#!/usr/bin/env node
/**
 * src/review-quality/index.verify.js — T9 Review 与质量门禁记录验证脚本
 *
 * 覆盖：
 *   - Review 创建/更新/解决/查询/摘要
 *   - 质量门禁创建/更新/失败记录/查询/摘要
 *   - 枚举约束、必填校验、边界条件
 *   - 数据隔离（structuredClone）
 *   - T8 护栏兼容性
 *
 * 用法：node src/review-quality/index.verify.js
 */

"use strict";

const path = require("path");
const fs = require("fs");

// ── 测试框架 ──────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label} — expected ${b}, got ${a}`);
  }
}

function assertThrows(fn, expectedMessage, label) {
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
    if (expectedMessage && !e.message.includes(expectedMessage)) {
      console.error(`  FAIL: ${label} — message mismatch. Expected to include "${expectedMessage}", got "${e.message}"`);
      failed++;
      return;
    }
  }
  if (threw) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label} — expected to throw`);
  }
}

// ── 初始化 ────────────────────────────────────────────────────────────
const testDir = path.join(__dirname, "..", "..", "data", "test-t9");
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// 清理旧测试数据
for (const file of ["review-records.json", "quality-gate-runs.json"]) {
  const p = path.join(testDir, file);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

const { createPersistence, REVIEW_RESULTS, QG_FINAL_STATUSES } = require("../storage");
const reviewQuality = require("./index");

const p = createPersistence(testDir);

// ═══════════════════════════════════════════════════════════════════════
// PART 1: Review 管理
// ═══════════════════════════════════════════════════════════════════════

console.log("\n── Review 创建 ──");

// 1. 基本创建
const rev1 = reviewQuality.createReview(p, {
  work_item_id: "wi-test",
  task_id: "task-test",
  author_agent: "Codex",
  reviewer_agent: "Claude",
  scope: "代码审查",
  findings: [{ severity: "minor", description: "命名不规范" }],
  result: "changes_requested",
  required_fixes: ["修复命名"],
});
assert(rev1.id && rev1.id.startsWith("rev-"), "createReview 生成 rev- 前缀 ID");
assertEqual(rev1.work_item_id, "wi-test", "createReview 设置 work_item_id");
assertEqual(rev1.author_agent, "Codex", "createReview 设置 author_agent");
assertEqual(rev1.reviewer_agent, "Claude", "createReview 设置 reviewer_agent");
assertEqual(rev1.result, "changes_requested", "createReview 设置 result");
assertEqual(rev1.resolved, false, "createReview resolved 默认 false");

// 2. 默认值
const rev2 = reviewQuality.createReview(p, {
  work_item_id: "wi-test2",
  author_agent: "Claude",
  reviewer_agent: "Codex",
});
assertEqual(rev2.result, "approved", "createReview result 默认 approved");
assertEqual(rev2.resolved, false, "createReview resolved 默认 false");
assert(Array.isArray(rev2.findings), "createReview findings 默认数组");
assert(Array.isArray(rev2.required_fixes), "createReview required_fixes 默认数组");

// 3. 自审拒绝
assertThrows(
  () => reviewQuality.createReview(p, {
    work_item_id: "wi-test",
    author_agent: "Codex",
    reviewer_agent: "Codex",
  }),
  "自审",
  "createReview 拒绝自审"
);

// 4. 非法 result 枚举
assertThrows(
  () => reviewQuality.createReview(p, {
    work_item_id: "wi-test",
    author_agent: "Codex",
    reviewer_agent: "Claude",
    result: "invalid_status",
  }),
  "无效的 Review 结果",
  "createReview 拒绝非法 result 枚举"
);

// 5. 缺少必填字段
assertThrows(
  () => reviewQuality.createReview(p, {
    reviewer_agent: "Claude",
  }),
  "work_item_id",
  "createReview 拒绝缺少 work_item_id"
);

// 6. created_at/updated_at 时间戳
assert(rev1.created_at && rev1.updated_at, "createReview 生成时间戳");

console.log("\n── Review 更新 ──");

// 7. 更新 findings
const rev1Updated = reviewQuality.updateReview(p, rev1.id, {
  findings: [{ severity: "major", description: "逻辑错误" }],
});
assertEqual(rev1Updated.findings.length, 1, "updateReview 更新 findings");
assertEqual(rev1Updated.findings[0].severity, "major", "updateReview findings 内容正确");

// 8. 更新 required_fixes
const rev1Updated2 = reviewQuality.updateReview(p, rev1.id, {
  required_fixes: ["修复逻辑错误", "补充测试"],
});
assertEqual(rev1Updated2.required_fixes.length, 2, "updateReview 更新 required_fixes");

// 9. 变更 result
const rev1Updated3 = reviewQuality.updateReview(p, rev1.id, {
  result: "approved",
});
assertEqual(rev1Updated3.result, "approved", "updateReview 变更 result 为 approved");

// 10. 变更 resolved
const rev1Updated4 = reviewQuality.updateReview(p, rev1.id, {
  resolved: true,
});
assertEqual(rev1Updated4.resolved, true, "updateReview 变更 resolved 为 true");

// 11. 非法 result 变更拒绝
assertThrows(
  () => reviewQuality.updateReview(p, rev1.id, { result: "rejected" }),
  "无效的 Review 结果",
  "updateReview 拒绝非法 result 变更"
);

// 12. 不存在的记录
assertThrows(
  () => reviewQuality.updateReview(p, "rev-nonexistent", { result: "approved" }),
  "不存在",
  "updateReview 拒绝不存在的记录"
);

// 13. updated_at 更新
assert(
  new Date(rev1Updated.updated_at).getTime() >= new Date(rev1.updated_at).getTime(),
  "updateReview 更新 updated_at 时间戳"
);

// 14. 不可变字段保护：author_agent 不能被修改
const rev1AfterImmutableAttempt = reviewQuality.updateReview(p, rev1.id, {
  author_agent: "MiniMax", // 尝试修改作者
  findings: [{ severity: "info", description: "only findings should change" }],
});
assertEqual(rev1AfterImmutableAttempt.author_agent, "Codex", "updateReview 保护 author_agent 不可变");
assertEqual(rev1AfterImmutableAttempt.findings[0].severity, "info", "updateReview 可修改字段正常更新");

console.log("\n── Review 解决 ──");

// 15. resolveReview 标记已解决
// 先创建一条 changes_requested 的记录
const rev3 = reviewQuality.createReview(p, {
  work_item_id: "wi-test3",
  author_agent: "Claude",
  reviewer_agent: "Codex",
  result: "changes_requested",
  required_fixes: ["fix1", "fix2"],
});
const resolved = reviewQuality.resolveReview(p, rev3.id);
assertEqual(resolved.resolved, true, "resolveReview 设置 resolved=true");
assertDeepEqual(resolved.required_fixes, [], "resolveReview 清空 required_fixes");

// 16. resolveReview 不存在的记录
assertThrows(
  () => reviewQuality.resolveReview(p, "rev-nonexistent"),
  "不存在",
  "resolveReview 拒绝不存在的记录"
);

console.log("\n── Review 查询 ──");

// 17. 查询全部
const all = reviewQuality.queryReviews(p);
assert(all.length >= 3, "queryReviews() 返回所有记录");

// 18. 按 work_item_id 查询
const byWi = reviewQuality.queryReviews(p, { work_item_id: "wi-test" });
assertEqual(byWi.length, 1, "queryReviews 按 work_item_id 筛选");

// 19. 按 task_id 查询
const byTask = reviewQuality.queryReviews(p, { task_id: "task-test" });
assertEqual(byTask.length, 1, "queryReviews 按 task_id 筛选");
assertEqual(byTask[0].id, rev1.id, "queryReviews 按 task_id 返回正确记录");

// 20. 按 reviewer_agent 查询
const byReviewer = reviewQuality.queryReviews(p, { reviewer_agent: "Codex" });
assert(byReviewer.length >= 2, "queryReviews 按 reviewer_agent 筛选");

// 21. 按 result 查询
const byResult = reviewQuality.queryReviews(p, { result: "approved" });
assert(byResult.length >= 1, "queryReviews 按 result=approved 筛选");

// 22. 按 resolved 查询
const unresolved = reviewQuality.queryReviews(p, { resolved: false });
const resolvedList = reviewQuality.queryReviews(p, { resolved: true });
assert(unresolved.length >= 1, "queryReviews 按 resolved=false 筛选");
assert(resolvedList.length >= 1, "queryReviews 按 resolved=true 筛选");

// 23. 组合查询
const combined = reviewQuality.queryReviews(p, {
  work_item_id: "wi-test",
  reviewer_agent: "Claude",
  result: "approved",
});
assert(combined.length >= 1, "queryReviews 组合筛选");

// 24. 无匹配查询
const noMatch = reviewQuality.queryReviews(p, { work_item_id: "wi-nonexistent" });
assertEqual(noMatch.length, 0, "queryReviews 无匹配返回空数组");

console.log("\n── Review 摘要 ──");

// 25. 有记录的摘要
const summary = reviewQuality.summarizeReviews(p, "wi-test3");
assertEqual(summary.total, 1, "summarizeReviews total 正确");
assertEqual(summary.changes_requested, 1, "summarizeReviews 计数 changes_requested");
assertEqual(summary.unresolved, 0, "summarizeReviews 已解决后 unresolved=0");
assert(summary.latest !== null, "summarizeReviews latest 非 null");
assertEqual(summary.latest.result, "changes_requested", "summarizeReviews latest.result 正确");
assert(summary.by_reviewer["Codex"] >= 1, "summarizeReviews by_reviewer 正确");

// 26. 空工作项摘要
const emptySummary = reviewQuality.summarizeReviews(p, "wi-nonexistent");
assertEqual(emptySummary.total, 0, "summarizeReviews 空工作项 total=0");
assertEqual(emptySummary.latest, null, "summarizeReviews 空工作项 latest=null");
assertEqual(emptySummary.by_reviewer && Object.keys(emptySummary.by_reviewer).length, 0, "summarizeReviews 空工作项 by_reviewer 为空");

// 27. unresolved 计数
// 创建一条 changes_requested 且未解决的记录
const revUnresolved = reviewQuality.createReview(p, {
  work_item_id: "wi-unresolved",
  author_agent: "Codex",
  reviewer_agent: "Claude",
  result: "changes_requested",
  required_fixes: ["fix A", "fix B"],
});
const summary2 = reviewQuality.summarizeReviews(p, "wi-unresolved");
assertEqual(summary2.unresolved, 1, "summarizeReviews 统计未解决的 changes_requested");
assert(summary2.latest_unresolved !== null, "summarizeReviews latest_unresolved 非 null");
assertEqual(summary2.latest_unresolved.required_fixes_count, 2, "summarizeReviews latest_unresolved.required_fixes_count 正确");

// 27a. P2 修复：disputed 未解决计入 unresolved
const revDisputed = reviewQuality.createReview(p, {
  work_item_id: "wi-disputed-test",
  author_agent: "Codex",
  reviewer_agent: "Claude",
  result: "disputed",
});
const summaryDisputed = reviewQuality.summarizeReviews(p, "wi-disputed-test");
assertEqual(summaryDisputed.unresolved, 1, "summarizeReviews disputed 未解决计入 unresolved");
assertEqual(summaryDisputed.disputed, 1, "summarizeReviews disputed 计数正确");

// 27b. P2 修复：user_confirmation_required 未解决计入 unresolved
const revUcr = reviewQuality.createReview(p, {
  work_item_id: "wi-ucr-test",
  author_agent: "Codex",
  reviewer_agent: "Claude",
  result: "user_confirmation_required",
});
const summaryUcr = reviewQuality.summarizeReviews(p, "wi-ucr-test");
assertEqual(summaryUcr.unresolved, 1, "summarizeReviews user_confirmation_required 未解决计入 unresolved");
assertEqual(summaryUcr.user_confirmation_required, 1, "summarizeReviews user_confirmation_required 计数正确");

// 27c. P2 修复：approved 即使 resolved=false 也不计入 unresolved
const revApprovedUnresolved = reviewQuality.createReview(p, {
  work_item_id: "wi-approved-test",
  author_agent: "Claude",
  reviewer_agent: "Codex",
  result: "approved",
  // resolved 默认 false
});
const summaryApproved = reviewQuality.summarizeReviews(p, "wi-approved-test");
assertEqual(summaryApproved.unresolved, 0, "summarizeReviews approved 不计入 unresolved");
assertEqual(summaryApproved.approved, 1, "summarizeReviews approved 计数正确");

// ═══════════════════════════════════════════════════════════════════════
// PART 2: 质量门禁管理
// ═══════════════════════════════════════════════════════════════════════

console.log("\n── 质量门禁创建 ──");

// 28. 基本创建（passed 必须提供 evidence）
const qg1 = reviewQuality.createQualityGate(p, {
  work_item_id: "wi-test",
  task_id: "task-test",
  gate_name: "npm test",
  validation_method: "npm test",
  result: "All 33 tests passed",
});
assert(qg1.id && qg1.id.startsWith("qg-"), "createQualityGate 生成 qg- 前缀 ID");
assertEqual(qg1.work_item_id, "wi-test", "createQualityGate 设置 work_item_id");
assertEqual(qg1.gate_name, "npm test", "createQualityGate 设置 gate_name");
assertEqual(qg1.final_status, "passed", "createQualityGate final_status=passed（有证据）");

// 29. passed 无证据拒绝（P1 修复：空门禁不得静默通过）
assertThrows(
  () => reviewQuality.createQualityGate(p, {
    work_item_id: "wi-test2",
    gate_name: "npm run check",
  }),
  "门禁不能静默通过",
  "createQualityGate 拒绝无 evidence 的 passed 门禁"
);

// 29a. passed 无 validation_method 拒绝
assertThrows(
  () => reviewQuality.createQualityGate(p, {
    work_item_id: "wi-test2",
    gate_name: "lint",
    result: "no errors",
  }),
  "validation_method",
  "createQualityGate 拒绝缺 validation_method 的 passed 门禁"
);

// 29b. passed 无 result 拒绝
assertThrows(
  () => reviewQuality.createQualityGate(p, {
    work_item_id: "wi-test2",
    gate_name: "lint",
    validation_method: "eslint",
  }),
  "result",
  "createQualityGate 拒绝缺 result 的 passed 门禁"
);

// 29c. 非 passed 状态无需 evidence（留给 recordGateFailure 处理）
const qg2 = reviewQuality.createQualityGate(p, {
  work_item_id: "wi-test2",
  gate_name: "npm run check",
  final_status: "failed",
});
assertEqual(qg2.final_status, "failed", "createQualityGate 非 passed 状态允许无 evidence");
assertEqual(qg2.failed_command, "", "createQualityGate 非 passed 默认 T9 字段为空");

// 30. 非法 final_status 枚举
assertThrows(
  () => reviewQuality.createQualityGate(p, {
    work_item_id: "wi-test",
    gate_name: "check",
    final_status: "error",
  }),
  "无效的质量门禁最终状态",
  "createQualityGate 拒绝非法 final_status"
);

// 31. 缺少必填字段
assertThrows(
  () => reviewQuality.createQualityGate(p, {
    gate_name: "lint",
  }),
  "work_item_id",
  "createQualityGate 拒绝缺少 work_item_id"
);

console.log("\n── 质量门禁更新 ──");

// 32. 更新 result
const qg1Updated = reviewQuality.updateQualityGate(p, qg1.id, {
  result: "All 33 tests passed",
});
assertEqual(qg1Updated.result, "All 33 tests passed", "updateQualityGate 更新 result");

// 33. 变更 final_status
const qg1Updated2 = reviewQuality.updateQualityGate(p, qg1.id, {
  final_status: "failed",
});
assertEqual(qg1Updated2.final_status, "failed", "updateQualityGate 变更 final_status 为 failed");

// 34. 更新 T9 失败字段
const qg1Updated3 = reviewQuality.updateQualityGate(p, qg1.id, {
  failed_command: "npm test",
  failure_summary: "2 tests failed",
  impact_scope: "T9 review-quality module",
  next_actions: "Fix failing tests",
});
assertEqual(qg1Updated3.failed_command, "npm test", "updateQualityGate 更新 failed_command");
assertEqual(qg1Updated3.failure_summary, "2 tests failed", "updateQualityGate 更新 failure_summary");

// 35. 非法 final_status 变更拒绝
assertThrows(
  () => reviewQuality.updateQualityGate(p, qg1.id, { final_status: "unknown" }),
  "无效的质量门禁最终状态",
  "updateQualityGate 拒绝非法 final_status 变更"
);

// 36. 不存在的记录
assertThrows(
  () => reviewQuality.updateQualityGate(p, "qg-nonexistent", { final_status: "passed" }),
  "不存在",
  "updateQualityGate 拒绝不存在的记录"
);

// 37. updated_at 更新
assert(
  new Date(qg1Updated.updated_at).getTime() >= new Date(qg1.updated_at).getTime(),
  "updateQualityGate 更新 updated_at 时间戳"
);

console.log("\n── 门禁失败记录 ──");

// 38. recordGateFailure 完整记录
const qgFail = reviewQuality.createQualityGate(p, {
  work_item_id: "wi-fail-test",
  gate_name: "npm run verify",
  final_status: "failed",  // 非 passed，无需 evidence，留给 recordGateFailure 填写
});
const failRecord = reviewQuality.recordGateFailure(p, qgFail.id, {
  failed_command: "npm run verify",
  failure_summary: "3 out of 40 verification tests failed in review-quality module",
  impact_scope: "Blocks T9 delivery; T11/T13/T14 depend on T9 query APIs",
  next_actions: "1) Review failed assertions 2) Fix logic 3) Re-run verify",
  result: "40 tests: 37 passed, 3 failed",
});
assertEqual(failRecord.final_status, "failed", "recordGateFailure 设置 final_status=failed");
assertEqual(failRecord.failed_command, "npm run verify", "recordGateFailure 记录 failed_command");
assert(failRecord.failure_summary.includes("3 out of 40"), "recordGateFailure 记录 failure_summary");
assert(failRecord.impact_scope.includes("Blocks T9"), "recordGateFailure 记录 impact_scope");
assert(failRecord.next_actions.includes("Review failed"), "recordGateFailure 记录 next_actions");
assertEqual(failRecord.result, "40 tests: 37 passed, 3 failed", "recordGateFailure 保留 result");

// 39. recordGateFailure 缺少必填字段
assertThrows(
  () => reviewQuality.recordGateFailure(p, qgFail.id, {
    failed_command: "cmd",
    // 缺少 failure_summary, impact_scope, next_actions
  }),
  "failure_summary",
  "recordGateFailure 拒绝缺少 failure_summary"
);

assertThrows(
  () => reviewQuality.recordGateFailure(p, qgFail.id, {
    failed_command: "",
    failure_summary: "summary",
    impact_scope: "scope",
    next_actions: "actions",
  }),
  "failed_command",
  "recordGateFailure 拒绝空 failed_command"
);

// 40. recordGateFailure 不存在的记录
assertThrows(
  () => reviewQuality.recordGateFailure(p, "qg-nonexistent", {
    failed_command: "cmd",
    failure_summary: "msg",
    impact_scope: "scope",
    next_actions: "fix",
  }),
  "不存在",
  "recordGateFailure 拒绝不存在的记录"
);

console.log("\n── 质量门禁查询 ──");

// 41. 查询全部
const qgAll = reviewQuality.queryQualityGates(p);
assert(qgAll.length >= 3, "queryQualityGates() 返回所有记录");

// 42. 按 work_item_id 查询
const qgByWi = reviewQuality.queryQualityGates(p, { work_item_id: "wi-test" });
assertEqual(qgByWi.length, 1, "queryQualityGates 按 work_item_id 筛选");

// 43. 按 task_id 查询
const qgByTask = reviewQuality.queryQualityGates(p, { task_id: "task-test" });
assertEqual(qgByTask.length, 1, "queryQualityGates 按 task_id 筛选");

// 44. 按 gate_name 查询
const qgByName = reviewQuality.queryQualityGates(p, { gate_name: "npm test" });
assertEqual(qgByName.length, 1, "queryQualityGates 按 gate_name 筛选");

// 45. 按 final_status 查询
const qgByStatus = reviewQuality.queryQualityGates(p, { final_status: "failed" });
assert(qgByStatus.length >= 2, "queryQualityGates 按 final_status=failed 筛选");

// 46. 组合查询
const qgCombined = reviewQuality.queryQualityGates(p, {
  work_item_id: "wi-fail-test",
  final_status: "failed",
});
assertEqual(qgCombined.length, 1, "queryQualityGates 组合筛选");

// 47. 无匹配查询
const qgNoMatch = reviewQuality.queryQualityGates(p, { gate_name: "nonexistent" });
assertEqual(qgNoMatch.length, 0, "queryQualityGates 无匹配返回空数组");

console.log("\n── 质量门禁摘要 ──");

// 48. 有记录的摘要
// 先创建不同状态的记录在同一个 work_item_id 下
reviewQuality.createQualityGate(p, {
  work_item_id: "wi-mixed",
  gate_name: "lint",
  final_status: "passed",
  validation_method: "eslint",
  result: "0 errors, 0 warnings",
});
reviewQuality.createQualityGate(p, {
  work_item_id: "wi-mixed",
  gate_name: "test",
  final_status: "blocked",
});
const qgMixedFail = reviewQuality.createQualityGate(p, {
  work_item_id: "wi-mixed",
  gate_name: "verify",
  final_status: "failed",  // 非 passed，留给 recordGateFailure
});
reviewQuality.recordGateFailure(p, qgMixedFail.id, {
  failed_command: "node verify.js",
  failure_summary: "verification failed",
  impact_scope: "delivery",
  next_actions: "fix and re-verify",
});

const qgSummary = reviewQuality.summarizeQualityGates(p, "wi-mixed");
assertEqual(qgSummary.total, 3, "summarizeQualityGates total 正确");
assertEqual(qgSummary.passed, 1, "summarizeQualityGates passed 计数");
assertEqual(qgSummary.failed, 1, "summarizeQualityGates failed 计数");
assertEqual(qgSummary.blocked, 1, "summarizeQualityGates blocked 计数");
assertEqual(qgSummary.failures.length, 1, "summarizeQualityGates failures 列表长度");
assert(qgSummary.failures[0].failed_command.includes("verify.js"), "summarizeQualityGates failure 详情包含 failed_command");
assert(qgSummary.failures[0].impact_scope.includes("delivery"), "summarizeQualityGates failure 详情包含 impact_scope");
assert(qgSummary.failures[0].next_actions.includes("fix"), "summarizeQualityGates failure 详情包含 next_actions");

// 49. 空工作项摘要
const qgEmpty = reviewQuality.summarizeQualityGates(p, "wi-nonexistent");
assertEqual(qgEmpty.total, 0, "summarizeQualityGates 空 total=0");
assertEqual(qgEmpty.latest, null, "summarizeQualityGates 空 latest=null");
assertEqual(qgEmpty.failures.length, 0, "summarizeQualityGates 空 failures=[]");

// ═══════════════════════════════════════════════════════════════════════
// PART 3: 数据隔离验证
// ═══════════════════════════════════════════════════════════════════════

console.log("\n── 数据隔离 ──");

// 50. Review 读出的记录是深拷贝（修改不污染缓存）
const revRead = p.reviewRecordStore.read(rev1.id);
revRead.result = "disputed";
revRead.findings.push({ severity: "critical", description: "injected" });
const revReRead = p.reviewRecordStore.read(rev1.id);
assertEqual(revReRead.result, "approved", "Review 读深拷贝：result 未污染");
assertEqual(revReRead.findings.length, 1, "Review 读深拷贝：findings 未污染");

// 51. QualityGate 读出的记录是深拷贝
const qgRead = p.qualityGateRunStore.read(qg1.id);
qgRead.final_status = "passed"; // 实际是 failed
qgRead.failure_summary = "injected";
const qgReRead = p.qualityGateRunStore.read(qg1.id);
assertEqual(qgReRead.final_status, "failed", "QualityGate 读深拷贝：final_status 未污染");
assertEqual(qgReRead.failure_summary, "2 tests failed", "QualityGate 读深拷贝：failure_summary 未污染");

// 52. queryReviews 返回深拷贝
const queryResult = reviewQuality.queryReviews(p, { work_item_id: "wi-test" });
queryResult[0].result = "disputed";
const queryResult2 = reviewQuality.queryReviews(p, { work_item_id: "wi-test" });
assertEqual(queryResult2[0].result, "approved", "queryReviews 返回深拷贝");

// 53. queryQualityGates 返回深拷贝
const qgQueryResult = reviewQuality.queryQualityGates(p, { work_item_id: "wi-test" });
qgQueryResult[0].final_status = "passed";
const qgQueryResult2 = reviewQuality.queryQualityGates(p, { work_item_id: "wi-test" });
assertEqual(qgQueryResult2[0].final_status, "failed", "queryQualityGates 返回深拷贝");

// ═══════════════════════════════════════════════════════════════════════
// PART 4: 常量与枚举
// ═══════════════════════════════════════════════════════════════════════

console.log("\n── 常量与枚举 ──");

// 54. REVIEW_RESULTS
assert(Array.isArray(REVIEW_RESULTS), "REVIEW_RESULTS 是数组");
assertEqual(REVIEW_RESULTS.length, 4, "REVIEW_RESULTS 包含 4 个值");
assert(REVIEW_RESULTS.includes("approved"), "REVIEW_RESULTS 包含 approved");
assert(REVIEW_RESULTS.includes("changes_requested"), "REVIEW_RESULTS 包含 changes_requested");
assert(REVIEW_RESULTS.includes("disputed"), "REVIEW_RESULTS 包含 disputed");
assert(REVIEW_RESULTS.includes("user_confirmation_required"), "REVIEW_RESULTS 包含 user_confirmation_required");

// 55. QG_FINAL_STATUSES
assert(Array.isArray(QG_FINAL_STATUSES), "QG_FINAL_STATUSES 是数组");
assertEqual(QG_FINAL_STATUSES.length, 4, "QG_FINAL_STATUSES 包含 4 个值");
assert(QG_FINAL_STATUSES.includes("passed"), "QG_FINAL_STATUSES 包含 passed");
assert(QG_FINAL_STATUSES.includes("failed"), "QG_FINAL_STATUSES 包含 failed");
assert(QG_FINAL_STATUSES.includes("blocked"), "QG_FINAL_STATUSES 包含 blocked");
assert(QG_FINAL_STATUSES.includes("user_confirmed"), "QG_FINAL_STATUSES 包含 user_confirmed");

// 56. validateReviewResult
assertEqual(reviewQuality.validateReviewResult("approved").valid, true, "validateReviewResult approved=valid");
assertEqual(reviewQuality.validateReviewResult("invalid").valid, false, "validateReviewResult invalid=false");

// 57. validateFinalStatus
assertEqual(reviewQuality.validateFinalStatus("passed").valid, true, "validateFinalStatus passed=valid");
assertEqual(reviewQuality.validateFinalStatus("crashed").valid, false, "validateFinalStatus crashed=false");

// 58. validateNoSelfReview
assertEqual(reviewQuality.validateNoSelfReview("Codex", "Claude").valid, true, "validateNoSelfReview 不同 agent=valid");
assertEqual(reviewQuality.validateNoSelfReview("Codex", "Codex").valid, false, "validateNoSelfReview 相同 agent=false");

// ═══════════════════════════════════════════════════════════════════════
// PART 5: T8 兼容性验证
// ═══════════════════════════════════════════════════════════════════════

console.log("\n── T8 兼容性 ──");

// 59. T8 validateReviewGate 能正常查询
// T8 使用 reviewRecordStore.list(filter)，T9 不改变 Store 行为
const t8Reviews = p.reviewRecordStore.list((r) => r.work_item_id === "wi-test");
assert(t8Reviews.length >= 1, "T8 兼容：reviewRecordStore.list() 正常工作");

// 60. T8 hasApprovedReviewForTask 逻辑不受影响
const hasApproved = t8Reviews.some((r) => {
  if (r.task_id && r.task_id !== "task-test") return false;
  if (r.result !== "approved") return false;
  return r.resolved === true || !Array.isArray(r.required_fixes) || r.required_fixes.length === 0;
});
assert(hasApproved, "T8 兼容：hasApprovedReviewForTask 逻辑正确识别通过记录");

// 61. T8 validateQualityGate 能正常查询
const t8Gates = p.qualityGateRunStore.list((r) => r.work_item_id === "wi-test");
assert(t8Gates.length >= 1, "T8 兼容：qualityGateRunStore.list() 正常工作");

// 62. T8 latestRecord + final_status 逻辑
const latest = [...t8Gates].sort((a, b) =>
  new Date(b.updated_at || b.created_at).getTime() -
  new Date(a.updated_at || a.created_at).getTime()
)[0];
assert(latest && latest.final_status === "failed", "T8 兼容：latest gate final_status 正确");

// 63. P1 回归：空门禁记录不能被 T8 放行
// 验证 createQualityGate 现在拒绝无 evidence 的 passed 门禁
assertThrows(
  () => reviewQuality.createQualityGate(p, {
    work_item_id: "wi-bypass-test",
    gate_name: "phantom-gate",
    // 故意不传 validation_method 和 result
  }),
  "门禁不能静默通过",
  "P1 回归：空门禁记录（无 evidence）不能被创建为 passed"
);

// 64. P1 回归：有 evidence 的门禁可以正常通过 T8
const legitimateQg = reviewQuality.createQualityGate(p, {
  work_item_id: "wi-legit-test",
  gate_name: "npm run check",
  validation_method: "npm run check",
  result: "checked 35 JavaScript files",
});
const legitGates = p.qualityGateRunStore.list((r) => r.work_item_id === "wi-legit-test");
const legitLatest = [...legitGates].sort((a, b) =>
  new Date(b.updated_at || b.created_at).getTime() -
  new Date(a.updated_at || a.created_at).getTime()
)[0];
assert(legitLatest && legitLatest.final_status === "passed", "P1 回归：有 evidence 的 passed 门禁正常存在");
assert(legitLatest.validation_method && legitLatest.result, "P1 回归：有 evidence 的 passed 门禁包含可审计证据");

// ═══════════════════════════════════════════════════════════════════════
// 结果
// ═══════════════════════════════════════════════════════════════════════

console.log(`\n${"=".repeat(50)}`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`${"=".repeat(50)}\n`);

// 清理测试数据目录
try {
  fs.rmSync(testDir, { recursive: true, force: true });
} catch {
  // 清理失败不致命
}

if (failed > 0) {
  process.exit(1);
}
