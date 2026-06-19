#!/usr/bin/env node
/**
 * __page_query_verify.js — T3 页面查询视角验证
 *
 * 验证 5 个页面视图的数据读取路径，证明 T3 持久化模块零修改即可
 * 支撑 P0-14/P0-15/P0-16 的全部页面查询需求。
 *
 * 用法: node src/storage/__page_query_verify.js
 */

const { createPersistence } = require("./index");
const fs = require("fs");
const path = require("path");

const TEST_DIR = path.join(__dirname, "..", "..", "data", "__page_query_test__");
if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });

const {
  workItemStore, taskStore, a2aEventStore, reviewRecordStore,
  qualityGateRunStore, escalationRecordStore, retrospectiveMemoryStore,
  createWorkItem, createTask, createA2AEvent, createReviewRecord,
  createQualityGateRun, createEscalationRecord, createRetrospectiveMemory,
} = createPersistence(TEST_DIR);

let passed = 0, failed = 0;
function check(desc, fn) {
  try { fn(); passed++; }
  catch (e) { failed++; console.error(`  FAIL [${desc}]: ${e.message}`); }
}

// ── 场景准备：一个 WorkItem 贯穿全部 5 个视图 ─────────────────────
const wi = createWorkItem({ goal: "实现用户登录功能", type: "feature" });
createTask({ work_item_id: wi.id, owner_agent: "codex", boundary: "auth 模块" });
createTask({ work_item_id: wi.id, owner_agent: "claude", boundary: "token 刷新" });

createA2AEvent({
  from_agent: "claude", to_agent: "codex", work_item_id: wi.id,
  purpose: "solution_question", claim_or_request: "token 刷新策略是否安全？",
  conclusion: "需要补充 refresh token rotation", next_action: "Codex 更新方案",
});
createA2AEvent({
  from_agent: "codex", to_agent: "claude", work_item_id: wi.id,
  purpose: "execution_sync", conclusion: "方案已更新，同意 token rotation 方案",
});

createReviewRecord({
  work_item_id: wi.id, author_agent: "codex", reviewer_agent: "claude",
  result: "changes_requested", findings: ["缺少 token 黑名单机制"],
  required_fixes: ["补充黑名单"],
});

createQualityGateRun({
  work_item_id: wi.id, gate_name: "node-check",
  validation_method: "node --check", result: "ok", final_status: "passed",
});

createEscalationRecord({
  work_item_id: wi.id, what_happened: "token 刷新方案存在安全分歧",
  trigger_rule: "Agent 分歧无法解决",
  options: ["采用 rotation", "采用黑名单", "两者都做"],
  recommended_next_step: "建议两者都做，用户确认", risks: "工期增加约 1 天",
});

createRetrospectiveMemory({
  work_item_id: wi.id,
  effective_patterns: ["方案先行明确了 token 安全边界"],
  failure_causes: ["初始方案未考虑 refresh token rotation"],
  review_findings: ["token 黑名单机制缺失"],
  process_improvement_suggestions: ["安全相关方案必须包含威胁模型评估"],
});

console.log("T3 页面查询视角验证\n");

// ═══════════════════════════════════════════════════════════════════════
// 视图 1：工作项录入入口
// ═══════════════════════════════════════════════════════════════════════
console.log("── 视图 1：工作项录入 ──");

const newWi = createWorkItem({ goal: "页面录入测试", type: "bug_fix" });
check("createWorkItem 返回 id 和初始状态", () => {
  if (!newWi.id) throw new Error("id 缺失");
  if (newWi.status !== "needs_clarification") throw new Error("状态错误");
});

// ═══════════════════════════════════════════════════════════════════════
// 视图 2：统一聊天室与时间线
// ═══════════════════════════════════════════════════════════════════════
console.log("── 视图 2：统一时间线 ──");

const a2aEvents = a2aEventStore
  .list(r => r.work_item_id === wi.id)
  .sort((a, b) => a.created_at.localeCompare(b.created_at));

check("时间线包含 2 条 A2A 事件", () => {
  if (a2aEvents.length !== 2) throw new Error(`期望 2，实际 ${a2aEvents.length}`);
});
check("时间线按时间排序，第一条是 solution_question", () => {
  if (a2aEvents[0].purpose !== "solution_question") throw new Error(a2aEvents[0].purpose);
});

// ═══════════════════════════════════════════════════════════════════════
// 视图 3：工作项详情
// ═══════════════════════════════════════════════════════════════════════
console.log("── 视图 3：工作项详情 ──");

const detail = workItemStore.read(wi.id);
const tasks = taskStore.list(r => r.work_item_id === wi.id);
const escalations = escalationRecordStore.list(r => r.work_item_id === wi.id);

check("详情 goal 正确", () => {
  if (detail.goal !== "实现用户登录功能") throw new Error(detail.goal);
});
check("关联 2 个 Task", () => {
  if (tasks.length !== 2) throw new Error(`期望 2，实际 ${tasks.length}`);
});
check("关联 1 个升级记录", () => {
  if (escalations.length !== 1) throw new Error(`期望 1，实际 ${escalations.length}`);
});

// 最近一次关键结论（页面聚合层实现，不改 Store）
function latestKeyConclusion(workItemId) {
  const items = [];
  a2aEventStore
    .list(r => r.work_item_id === workItemId && r.conclusion)
    .forEach(r => items.push({ t: r.created_at, text: r.conclusion, src: "a2a" }));
  reviewRecordStore
    .list(r => r.work_item_id === workItemId && r.result)
    .forEach(r => items.push({ t: r.created_at, text: `Review: ${r.result}`, src: "review" }));
  qualityGateRunStore
    .list(r => r.work_item_id === workItemId && r.final_status)
    .forEach(r => items.push({ t: r.created_at, text: `门禁 ${r.gate_name}: ${r.final_status}`, src: "gate" }));
  escalationRecordStore
    .list(r => r.work_item_id === workItemId && r.recommended_next_step)
    .forEach(r => items.push({ t: r.created_at, text: r.recommended_next_step, src: "escalation" }));
  items.sort((a, b) => b.t.localeCompare(a.t));
  return items[0] || { text: "待形成", src: null };
}

const key = latestKeyConclusion(wi.id);
check("最近关键结论存在且非'待形成'", () => {
  if (key.text === "待形成" || !key.src) throw new Error("应存在关键结论");
});

// ═══════════════════════════════════════════════════════════════════════
// 视图 4：阻塞与人工确认
// ═══════════════════════════════════════════════════════════════════════
console.log("── 视图 4：阻塞与人工确认 ──");

const pending = escalationRecordStore.list(r =>
  r.work_item_id === wi.id && !r.user_decision
);
check("存在 1 条待用户确认升级", () => {
  if (pending.length !== 1) throw new Error(`期望 1，实际 ${pending.length}`);
});

escalationRecordStore.update(pending[0].id, { user_decision: "两者都做" });
const afterConfirm = escalationRecordStore.list(r =>
  r.work_item_id === wi.id && !r.user_decision
);
check("用户确认后待办清空", () => {
  if (afterConfirm.length !== 0) throw new Error(`期望 0，实际 ${afterConfirm.length}`);
});

// ═══════════════════════════════════════════════════════════════════════
// 视图 5：Review / 门禁 / 复盘
// ═══════════════════════════════════════════════════════════════════════
console.log("── 视图 5：Review / 门禁 / 复盘 ──");

const reviews = reviewRecordStore.list(r => r.work_item_id === wi.id);
const gates = qualityGateRunStore.list(r => r.work_item_id === wi.id);
const retros = retrospectiveMemoryStore.list(r => r.work_item_id === wi.id);

check("1 条 Review 记录", () => {
  if (reviews.length !== 1) throw new Error(`期望 1，实际 ${reviews.length}`);
});
check("Review 结果为 changes_requested", () => {
  if (reviews[0].result !== "changes_requested") throw new Error(reviews[0].result);
});
check("1 条门禁记录", () => {
  if (gates.length !== 1) throw new Error(`期望 1，实际 ${gates.length}`);
});
check("门禁 final_status 为 passed", () => {
  if (gates[0].final_status !== "passed") throw new Error(gates[0].final_status);
});
check("1 条复盘记录", () => {
  if (retros.length !== 1) throw new Error(`期望 1，实际 ${retros.length}`);
});
check("复盘含改进建议", () => {
  if (!retros[0].process_improvement_suggestions.some(s => s.includes("安全")))
    throw new Error("缺少安全相关改进建议");
});

// ── 清理 ──────────────────────────────────────────────────────────────
fs.rmSync(TEST_DIR, { recursive: true, force: true });

console.log(`\n${"═".repeat(50)}`);
console.log(`结果: ${passed} 通过, ${failed} 失败, ${passed + failed} 总计`);
console.log(`${"═".repeat(50)}`);

if (failed > 0) process.exit(1);
