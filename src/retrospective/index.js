#!/usr/bin/env node
/**
 * src/retrospective/index.js — T14 复盘记录最小闭环
 *
 * 在工作项完成或失败后生成结构化复盘记录：
 *   - 自动聚合 WorkItem / A2AEvent / ReviewRecord / QualityGateRun / EscalationRecord 的关键事实
 *   - 记录参与 Agent、Review 发现、质量门禁结果、返工次数、失败原因
 *   - 区分事实（自动聚合）、结论（retrospective_conclusion）、
 *     改进建议（process_improvement_suggestions）和技术执行建议（technical_execution_suggestions）
 *   - 提供页面/T13/T16 可消费的摘要查询
 *
 * 事实/结论/建议三分法：
 *   - 事实：aggregateFacts() 自动从关联记录提取，不可由调用方直接覆写
 *   - 结论：retrospective_conclusion，由复盘者撰写
 *   - 改进建议：process_improvement_suggestions（流程层面）
 *   - 技术执行建议：technical_execution_suggestions（代码/技术层面）
 *
 * 依赖：T3 Store（RetrospectiveMemory + 所有关联 Store）
 * 边界：不实现 T15 Dogfooding 指标增强（耗时统计、A2A 分布等）
 *      不自动修改产品/架构/AGENTS 规则
 *      confirmed_as_baseline 只是标记，不触发任何规则生效逻辑
 */

// ═══════════════════════════════════════════════════════════════════════════
// 内部工具
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 深拷贝，确保返回数据与 Store 内部引用隔离
 */
function clone(src) {
  if (src == null) return src;
  return JSON.parse(JSON.stringify(src));
}

/**
 * 从数组中收集去重的参与 Agent
 * @param {Array} records
 * @param {string[]} fields - 要提取的字段名列表
 */
function collectAgents(records, fields) {
  const agents = new Set();
  for (const r of records) {
    for (const f of fields) {
      if (r[f] && typeof r[f] === "string" && r[f].trim()) {
        agents.add(r[f].trim());
      }
    }
  }
  return [...agents].sort();
}

// ═══════════════════════════════════════════════════════════════════════════
// 事实聚合
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 从关联记录中聚合关键事实。
 *
 * 读取范围：
 *   - WorkItem → 类型、目标、最终状态
 *   - A2AEvent → 参与 Agent、交互次数、人工介入次数
 *   - ReviewRecord → Review 发现、返工次数
 *   - QualityGateRun → 质量门禁结果
 *   - EscalationRecord → 升级记录摘要
 *
 * 此函数只读不写，不创建任何记录。
 *
 * @param {object} persistence - 含所有 Store 实例的持久化对象
 * @param {string} workItemId
 * @returns {object} { participating_agents, rework_count, review_findings,
 *   quality_gate_results, failure_causes, user_intervention_reasons,
 *   escalation_results, aggregated_facts }
 */
function aggregateFacts(persistence, workItemId) {
  if (!workItemId || typeof workItemId !== "string" || !workItemId.trim()) {
    throw new Error("aggregateFacts: work_item_id 不能为空");
  }

  // ── WorkItem ──────────────────────────────────────────────────────
  const workItem = clone(persistence.workItemStore.read(workItemId));
  if (!workItem) {
    throw new Error(
      `aggregateFacts: 未找到工作项 "${workItemId}"，无法聚合事实`
    );
  }

  // ── A2AEvent ──────────────────────────────────────────────────────
  const allA2A = clone(
    persistence.a2aEventStore.list().filter(
      (e) => e.work_item_id === workItemId
    )
  );
  const participatingAgents = collectAgents(allA2A, ["from_agent", "to_agent"]);
  // 同时从 WorkItem 的 tasks 中收集 owner_agent（如果有）
  // 注意：Task 记录需要从 taskStore 读取
  const allTasks = clone(
    persistence.taskStore.list().filter(
      (t) => t.work_item_id === workItemId
    )
  );
  const taskAgents = collectAgents(allTasks, ["owner_agent"]);
  const mergedAgents = [...new Set([...participatingAgents, ...taskAgents])].sort();

  const a2aInteractionCount = allA2A.length;
  const manualInterventionCount = allA2A.filter(
    (e) => e.requires_user_intervention === true
  ).length;

  // ── ReviewRecord ──────────────────────────────────────────────────
  const allReviews = clone(
    persistence.reviewRecordStore.list().filter(
      (r) => r.work_item_id === workItemId
    )
  );
  // 返工次数：统计 result === "changes_requested" 的 Review 数量
  // 每个 changes_requested 代表一轮需要修改后重新提交
  const reworkCount = allReviews.filter(
    (r) => r.result === "changes_requested"
  ).length;
  // Review 发现：收集所有非空 findings
  const reviewFindings = [];
  for (const r of allReviews) {
    if (r.findings && r.findings.length > 0) {
      for (const f of r.findings) {
        if (f && typeof f === "string" && f.trim()) {
          reviewFindings.push(f.trim());
        }
      }
    }
  }

  // ── QualityGateRun ────────────────────────────────────────────────
  const allGates = clone(
    persistence.qualityGateRunStore.list().filter(
      (g) => g.work_item_id === workItemId
    )
  );
  // 质量门禁结果摘要：每条记录的关键字段
  const qualityGateResults = allGates.map((g) => ({
    gate_name: g.gate_name,
    final_status: g.final_status,
    failure_reason: g.failure_reason || "",
    failure_summary: g.failure_summary || "",
  }));

  // 失败原因：从门禁失败记录中提取
  const failureCauses = [];
  for (const g of allGates) {
    if (g.final_status === "failed" || g.final_status === "blocked") {
      if (g.failure_reason && g.failure_reason.trim()) {
        failureCauses.push(g.failure_reason.trim());
      }
      if (g.failure_summary && g.failure_summary.trim()) {
        failureCauses.push(g.failure_summary.trim());
      }
    }
  }

  // ── EscalationRecord ─────────────────────────────────────────────
  const allEscalations = clone(
    persistence.escalationRecordStore.list().filter(
      (e) => e.work_item_id === workItemId
    )
  );
  const escalationResults = allEscalations.map((e) => ({
    escalation_id: e.id,
    trigger_rule: e.trigger_rule || "",
    user_decision: e.user_decision || "",
  }));

  // 用户介入原因：从升级记录中提取
  const userInterventionReasons = [];
  for (const e of allEscalations) {
    if (e.trigger_rule && e.trigger_rule.trim()) {
      userInterventionReasons.push(e.trigger_rule.trim());
    }
  }

  // ── 聚合事实对象 ─────────────────────────────────────────────────
  const aggregatedFacts = {
    work_item_type: workItem.type || "",
    work_item_goal: workItem.goal || "",
    final_status: workItem.status || "",
    a2a_interaction_count: a2aInteractionCount,
    manual_intervention_count: manualInterventionCount,
    review_count: allReviews.length,
    quality_gate_count: allGates.length,
    escalation_count: allEscalations.length,
    task_count: allTasks.length,
  };

  return {
    participating_agents: mergedAgents,
    rework_count: reworkCount,
    review_findings: reviewFindings,
    quality_gate_results: qualityGateResults,
    failure_causes: failureCauses,
    user_intervention_reasons: userInterventionReasons,
    escalation_results: escalationResults,
    aggregated_facts: aggregatedFacts,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 复盘记录 CRUD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 为指定工作项生成结构化复盘记录。
 *
 * 自动调用 aggregateFacts() 聚合关联记录的事实，
 * 合并调用方提供的结论和建议，创建 RetrospectiveMemory 记录。
 *
 * 约束：
 *   - 同一 work_item_id 不应重复生成（调用方负责检查，T14 不做唯一约束）
 *   - 自动聚合的事实不会被 input 中的同名字段覆写
 *   - input 中的结论和建议字段若为空则使用默认值
 *
 * @param {object} persistence
 * @param {string} workItemId
 * @param {object} [input={}]
 * @param {string} [input.retrospective_conclusion] - 复盘总结论
 * @param {string[]} [input.process_improvement_suggestions] - 流程改进建议
 * @param {string[]} [input.technical_execution_suggestions] - 技术执行建议
 * @param {string[]} [input.effective_patterns] - 有效做法
 * @returns {object} 完整的 RetrospectiveMemory 记录
 */
function generateRetrospective(persistence, workItemId, input = {}) {
  if (!workItemId || typeof workItemId !== "string" || !workItemId.trim()) {
    throw new Error("generateRetrospective: work_item_id 不能为空");
  }

  // 1) 聚合事实
  const facts = aggregateFacts(persistence, workItemId);

  // 2) 合并 input 中的结论和建议（事实不可覆写）
  const record = persistence.createRetrospectiveMemory({
    work_item_id: workItemId,
    // 事实（自动聚合）
    participating_agents: facts.participating_agents,
    rework_count: facts.rework_count,
    review_findings: facts.review_findings,
    quality_gate_results: facts.quality_gate_results,
    failure_causes: facts.failure_causes,
    user_intervention_reasons: facts.user_intervention_reasons,
    escalation_results: facts.escalation_results,
    aggregated_facts: facts.aggregated_facts,
    // 结论（来自 input）
    retrospective_conclusion:
      input.retrospective_conclusion != null
        ? input.retrospective_conclusion
        : "",
    // 建议（来自 input）
    process_improvement_suggestions: Array.isArray(
      input.process_improvement_suggestions
    )
      ? input.process_improvement_suggestions
      : [],
    technical_execution_suggestions: Array.isArray(
      input.technical_execution_suggestions
    )
      ? input.technical_execution_suggestions
      : [],
    // 有效做法（来自 input）
    effective_patterns: Array.isArray(input.effective_patterns)
      ? input.effective_patterns
      : [],
  });

  return clone(record);
}

/**
 * 更新复盘记录。
 *
 * 允许更新的字段（白名单）：
 *   - retrospective_conclusion（结论）
 *   - process_improvement_suggestions（流程改进建议）
 *   - technical_execution_suggestions（技术执行建议）
 *   - effective_patterns（有效做法）
 *   - confirmed_as_baseline（标记为已确认基线）
 *
 * 禁止更新：
 *   - 自动聚合的事实字段（participating_agents / rework_count / review_findings /
 *     quality_gate_results / failure_causes / user_intervention_reasons /
 *     escalation_results / aggregated_facts）
 *   - work_item_id（不可变绑定）
 *
 * @param {object} persistence
 * @param {string} id - 复盘记录 ID
 * @param {object} patch - 要更新的字段
 * @returns {object} 更新后的完整记录（深拷贝）
 */
function updateRetrospective(persistence, id, patch = {}) {
  if (!id || typeof id !== "string" || !id.trim()) {
    throw new Error("updateRetrospective: id 不能为空");
  }

  const existing = persistence.retrospectiveMemoryStore.read(id);
  if (!existing) {
    throw new Error(
      `updateRetrospective: 未找到复盘记录 "${id}"`
    );
  }

  // 白名单：只允许更新结论、建议、有效做法和基线标记
  const allowed = [
    "retrospective_conclusion",
    "process_improvement_suggestions",
    "technical_execution_suggestions",
    "effective_patterns",
    "confirmed_as_baseline",
  ];

  const blocked = [];
  for (const key of Object.keys(patch)) {
    if (!allowed.includes(key)) {
      blocked.push(key);
    }
  }
  if (blocked.length > 0) {
    throw new Error(
      `updateRetrospective: 不允许更新字段: ${blocked.join(", ")}。` +
        `允许更新: ${allowed.join(", ")}`
    );
  }

  // 类型校验
  if (
    "confirmed_as_baseline" in patch &&
    typeof patch.confirmed_as_baseline !== "boolean"
  ) {
    throw new Error(
      "updateRetrospective: confirmed_as_baseline 必须是 boolean 类型"
    );
  }
  if (
    "process_improvement_suggestions" in patch &&
    !Array.isArray(patch.process_improvement_suggestions)
  ) {
    throw new Error(
      "updateRetrospective: process_improvement_suggestions 必须是数组"
    );
  }
  if (
    "technical_execution_suggestions" in patch &&
    !Array.isArray(patch.technical_execution_suggestions)
  ) {
    throw new Error(
      "updateRetrospective: technical_execution_suggestions 必须是数组"
    );
  }
  if (
    "effective_patterns" in patch &&
    !Array.isArray(patch.effective_patterns)
  ) {
    throw new Error(
      "updateRetrospective: effective_patterns 必须是数组"
    );
  }

  const updated = persistence.retrospectiveMemoryStore.update(id, patch);
  return clone(updated);
}

/**
 * 查询复盘记录。
 *
 * @param {object} persistence
 * @param {object} [filters={}]
 * @param {string} [filters.work_item_id] - 按工作项 ID 过滤
 * @param {boolean} [filters.confirmed_as_baseline] - 按基线确认状态过滤
 * @returns {object[]} 匹配的复盘记录（深拷贝数组）
 */
function queryRetrospectives(persistence, filters = {}) {
  const all = clone(persistence.retrospectiveMemoryStore.list());

  return all.filter((r) => {
    if (
      filters.work_item_id != null &&
      r.work_item_id !== filters.work_item_id
    ) {
      return false;
    }
    if (
      filters.confirmed_as_baseline != null &&
      r.confirmed_as_baseline !== filters.confirmed_as_baseline
    ) {
      return false;
    }
    return true;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 页面消费摘要
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 为指定工作项生成页面可消费的复盘摘要。
 *
 * 面向 T13/T16 页面展示，区分：
 *   - facts：自动聚合的事实数据
 *   - conclusion：复盘总结论
 *   - suggestions：流程改进建议 + 技术执行建议
 *
 * @param {object} persistence
 * @param {string} workItemId
 * @returns {object|null} 复盘摘要，若无复盘记录返回 null
 */
function summarizeRetrospective(persistence, workItemId) {
  if (!workItemId || typeof workItemId !== "string" || !workItemId.trim()) {
    throw new Error("summarizeRetrospective: work_item_id 不能为空");
  }

  const records = queryRetrospectives(persistence, { work_item_id: workItemId });
  if (records.length === 0) {
    return null;
  }

  // 取最新一条复盘记录（通常一个工作项只有一条）
  const latest = records.sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  )[0];

  return {
    work_item_id: latest.work_item_id,
    retrospective_id: latest.id,
    created_at: latest.created_at,
    confirmed_as_baseline: latest.confirmed_as_baseline,

    // 事实
    facts: {
      participating_agents: latest.participating_agents || [],
      rework_count: latest.rework_count || 0,
      review_findings: latest.review_findings || [],
      quality_gate_results: latest.quality_gate_results || [],
      failure_causes: latest.failure_causes || [],
      user_intervention_reasons: latest.user_intervention_reasons || [],
      escalation_results: latest.escalation_results || [],
      aggregated_facts: latest.aggregated_facts || {},
    },

    // 结论
    conclusion: latest.retrospective_conclusion || "",

    // 建议
    suggestions: {
      process: latest.process_improvement_suggestions || [],
      technical: latest.technical_execution_suggestions || [],
    },

    // 有效做法
    effective_patterns: latest.effective_patterns || [],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  aggregateFacts,
  generateRetrospective,
  updateRetrospective,
  queryRetrospectives,
  summarizeRetrospective,
};
