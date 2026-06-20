"use strict";

/**
 * src/review-quality/index.js — Review 与质量门禁记录管理模块（T9）
 *
 * 职责：
 *   - 在 T3 Store 之上提供 ReviewRecord 的创建、更新、查询和摘要。
 *   - 在 T3 Store 之上提供 QualityGateRun 的创建、更新、失败记录、查询和摘要。
 *   - 确保 Review 结论只落入四类枚举；失败门禁必须可查询失败原因和下一步。
 *
 * 本模块是 T3 的消费者，T8 Harness 护栏的协作模块。
 * 不实现 Harness 决策逻辑（属 T8）、不实现 Git 交付（属 T11）、
 * 不实现页面渲染（属 T13）、不实现复盘记录（属 T14）。
 *
 * 用法：
 *   const { createPersistence } = require("../storage");
 *   const p = createPersistence("data");
 *   const review = createReview(p, { work_item_id: "wi-xxx", ... });
 *   const summary = summarizeReviews(p, "wi-xxx");
 */

const {
  REVIEW_RESULTS,
  QG_FINAL_STATUSES,
} = require("../storage");

// ═══════════════════════════════════════════════════════════════════════
// 校验工具
// ═══════════════════════════════════════════════════════════════════════

/**
 * 校验 Review 结果是否为合法枚举值。
 * 四个合法结论：
 *   - "approved"                  通过
 *   - "changes_requested"         需要修改
 *   - "disputed"                  存在争议
 *   - "user_confirmation_required" 需用户确认
 */
function validateReviewResult(result) {
  if (!result || !REVIEW_RESULTS.includes(result)) {
    return {
      valid: false,
      error: `无效的 Review 结果: "${result}"，仅支持: ${REVIEW_RESULTS.join(", ")}`,
    };
  }
  return { valid: true };
}

/**
 * 校验质量门禁 final_status 是否为合法枚举值。
 * 四个合法状态：
 *   - "passed"          通过
 *   - "failed"          失败
 *   - "blocked"         阻塞
 *   - "user_confirmed"  用户确认
 */
function validateFinalStatus(status) {
  if (!status || !QG_FINAL_STATUSES.includes(status)) {
    return {
      valid: false,
      error: `无效的质量门禁最终状态: "${status}"，仅支持: ${QG_FINAL_STATUSES.join(", ")}`,
    };
  }
  return { valid: true };
}

/**
 * 校验 author 和 reviewer 不能相同（自审拦截）。
 */
function validateNoSelfReview(authorAgent, reviewerAgent) {
  if (authorAgent && reviewerAgent && authorAgent === reviewerAgent) {
    return {
      valid: false,
      error: `作者不能自审: author_agent 和 reviewer_agent 不能相同 ("${authorAgent}")`,
    };
  }
  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════════════
// Review 管理
// ═══════════════════════════════════════════════════════════════════════

/**
 * 创建 Review 记录（T3 工厂的薄封装）。
 *
 * 必填：work_item_id、author_agent、reviewer_agent。
 * result 默认为 "approved"，可选传入 findings、required_fixes、scope、task_id。
 *
 * Review 结论在创建时即受枚举约束（T3 createReviewRecord 已执行此校验）。
 * 自审在创建时被拒绝。
 *
 * @param {object} persistence - T3 createPersistence() 返回值
 * @param {object} input - Review 参数
 * @returns {object} 创建的 ReviewRecord（深拷贝）
 */
function createReview(persistence, input = {}) {
  return persistence.createReviewRecord(input);
}

/**
 * 更新 Review 记录。
 *
 * 允许更新的字段：findings、required_fixes、result、resolved、scope。
 * result 变更必须仍为合法枚举值。
 * 不允许变更 work_item_id / task_id / author_agent / reviewer_agent。
 *
 * @param {object} persistence - T3 持久化实例
 * @param {string} id - Review 记录 ID
 * @param {object} patch - 要更新的字段
 * @returns {object} 更新后的记录
 */
function updateReview(persistence, id, patch = {}) {
  const existing = persistence.reviewRecordStore.read(id);
  if (!existing) {
    throw new Error(`Review 记录不存在: ${id}`);
  }

  // 枚举校验：result 变更时必须为合法值
  if (patch.result !== undefined) {
    const check = validateReviewResult(patch.result);
    if (!check.valid) throw new Error(check.error);
  }

  // 自审校验：不允许通过 patch 把记录改成自审
  const author = patch.author_agent || existing.author_agent;
  const reviewer = patch.reviewer_agent || existing.reviewer_agent;
  const selfCheck = validateNoSelfReview(author, reviewer);
  if (!selfCheck.valid) throw new Error(selfCheck.error);

  // 过滤不可变字段：work_item_id、task_id、author_agent、reviewer_agent
  // 不允许通过 patch 修改绑定身份
  const safePatch = {};
  const allowedFields = ["findings", "required_fixes", "result", "resolved", "scope"];
  for (const key of allowedFields) {
    if (patch[key] !== undefined) {
      safePatch[key] = patch[key];
    }
  }

  if (Object.keys(safePatch).length === 0) {
    return existing;
  }

  return persistence.reviewRecordStore.update(id, safePatch);
}

/**
 * 将 Review 记录标记为已解决。
 *
 * 设置 resolved = true 并清空 required_fixes。
 * 通常在作者完成修改后调用。
 *
 * @param {object} persistence - T3 持久化实例
 * @param {string} id - Review 记录 ID
 * @returns {object} 更新后的记录
 */
function resolveReview(persistence, id) {
  const existing = persistence.reviewRecordStore.read(id);
  if (!existing) {
    throw new Error(`Review 记录不存在: ${id}`);
  }

  return persistence.reviewRecordStore.update(id, {
    resolved: true,
    required_fixes: [],
  });
}

/**
 * 按条件查询 Review 记录。
 *
 * 所有筛选条件均为可选，多条件取 AND 交集。
 *
 * @param {object} persistence - T3 持久化实例
 * @param {object} [filters] - 筛选条件
 * @param {string} [filters.work_item_id] - 按工作项筛选
 * @param {string} [filters.task_id] - 按任务筛选
 * @param {string} [filters.author_agent] - 按作者筛选
 * @param {string} [filters.reviewer_agent] - 按 Review 方筛选
 * @param {string} [filters.result] - 按 Review 结果筛选
 * @param {boolean} [filters.resolved] - 按是否已解决筛选
 * @returns {object[]} ReviewRecord 数组（深拷贝）
 */
function queryReviews(persistence, filters = {}) {
  const hasFilter = Object.values(filters).some((v) => v !== undefined && v !== null);
  if (!hasFilter) {
    return persistence.reviewRecordStore.list();
  }

  return persistence.reviewRecordStore.list((record) => {
    if (filters.work_item_id !== undefined && record.work_item_id !== filters.work_item_id) {
      return false;
    }
    if (filters.task_id !== undefined) {
      // task_id 为 null 的记录不匹配具体 task_id 查询（与 T8 的宽松等不同：
      // 查询是精确筛选，宽松匹配是护栏决策逻辑，属于 T8）
      if (record.task_id !== filters.task_id) return false;
    }
    if (filters.author_agent !== undefined && record.author_agent !== filters.author_agent) {
      return false;
    }
    if (filters.reviewer_agent !== undefined && record.reviewer_agent !== filters.reviewer_agent) {
      return false;
    }
    if (filters.result !== undefined && record.result !== filters.result) {
      return false;
    }
    if (filters.resolved !== undefined && record.resolved !== filters.resolved) {
      return false;
    }
    return true;
  });
}

/**
 * 生成工作项的 Review 摘要。
 *
 * 摘要包含各类结论计数、未解决数（所有 resolved=false 的非 approved Review）
 * 和最近一次 Review，供 T11/T13/T14/T16 消费。
 *
 * @param {object} persistence - T3 持久化实例
 * @param {string} workItemId - 工作项 ID
 * @returns {object} Review 摘要
 */
function summarizeReviews(persistence, workItemId) {
  const reviews = queryReviews(persistence, { work_item_id: workItemId });

  if (reviews.length === 0) {
    return {
      work_item_id: workItemId,
      total: 0,
      approved: 0,
      changes_requested: 0,
      disputed: 0,
      user_confirmation_required: 0,
      unresolved: 0,
      latest: null,
      by_reviewer: {},
    };
  }

  const counts = { approved: 0, changes_requested: 0, disputed: 0, user_confirmation_required: 0 };
  let unresolved = 0;
  const byReviewer = {};

  for (const r of reviews) {
    counts[r.result] = (counts[r.result] || 0) + 1;
    // 统计所有未解决的非通过 Review（changes_requested / disputed / user_confirmation_required），
    // 而不仅限于 changes_requested。approved 即使 resolved=false 也不算未解决。
    if (!r.resolved && r.result !== "approved") {
      unresolved++;
    }
    byReviewer[r.reviewer_agent] = (byReviewer[r.reviewer_agent] || 0) + 1;
  }

  // 最近一次 Review（按 updated_at 降序）
  const sorted = [...reviews].sort(
    (a, b) => new Date(b.updated_at || b.created_at).getTime() -
             new Date(a.updated_at || a.created_at).getTime()
  );
  const latest = sorted[0];
  const latestUnresolved = reviews.filter((r) => !r.resolved)
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() -
                 new Date(a.updated_at || a.created_at).getTime())[0] || null;

  return {
    work_item_id: workItemId,
    total: reviews.length,
    ...counts,
    unresolved,
    latest: {
      id: latest.id,
      reviewer_agent: latest.reviewer_agent,
      result: latest.result,
      resolved: latest.resolved,
      at: latest.updated_at || latest.created_at,
    },
    latest_unresolved: latestUnresolved ? {
      id: latestUnresolved.id,
      result: latestUnresolved.result,
      required_fixes_count: Array.isArray(latestUnresolved.required_fixes)
        ? latestUnresolved.required_fixes.length : 0,
      at: latestUnresolved.updated_at || latestUnresolved.created_at,
    } : null,
    by_reviewer: byReviewer,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 质量门禁管理
// ═══════════════════════════════════════════════════════════════════════

/**
 * 创建质量门禁运行记录。
 *
 * 必填：work_item_id、gate_name。
 *
 * 门禁不可静默通过：当 final_status 为 "passed"（默认）时，
 * 必须提供 validation_method 和 result 作为可审计证据。
 * 空门禁记录（无真实执行结果）不得被 T8 放行。
 *
 * @param {object} persistence - T3 createPersistence() 返回值
 * @param {object} input - 质量门禁参数
 * @returns {object} 创建的 QualityGateRun（深拷贝）
 */
function createQualityGate(persistence, input = {}) {
  // T3 默认 final_status="passed"，但空门禁记录不得被静默放行。
  // 当门禁状态为 passed 时，要求 validation_method 和 result 非空，
  // 确保有可审计证据证明门禁确实执行并通过。
  //
  // 仅当必填字段已提供时才做 P1 证据校验；必填字段缺失时交由 T3 报错，
  // 避免掩盖 T3 的 "缺少必填字段" 错误信息。
  const hasRequired = input.work_item_id && input.gate_name;
  const finalStatus = input.final_status || "passed";

  if (hasRequired && finalStatus === "passed") {
    const missing = [];
    if (!input.validation_method || typeof input.validation_method !== "string" || !input.validation_method.trim()) {
      missing.push("validation_method");
    }
    if (!input.result || typeof input.result !== "string" || !input.result.trim()) {
      missing.push("result");
    }
    if (missing.length > 0) {
      throw new Error(
        `createQualityGate: 门禁不能静默通过。final_status=passed 时必须提供: ${missing.join(", ")}。`
      );
    }
  }

  return persistence.createQualityGateRun(input);
}

/**
 * 更新质量门禁记录。
 *
 * 允许更新的字段：gate_name、validation_method、result、failure_reason、
 *   safe_fix_attempted、final_status、failed_command、failure_summary、
 *   impact_scope、next_actions。
 *
 * final_status 变更必须仍为合法枚举值。
 *
 * @param {object} persistence - T3 持久化实例
 * @param {string} id - 门禁记录 ID
 * @param {object} patch - 要更新的字段
 * @returns {object} 更新后的记录
 */
function updateQualityGate(persistence, id, patch = {}) {
  const existing = persistence.qualityGateRunStore.read(id);
  if (!existing) {
    throw new Error(`质量门禁记录不存在: ${id}`);
  }

  // 枚举校验：final_status 变更时必须为合法值
  if (patch.final_status !== undefined) {
    const check = validateFinalStatus(patch.final_status);
    if (!check.valid) throw new Error(check.error);
  }

  // 允许更新的字段白名单
  const safePatch = {};
  const allowedFields = [
    "gate_name", "validation_method", "result", "failure_reason",
    "safe_fix_attempted", "final_status",
    "failed_command", "failure_summary", "impact_scope", "next_actions",
  ];
  for (const key of allowedFields) {
    if (patch[key] !== undefined) {
      safePatch[key] = patch[key];
    }
  }

  if (Object.keys(safePatch).length === 0) {
    return existing;
  }

  return persistence.qualityGateRunStore.update(id, safePatch);
}

/**
 * 结构化记录质量门禁失败。
 *
 * 一次调用完成：
 *   1. 设置 final_status = "failed"
 *   2. 记录失败命令（failed_command）
 *   3. 记录失败摘要（failure_summary）
 *   4. 记录影响范围（impact_scope）
 *   5. 记录下一步动作（next_actions）
 *
 * 失败命令、摘要、影响范围和下一步动作均为必填，
 * 确保失败门禁不可被静默跳过，后续可查询失败原因和下一步。
 *
 * @param {object} persistence - T3 持久化实例
 * @param {string} id - 门禁记录 ID
 * @param {object} details - 失败详情
 * @param {string} details.failed_command - 失败的命令
 * @param {string} details.failure_summary - 失败摘要
 * @param {string} details.impact_scope - 影响范围
 * @param {string} details.next_actions - 建议的下一步动作
 * @param {string} [details.result] - 可选的门禁原始结果/输出
 * @returns {object} 更新后的记录
 */
function recordGateFailure(persistence, id, details = {}) {
  const existing = persistence.qualityGateRunStore.read(id);
  if (!existing) {
    throw new Error(`质量门禁记录不存在: ${id}`);
  }

  // 失败核心字段校验：四个描述字段均不能为空
  const missing = [];
  if (!details.failed_command || typeof details.failed_command !== "string" || !details.failed_command.trim()) {
    missing.push("failed_command");
  }
  if (!details.failure_summary || typeof details.failure_summary !== "string" || !details.failure_summary.trim()) {
    missing.push("failure_summary");
  }
  if (!details.impact_scope || typeof details.impact_scope !== "string" || !details.impact_scope.trim()) {
    missing.push("impact_scope");
  }
  if (!details.next_actions || typeof details.next_actions !== "string" || !details.next_actions.trim()) {
    missing.push("next_actions");
  }

  if (missing.length > 0) {
    throw new Error(
      `recordGateFailure 缺少必填字段: ${missing.join(", ")}。门禁失败必须记录命令、摘要、影响范围和下一步动作。`
    );
  }

  const patch = {
    final_status: "failed",
    failed_command: details.failed_command.trim(),
    failure_summary: details.failure_summary.trim(),
    impact_scope: details.impact_scope.trim(),
    next_actions: details.next_actions.trim(),
  };

  if (details.result !== undefined) {
    patch.result = details.result;
  }

  return persistence.qualityGateRunStore.update(id, patch);
}

/**
 * 按条件查询质量门禁记录。
 *
 * 所有筛选条件均为可选，多条件取 AND 交集。
 *
 * @param {object} persistence - T3 持久化实例
 * @param {object} [filters] - 筛选条件
 * @param {string} [filters.work_item_id] - 按工作项筛选
 * @param {string} [filters.task_id] - 按任务筛选
 * @param {string} [filters.gate_name] - 按门禁名称筛选
 * @param {string} [filters.final_status] - 按最终状态筛选
 * @returns {object[]} QualityGateRun 数组（深拷贝）
 */
function queryQualityGates(persistence, filters = {}) {
  const hasFilter = Object.values(filters).some((v) => v !== undefined && v !== null);
  if (!hasFilter) {
    return persistence.qualityGateRunStore.list();
  }

  return persistence.qualityGateRunStore.list((record) => {
    if (filters.work_item_id !== undefined && record.work_item_id !== filters.work_item_id) {
      return false;
    }
    if (filters.task_id !== undefined && record.task_id !== filters.task_id) {
      return false;
    }
    if (filters.gate_name !== undefined && record.gate_name !== filters.gate_name) {
      return false;
    }
    if (filters.final_status !== undefined && record.final_status !== filters.final_status) {
      return false;
    }
    return true;
  });
}

/**
 * 生成工作项的质量门禁摘要。
 *
 * 摘要包含各状态计数、失败详情和最近一次门禁，供 T11/T13/T14/T16 消费。
 *
 * @param {object} persistence - T3 持久化实例
 * @param {string} workItemId - 工作项 ID
 * @returns {object} 质量门禁摘要
 */
function summarizeQualityGates(persistence, workItemId) {
  const gates = queryQualityGates(persistence, { work_item_id: workItemId });

  if (gates.length === 0) {
    return {
      work_item_id: workItemId,
      total: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
      user_confirmed: 0,
      latest: null,
      failures: [],
    };
  }

  const counts = { passed: 0, failed: 0, blocked: 0, user_confirmed: 0 };
  const failures = [];

  for (const g of gates) {
    counts[g.final_status] = (counts[g.final_status] || 0) + 1;
    if (g.final_status === "failed") {
      failures.push({
        id: g.id,
        gate_name: g.gate_name,
        failed_command: g.failed_command || "",
        failure_summary: g.failure_summary || g.failure_reason || "",
        impact_scope: g.impact_scope || "",
        next_actions: g.next_actions || "",
        at: g.updated_at || g.created_at,
      });
    }
  }

  // 最近一次门禁（按 updated_at 降序）
  const sorted = [...gates].sort(
    (a, b) => new Date(b.updated_at || b.created_at).getTime() -
             new Date(a.updated_at || a.created_at).getTime()
  );
  const latest = sorted[0];

  return {
    work_item_id: workItemId,
    total: gates.length,
    ...counts,
    latest: {
      id: latest.id,
      gate_name: latest.gate_name,
      final_status: latest.final_status,
      at: latest.updated_at || latest.created_at,
    },
    failures,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════════════════════════════════

module.exports = {
  // 校验
  validateReviewResult,
  validateFinalStatus,
  validateNoSelfReview,

  // Review 管理
  createReview,
  updateReview,
  resolveReview,
  queryReviews,
  summarizeReviews,

  // 质量门禁管理
  createQualityGate,
  updateQualityGate,
  recordGateFailure,
  queryQualityGates,
  summarizeQualityGates,
};
