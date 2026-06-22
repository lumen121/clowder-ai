#!/usr/bin/env node
/**
 * src/dogfooding/index.js — T15 Dogfooding 评估增强
 *
 * 在 T14 复盘记录基础上，从已有 Store 中计算 Dogfooding 评估指标：
 *   - 耗时统计（录入→各阶段首次事件→最终记录的跨度）
 *   - A2A 交互（总次数、按目的分布、人工介入、Agent 参与）
 *   - Review 指标（发现数量、返工轮次、通过/争议/需用户确认）
 *   - 质量门禁（通过/失败/阻塞/用户确认）
 *   - 交付指标（检查次数、准备/推送、通过/阻塞/失败）
 *   - 升级指标（总数、待处理、已解决、按触发规则分布）
 *   - 任务指标（总数、完成/阻塞/进行中）
 *   - 复盘记忆使用（是否已生成、是否已确认基线）
 *
 * 事实/建议分离规则：
 *   - evaluateMetrics() 只输出计算事实，不输出解释或建议
 *   - summarizeEvaluation() 在事实基础上附带 T14 复盘建议，并用 _notice
 *     标记"不自动成为产品规则"
 *   - 本模块只读不写，不创建任何记录，不修改任何 Store 数据
 *
 * 依赖：T3 Store（workItem/a2aEvent/task/reviewRecord/qualityGateRun/
 *       deliveryRecord/escalationRecord/retrospectiveMemory）
 * 边界：不实现 T16；不自动修改产品/架构/AGENTS 规则
 */

// ═══════════════════════════════════════════════════════════════════════════
// 内部工具
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 深拷贝，确保返回数据与 Store 内部引用隔离。
 * 所有从 Store 读取的数据在计算前必须 clone。
 */
function clone(src) {
  if (src == null) return src;
  return JSON.parse(JSON.stringify(src));
}

/**
 * 从记录数组中获取最早 created_at
 * @param {Array<{created_at?: string}>} records
 * @returns {string|null}
 */
function earliestCreated(records) {
  if (!records.length) return null;
  let min = null;
  for (const r of records) {
    const ts = r.created_at;
    if (ts && (!min || ts < min)) min = ts;
  }
  return min;
}

/**
 * 从记录数组中获取最晚 created_at
 * @param {Array<{created_at?: string}>} records
 * @returns {string|null}
 */
function latestCreated(records) {
  if (!records.length) return null;
  let max = null;
  for (const r of records) {
    const ts = r.created_at;
    if (ts && (!max || ts > max)) max = ts;
  }
  return max;
}

/**
 * 计算两个 ISO 时间字符串之间的毫秒差
 * @param {string|null} start
 * @param {string|null} end
 * @returns {number|null}
 */
function msBetween(start, end) {
  if (!start || !end) return null;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  // 不允许负值（说明数据时序异常），但保留以便调用方发现数据质量问题
  return diff;
}

/**
 * 安全地收集去重的 Agent 名称
 */
function collectAgentSet(records, fields) {
  const agents = new Set();
  for (const r of records) {
    for (const f of fields) {
      if (r[f] && typeof r[f] === "string" && r[f].trim()) {
        agents.add(r[f].trim());
      }
    }
  }
  return agents;
}

/**
 * 从 Review findings 中提取结构化发现列表
 * 兼容 string 和 {severity, description} 两种形态（T9 兼容）
 */
function extractReviewFindings(reviews) {
  const findings = [];
  for (const r of reviews) {
    if (!r.findings || !r.findings.length) continue;
    for (const f of r.findings) {
      if (!f) continue;
      if (typeof f === "string") {
        const trimmed = f.trim();
        if (trimmed) findings.push(trimmed);
      } else if (typeof f === "object") {
        const desc = (f.description || "").trim();
        if (!desc) continue;
        const entry = { description: desc };
        if (f.severity && typeof f.severity === "string" && f.severity.trim()) {
          entry.severity = f.severity.trim();
        }
        findings.push(entry);
      }
    }
  }
  return findings;
}

// ═══════════════════════════════════════════════════════════════════════════
// 核心评估
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 从现有记录中计算工作项的 Dogfooding 评估指标。
 *
 * 读取范围（只读不写）：
 *   - WorkItem → 类型、状态、创建时间
 *   - A2AEvent → 交互次数、目的分布、Agent 参与、人工介入
 *   - Task → 任务数量、状态分布
 *   - ReviewRecord → 发现数量、返工轮次、结论分布
 *   - QualityGateRun → 通过/失败/阻塞统计
 *   - DeliveryRecord → 交付检查、推送结果
 *   - EscalationRecord → 升级次数、状态、触发规则分布
 *   - RetrospectiveMemory → 是否已生成、是否已确认基线
 *
 * @param {object} persistence - 含所有 Store 实例的持久化对象
 * @param {string} workItemId
 * @returns {object} 结构化评估指标
 */
function evaluateMetrics(persistence, workItemId) {
  // ── 参数校验 ──────────────────────────────────────────────────────
  if (!workItemId || typeof workItemId !== "string" || !workItemId.trim()) {
    throw new Error("evaluateMetrics: work_item_id 不能为空");
  }

  const workItem = persistence.workItemStore.read(workItemId);
  if (!workItem) {
    throw new Error(
      `evaluateMetrics: 未找到工作项 "${workItemId}"`
    );
  }
  const wiCreated = workItem.created_at || null;

  // ── 收集关联记录（全部深拷贝）───────────────────────────────────
  const allA2A = clone(
    persistence.a2aEventStore.list().filter(
      (e) => e.work_item_id === workItemId
    )
  );
  const allTasks = clone(
    persistence.taskStore.list().filter(
      (t) => t.work_item_id === workItemId
    )
  );
  const allReviews = clone(
    persistence.reviewRecordStore.list().filter(
      (r) => r.work_item_id === workItemId
    )
  );
  const allGates = clone(
    persistence.qualityGateRunStore.list().filter(
      (g) => g.work_item_id === workItemId
    )
  );
  const allDeliveries = clone(
    persistence.deliveryRecordStore.list().filter(
      (d) => d.work_item_id === workItemId
    )
  );
  const allEscalations = clone(
    persistence.escalationRecordStore.list().filter(
      (e) => e.work_item_id === workItemId
    )
  );
  const allRetros = clone(
    persistence.retrospectiveMemoryStore.list().filter(
      (r) => r.work_item_id === workItemId
    )
  );

  // ── 合并所有记录用于总跨度计算 ──────────────────────────────────
  const allRecords = [
    ...allA2A, ...allTasks, ...allReviews, ...allGates,
    ...allDeliveries, ...allEscalations, ...allRetros,
  ];
  const latestTs = latestCreated(allRecords);

  // ═══════════════════════════════════════════════════════════════════
  // 1. 耗时指标
  // ═══════════════════════════════════════════════════════════════════
  const timing = {
    work_item_created_at: wiCreated,
    entry_to_first_task_ms: msBetween(wiCreated, earliestCreated(allTasks)),
    entry_to_first_a2a_ms: msBetween(wiCreated, earliestCreated(allA2A)),
    entry_to_first_review_ms: msBetween(wiCreated, earliestCreated(allReviews)),
    entry_to_first_delivery_ms: msBetween(wiCreated, earliestCreated(allDeliveries)),
    total_span_ms: msBetween(wiCreated, latestTs),
    // 辅助字段：各阶段首次时间点（方便页面展示）
    first_task_at: earliestCreated(allTasks),
    first_a2a_at: earliestCreated(allA2A),
    first_review_at: earliestCreated(allReviews),
    first_delivery_at: earliestCreated(allDeliveries),
    latest_record_at: latestTs,
  };

  // ═══════════════════════════════════════════════════════════════════
  // 2. A2A 指标
  // ═══════════════════════════════════════════════════════════════════
  const a2aByPurpose = {};
  const a2aAgents = collectAgentSet(allA2A, ["from_agent", "to_agent"]);
  for (const e of allA2A) {
    const p = e.purpose || "unknown";
    a2aByPurpose[p] = (a2aByPurpose[p] || 0) + 1;
  }
  const a2a = {
    total_count: allA2A.length,
    by_purpose: a2aByPurpose,
    manual_intervention_count: allA2A.filter(
      (e) => e.requires_user_intervention === true
    ).length,
    agent_participation: [...a2aAgents].sort(),
  };

  // ═══════════════════════════════════════════════════════════════════
  // 3. Review 指标
  // ═══════════════════════════════════════════════════════════════════
  const reviewFindings = extractReviewFindings(allReviews);
  // 返工轮次：每个 changes_requested 代表一轮返工
  const reworkRounds = allReviews.filter(
    (r) => r.result === "changes_requested"
  ).length;
  const review = {
    total_count: allReviews.length,
    findings_count: reviewFindings.length,
    rework_rounds: reworkRounds,
    approval_count: allReviews.filter((r) => r.result === "approved").length,
    changes_requested_count: reworkRounds,
    dispute_count: allReviews.filter((r) => r.result === "disputed").length,
    user_confirmation_count: allReviews.filter(
      (r) => r.result === "user_confirmation_required"
    ).length,
    // T9 已确认口径：approved 不计入 unresolved（即使 resolved 未显式设为 true）
    unresolved_count: allReviews.filter(
      (r) => r.resolved !== true && r.result !== "approved"
    ).length,
  };

  // ═══════════════════════════════════════════════════════════════════
  // 4. 质量门禁指标
  // ═══════════════════════════════════════════════════════════════════
  const qualityGate = {
    total_count: allGates.length,
    passed_count: allGates.filter((g) => g.final_status === "passed").length,
    failed_count: allGates.filter((g) => g.final_status === "failed").length,
    blocked_count: allGates.filter((g) => g.final_status === "blocked").length,
    user_confirmed_count: allGates.filter(
      (g) => g.final_status === "user_confirmed"
    ).length,
  };

  // ═══════════════════════════════════════════════════════════════════
  // 5. 交付指标
  // ═══════════════════════════════════════════════════════════════════
  const delivery = {
    total_checks: allDeliveries.length,
    prepare_count: allDeliveries.filter(
      (d) => d.action === "prepare_commit"
    ).length,
    push_count: allDeliveries.filter(
      (d) => d.action === "feature_push"
    ).length,
    passed_checks: allDeliveries.filter((d) => d.result === "passed").length,
    blocked_checks: allDeliveries.filter((d) => d.result === "blocked").length,
    failed_checks: allDeliveries.filter((d) => d.result === "failed").length,
    successful_pushes: allDeliveries.filter(
      (d) => d.push_status === "succeeded"
    ).length,
    failed_pushes: allDeliveries.filter(
      (d) => d.push_status === "failed"
    ).length,
    not_attempted_pushes: allDeliveries.filter(
      (d) => d.push_status === "not_attempted"
    ).length,
    ready_pushes: allDeliveries.filter(
      (d) => d.push_status === "ready"
    ).length,
  };

  // ═══════════════════════════════════════════════════════════════════
  // 6. 升级指标
  // ═══════════════════════════════════════════════════════════════════
  const escalationByTrigger = {};
  for (const e of allEscalations) {
    const trigger = e.trigger_rule || "unspecified";
    escalationByTrigger[trigger] = (escalationByTrigger[trigger] || 0) + 1;
  }
  const escalation = {
    total_count: allEscalations.length,
    // T12 状态：pending_user_confirmation, needs_more_info, confirmed, rejected
    pending_count: allEscalations.filter(
      (e) => e.status === "pending_user_confirmation" || e.status === "needs_more_info"
    ).length,
    resolved_count: allEscalations.filter(
      (e) => e.status === "confirmed" || e.status === "rejected"
    ).length,
    by_trigger: escalationByTrigger,
  };

  // ═══════════════════════════════════════════════════════════════════
  // 7. 任务指标
  // ═══════════════════════════════════════════════════════════════════
  const task = {
    total_count: allTasks.length,
    completed_count: allTasks.filter((t) => t.status === "completed").length,
    blocked_count: allTasks.filter((t) => t.status === "blocked").length,
    in_progress_count: allTasks.filter((t) => t.status === "in_progress").length,
    pending_count: allTasks.filter((t) => t.status === "pending").length,
  };

  // ═══════════════════════════════════════════════════════════════════
  // 8. 复盘记忆使用
  // ═══════════════════════════════════════════════════════════════════
  const memoryUsage = {
    retrospective_generated: allRetros.length > 0,
    retrospective_count: allRetros.length,
    confirmed_as_baseline: allRetros.some(
      (r) => r.confirmed_as_baseline === true
    ),
  };

  // ═══════════════════════════════════════════════════════════════════
  // 汇总计数（便于快速查看）
  // ═══════════════════════════════════════════════════════════════════
  const summaryCounts = {
    total_a2a: a2a.total_count,
    total_review_findings: review.findings_count,
    total_rework_rounds: review.rework_rounds,
    total_gate_failures: qualityGate.failed_count + qualityGate.blocked_count,
    total_escalations: escalation.total_count,
    total_delivery_checks: delivery.total_checks,
    total_tasks: task.total_count,
  };

  return {
    work_item_id: workItemId,
    evaluated_at: new Date().toISOString(),

    // 事实指标（由数据自动计算，不包含解释或建议）
    timing,
    a2a,
    review,
    quality_gate: qualityGate,
    delivery,
    escalation,
    task,
    memory_usage: memoryUsage,
    summary_counts: summaryCounts,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 页面消费摘要
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 为指定工作项生成页面/T16 可消费的 Dogfooding 摘要。
 *
 * 摘要结构：
 *   - key_metrics：页面快速展示的关键指标
 *   - detail：完整的 evaluateMetrics() 输出
 *   - improvement_suggestions：来自 T14 复盘记录的改进建议（不为空时附带）
 *   - _notice：标记"这些是事实指标，不自动成为产品规则"
 *
 * 注意：improvement_suggestions 来自 T14 RetrospectiveMemory 的结论和建议字段，
 * 不是 T15 自身产生的。T15 只负责计算指标和附带已有建议。
 *
 * @param {object} persistence
 * @param {string} workItemId
 * @returns {object} 页面可消费的评估摘要
 */
function summarizeEvaluation(persistence, workItemId) {
  const metrics = evaluateMetrics(persistence, workItemId);

  // 读取 T14 复盘记录中的改进建议（消费但不改写）
  const allRetros = clone(
    persistence.retrospectiveMemoryStore.list().filter(
      (r) => r.work_item_id === workItemId
    )
  );
  const latestRetro = allRetros.sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  )[0];

  // 判断交付结果
  let deliveryOutcome = "not_attempted";
  if (metrics.delivery.successful_pushes > 0) {
    deliveryOutcome = "pushed";
  } else if (metrics.delivery.failed_pushes > 0) {
    deliveryOutcome = "push_failed";
  } else if (metrics.delivery.blocked_checks > 0) {
    deliveryOutcome = "blocked";
  } else if (metrics.delivery.passed_checks > 0) {
    deliveryOutcome = "ready";
  }

  return {
    work_item_id: metrics.work_item_id,
    evaluated_at: metrics.evaluated_at,

    // 关键指标（页面快速展示，值与 detail 相同来源）
    key_metrics: {
      total_elapsed_ms: metrics.timing.total_span_ms,
      a2a_interactions: metrics.a2a.total_count,
      review_findings: metrics.review.findings_count,
      rework_rounds: metrics.review.rework_rounds,
      gate_failures: metrics.summary_counts.total_gate_failures,
      escalations: metrics.escalation.total_count,
      tasks_total: metrics.task.total_count,
      delivery_outcome: deliveryOutcome,
      retrospective_generated: metrics.memory_usage.retrospective_generated,
    },

    // 详细指标
    detail: {
      timing: metrics.timing,
      a2a: metrics.a2a,
      review: metrics.review,
      quality_gate: metrics.quality_gate,
      delivery: metrics.delivery,
      escalation: metrics.escalation,
      task: metrics.task,
      memory_usage: metrics.memory_usage,
      summary_counts: metrics.summary_counts,
    },

    // T14 复盘中的改进建议（只读消费，来自 RetrospectiveMemory）
    improvement_suggestions: latestRetro
      ? {
          conclusion: latestRetro.retrospective_conclusion || "",
          process: latestRetro.process_improvement_suggestions || [],
          technical: latestRetro.technical_execution_suggestions || [],
          effective_patterns: latestRetro.effective_patterns || [],
          confirmed_as_baseline: latestRetro.confirmed_as_baseline || false,
        }
      : null,

    // 区分标记：事实指标 / 建议 分开，不自动成为产品规则
    _notice:
      "本评估中的指标为从已有记录自动计算的事实数据。" +
      "improvement_suggestions 来自 T14 复盘记录。" +
      "所有改进建议只有经产品负责人确认后才能成为新的基线规则。",
  };
}

/**
 * 查询工作项的 Dogfooding 评估。
 *
 * 评估由已有记录实时计算，不依赖持久化的评估快照。
 * 因此查询本质上是"对匹配的工作项调用 summarizeEvaluation()"。
 *
 * @param {object} persistence
 * @param {object} [filters={}]
 * @param {string} [filters.work_item_id] - 按工作项 ID 过滤
 * @param {string} [filters.status] - 按工作项状态过滤
 * @param {string} [filters.type] - 按工作项类型过滤
 * @returns {object[]} 匹配工作项的评估摘要列表
 */
function queryEvaluations(persistence, filters = {}) {
  const allWorkItems = clone(persistence.workItemStore.list());

  const matched = allWorkItems.filter((wi) => {
    if (filters.work_item_id != null && wi.id !== filters.work_item_id) {
      return false;
    }
    if (filters.status != null && wi.status !== filters.status) {
      return false;
    }
    if (filters.type != null && wi.type !== filters.type) {
      return false;
    }
    return true;
  });

  return matched.map((wi) => {
    try {
      return summarizeEvaluation(persistence, wi.id);
    } catch (_err) {
      // 如果某个工作项的评估失败（如数据不一致），跳过并返回 null
      // 调用方通过 .filter(Boolean) 可移除失败项
      return null;
    }
  }).filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  evaluateMetrics,
  summarizeEvaluation,
  queryEvaluations,
};
