"use strict";

/**
 * T10 — Worktree 与任务隔离最小治理
 *
 * 本模块在 T3 WorkspaceRecord 之上提供任务到 branch/worktree 的绑定登记、
 * 冲突状态管理、查询和合并前最小检查。
 *
 * 设计约束：
 *   - 不实现完整自动合并（属 T11）。
 *   - 不实现 Git 操作（属 T11）。
 *   - 不做 Harness 护栏决策（属 T8）。
 *   - 每个 branch 至多一个活跃绑定（一对一）。
 *
 * 依赖：
 *   - T3 persistence（WorkspaceRecord Store + 工厂）。
 *   - T3 WS_CONFLICT_STATUSES / WS_CLEANUP_STATUSES 常量。
 */

const path = require("path");

// ═══════════════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════════════

/**
 * 工作区清理状态枚举。
 * 当前 T3 schema 已隐含 active 但未显式枚举；T10 补充完整枚举用于校验。
 */
const WS_CLEANUP_STATUSES = Object.freeze([
  "active",
  "cleaned",
  "archived",
]);

/**
 * 允许通过 updateWorkspaceStatus 更新的字段白名单。
 * 绑定身份字段（agent / task_id / branch / worktree_path / base_ref）不可通过此路径修改，
 * 以保证隔离记录的可追溯性。
 */
const UPDATE_ALLOWED_FIELDS = Object.freeze([
  "changed_files",
  "merge_order",
  "conflict_status",
  "cleanup_status",
]);

// ═══════════════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════════════

/**
 * 在 persistence 的 workspaceRecordStore 上按条件查找第一条匹配记录。
 * 返回记录副本（structuredClone 隔离），避免调用方意外修改 Store 缓存。
 *
 * @param {object} store - workspaceRecordStore
 * @param {function} predicate - (record) => boolean
 * @returns {object|null}
 */
function findOne(store, predicate) {
  const all = store.list();
  const found = all.find(predicate);
  return found ? structuredClone(found) : null;
}

/**
 * 按条件查找所有匹配记录（均做结构化克隆）。
 *
 * @param {object} store - workspaceRecordStore
 * @param {function} predicate - (record) => boolean
 * @returns {object[]}
 */
function findAll(store, predicate) {
  return store.list().filter(predicate).map((r) => structuredClone(r));
}

// ═══════════════════════════════════════════════════════════════════════
// 核心 API
// ═══════════════════════════════════════════════════════════════════════

/**
 * 登记任务隔离工作区，创建 task→branch/worktree 绑定记录。
 *
 * 规则：
 *   - task_id、agent、branch 为必填（由 T3 WORKSPACE_REQUIRED 约束）。
 *   - 同一 branch 不得重复绑定（已存在活跃记录时拒绝）。
 *   - worktree_path 未提供时，按约定自动推导为 `<repo>/../clowder-ai-<task>`。
 *
 * @param {object} persistence - T3 createPersistence 返回值
 * @param {object} input
 * @param {string} input.task_id    - 任务 ID（如 "T10"）
 * @param {string} input.agent      - 执行 Agent 标识
 * @param {string} input.branch     - Git 分支名
 * @param {string} [input.worktree_path] - worktree 路径（可选，支持自动推导）
 * @param {string} [input.base_ref] - 分支基线引用
 * @param {string[]} [input.changed_files] - 预填变更文件列表
 * @param {number} [input.merge_order] - 合并顺序编号
 * @returns {object} 创建的 WorkspaceRecord（结构化克隆）
 */
function registerWorkspace(persistence, input = {}) {
  if (!persistence || !persistence.workspaceRecordStore) {
    throw new Error("registerWorkspace 需要有效的 persistence 实例");
  }
  if (!input || typeof input !== "object") {
    throw new Error("registerWorkspace 需要有效的 input 对象");
  }

  const store = persistence.workspaceRecordStore;

  // 检查同一 branch 是否已有活跃绑定
  const existing = findOne(store, (r) =>
    r.branch === input.branch && r.cleanup_status === "active"
  );
  if (existing) {
    throw new Error(
      `分支 "${input.branch}" 已存在活跃工作区绑定 (${existing.id})。` +
      `请先将已有绑定标记为 cleaned 或 archived 后再重新登记。`
    );
  }

  // 自动推导 worktree_path（遵循已建立的 worktree 路径约定）
  // __dirname = <repo>/src/worktree/ → 3 层 dirname 到达仓库父目录
  // 例如: C:\aiWorkspace\clowder-ai-t10\src\worktree → C:\aiWorkspace
  // 结果: C:\aiWorkspace\clowder-ai-<task>
  const worktree_path = input.worktree_path ||
    path.resolve(
      path.dirname(path.dirname(path.dirname(__dirname))),
      `clowder-ai-${String(input.task_id || "").toLowerCase().replace(/\s+/g, "-")}`
    );

  const record = persistence.createWorkspaceRecord({
    task_id: input.task_id || "",
    agent: input.agent || "",
    branch: input.branch || "",
    worktree_path,
    base_ref: input.base_ref || "",
    changed_files: Array.isArray(input.changed_files) ? [...input.changed_files] : [],
    merge_order: typeof input.merge_order === "number" ? input.merge_order : 0,
    conflict_status: input.conflict_status || "clean",
    cleanup_status: input.cleanup_status || "active",
  });

  return structuredClone(record);
}

/**
 * 更新工作区状态字段（冲突状态、清理状态、变更文件列表、合并顺序）。
 *
 * 白名单控制：仅允许更新 changed_files / merge_order / conflict_status / cleanup_status。
 * 绑定身份字段（agent / task_id / branch / worktree_path / base_ref）不允许通过此路径修改，
 * 以保证隔离记录可追溯。
 *
 * @param {object} persistence - T3 createPersistence 返回值
 * @param {string} wsId - WorkspaceRecord ID
 * @param {object} updates - 待更新字段
 * @param {string} [updates.conflict_status]
 * @param {string} [updates.cleanup_status]
 * @param {string[]} [updates.changed_files]
 * @param {number} [updates.merge_order]
 * @returns {object} 更新后的 WorkspaceRecord（结构化克隆）
 */
function updateWorkspaceStatus(persistence, wsId, updates = {}) {
  if (!persistence || !persistence.workspaceRecordStore) {
    throw new Error("updateWorkspaceStatus 需要有效的 persistence 实例");
  }
  if (!wsId || typeof wsId !== "string") {
    throw new Error("updateWorkspaceStatus 需要有效的 workspace ID");
  }

  const store = persistence.workspaceRecordStore;
  const existing = store.read(wsId);
  if (!existing) {
    throw new Error(`WorkspaceRecord "${wsId}" 未找到`);
  }

  // 白名单过滤：仅允许更新安全字段
  const patch = {};
  for (const key of Object.keys(updates)) {
    if (UPDATE_ALLOWED_FIELDS.includes(key)) {
      patch[key] = updates[key];
    }
  }

  // 校验 conflict_status（如果提供）
  if (patch.conflict_status !== undefined) {
    const WS_CONFLICT_STATUSES = ["clean", "file_conflict", "semantic_conflict_risk", "resolved"];
    if (!WS_CONFLICT_STATUSES.includes(patch.conflict_status)) {
      throw new Error(
        `无效的冲突状态: "${patch.conflict_status}"，` +
        `仅支持: ${WS_CONFLICT_STATUSES.join(", ")}`
      );
    }
  }

  // 校验 cleanup_status（如果提供）
  if (patch.cleanup_status !== undefined) {
    if (!WS_CLEANUP_STATUSES.includes(patch.cleanup_status)) {
      throw new Error(
        `无效的清理状态: "${patch.cleanup_status}"，` +
        `仅支持: ${WS_CLEANUP_STATUSES.join(", ")}`
      );
    }
  }

  // changed_files 以数组形式整体替换（如果提供）
  if (Array.isArray(patch.changed_files)) {
    patch.changed_files = [...patch.changed_files];
  }

  if (Object.keys(patch).length === 0) {
    return structuredClone(existing);
  }

  store.update(wsId, patch);
  return structuredClone(store.read(wsId));
}

/**
 * 按任务 ID 查找所有关联的工作区记录。
 *
 * @param {object} persistence
 * @param {string} taskId
 * @returns {object[]} WorkspaceRecord 数组（结构化克隆）
 */
function getWorkspaceByTask(persistence, taskId) {
  if (!persistence || !persistence.workspaceRecordStore) {
    throw new Error("getWorkspaceByTask 需要有效的 persistence 实例");
  }
  return findAll(persistence.workspaceRecordStore, (r) => r.task_id === taskId);
}

/**
 * 按分支名查找工作区记录（branch 一对一，返回单条或 null）。
 *
 * 查询策略：优先返回 cleanup_status === "active" 的记录；
 * 若无活跃记录，则返回该 branch 下最新一条记录（按 created_at 降序）；
 * 无任何记录时返回 null。
 *
 * 此策略确保 branch 在归档后重新绑定时，查询命中当前活跃绑定而非历史归档记录。
 *
 * @param {object} persistence
 * @param {string} branch
 * @returns {object|null} WorkspaceRecord（结构化克隆）或 null
 */
function getWorkspaceByBranch(persistence, branch) {
  if (!persistence || !persistence.workspaceRecordStore) {
    throw new Error("getWorkspaceByBranch 需要有效的 persistence 实例");
  }
  const store = persistence.workspaceRecordStore;
  const active = findOne(store, (r) => r.branch === branch && r.cleanup_status === "active");
  if (active) return active;
  // 无活跃记录时，返回最新一条（按 created_at 降序），供历史查询
  const all = findAll(store, (r) => r.branch === branch);
  if (all.length === 0) return null;
  all.sort((a, b) =>
    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );
  return all[0];
}

/**
 * 获取所有活跃（cleanup_status === "active"）的工作区记录。
 *
 * @param {object} persistence
 * @returns {object[]}
 */
function getActiveWorkspaces(persistence) {
  if (!persistence || !persistence.workspaceRecordStore) {
    throw new Error("getActiveWorkspaces 需要有效的 persistence 实例");
  }
  return findAll(
    persistence.workspaceRecordStore,
    (r) => r.cleanup_status === "active"
  );
}

/**
 * 获取所有存在冲突（conflict_status !== "clean"）的工作区记录。
 *
 * @param {object} persistence
 * @returns {object[]}
 */
function getConflictingWorkspaces(persistence) {
  if (!persistence || !persistence.workspaceRecordStore) {
    throw new Error("getConflictingWorkspaces 需要有效的 persistence 实例");
  }
  return findAll(
    persistence.workspaceRecordStore,
    (r) => r.conflict_status !== "clean"
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 合并前最小检查
// ═══════════════════════════════════════════════════════════════════════

/**
 * 合并前最小检查：验证指定分支的隔离工作区绑定和冲突状态。
 *
 * 检查项（按顺序，首个失败即返回）：
 *   1. 该分支是否存在 WorkspaceRecord 绑定。
 *   2. cleanup_status 必须为 "active"（已清理/归档的工作区不应合并）。
 *   3. conflict_status 必须为 "clean" 或 "resolved"。
 *
 * 本函数不执行合并操作，也不决定"是否允许合并"——后者属于 T8/T11 职责。
 *
 * @param {object} persistence
 * @param {string} branch - 待检查的分支名
 * @returns {{ pass: boolean, reasons: string[], workspace: object|null }}
 *         pass=false 时 reasons 包含失败原因；workspace 为关联记录或 null。
 */
function preMergeCheck(persistence, branch) {
  if (!persistence || !persistence.workspaceRecordStore) {
    return {
      pass: false,
      reasons: ["preMergeCheck 需要有效的 persistence 实例"],
      workspace: null,
    };
  }
  if (!branch || typeof branch !== "string") {
    return {
      pass: false,
      reasons: ["preMergeCheck 需要有效的 branch 参数"],
      workspace: null,
    };
  }

  const reasons = [];
  const workspace = getWorkspaceByBranch(persistence, branch);

  // 检查 1：绑定存在性
  if (!workspace) {
    reasons.push(`未找到分支 "${branch}" 的隔离工作区绑定记录`);
    return { pass: false, reasons, workspace: null };
  }

  // 检查 2：清理状态
  if (workspace.cleanup_status !== "active") {
    reasons.push(
      `工作区清理状态为 "${workspace.cleanup_status}"，` +
      `仅有 "active" 状态允许合并前检查通过`
    );
  }

  // 检查 3：冲突状态
  if (workspace.conflict_status !== "clean" && workspace.conflict_status !== "resolved") {
    reasons.push(
      `冲突状态为 "${workspace.conflict_status}"，` +
      `需要 "clean" 或 "resolved" 才能通过合并前检查`
    );
  }

  return {
    pass: reasons.length === 0,
    reasons,
    workspace,
  };
}

// ═══════════════════════════════════════════════════════════════════════

module.exports = {
  // 常量
  WS_CLEANUP_STATUSES,
  UPDATE_ALLOWED_FIELDS,

  // 核心 API
  registerWorkspace,
  updateWorkspaceStatus,
  getWorkspaceByTask,
  getWorkspaceByBranch,
  getActiveWorkspaces,
  getConflictingWorkspaces,

  // 合并前检查
  preMergeCheck,
};
