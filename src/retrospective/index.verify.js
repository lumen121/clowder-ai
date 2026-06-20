#!/usr/bin/env node
/**
 * src/retrospective/index.verify.js — T14 复盘记录最小闭环验证
 *
 * 覆盖：
 *   - aggregateFacts：事实聚合正确性
 *   - generateRetrospective：复盘生成（事实+结论+建议）
 *   - updateRetrospective：更新白名单与类型校验
 *   - queryRetrospectives：查询过滤
 *   - summarizeRetrospective：页面摘要结构
 *   - 数据隔离（深拷贝）
 *   - 错误处理与边界
 */

const path = require("path");
const os = require("os");
const fs = require("fs");

// 使用临时目录隔离测试数据
const TMP = path.join(os.tmpdir(), `t14-verify-${Date.now()}`);
fs.mkdirSync(TMP, { recursive: true });

const { createPersistence } = require("../storage");
const {
  aggregateFacts,
  generateRetrospective,
  updateRetrospective,
  queryRetrospectives,
  summarizeRetrospective,
} = require("./index");

const p = createPersistence(TMP);

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

function assertEq(a, b, label) {
  if (a === b) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
}

function assertDeepEq(a, b, label) {
  if (JSON.stringify(a) === JSON.stringify(b)) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
}

function assertThrows(fn, label) {
  try {
    fn();
    failed++;
    console.error(`  FAIL: ${label} — expected throw, but no error`);
  } catch (_) {
    passed++;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 准备测试数据
// ═══════════════════════════════════════════════════════════════════════════

const wi = p.createWorkItem({ goal: "实现用户登录功能", type: "feature" });
const wi2 = p.createWorkItem({ goal: "修复页面崩溃 Bug", type: "bug_fix" });

// Tasks
const t1 = p.createTask({ work_item_id: wi.id, owner_agent: "Claude", reviewer_agent: "Codex" });
const t2 = p.createTask({ work_item_id: wi.id, owner_agent: "Codex", reviewer_agent: "Claude" });

// A2AEvents
p.createA2AEvent({
  from_agent: "Claude", to_agent: "Codex", work_item_id: wi.id,
  purpose: "solution_question", context: "方案讨论",
});
p.createA2AEvent({
  from_agent: "Codex", to_agent: "Claude", work_item_id: wi.id,
  purpose: "task_handover", context: "任务交接",
});
p.createA2AEvent({
  from_agent: "Claude", to_agent: "Codex", work_item_id: wi.id,
  purpose: "review_request", context: "Review 请求",
  requires_user_intervention: true,
});

// ReviewRecords
p.createReviewRecord({
  work_item_id: wi.id, author_agent: "Claude", reviewer_agent: "Codex",
  result: "changes_requested", findings: ["变量命名不规范", "缺少错误处理"],
});
p.createReviewRecord({
  work_item_id: wi.id, author_agent: "Claude", reviewer_agent: "Codex",
  result: "approved", findings: [],
});

// QualityGateRuns
p.createQualityGateRun({
  work_item_id: wi.id, gate_name: "lint", final_status: "passed",
  validation_method: "npm run check", result: "35 files OK",
});
p.createQualityGateRun({
  work_item_id: wi.id, gate_name: "test", final_status: "failed",
  failure_reason: "3/40 tests failed",
  failure_summary: "状态机 blocked 出口校验断言失败",
  validation_method: "npm test", result: "failed",
});

// EscalationRecords
p.createEscalationRecord({
  work_item_id: wi.id, trigger_rule: "QUALITY_GATE_NOT_PASSED",
  what_happened: "质量门禁 test 失败",
  user_decision: "confirm",
});
p.createEscalationRecord({
  work_item_id: wi.id, trigger_rule: "HIGH_RISK_ACTION_REQUIRES_CONFIRMATION",
  what_happened: "请求推送到 master",
  user_decision: "reject",
});

console.log("T14 Retrospective Module Verification\n");

// ═══════════════════════════════════════════════════════════════════════════
// 1. aggregateFacts — 基本聚合
// ═══════════════════════════════════════════════════════════════════════════

console.log("1. aggregateFacts — 基本聚合");

{
  const facts = aggregateFacts(p, wi.id);

  // 参与 Agent：从 A2A 和 Task 中收集
  assert(
    facts.participating_agents.includes("Claude"),
    "1.1 参与 Agent 包含 Claude"
  );
  assert(
    facts.participating_agents.includes("Codex"),
    "1.2 参与 Agent 包含 Codex"
  );
  assertEq(facts.participating_agents.length >= 2, true, "1.3 至少 2 个参与 Agent");

  // 返工次数：result=changes_requested 的 Review 数量
  assertEq(facts.rework_count, 1, "1.4 返工次数=1（1 条 changes_requested）");

  // Review 发现
  assertEq(facts.review_findings.length, 2, "1.5 Review 发现 2 条");
  assert(
    facts.review_findings.includes("变量命名不规范"),
    "1.6 发现包含'变量命名不规范'"
  );

  // 质量门禁结果
  assertEq(facts.quality_gate_results.length, 2, "1.7 质量门禁结果 2 条");
  assertEq(facts.quality_gate_results[0].gate_name, "lint", "1.8 第一条门禁名为 lint");
  assertEq(facts.quality_gate_results[1].final_status, "failed", "1.9 第二条门禁 failed");

  // 失败原因
  assert(facts.failure_causes.length >= 2, "1.10 失败原因至少 2 条（failure_reason + failure_summary）");

  // 升级结果
  assertEq(facts.escalation_results.length, 2, "1.11 升级结果 2 条");

  // 用户介入原因
  assertEq(facts.user_intervention_reasons.length, 2, "1.12 用户介入原因 2 条");

  // 聚合事实对象
  assertEq(facts.aggregated_facts.work_item_type, "feature", "1.13 工作项类型=feature");
  assertEq(facts.aggregated_facts.final_status, "needs_clarification", "1.14 最终状态");
  assertEq(facts.aggregated_facts.a2a_interaction_count, 3, "1.15 A2A 交互次数=3");
  assertEq(facts.aggregated_facts.manual_intervention_count, 1, "1.16 人工介入次数=1");
  assertEq(facts.aggregated_facts.review_count, 2, "1.17 Review 数量=2");
  assertEq(facts.aggregated_facts.quality_gate_count, 2, "1.18 质量门禁数量=2");
  assertEq(facts.aggregated_facts.escalation_count, 2, "1.19 升级数量=2");
  assertEq(facts.aggregated_facts.task_count, 2, "1.20 Task 数量=2");
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. aggregateFacts — 错误处理
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n2. aggregateFacts — 错误处理");

{
  assertThrows(
    () => aggregateFacts(p, ""),
    "2.1 空 work_item_id 拒绝"
  );
  assertThrows(
    () => aggregateFacts(p, null),
    "2.2 null work_item_id 拒绝"
  );
  assertThrows(
    () => aggregateFacts(p, "nonexistent-id"),
    "2.3 不存在的工作项拒绝"
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. aggregateFacts — 空工作项（无关联记录）
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n3. aggregateFacts — 无关联记录的工作项");

{
  const facts = aggregateFacts(p, wi2.id);

  assertEq(facts.participating_agents.length, 0, "3.1 无参与 Agent");
  assertEq(facts.rework_count, 0, "3.2 返工次数=0");
  assertEq(facts.review_findings.length, 0, "3.3 无 Review 发现");
  assertEq(facts.quality_gate_results.length, 0, "3.4 无质量门禁结果");
  assertEq(facts.failure_causes.length, 0, "3.5 无失败原因");
  assertEq(facts.escalation_results.length, 0, "3.6 无升级结果");
  assertEq(facts.user_intervention_reasons.length, 0, "3.7 无用户介入原因");
  assertEq(facts.aggregated_facts.a2a_interaction_count, 0, "3.8 A2A=0");
  assertEq(facts.aggregated_facts.review_count, 0, "3.9 Review=0");
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. generateRetrospective — 基本生成
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n4. generateRetrospective — 基本生成");

{
  const retro = generateRetrospective(p, wi.id, {
    retrospective_conclusion: "整体流程顺利，Review 发现的问题及时修复",
    process_improvement_suggestions: ["加强 Review 前的自检"],
    technical_execution_suggestions: ["统一错误处理模式"],
    effective_patterns: ["A2A 及时同步阻塞信息"],
  });

  assert(retro.id && retro.id.startsWith("retro-"), "4.1 生成记录 ID");
  assertEq(retro.work_item_id, wi.id, "4.2 work_item_id 正确");
  assertEq(retro.retrospective_conclusion, "整体流程顺利，Review 发现的问题及时修复", "4.3 结论已写入");
  assertDeepEq(
    retro.process_improvement_suggestions,
    ["加强 Review 前的自检"],
    "4.4 流程改进建议已写入"
  );
  assertDeepEq(
    retro.technical_execution_suggestions,
    ["统一错误处理模式"],
    "4.5 技术执行建议已写入"
  );
  assertDeepEq(
    retro.effective_patterns,
    ["A2A 及时同步阻塞信息"],
    "4.6 有效做法已写入"
  );

  // 事实已自动聚合
  assertEq(retro.rework_count, 1, "4.7 事实：返工次数=1");
  assert(retro.participating_agents.length >= 2, "4.8 事实：参与 Agent 已聚合");
  assertEq(retro.review_findings.length, 2, "4.9 事实：Review 发现已聚合");
  assertEq(retro.escalation_results.length, 2, "4.10 事实：升级结果已聚合");
  assertEq(retro.aggregated_facts.work_item_type, "feature", "4.11 事实：聚合对象已写入");

  // 默认值
  assertEq(retro.confirmed_as_baseline, false, "4.12 默认 confirmed_as_baseline=false");
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. generateRetrospective — input 不可覆写事实
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n5. generateRetrospective — input 不可覆写事实");

{
  const retro = generateRetrospective(p, wi.id, {
    rework_count: 999,  // 尝试覆写事实
    participating_agents: ["fake-agent"],
    retrospective_conclusion: "测试结论",
  });

  // 事实以 aggregateFacts 为准，不被 input 覆写
  assertEq(retro.rework_count, 1, "5.1 rework_count 未被覆写（仍为聚合值）");
  assert(
    !retro.participating_agents.includes("fake-agent"),
    "5.2 participating_agents 未被覆写"
  );
  // 但结论正常写入
  assertEq(retro.retrospective_conclusion, "测试结论", "5.3 结论正常写入");
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. generateRetrospective — 默认值（无 input）
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n6. generateRetrospective — 默认值");

{
  const retro = generateRetrospective(p, wi2.id);

  assertEq(retro.retrospective_conclusion, "", "6.1 默认结论为空字符串");
  assertEq(retro.process_improvement_suggestions.length, 0, "6.2 默认改进建议为空数组");
  assertEq(retro.technical_execution_suggestions.length, 0, "6.3 默认技术建议为空数组");
  assertEq(retro.effective_patterns.length, 0, "6.4 默认有效做法为空数组");
  assertEq(retro.rework_count, 0, "6.5 返工次数=0");
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. generateRetrospective — 错误处理
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n7. generateRetrospective — 错误处理");

{
  assertThrows(
    () => generateRetrospective(p, ""),
    "7.1 空 work_item_id 拒绝"
  );
  assertThrows(
    () => generateRetrospective(p, null),
    "7.2 null work_item_id 拒绝"
  );
  assertThrows(
    () => generateRetrospective(p, "no-such-id"),
    "7.3 不存在的工作项拒绝（底层 aggregateFacts 抛错）"
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. updateRetrospective — 正常更新
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n8. updateRetrospective — 正常更新");

{
  const retro = generateRetrospective(p, wi.id, {
    retrospective_conclusion: "初始结论",
    process_improvement_suggestions: ["建议1"],
    technical_execution_suggestions: ["技术建议1"],
  });

  // 更新结论
  const u1 = updateRetrospective(p, retro.id, {
    retrospective_conclusion: "修订后的结论",
  });
  assertEq(u1.retrospective_conclusion, "修订后的结论", "8.1 结论已更新");
  assertEq(u1.process_improvement_suggestions.length, 1, "8.2 未修改字段保持不变");

  // 更新建议
  const u2 = updateRetrospective(p, retro.id, {
    process_improvement_suggestions: ["建议1", "建议2"],
    technical_execution_suggestions: ["技术建议1", "技术建议2"],
  });
  assertEq(u2.process_improvement_suggestions.length, 2, "8.3 流程建议增加到 2 条");
  assertEq(u2.technical_execution_suggestions.length, 2, "8.4 技术建议增加到 2 条");

  // 更新有效做法
  const u3 = updateRetrospective(p, retro.id, {
    effective_patterns: ["模式A", "模式B"],
  });
  assertEq(u3.effective_patterns.length, 2, "8.5 有效做法已更新");

  // 标记为基线
  const u4 = updateRetrospective(p, retro.id, {
    confirmed_as_baseline: true,
  });
  assertEq(u4.confirmed_as_baseline, true, "8.6 标记为基线");
  assertEq(u4.retrospective_conclusion, "修订后的结论", "8.7 其他字段未变");

  // 取消基线标记
  const u5 = updateRetrospective(p, retro.id, {
    confirmed_as_baseline: false,
  });
  assertEq(u5.confirmed_as_baseline, false, "8.8 取消基线标记");
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. updateRetrospective — 白名单拒绝
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n9. updateRetrospective — 白名单拒绝");

{
  const retro = generateRetrospective(p, wi.id, {});

  assertThrows(
    () => updateRetrospective(p, retro.id, { work_item_id: "other" }),
    "9.1 拒绝修改 work_item_id"
  );
  assertThrows(
    () => updateRetrospective(p, retro.id, { rework_count: 99 }),
    "9.2 拒绝修改 rework_count（事实字段）"
  );
  assertThrows(
    () => updateRetrospective(p, retro.id, { participating_agents: [] }),
    "9.3 拒绝修改 participating_agents（事实字段）"
  );
  assertThrows(
    () => updateRetrospective(p, retro.id, { aggregated_facts: {} }),
    "9.4 拒绝修改 aggregated_facts（事实字段）"
  );
  assertThrows(
    () => updateRetrospective(p, retro.id, { review_findings: [] }),
    "9.5 拒绝修改 review_findings（事实字段）"
  );
  assertThrows(
    () => updateRetrospective(p, retro.id, { quality_gate_results: [] }),
    "9.6 拒绝修改 quality_gate_results（事实字段）"
  );
  assertThrows(
    () => updateRetrospective(p, retro.id, { failure_causes: [] }),
    "9.7 拒绝修改 failure_causes（事实字段）"
  );
  assertThrows(
    () => updateRetrospective(p, retro.id, { user_intervention_reasons: [] }),
    "9.8 拒绝修改 user_intervention_reasons（事实字段）"
  );
  assertThrows(
    () => updateRetrospective(p, retro.id, { escalation_results: [] }),
    "9.9 拒绝修改 escalation_results（事实字段）"
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. updateRetrospective — 类型校验
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n10. updateRetrospective — 类型校验");

{
  const retro = generateRetrospective(p, wi.id, {});

  assertThrows(
    () => updateRetrospective(p, retro.id, { confirmed_as_baseline: "yes" }),
    "10.1 confirmed_as_baseline 非 boolean 拒绝"
  );
  assertThrows(
    () => updateRetrospective(p, retro.id, { process_improvement_suggestions: "not_array" }),
    "10.2 process_improvement_suggestions 非数组拒绝"
  );
  assertThrows(
    () => updateRetrospective(p, retro.id, { technical_execution_suggestions: "not_array" }),
    "10.3 technical_execution_suggestions 非数组拒绝"
  );
  assertThrows(
    () => updateRetrospective(p, retro.id, { effective_patterns: "not_array" }),
    "10.4 effective_patterns 非数组拒绝"
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. updateRetrospective — 不存在记录
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n11. updateRetrospective — 不存在记录");

{
  assertThrows(
    () => updateRetrospective(p, "retro-nonexistent", { retrospective_conclusion: "x" }),
    "11.1 不存在的记录拒绝"
  );
  assertThrows(
    () => updateRetrospective(p, "", {}),
    "11.2 空 id 拒绝"
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 12. queryRetrospectives — 查询过滤
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n12. queryRetrospectives — 查询过滤");

{
  const retro1 = generateRetrospective(p, wi.id, { retrospective_conclusion: "C1" });
  const retro2 = generateRetrospective(p, wi2.id, { retrospective_conclusion: "C2" });

  // 全量查询
  const all = queryRetrospectives(p);
  assert(all.length >= 2, "12.1 全量查询返回 >=2 条记录");

  // 按 work_item_id
  const byWi1 = queryRetrospectives(p, { work_item_id: wi.id });
  assert(byWi1.length >= 1, "12.2 按 wi.id 查询有结果");
  assert(
    byWi1.every((r) => r.work_item_id === wi.id),
    "12.3 所有结果的 work_item_id 匹配"
  );

  const byWi2 = queryRetrospectives(p, { work_item_id: wi2.id });
  assert(byWi2.length >= 1, "12.4 按 wi2.id 查询有结果");

  // 按 confirmed_as_baseline
  const notBaseline = queryRetrospectives(p, { confirmed_as_baseline: false });
  assert(notBaseline.length >= 2, "12.5 未基线确认的记录 >=2");

  // 标记一条为基线后查询
  updateRetrospective(p, retro1.id, { confirmed_as_baseline: true });
  const baseline = queryRetrospectives(p, { confirmed_as_baseline: true });
  assert(baseline.length >= 1, "12.6 基线确认的记录 >=1");
  assert(
    baseline.every((r) => r.confirmed_as_baseline === true),
    "12.7 所有结果已基线确认"
  );

  // 组合过滤
  const combined = queryRetrospectives(p, {
    work_item_id: wi.id,
    confirmed_as_baseline: true,
  });
  assert(combined.length >= 1, "12.8 组合过滤有结果");
  assertEq(combined[0].work_item_id, wi.id, "12.9 组合过滤 work_item_id 匹配");

  // 无匹配
  const empty = queryRetrospectives(p, { work_item_id: "no-such-wi" });
  assertEq(empty.length, 0, "12.10 无匹配返回空数组");
}

// ═══════════════════════════════════════════════════════════════════════════
// 13. summarizeRetrospective — 页面摘要
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n13. summarizeRetrospective — 页面摘要");

{
  // 先清理旧记录，生成一条干净的用于摘要测试
  const testWi = p.createWorkItem({ goal: "摘要测试工作项", type: "feature" });
  const retro = generateRetrospective(p, testWi.id, {
    retrospective_conclusion: "测试结论：一切顺利",
    process_improvement_suggestions: ["改进A"],
    technical_execution_suggestions: ["技术B"],
    effective_patterns: ["模式C"],
  });

  const summary = summarizeRetrospective(p, testWi.id);

  assert(summary !== null, "13.1 摘要非 null");
  assertEq(summary.work_item_id, testWi.id, "13.2 work_item_id 正确");
  assertEq(summary.retrospective_id, retro.id, "13.3 retrospective_id 正确");

  // facts 区
  assert("participating_agents" in summary.facts, "13.4 facts.participating_agents 存在");
  assert("rework_count" in summary.facts, "13.5 facts.rework_count 存在");
  assert("review_findings" in summary.facts, "13.6 facts.review_findings 存在");
  assert("quality_gate_results" in summary.facts, "13.7 facts.quality_gate_results 存在");
  assert("failure_causes" in summary.facts, "13.8 facts.failure_causes 存在");
  assert("escalation_results" in summary.facts, "13.9 facts.escalation_results 存在");
  assert("aggregated_facts" in summary.facts, "13.10 facts.aggregated_facts 存在");

  // conclusion 区
  assertEq(summary.conclusion, "测试结论：一切顺利", "13.11 结论正确");

  // suggestions 区
  assertEq(summary.suggestions.process.length, 1, "13.12 流程建议 1 条");
  assertEq(summary.suggestions.technical.length, 1, "13.13 技术建议 1 条");

  // effective_patterns
  assertEq(summary.effective_patterns.length, 1, "13.14 有效做法 1 条");
  assertEq(summary.effective_patterns[0], "模式C", "13.15 有效做法内容正确");

  // confirmed_as_baseline
  assertEq(summary.confirmed_as_baseline, false, "13.16 基线状态正确");
}

// ═══════════════════════════════════════════════════════════════════════════
// 14. summarizeRetrospective — 无复盘记录
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n14. summarizeRetrospective — 无复盘记录");

{
  const emptyWi = p.createWorkItem({ goal: "无复盘的工作项", type: "bug_fix" });
  const summary = summarizeRetrospective(p, emptyWi.id);
  assertEq(summary, null, "14.1 无复盘返回 null");
}

// ═══════════════════════════════════════════════════════════════════════════
// 15. summarizeRetrospective — 错误处理
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n15. summarizeRetrospective — 错误处理");

{
  assertThrows(
    () => summarizeRetrospective(p, ""),
    "15.1 空 work_item_id 拒绝"
  );
  assertThrows(
    () => summarizeRetrospective(p, null),
    "15.2 null work_item_id 拒绝"
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 16. 数据隔离 — 深拷贝验证
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n16. 数据隔离 — 深拷贝验证");

{
  const retro = generateRetrospective(p, wi.id, {
    process_improvement_suggestions: ["原始建议"],
  });

  // 修改返回值的数组不应影响 Store
  const retroCopy = generateRetrospective(p, wi.id, {});
  retroCopy.participating_agents.push("INJECTED");
  retroCopy.process_improvement_suggestions.push("INJECTED");

  // 重新读取
  const stored = p.retrospectiveMemoryStore.read(retro.id);
  assert(
    !stored.participating_agents.includes("INJECTED"),
    "16.1 participating_agents 未被注入（generateRetrospective 深拷贝）"
  );
  assert(
    !stored.process_improvement_suggestions.includes("INJECTED"),
    "16.2 建议未被注入（generateRetrospective 深拷贝）"
  );

  // updateRetrospective 返回深拷贝
  const updated = updateRetrospective(p, retro.id, {
    process_improvement_suggestions: ["新建议"],
  });
  updated.process_improvement_suggestions.push("INJECTED_AGAIN");
  const stored2 = p.retrospectiveMemoryStore.read(retro.id);
  assert(
    !stored2.process_improvement_suggestions.includes("INJECTED_AGAIN"),
    "16.3 建议未被注入（updateRetrospective 深拷贝）"
  );

  // queryRetrospectives 返回深拷贝
  const queried = queryRetrospectives(p, { work_item_id: wi.id });
  if (queried.length > 0) {
    queried[0].retrospective_conclusion = "MODIFIED_EXTERNALLY";
    const stored3 = p.retrospectiveMemoryStore.read(queried[0].id);
    assert(
      stored3.retrospective_conclusion !== "MODIFIED_EXTERNALLY",
      "16.4 queryRetrospectives 返回深拷贝，不影响 Store"
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 17. 与现有 Store 兼容
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n17. 与现有 Store 兼容");

{
  // T3 的 createRetrospectiveMemory 仍可独立使用
  const direct = p.createRetrospectiveMemory({ work_item_id: wi.id });
  assert(direct.id && direct.id.startsWith("retro-"), "17.1 直接创建仍有 ID");
  assertEq(direct.rework_count, 0, "17.2 T14 新字段有默认值（兼容）");
  assertEq(direct.participating_agents.length, 0, "17.3 默认 participating_agents=[]");
  assertEq(direct.escalation_results.length, 0, "17.4 默认 escalation_results=[]");
  assertEq(typeof direct.aggregated_facts, "object", "17.5 默认 aggregated_facts={}");

  // 老字段仍正常工作
  assertEq(direct.effective_patterns.length, 0, "17.6 老字段 effective_patterns 仍正常");
  assertEq(direct.confirmed_as_baseline, false, "17.7 老字段 confirmed_as_baseline 仍正常");
}

// ═══════════════════════════════════════════════════════════════════════════
// 18. aggregateFacts — 外部提供的 work_item_id 对应 WorkItem 不存在
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n18. 边界场景");

{
  // 长时间空字符串（空白）
  assertThrows(
    () => aggregateFacts(p, "   "),
    "18.1 纯空白 work_item_id 拒绝"
  );
  assertThrows(
    () => generateRetrospective(p, "   "),
    "18.2 纯空白 work_item_id 拒绝（generateRetrospective）"
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 清理
// ═══════════════════════════════════════════════════════════════════════════

try {
  fs.rmSync(TMP, { recursive: true, force: true });
} catch (_) {
  // Windows 下可能的文件锁定，忽略清理错误
}

// ═══════════════════════════════════════════════════════════════════════════
// 结果
// ═══════════════════════════════════════════════════════════════════════════

console.log(`\n${"═".repeat(60)}`);
console.log(`  Passed: ${passed}  |  Failed: ${failed}`);
console.log(`${"═".repeat(60)}`);

if (failed > 0) {
  process.exit(1);
}
