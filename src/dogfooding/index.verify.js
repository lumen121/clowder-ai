#!/usr/bin/env node
/**
 * src/dogfooding/index.verify.js — T15 Dogfooding 评估增强验证
 *
 * 覆盖：
 *   1. evaluateMetrics — 基本指标计算（各维度独立验证）
 *   2. evaluateMetrics — 空工作项（无关联记录）
 *   3. evaluateMetrics — 耗时计算正确性
 *   4. evaluateMetrics — A2A 按目的分布与 Agent 参与
 *   5. evaluateMetrics — Review 发现计数（string + object 两种形态）
 *   6. evaluateMetrics — 质量门禁通过/失败/阻塞统计
 *   7. evaluateMetrics — 交付检查与推送结果统计
 *   8. evaluateMetrics — 升级记录统计
 *   9. evaluateMetrics — 复盘记忆使用标记
 *  10. evaluateMetrics — 任务状态分布
 *  11. summarizeEvaluation — 页面消费格式（含 T14 改进建议）
 *  12. summarizeEvaluation — 无复盘时的 improvement_suggestions=null
 *  13. queryEvaluations — 过滤查询
 *  14. 数据隔离 — 深拷贝不污染 Store
 *  15. 错误处理 — 空 ID / 不存在工作项
 *  16. T14 兼容 — evaluateMetrics 与 T14 aggregateFacts 无冲突
 *  17. 边界情况 — 负耗时、大量记录
 */

const path = require("path");
const fs = require("fs");
const os = require("os");

// 使用临时目录进行隔离测试
const TMP_BASE = path.join(
  os.tmpdir(),
  `clowder-t15-verify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
);
fs.mkdirSync(TMP_BASE, { recursive: true });

let setupCounter = 0;

const { createPersistence } = require("../storage");
const {
  evaluateMetrics,
  summarizeEvaluation,
  queryEvaluations,
} = require("./index");

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ FAIL [${passed + failed}] ${label}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(
      `  ✗ FAIL [${passed + failed}] ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertDeepEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) {
    passed++;
  } else {
    failed++;
    console.error(
      `  ✗ FAIL [${passed + failed}] ${label}: expected ${b}, got ${a}`
    );
  }
}

function assertThrows(fn, label) {
  try {
    fn();
    failed++;
    console.error(`  ✗ FAIL [${passed + failed}] ${label}: expected throw but did not`);
  } catch (_e) {
    passed++;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 辅助：创建测试数据
// ═══════════════════════════════════════════════════════════════════════════

function setup() {
  const dir = path.join(TMP_BASE, `s${++setupCounter}`);
  fs.mkdirSync(dir, { recursive: true });
  const p = createPersistence(dir);

  // 创建工作项
  const wi = p.createWorkItem({
    goal: "实现 T15 Dogfooding 评估增强",
    type: "feature",
  });
  const wi2 = p.createWorkItem({
    goal: "修复页面显示 Bug",
    type: "bug_fix",
  });
  const wi3 = p.createWorkItem({
    goal: "空工作项，无任何关联记录",
    type: "feature",
  });

  // 创建 A2A 事件
  const a2a1 = p.createA2AEvent({
    work_item_id: wi.id,
    from_agent: "Claude",
    to_agent: "Codex",
    purpose: "solution_question",
    context: "T15 方案讨论",
    claim_or_request: "Dogfooding 指标应该包括哪些维度？",
  });
  const a2a2 = p.createA2AEvent({
    work_item_id: wi.id,
    from_agent: "Codex",
    to_agent: "Claude",
    purpose: "task_handover",
    context: "T15 实现分工",
    claim_or_request: "你负责核心模块，我负责 Review",
  });
  const a2a3 = p.createA2AEvent({
    work_item_id: wi.id,
    from_agent: "Claude",
    to_agent: "Codex",
    purpose: "review_request",
    context: "请求 Codex Review",
    claim_or_request: "T15 代码已就绪",
    requires_user_intervention: true,
  });

  // 创建 Task
  const task1 = p.createTask({
    work_item_id: wi.id,
    owner_agent: "Claude",
    reviewer_agent: "Codex",
    boundary: "实现 evaluateMetrics",
    status: "completed",
  });
  const task2 = p.createTask({
    work_item_id: wi.id,
    owner_agent: "Codex",
    reviewer_agent: "Claude",
    boundary: "Review T15 实现",
    status: "in_progress",
  });
  const task3 = p.createTask({
    work_item_id: wi.id,
    owner_agent: "Claude",
    reviewer_agent: "Codex",
    boundary: "补充验证测试",
    status: "blocked",
    collaborators: ["MiniMax"],
  });

  // 创建 ReviewRecord
  const rev1 = p.createReviewRecord({
    work_item_id: wi.id,
    author_agent: "Claude",
    reviewer_agent: "Codex",
    scope: "T15 核心模块",
    result: "changes_requested",
    findings: ["缺少错误处理测试", { severity: "P1", description: "queryEvaluations 边界未覆盖" }],
  });
  const rev2 = p.createReviewRecord({
    work_item_id: wi.id,
    author_agent: "Claude",
    reviewer_agent: "Codex",
    scope: "T15 修复后复核",
    result: "approved",
    findings: ["所有问题已修复"],
  });

  // 创建 QualityGateRun
  const qg1 = p.createQualityGateRun({
    work_item_id: wi.id,
    gate_name: "npm run check",
    final_status: "passed",
  });
  const qg2 = p.createQualityGateRun({
    work_item_id: wi.id,
    gate_name: "verify:dogfooding",
    final_status: "failed",
    failure_reason: "3 项验证失败",
    failure_summary: "summarizeEvaluation 返回格式与预期不一致",
  });
  const qg3 = p.createQualityGateRun({
    work_item_id: wi.id,
    gate_name: "npm test",
    final_status: "blocked",
    failure_reason: "依赖模块缺失",
  });

  // 创建 DeliveryRecord
  const del1 = p.createDeliveryRecord({
    work_item_id: wi.id,
    action: "prepare_commit",
    actor_agent: "Claude",
    current_branch: "claude/t15-dogfooding",
    result: "passed",
  });
  const del2 = p.createDeliveryRecord({
    work_item_id: wi.id,
    action: "feature_push",
    actor_agent: "Claude",
    current_branch: "claude/t15-dogfooding",
    result: "passed",
    push_status: "succeeded",
  });
  const del3 = p.createDeliveryRecord({
    work_item_id: wi.id,
    action: "feature_push",
    actor_agent: "Claude",
    current_branch: "claude/t15-dogfooding",
    result: "blocked",
    push_status: "failed",
    failure_summary: "main 分支保护拒绝推送",
  });

  // 创建 EscalationRecord
  const esc1 = p.createEscalationRecord({
    work_item_id: wi.id,
    trigger_rule: "gate_failure",
    what_happened: "质量门禁验证失败",
    blocked_gate: "verify:dogfooding",
    options: ["修复后重试", "跳过门禁"],
    risks: "跳过门禁可能导致回归",
    recommended_next_step: "修复后重新验证",
  });
  // 设置 escalation status（T12 创建时默认为 pending_user_confirmation）
  p.escalationRecordStore.update(esc1.id, {
    status: "pending_user_confirmation",
  });

  const esc2 = p.createEscalationRecord({
    work_item_id: wi.id,
    trigger_rule: "risk_detected",
    what_happened: "发现跨模块影响风险",
    blocked_gate: "pre-merge-check",
    options: ["确认继续", "回滚变更"],
    risks: "可能影响 T14 已有功能",
    recommended_next_step: "先做影响分析",
  });
  p.escalationRecordStore.update(esc2.id, {
    status: "confirmed",
    user_decision: "confirm",
  });

  // 创建 RetrospectiveMemory
  const retro = p.createRetrospectiveMemory({
    work_item_id: wi.id,
    participating_agents: ["Claude", "Codex"],
    rework_count: 1,
    retrospective_conclusion: "T15 实现顺利，Review 发现 2 项问题已修复",
    process_improvement_suggestions: ["Review 前先自检 verify 脚本"],
    technical_execution_suggestions: ["评估指标应支持分页查询"],
    effective_patterns: ["先写测试再写实现"],
    confirmed_as_baseline: false,
  });

  return {
    p, wi, wi2, wi3,
    a2a1, a2a2, a2a3,
    task1, task2, task3,
    rev1, rev2,
    qg1, qg2, qg3,
    del1, del2, del3,
    esc1, esc2,
    retro,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. evaluateMetrics — 基本指标计算
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n=== Section 1: evaluateMetrics — 基本指标 ===");

{
  const { p, wi } = setup();
  const metrics = evaluateMetrics(p, wi.id);

  assert(metrics !== null, "1.1 返回非 null");
  assertEqual(metrics.work_item_id, wi.id, "1.2 work_item_id 匹配");
  assert(typeof metrics.evaluated_at === "string", "1.3 evaluated_at 是字符串");
  assert(metrics.timing !== undefined, "1.4 timing 存在");
  assert(metrics.a2a !== undefined, "1.5 a2a 存在");
  assert(metrics.review !== undefined, "1.6 review 存在");
  assert(metrics.quality_gate !== undefined, "1.7 quality_gate 存在");
  assert(metrics.delivery !== undefined, "1.8 delivery 存在");
  assert(metrics.escalation !== undefined, "1.9 escalation 存在");
  assert(metrics.task !== undefined, "1.10 task 存在");
  assert(metrics.memory_usage !== undefined, "1.11 memory_usage 存在");
  assert(metrics.summary_counts !== undefined, "1.12 summary_counts 存在");
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. evaluateMetrics — 空工作项（无关联记录）
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n=== Section 2: evaluateMetrics — 空工作项 ===");

{
  const { p, wi3 } = setup();
  const metrics = evaluateMetrics(p, wi3.id);

  assertEqual(metrics.a2a.total_count, 0, "2.1 A2A 总数为 0");
  assertEqual(metrics.review.total_count, 0, "2.2 Review 总数为 0");
  assertEqual(metrics.quality_gate.total_count, 0, "2.3 门禁总数为 0");
  assertEqual(metrics.delivery.total_checks, 0, "2.4 交付检查总数为 0");
  assertEqual(metrics.escalation.total_count, 0, "2.5 升级总数为 0");
  assertEqual(metrics.task.total_count, 0, "2.6 任务总数为 0");
  assertEqual(metrics.memory_usage.retrospective_generated, false, "2.7 未生成复盘");
  assert(metrics.timing.total_span_ms === null, "2.8 无关联记录时 total_span_ms 为 null");
  assert(metrics.timing.entry_to_first_task_ms === null, "2.9 无任务时 entry_to_first_task_ms 为 null");
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. evaluateMetrics — A2A 指标
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n=== Section 3: evaluateMetrics — A2A 指标 ===");

{
  const { p, wi } = setup();
  const metrics = evaluateMetrics(p, wi.id);

  assertEqual(metrics.a2a.total_count, 3, "3.1 A2A 总数 = 3");
  assertEqual(
    metrics.a2a.by_purpose["solution_question"], 1,
    "3.2 solution_question 计数 = 1"
  );
  assertEqual(
    metrics.a2a.by_purpose["task_handover"], 1,
    "3.3 task_handover 计数 = 1"
  );
  assertEqual(
    metrics.a2a.by_purpose["review_request"], 1,
    "3.4 review_request 计数 = 1"
  );
  assertEqual(metrics.a2a.manual_intervention_count, 1, "3.5 人工介入计数 = 1");
  assert(
    metrics.a2a.agent_participation.includes("Claude"),
    "3.6 Agent 参与包含 Claude"
  );
  assert(
    metrics.a2a.agent_participation.includes("Codex"),
    "3.7 Agent 参与包含 Codex"
  );
  assertEqual(metrics.a2a.agent_participation.length, 2, "3.8 Agent 参与去重 = 2");
  // by_purpose 的键值对总数 = 3
  assertEqual(
    Object.keys(metrics.a2a.by_purpose).length, 3,
    "3.9 by_purpose 键值对数量 = 3"
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. evaluateMetrics — Review 指标
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n=== Section 4: evaluateMetrics — Review 指标 ===");

{
  const { p, wi } = setup();
  const metrics = evaluateMetrics(p, wi.id);

  assertEqual(metrics.review.total_count, 2, "4.1 Review 总数 = 2");
  assertEqual(metrics.review.rework_rounds, 1, "4.2 返工轮次 = 1 (changes_requested)");
  assertEqual(metrics.review.approval_count, 1, "4.3 通过数 = 1");
  assertEqual(metrics.review.changes_requested_count, 1, "4.4 changes_requested 计数 = 1");
  assertEqual(metrics.review.dispute_count, 0, "4.5 争议数 = 0");
  assertEqual(metrics.review.user_confirmation_count, 0, "4.6 需用户确认数 = 0");
  // findings_count：rev1 有 2 条 (1 string + 1 object)，rev2 有 1 条
  assertEqual(metrics.review.findings_count, 3, "4.7 发现总数 = 3");
  // 验证 object findings 被保留
  assertEqual(metrics.summary_counts.total_review_findings, 3, "4.8 summary_counts 中 review_findings = 3");
  // T9 已确认口径：approved 不计入 unresolved（即使 resolved 未显式设为 true）
// rev1: changes_requested, default resolved=false → 计入 unresolved
// rev2: approved, resolved=true → 不计入（approved 排除）
assertEqual(metrics.review.unresolved_count, 1, "4.9 未解决 Review = 1 (approved 被 T9 口径排除)");
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. evaluateMetrics — 质量门禁指标
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n=== Section 4b: T9 unresolved 口径回归 ===");

{
  // 回归验证：approved + resolved=false 不应计入 unresolved（T9 已确认口径）
  const dir = path.join(TMP_BASE, `s${++setupCounter}`);
  fs.mkdirSync(dir, { recursive: true });
  const p = createPersistence(dir);
  const wi = p.createWorkItem({ goal: "T9 unresolved口径回归", type: "feature" });
  p.createReviewRecord({
    work_item_id: wi.id,
    author_agent: "Claude",
    reviewer_agent: "Codex",
    scope: "approved 但未显式标记 resolved",
    result: "approved",
    findings: [],
  });
  p.createReviewRecord({
    work_item_id: wi.id,
    author_agent: "Claude",
    reviewer_agent: "Codex",
    scope: "changes_requested 未解决",
    result: "changes_requested",
    findings: ["需要修改"],
  });
  const m = evaluateMetrics(p, wi.id);
  assertEqual(m.review.unresolved_count, 1, "4b.1 approved(resolved=false)不计入, changes_requested 计入 → unresolved=1");
  assertEqual(m.review.approval_count, 1, "4b.2 approved 计数不受影响");
}

console.log("\n=== Section 5: evaluateMetrics — 质量门禁指标 ===");

{
  const { p, wi } = setup();
  const metrics = evaluateMetrics(p, wi.id);

  assertEqual(metrics.quality_gate.total_count, 3, "5.1 门禁总数 = 3");
  assertEqual(metrics.quality_gate.passed_count, 1, "5.2 通过数 = 1");
  assertEqual(metrics.quality_gate.failed_count, 1, "5.3 失败数 = 1");
  assertEqual(metrics.quality_gate.blocked_count, 1, "5.4 阻塞数 = 1");
  assertEqual(metrics.quality_gate.user_confirmed_count, 0, "5.5 用户确认数 = 0");
  assertEqual(
    metrics.summary_counts.total_gate_failures, 2,
    "5.6 summary_counts 门禁失败总数 = failed + blocked = 2"
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. evaluateMetrics — 交付指标
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n=== Section 6: evaluateMetrics — 交付指标 ===");

{
  const { p, wi } = setup();
  const metrics = evaluateMetrics(p, wi.id);

  assertEqual(metrics.delivery.total_checks, 3, "6.1 交付检查总数 = 3");
  assertEqual(metrics.delivery.prepare_count, 1, "6.2 prepare_commit 数 = 1");
  assertEqual(metrics.delivery.push_count, 2, "6.3 feature_push 数 = 2");
  assertEqual(metrics.delivery.passed_checks, 2, "6.4 检查通过数 = 2");
  assertEqual(metrics.delivery.blocked_checks, 1, "6.5 检查阻塞数 = 1");
  assertEqual(metrics.delivery.failed_checks, 0, "6.6 检查失败数 = 0");
  assertEqual(metrics.delivery.successful_pushes, 1, "6.7 成功推送数 = 1");
  assertEqual(metrics.delivery.failed_pushes, 1, "6.8 失败推送数 = 1");
  assertEqual(metrics.delivery.not_attempted_pushes, 1, "6.9 未尝试推送数 = 1");
  assertEqual(metrics.delivery.ready_pushes, 0, "6.10 待推送数 = 0");
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. evaluateMetrics — 升级指标
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n=== Section 7: evaluateMetrics — 升级指标 ===");

{
  const { p, wi } = setup();
  const metrics = evaluateMetrics(p, wi.id);

  assertEqual(metrics.escalation.total_count, 2, "7.1 升级总数 = 2");
  assertEqual(metrics.escalation.pending_count, 1, "7.2 待处理数 = 1 (pending_user_confirmation)");
  assertEqual(metrics.escalation.resolved_count, 1, "7.3 已解决数 = 1 (confirmed)");
  assertEqual(metrics.escalation.by_trigger["gate_failure"], 1, "7.4 gate_failure 触发 = 1");
  assertEqual(metrics.escalation.by_trigger["risk_detected"], 1, "7.5 risk_detected 触发 = 1");
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. evaluateMetrics — 任务指标
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n=== Section 8: evaluateMetrics — 任务指标 ===");

{
  const { p, wi } = setup();
  const metrics = evaluateMetrics(p, wi.id);

  assertEqual(metrics.task.total_count, 3, "8.1 任务总数 = 3");
  assertEqual(metrics.task.completed_count, 1, "8.2 已完成 = 1");
  assertEqual(metrics.task.in_progress_count, 1, "8.3 进行中 = 1");
  assertEqual(metrics.task.blocked_count, 1, "8.4 阻塞 = 1");
  assertEqual(metrics.task.pending_count, 0, "8.5 待开始 = 0");
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. evaluateMetrics — 复盘记忆使用
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n=== Section 9: evaluateMetrics — 复盘记忆使用 ===");

{
  const { p, wi, wi3 } = setup();

  const metricsWith = evaluateMetrics(p, wi.id);
  assertEqual(metricsWith.memory_usage.retrospective_generated, true, "9.1 有复盘时 retrospective_generated = true");
  assertEqual(metricsWith.memory_usage.retrospective_count, 1, "9.2 retrospective_count = 1");
  assertEqual(metricsWith.memory_usage.confirmed_as_baseline, false, "9.3 confirmed_as_baseline = false");

  const metricsWithout = evaluateMetrics(p, wi3.id);
  assertEqual(metricsWithout.memory_usage.retrospective_generated, false, "9.4 无复盘时 retrospective_generated = false");
  assertEqual(metricsWithout.memory_usage.retrospective_count, 0, "9.5 retrospective_count = 0");
  assertEqual(metricsWithout.memory_usage.confirmed_as_baseline, false, "9.6 无复盘时 confirmed_as_baseline = false");
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. evaluateMetrics — 耗时计算
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n=== Section 10: evaluateMetrics — 耗时计算 ===");

{
  const { p, wi } = setup();
  const metrics = evaluateMetrics(p, wi.id);

  assert(
    metrics.timing.work_item_created_at !== null,
    "10.1 work_item_created_at 不为 null"
  );
  assert(
    typeof metrics.timing.total_span_ms === "number",
    "10.2 total_span_ms 是数字"
  );
  assert(metrics.timing.total_span_ms >= 0, "10.3 total_span_ms >= 0");
  assert(
    typeof metrics.timing.entry_to_first_task_ms === "number",
    "10.4 entry_to_first_task_ms 是数字"
  );
  assert(
    metrics.timing.entry_to_first_task_ms >= 0,
    "10.5 entry_to_first_task_ms >= 0"
  );
  assert(
    typeof metrics.timing.entry_to_first_a2a_ms === "number",
    "10.6 entry_to_first_a2a_ms 是数字"
  );
  assert(
    typeof metrics.timing.entry_to_first_review_ms === "number",
    "10.7 entry_to_first_review_ms 是数字"
  );
  assert(
    typeof metrics.timing.entry_to_first_delivery_ms === "number",
    "10.8 entry_to_first_delivery_ms 是数字"
  );
  assert(metrics.timing.first_task_at !== null, "10.9 first_task_at 不为 null");
  assert(metrics.timing.first_a2a_at !== null, "10.10 first_a2a_at 不为 null");
  assert(metrics.timing.first_review_at !== null, "10.11 first_review_at 不为 null");
  assert(metrics.timing.first_delivery_at !== null, "10.12 first_delivery_at 不为 null");
  assert(metrics.timing.latest_record_at !== null, "10.13 latest_record_at 不为 null");

  // total_span_ms 应大于等于各阶段跨度
  assert(
    metrics.timing.total_span_ms >= (metrics.timing.entry_to_first_task_ms || 0),
    "10.14 total_span >= entry_to_first_task"
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. summarizeEvaluation — 页面消费格式
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n=== Section 11: summarizeEvaluation — 页面消费格式 ===");

{
  const { p, wi } = setup();
  const summary = summarizeEvaluation(p, wi.id);

  assertEqual(summary.work_item_id, wi.id, "11.1 work_item_id 匹配");
  assert(summary.key_metrics !== undefined, "11.2 key_metrics 存在");
  assert(summary.detail !== undefined, "11.3 detail 存在");
  assert(summary._notice !== undefined, "11.4 _notice 存在");

  // key_metrics 字段
  assert(
    typeof summary.key_metrics.total_elapsed_ms === "number" || summary.key_metrics.total_elapsed_ms === null,
    "11.5 total_elapsed_ms"
  );
  assertEqual(summary.key_metrics.a2a_interactions, 3, "11.6 a2a_interactions = 3");
  assertEqual(summary.key_metrics.review_findings, 3, "11.7 review_findings = 3");
  assertEqual(summary.key_metrics.rework_rounds, 1, "11.8 rework_rounds = 1");
  assertEqual(summary.key_metrics.gate_failures, 2, "11.9 gate_failures = 2");
  assertEqual(summary.key_metrics.escalations, 2, "11.10 escalations = 2");
  assertEqual(summary.key_metrics.tasks_total, 3, "11.11 tasks_total = 3");
  assertEqual(summary.key_metrics.delivery_outcome, "pushed", "11.12 delivery_outcome = pushed");
  assertEqual(summary.key_metrics.retrospective_generated, true, "11.13 retrospective_generated = true");

  // improvement_suggestions 来自 T14 复盘
  assert(summary.improvement_suggestions !== null, "11.14 improvement_suggestions 不为 null");
  assertEqual(
    summary.improvement_suggestions.conclusion,
    "T15 实现顺利，Review 发现 2 项问题已修复",
    "11.15 conclusion 来自 T14 复盘"
  );
  assert(
    summary.improvement_suggestions.process.includes("Review 前先自检 verify 脚本"),
    "11.16 process 建议包含 T14 复盘内容"
  );
  assert(
    summary.improvement_suggestions.technical.includes("评估指标应支持分页查询"),
    "11.17 technical 建议包含 T14 复盘内容"
  );
  assert(
    summary.improvement_suggestions.effective_patterns.includes("先写测试再写实现"),
    "11.18 effective_patterns 包含 T14 复盘内容"
  );

  // detail 包含完整指标
  assertEqual(summary.detail.a2a.total_count, 3, "11.19 detail.a2a 完整");
  assertEqual(summary.detail.review.total_count, 2, "11.20 detail.review 完整");
}

// ═══════════════════════════════════════════════════════════════════════════
// 12. summarizeEvaluation — 无复盘时 improvement_suggestions=null
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n=== Section 12: summarizeEvaluation — 无复盘 ===");

{
  const { p, wi3 } = setup();
  const summary = summarizeEvaluation(p, wi3.id);

  assertEqual(summary.improvement_suggestions, null, "12.1 无复盘时 improvement_suggestions = null");
  assertEqual(summary.key_metrics.delivery_outcome, "not_attempted", "12.2 delivery_outcome = not_attempted");
  assertEqual(summary.key_metrics.retrospective_generated, false, "12.3 retrospective_generated = false");
  assert(summary._notice !== undefined, "12.4 _notice 仍存在");
}

// ═══════════════════════════════════════════════════════════════════════════
// 13. queryEvaluations — 过滤查询
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n=== Section 13: queryEvaluations — 过滤查询 ===");

{
  const { p, wi, wi2 } = setup();

  // 按 work_item_id 过滤
  const byId = queryEvaluations(p, { work_item_id: wi.id });
  assertEqual(byId.length, 1, "13.1 按 work_item_id 过滤返回 1 条");
  assertEqual(byId[0].work_item_id, wi.id, "13.2 返回正确的工作项");

  // 按 status 过滤
  const byStatus = queryEvaluations(p, { status: "needs_clarification" });
  assert(byStatus.length >= 3, "13.3 按 status=needs_clarification 过滤返回 >= 3 条");

  // 按 type 过滤
  const byType = queryEvaluations(p, { type: "bug_fix" });
  assertEqual(byType.length, 1, "13.4 按 type=bug_fix 过滤返回 1 条");
  assertEqual(byType[0].work_item_id, wi2.id, "13.5 bug_fix 工作项匹配");

  // 无过滤
  const all = queryEvaluations(p, {});
  assert(all.length >= 3, "13.6 无过滤返回所有工作项");

  // 不匹配的 status
  const noMatch = queryEvaluations(p, { status: "completed" });
  assertEqual(noMatch.length, 0, "13.7 无 completed 状态工作项时返回空数组");
}

// ═══════════════════════════════════════════════════════════════════════════
// 14. 数据隔离 — 深拷贝不污染 Store
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n=== Section 14: 数据隔离 ===");

{
  const { p, wi } = setup();

  const metrics1 = evaluateMetrics(p, wi.id);
  // 修改返回的 metrics 不应影响 Store 数据
  metrics1.a2a.total_count = 999;
  metrics1.review.rework_rounds = 999;

  const metrics2 = evaluateMetrics(p, wi.id);
  assertEqual(metrics2.a2a.total_count, 3, "14.1 A2A 总数不受外部修改影响");
  assertEqual(metrics2.review.rework_rounds, 1, "14.2 返工轮次不受外部修改影响");

  // summary 也不应影响 Store
  const summary = summarizeEvaluation(p, wi.id);
  summary.key_metrics.a2a_interactions = 999;
  summary.detail.a2a.total_count = 999;

  const metrics3 = evaluateMetrics(p, wi.id);
  assertEqual(metrics3.a2a.total_count, 3, "14.3 summarizeEvaluation 不污染 Store");

  // improvement_suggestions 修改不影响复盘记录
  if (summary.improvement_suggestions) {
    summary.improvement_suggestions.process.push("不应该出现的建议");
  }
  const retro = p.retrospectiveMemoryStore.list().filter(r => r.work_item_id === wi.id);
  assertEqual(retro[0].process_improvement_suggestions.length, 1, "14.4 复盘记录不受 summary 修改影响");
}

// ═══════════════════════════════════════════════════════════════════════════
// 15. 错误处理
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n=== Section 15: 错误处理 ===");

{
  const { p } = setup();

  assertThrows(() => evaluateMetrics(p, ""), "15.1 空 work_item_id 抛出");
  assertThrows(() => evaluateMetrics(p, null), "15.2 null work_item_id 抛出");
  assertThrows(() => evaluateMetrics(p, undefined), "15.3 undefined work_item_id 抛出");
  assertThrows(() => evaluateMetrics(p, "nonexistent-id"), "15.4 不存在的工作项抛出");

  assertThrows(() => summarizeEvaluation(p, ""), "15.5 summarizeEvaluation 空 ID 抛出");
  assertThrows(() => summarizeEvaluation(p, "nonexistent-id"), "15.6 summarizeEvaluation 不存在工作项抛出");
}

// ═══════════════════════════════════════════════════════════════════════════
// 16. T14 兼容 — 与 aggregateFacts 无冲突
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n=== Section 16: T14 兼容 ===");

{
  const { p, wi } = setup();
  const { aggregateFacts } = require("../retrospective");

  const t14Facts = aggregateFacts(p, wi.id);
  const t15Metrics = evaluateMetrics(p, wi.id);

  // T14 事实与 T15 指标应一致（相同数据源）
  assertEqual(
    t14Facts.rework_count,
    t15Metrics.review.rework_rounds,
    "16.1 rework_count 一致"
  );
  assertEqual(
    t14Facts.aggregated_facts.a2a_interaction_count,
    t15Metrics.a2a.total_count,
    "16.2 A2A 交互次数一致"
  );
  assertEqual(
    t14Facts.aggregated_facts.review_count,
    t15Metrics.review.total_count,
    "16.3 Review 总数一致"
  );
  assertEqual(
    t14Facts.aggregated_facts.quality_gate_count,
    t15Metrics.quality_gate.total_count,
    "16.4 门禁总数一致"
  );
  assertEqual(
    t14Facts.aggregated_facts.escalation_count,
    t15Metrics.escalation.total_count,
    "16.5 升级总数一致"
  );
  assertEqual(
    t14Facts.aggregated_facts.task_count,
    t15Metrics.task.total_count,
    "16.6 任务总数一致"
  );
  assertEqual(
    t14Facts.aggregated_facts.manual_intervention_count,
    t15Metrics.a2a.manual_intervention_count,
    "16.7 人工介入次数一致"
  );

  // T15 不修改 T14 的事实数据
  const t14FactsAfter = aggregateFacts(p, wi.id);
  assertDeepEqual(
    t14Facts.rework_count,
    t14FactsAfter.rework_count,
    "16.8 T15 不改变 T14 rework_count"
  );
  assertDeepEqual(
    t14Facts.aggregated_facts,
    t14FactsAfter.aggregated_facts,
    "16.9 T15 不改变 T14 aggregated_facts"
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 17. 边界情况
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n=== Section 17: 边界情况 ===");

{
  const { p, wi } = setup();

  // 17.1-17.3: 评估多次应得到一致结果（纯计算，无副作用）
  const m1 = evaluateMetrics(p, wi.id);
  const m2 = evaluateMetrics(p, wi.id);
  assertEqual(m1.a2a.total_count, m2.a2a.total_count, "17.1 多次评估 A2A 一致");
  assertEqual(m1.review.findings_count, m2.review.findings_count, "17.2 多次评估 Review 一致");
  assertEqual(m1.summary_counts.total_gate_failures, m2.summary_counts.total_gate_failures, "17.3 多次评估门禁一致");

  // 17.4-17.5: 负耗时（created_at 顺序异常时允许负值，由调用方发现数据质量问题）
  const m3 = evaluateMetrics(p, wi.id);
  // 由于测试数据按顺序创建，耗时应该非负
  if (m3.timing.entry_to_first_review_ms !== null) {
    assert(m3.timing.entry_to_first_review_ms >= 0, "17.4 entry_to_first_review_ms >= 0（正常顺序）");
  }

  // 17.6: improvement_suggestions 的 confirmed_as_baseline
  const summary = summarizeEvaluation(p, wi.id);
  assertEqual(
    summary.improvement_suggestions.confirmed_as_baseline, false,
    "17.5 confirmed_as_baseline = false"
  );

  // 17.7-17.8: delivery_outcome 枚举值
  assert(
    ["not_attempted", "pushed", "push_failed", "blocked", "ready"].includes(
      summary.key_metrics.delivery_outcome
    ),
    "17.7 delivery_outcome 为合法枚举值"
  );

  // 17.9: summary_counts 完整性
  const sc = m1.summary_counts;
  assert(typeof sc.total_a2a === "number", "17.8 total_a2a 是数字");
  assert(typeof sc.total_review_findings === "number", "17.9 total_review_findings 是数字");
  assert(typeof sc.total_rework_rounds === "number", "17.10 total_rework_rounds 是数字");
  assert(typeof sc.total_gate_failures === "number", "17.11 total_gate_failures 是数字");
  assert(typeof sc.total_escalations === "number", "17.12 total_escalations 是数字");
  assert(typeof sc.total_delivery_checks === "number", "17.13 total_delivery_checks 是数字");
  assert(typeof sc.total_tasks === "number", "17.14 total_tasks 是数字");
}

// ═══════════════════════════════════════════════════════════════════════════
// 报告
// ═══════════════════════════════════════════════════════════════════════════

console.log(`\n${"=".repeat(50)}`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
console.log(`${"=".repeat(50)}\n`);

// 清理
try {
  fs.rmSync(TMP_BASE, { recursive: true, force: true });
} catch (_e) {
  // 清理失败不阻塞验证结果
}

process.exit(failed > 0 ? 1 : 0);
