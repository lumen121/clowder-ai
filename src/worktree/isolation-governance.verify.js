"use strict";

/**
 * T10 — Worktree 与任务隔离最小治理验证脚本
 *
 * 用法: node src/worktree/isolation-governance.verify.js
 *
 * 覆盖：
 *   - registerWorkspace（创建 / 必填校验 / 重复拒绝 / 自动路径推导 / base_ref）
 *   - updateWorkspaceStatus（状态更新 / 白名单控制 / 非法值拒绝）
 *   - 查询（按 task / branch / active / conflicting）
 *   - preMergeCheck（通过 / 未绑定 / 冲突 / 清理 / resolved）
 *   - 数据隔离（structuredClone 验证）
 *
 * 依赖：T3 persistence（内存模式，不落盘）。
 */

const path = require("path");
const fs = require("fs");
const os = require("os");

// ── 使用临时目录避免污染实际 data/ ────────────────────────────────
const TMP_DIR = path.join(os.tmpdir(), `t10-verify-${Date.now()}`);
fs.mkdirSync(TMP_DIR, { recursive: true });

const { createPersistence } = require("../storage");
const {
  WS_CLEANUP_STATUSES,
  registerWorkspace,
  updateWorkspaceStatus,
  getWorkspaceByTask,
  getWorkspaceByBranch,
  getActiveWorkspaces,
  getConflictingWorkspaces,
  preMergeCheck,
} = require("./isolation-governance");

// ═══════════════════════════════════════════════════════════════════════
// 测试工具
// ═══════════════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;

function check(label, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${label}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${label}`);
    console.log(`    ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

function assertThrow(fn, expectedMsg) {
  try {
    fn();
    throw new Error("Expected throw but none occurred");
  } catch (e) {
    if (expectedMsg && !e.message.includes(expectedMsg)) {
      throw new Error(`Expected message containing "${expectedMsg}", got "${e.message}"`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 准备
// ═══════════════════════════════════════════════════════════════════════

const persistence = createPersistence(TMP_DIR);

console.log("\n── registerWorkspace ──");

// 1.1 正常创建（完整字段）
let ws1;
check("创建完整字段的工作区记录", () => {
  ws1 = registerWorkspace(persistence, {
    task_id: "T10",
    agent: "Claude",
    branch: "claude/t10-worktree-isolation",
    worktree_path: "C:\\aiWorkspace\\clowder-ai-t10",
    base_ref: "origin/master",
    changed_files: ["src/storage/index.js"],
    merge_order: 1,
  });
  assert(ws1.id && ws1.id.startsWith("ws-"), "应生成 ws- 前缀 ID");
  assert(ws1.task_id === "T10", "task_id 应保留");
  assert(ws1.agent === "Claude", "agent 应保留");
  assert(ws1.branch === "claude/t10-worktree-isolation", "branch 应保留");
  assert(ws1.worktree_path === "C:\\aiWorkspace\\clowder-ai-t10", "worktree_path 应保留");
  assert(ws1.base_ref === "origin/master", "base_ref 应保留");
  assert(Array.isArray(ws1.changed_files) && ws1.changed_files[0] === "src/storage/index.js");
  assert(ws1.merge_order === 1, "merge_order 应为 1");
  assert(ws1.conflict_status === "clean", "默认 conflict_status 应为 clean");
  assert(ws1.cleanup_status === "active", "默认 cleanup_status 应为 active");
});

// 1.2 最小字段创建（验证必填和默认值）
check("最小字段创建（仅必填）", () => {
  const ws = registerWorkspace(persistence, {
    task_id: "T11",
    agent: "Codex",
    branch: "codex/t11-git-delivery",
  });
  assert(ws.task_id === "T11");
  assert(ws.agent === "Codex");
  assert(ws.branch === "codex/t11-git-delivery");
  assert(ws.conflict_status === "clean");
  assert(ws.cleanup_status === "active");
  assert(ws.base_ref === "", "base_ref 默认空字符串");
  assert(ws.changed_files.length === 0, "changed_files 默认空数组");
  assert(ws.merge_order === 0, "merge_order 默认 0");
});

// 1.3 worktree_path 自动推导（应在仓库父目录，而非仓库内部）
check("worktree_path 自动推导到仓库同级目录（非仓库内部）", () => {
  const ws = registerWorkspace(persistence, {
    task_id: "T8",
    agent: "Codex",
    branch: "codex/t8-harness",
  });
  // 推导路径应包含 clowder-ai-t8 且位于仓库父目录下
  // e.g. C:\aiWorkspace\clowder-ai-t8，而非 C:\aiWorkspace\...\...\clowder-ai-t8
  const p = ws.worktree_path;
  assert(p.includes("clowder-ai-t8"), `路径应含 clowder-ai-t8，实际: ${p}`);
  // 不应是仓库内部的子目录（即不应在 clowder-ai-t<N> 下再嵌套 clowder-ai-t<N>）
  const normalized = p.replace(/\\/g, "/");
  const matches = normalized.match(/clowder-ai-t\d+/g);
  assert(matches && matches.length === 1,
    `路径应恰好包含一个 clowder-ai-t<N>，实际: ${normalized}`);
});

// 1.4 base_ref 正确记录
check("base_ref 正确记录为 origin/master", () => {
  const ws = registerWorkspace(persistence, {
    task_id: "T13",
    agent: "MiniMax",
    branch: "minimax/t13-page-ui",
    base_ref: "origin/master",
  });
  assert(ws.base_ref === "origin/master");
});

// 1.5 同一 branch 重复绑定拒绝
check("同一 branch 重复绑定应拒绝", () => {
  assertThrow(
    () => registerWorkspace(persistence, {
      task_id: "T10-v2",
      agent: "Claude",
      branch: "claude/t10-worktree-isolation",
    }),
    "已存在活跃工作区绑定"
  );
});

// 1.6 无效 persistence 拒绝
check("无效 persistence 应拒绝", () => {
  assertThrow(() => registerWorkspace(null, { task_id: "T1", agent: "X", branch: "b" }), "有效的 persistence");
  assertThrow(() => registerWorkspace({}, { task_id: "T1", agent: "X", branch: "b" }), "有效的 persistence");
});

// 1.7 缺少必填字段（T3 层校验）
check("缺少必填字段 agent 应抛出", () => {
  assertThrow(
    () => registerWorkspace(persistence, { task_id: "T1", branch: "b" }),
    "agent"
  );
});

// ═══════════════════════════════════════════════════════════════════════
// 数据隔离验证
// ═══════════════════════════════════════════════════════════════════════

console.log("\n── 数据隔离 ──");

check("registerWorkspace 返回结构化克隆（非 Store 内部引用）", () => {
  const ws = registerWorkspace(persistence, {
    task_id: "T7",
    agent: "Codex",
    branch: "codex/t7-solution-breakdown",
  });
  // 修改返回值不应影响 Store
  ws.task_id = "MODIFIED";
  ws.conflict_status = "file_conflict";
  const stored = persistence.workspaceRecordStore.read(ws.id);
  assert(stored.task_id === "T7", "Store 中 task_id 不应被修改");
  assert(stored.conflict_status === "clean", "Store 中 conflict_status 不应被修改");
});

// ═══════════════════════════════════════════════════════════════════════
// updateWorkspaceStatus
// ═══════════════════════════════════════════════════════════════════════

console.log("\n── updateWorkspaceStatus ──");

// 2.1 更新 conflict_status
check("更新 conflict_status 为 file_conflict", () => {
  const updated = updateWorkspaceStatus(persistence, ws1.id, { conflict_status: "file_conflict" });
  assert(updated.conflict_status === "file_conflict");
  // 验证 Store 也更新了
  const stored = persistence.workspaceRecordStore.read(ws1.id);
  assert(stored.conflict_status === "file_conflict");
});

// 2.2 更新 conflict_status 为 resolved
check("更新 conflict_status 为 resolved", () => {
  const updated = updateWorkspaceStatus(persistence, ws1.id, { conflict_status: "resolved" });
  assert(updated.conflict_status === "resolved");
});

// 2.3 更新 cleanup_status
check("更新 cleanup_status 为 cleaned", () => {
  // 用一个新 workspace 测试
  const ws = registerWorkspace(persistence, {
    task_id: "T6",
    agent: "Claude",
    branch: "claude/t6-a2a-test",
  });
  const updated = updateWorkspaceStatus(persistence, ws.id, { cleanup_status: "cleaned" });
  assert(updated.cleanup_status === "cleaned");
});

// 2.4 更新 changed_files
check("更新 changed_files 列表", () => {
  const updated = updateWorkspaceStatus(persistence, ws1.id, {
    changed_files: ["src/storage/index.js", "src/worktree/isolation-governance.js"],
  });
  assert(updated.changed_files.length === 2);
  assert(updated.changed_files.includes("src/worktree/isolation-governance.js"));
});

// 2.5 更新 merge_order
check("更新 merge_order", () => {
  const updated = updateWorkspaceStatus(persistence, ws1.id, { merge_order: 5 });
  assert(updated.merge_order === 5);
});

// 2.6 无效 conflict_status 拒绝
check("无效 conflict_status 应拒绝", () => {
  assertThrow(
    () => updateWorkspaceStatus(persistence, ws1.id, { conflict_status: "invalid_status" }),
    "无效的冲突状态"
  );
});

// 2.7 无效 cleanup_status 拒绝
check("无效 cleanup_status 应拒绝", () => {
  assertThrow(
    () => updateWorkspaceStatus(persistence, ws1.id, { cleanup_status: "deleted" }),
    "无效的清理状态"
  );
});

// 2.8 白名单：绑定字段不可通过 update 修改
check("绑定字段 agent 不可通过 updateWorkspaceStatus 修改", () => {
  const updated = updateWorkspaceStatus(persistence, ws1.id, {
    agent: "Hacker",
    conflict_status: "clean",
  });
  assert(updated.agent === "Claude", "agent 应保持 Claude 不变");
  assert(updated.conflict_status === "clean", "但合法字段应被更新");
});

// 2.9 白名单：branch 不可通过 update 修改
check("绑定字段 branch 不可通过 updateWorkspaceStatus 修改", () => {
  const updated = updateWorkspaceStatus(persistence, ws1.id, { branch: "hacker-branch" });
  assert(updated.branch === "claude/t10-worktree-isolation");
});

// 2.10 白名单：task_id 不可通过 update 修改
check("绑定字段 task_id 不可通过 updateWorkspaceStatus 修改", () => {
  const updated = updateWorkspaceStatus(persistence, ws1.id, { task_id: "T99" });
  assert(updated.task_id === "T10");
});

// 2.11 不存在的 workspace ID
check("更新不存在的 workspace ID 应抛出", () => {
  assertThrow(
    () => updateWorkspaceStatus(persistence, "ws-nonexistent", { conflict_status: "clean" }),
    "未找到"
  );
});

// 2.12 空更新 — no-op 但仍返回克隆
check("空更新返回克隆记录", () => {
  const current = persistence.workspaceRecordStore.read(ws1.id);
  const result = updateWorkspaceStatus(persistence, ws1.id, {});
  assert(result.id === current.id);
  // 修改返回值不影响 Store
  result.conflict_status = "file_conflict";
  const stored = persistence.workspaceRecordStore.read(ws1.id);
  assert(stored.conflict_status !== "file_conflict");
});

// ═══════════════════════════════════════════════════════════════════════
// 查询
// ═══════════════════════════════════════════════════════════════════════

console.log("\n── getWorkspaceByTask ──");

check("按 task_id 查找返回匹配记录", () => {
  const results = getWorkspaceByTask(persistence, "T10");
  assert(results.length > 0, "应至少找到一条 T10 记录");
  assert(results.every((r) => r.task_id === "T10"), "所有结果应匹配 T10");
});

check("按不存在 task_id 查找返回空数组", () => {
  const results = getWorkspaceByTask(persistence, "T99");
  assert(Array.isArray(results) && results.length === 0);
});

check("无效 persistence 拒绝（getWorkspaceByTask）", () => {
  assertThrow(() => getWorkspaceByTask(null, "T10"), "有效的 persistence");
});

console.log("\n── getWorkspaceByBranch ──");

check("按 branch 查找返回匹配记录", () => {
  const ws = getWorkspaceByBranch(persistence, "claude/t10-worktree-isolation");
  assert(ws !== null, "应找到记录");
  assert(ws.branch === "claude/t10-worktree-isolation");
});

check("按不存在 branch 查找返回 null", () => {
  const ws = getWorkspaceByBranch(persistence, "nonexistent/branch");
  assert(ws === null);
});

check("无效 persistence 拒绝（getWorkspaceByBranch）", () => {
  assertThrow(() => getWorkspaceByBranch(null, "b"), "有效的 persistence");
});

// P1 修复验证：branch 归档后重新绑定，查询应返回活跃记录
check("branch 归档后重新绑定 → getWorkspaceByBranch 返回活跃记录", () => {
  const branchReuse = "codex/t12-reusable-branch";
  // 第一条绑定：创建后归档
  const first = registerWorkspace(persistence, {
    task_id: "T12",
    agent: "Codex",
    branch: branchReuse,
  });
  updateWorkspaceStatus(persistence, first.id, { cleanup_status: "archived" });
  // 第二条绑定：同一 branch 重新登记（活跃）
  const second = registerWorkspace(persistence, {
    task_id: "T12-v2",
    agent: "Codex",
    branch: branchReuse,
  });
  // 查询应返回正在活跃的第二条，而非历史归档的第一条
  const found = getWorkspaceByBranch(persistence, branchReuse);
  assert(found !== null, "应找到记录");
  assert(found.id === second.id, `应返回活跃记录 ${second.id}，而非归档记录 ${first.id}`);
  assert(found.cleanup_status === "active", "应为 active 状态");
  assert(found.task_id === "T12-v2", "应为重新绑定后的任务");
});

console.log("\n── getActiveWorkspaces ──");

check("getActiveWorkspaces 返回仅 active 记录", () => {
  const active = getActiveWorkspaces(persistence);
  assert(active.length > 0, "应至少有一条 active 记录");
  assert(active.every((r) => r.cleanup_status === "active"), "所有结果应为 active");
});

check("getActiveWorkspaces 不包含 cleaned 记录", () => {
  const active = getActiveWorkspaces(persistence);
  const hasCleaned = active.some((r) => r.cleanup_status === "cleaned");
  assert(!hasCleaned, "不应包含 cleaned 记录");
});

console.log("\n── getConflictingWorkspaces ──");

// 先让一条记录有冲突
let conflictWs;
check("准备：创建有冲突的工作区", () => {
  conflictWs = registerWorkspace(persistence, {
    task_id: "T5-conflict",
    agent: "Claude",
    branch: "claude/t5-with-conflict",
    conflict_status: "file_conflict",
  });
  assert(conflictWs.conflict_status === "file_conflict");
});

check("getConflictingWorkspaces 返回仅冲突记录", () => {
  const conflicts = getConflictingWorkspaces(persistence);
  assert(conflicts.length > 0, "应至少有一条冲突记录");
  assert(conflicts.every((r) => r.conflict_status !== "clean"), "所有结果应非 clean");
});

check("getConflictingWorkspaces 不包含 clean 记录", () => {
  const conflicts = getConflictingWorkspaces(persistence);
  // ws1 现在 conflict_status 是 clean（我们在 update 测试中已改回）
  const hasWs1 = conflicts.some((r) => r.id === ws1.id);
  assert(!hasWs1, "clean 记录不应出现在冲突列表");
});

// ═══════════════════════════════════════════════════════════════════════
// preMergeCheck
// ═══════════════════════════════════════════════════════════════════════

console.log("\n── preMergeCheck ──");

// 先确保 ws1 状态是干净的
updateWorkspaceStatus(persistence, ws1.id, {
  conflict_status: "clean",
  cleanup_status: "active",
});

// 3.1 通过：clean + active
check("clean + active → 合并前检查通过", () => {
  const result = preMergeCheck(persistence, "claude/t10-worktree-isolation");
  assert(result.pass === true, "应通过");
  assert(result.reasons.length === 0, "应无失败原因");
  assert(result.workspace !== null, "应返回关联 workspace");
});

// 3.2 通过：resolved + active
check("resolved + active → 合并前检查通过", () => {
  updateWorkspaceStatus(persistence, ws1.id, { conflict_status: "resolved" });
  const result = preMergeCheck(persistence, "claude/t10-worktree-isolation");
  assert(result.pass === true);
  // 恢复 clean
  updateWorkspaceStatus(persistence, ws1.id, { conflict_status: "clean" });
});

// 3.3 失败：未绑定
check("无绑定记录 → 失败 + 原因包含'未找到'", () => {
  const result = preMergeCheck(persistence, "no-binding-branch");
  assert(result.pass === false);
  assert(result.workspace === null);
  assert(result.reasons.length > 0 && result.reasons[0].includes("未找到"),
    `原因应包含'未找到'，实际: ${result.reasons.join("; ")}`);
});

// 3.4 失败：冲突未解决
check("file_conflict + active → 失败", () => {
  const result = preMergeCheck(persistence, "claude/t5-with-conflict");
  assert(result.pass === false);
  assert(result.reasons.some((r) => r.includes("file_conflict")),
    `原因应包含 file_conflict，实际: ${result.reasons.join("; ")}`);
});

// 3.5 失败：semantic_conflict_risk
check("semantic_conflict_risk + active → 失败", () => {
  updateWorkspaceStatus(persistence, conflictWs.id, { conflict_status: "semantic_conflict_risk" });
  const result = preMergeCheck(persistence, "claude/t5-with-conflict");
  assert(result.pass === false);
  assert(result.reasons.some((r) => r.includes("semantic_conflict_risk")));
});

// 3.6 失败：cleanup_status 非 active
check("cleaned 状态 → 失败", () => {
  const result = preMergeCheck(persistence, "claude/t6-a2a-test");
  assert(result.pass === false);
  assert(result.reasons.some((r) => r.includes("cleaned")),
    `原因应包含 cleaned，实际: ${result.reasons.join("; ")}`);
});

// 3.7 无效 persistence
check("无效 persistence → fail + reasons", () => {
  const result = preMergeCheck(null, "some-branch");
  assert(result.pass === false);
  assert(result.workspace === null);
  assert(result.reasons.length > 0);
});

// 3.8 空 branch
check("空 branch → fail + reasons", () => {
  const result = preMergeCheck(persistence, "");
  assert(result.pass === false);
  assert(result.reasons.length > 0);
});

// P1 修复验证：branch 归档后重建，preMergeCheck 应命中新记录并通过
check("branch 归档后重新绑定 → preMergeCheck 通过", () => {
  const reuseBranch = "codex/t14-reuse-for-merge";
  // 创建 → 归档
  const oldWs = registerWorkspace(persistence, {
    task_id: "T14",
    agent: "Claude",
    branch: reuseBranch,
  });
  updateWorkspaceStatus(persistence, oldWs.id, { cleanup_status: "archived" });
  // 同一 branch 重新绑定（冲突状态 clean）
  registerWorkspace(persistence, {
    task_id: "T14-v2",
    agent: "Claude",
    branch: reuseBranch,
    conflict_status: "clean",
  });
  const result = preMergeCheck(persistence, reuseBranch);
  assert(result.pass === true,
    `应通过，实际: pass=${result.pass}, reasons=${result.reasons.join("; ")}`);
  assert(result.workspace !== null);
  assert(result.workspace.cleanup_status === "active");
  assert(result.workspace.task_id === "T14-v2", "应命中重新绑定后的记录");
});

// ═══════════════════════════════════════════════════════════════════════
// 边界与常量
// ═══════════════════════════════════════════════════════════════════════

console.log("\n── 常量与边界 ──");

check("WS_CLEANUP_STATUSES 包含 active/cleaned/archived", () => {
  assert(WS_CLEANUP_STATUSES.includes("active"));
  assert(WS_CLEANUP_STATUSES.includes("cleaned"));
  assert(WS_CLEANUP_STATUSES.includes("archived"));
  assert(WS_CLEANUP_STATUSES.length === 3);
});

check("WS_CLEANUP_STATUSES 已冻结", () => {
  try { WS_CLEANUP_STATUSES.push("deleted"); } catch (e) { /* expected */ }
  assert(WS_CLEANUP_STATUSES.length === 3);
});

check("同一 task 可有多条 workspace 记录（历史 + 当前）", () => {
  const ws1 = registerWorkspace(persistence, {
    task_id: "T12",
    agent: "Codex",
    branch: "codex/t12-first",
  });
  updateWorkspaceStatus(persistence, ws1.id, { cleanup_status: "archived" });
  registerWorkspace(persistence, {
    task_id: "T12",
    agent: "Codex",
    branch: "codex/t12-second",
  });
  const all = getWorkspaceByTask(persistence, "T12");
  assert(all.length >= 2, `同一 task 应有 ≥2 条记录，实际: ${all.length}`);
});

// ═══════════════════════════════════════════════════════════════════════
// 清理临时目录
// ═══════════════════════════════════════════════════════════════════════

try {
  fs.rmSync(TMP_DIR, { recursive: true });
} catch {
  // 忽略清理失败（不影响测试结果）
}

// ═══════════════════════════════════════════════════════════════════════
// 结果
// ═══════════════════════════════════════════════════════════════════════

const total = passed + failed;
console.log(`\n${"=".repeat(40)}`);
console.log(`通过 ${passed} / ${total}`);
if (failed > 0) {
  console.log(`失败 ${failed}`);
  process.exit(1);
} else {
  console.log("全部通过 ✓");
}
