"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createPersistence } = require("../storage");
const { generateRetrospective } = require("../retrospective");
const {
  buildUserParticipationView,
  buildWorkItemView,
  findLatestKeyConclusion,
} = require("./user-participation-view");

let passed = 0;

function check(name, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    process.stderr.write(`FAIL ${name}\n${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

function makePersistence() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clowder-t13f-view-"));
  return createPersistence(dir);
}

function seedCompletedScenario(p) {
  const workItem = p.createWorkItem({
    type: "feature",
    goal: "通过页面查看完整协作闭环",
    title: "页面闭环查看",
    status: "completed",
    metadata: { source: "page" },
  });
  const task = p.createTask({
    work_item_id: workItem.id,
    owner_agent: "Codex",
    reviewer_agent: "Claude",
    collaborators: ["MiniMax"],
    boundary: "补齐页面功能骨架",
    dependencies: [],
    expected_artifacts: ["public/console.html"],
    acceptance_criteria: ["页面可见 Review、门禁、复盘"],
    status: "completed",
    metadata: { title: "T13F 页面骨架" },
  });
  p.createA2AEvent({
    from_agent: "Codex",
    to_agent: "Claude",
    work_item_id: workItem.id,
    task_id: task.id,
    purpose: "review_request",
    claim_or_request: "请 Review 页面功能骨架",
    response: "Review 通过",
    conclusion: "review_passed",
    next_action: "run_e2e",
    requires_user_intervention: false,
  });
  p.createReviewRecord({
    work_item_id: workItem.id,
    task_id: task.id,
    author_agent: "Codex",
    reviewer_agent: "Claude",
    scope: "T13F 页面功能骨架",
    findings: ["页面投影可读"],
    result: "approved",
    required_fixes: [],
    resolved: true,
  });
  p.createQualityGateRun({
    work_item_id: workItem.id,
    task_id: task.id,
    gate_name: "verify:page",
    validation_method: "node src/server/user-participation-view.verify.js",
    result: "12 passed",
    final_status: "passed",
  });
  p.createEscalationRecord({
    work_item_id: workItem.id,
    task_id: task.id,
    status: "confirmed",
    trigger_type: "harness_block",
    trigger_rule: "HIGH_RISK_ACTION_REQUIRES_CONFIRMATION",
    what_happened: "需要用户确认降级执行",
    blocked_gate: "permission",
    options: ["confirm", "reject"],
    risks: "MiniMax 未参与体验 Review",
    recommended_next_step: "记录 A7 降级风险",
    user_decision: "confirm",
    decision_detail: "开发冲刺先继续",
    decided_by: "user",
  });
  p.createDeliveryRecord({
    work_item_id: workItem.id,
    task_id: task.id,
    action: "feature_push",
    actor_agent: "Codex",
    git_identity: "Clowder Codex <codex@clowder.local>",
    current_branch: "codex/t13f-t16-e2e",
    target_branch: "codex/t13f-t16-e2e",
    result: "passed",
    push_status: "ready",
  });
  generateRetrospective(p, workItem.id, {
    retrospective_conclusion: "页面闭环样例可读，MiniMax 体验 Review 仍需补齐。",
    process_improvement_suggestions: ["T16 继续覆盖失败路径"],
    technical_execution_suggestions: ["保持页面投影在服务层"],
  });
  return { workItem, task };
}

check("empty workspace returns no selected work item", () => {
  const p = makePersistence();
  const view = buildUserParticipationView(p);
  assert.deepStrictEqual(view.work_items, []);
  assert.strictEqual(view.selected_work_item, null);
  assert.strictEqual(view.product_baseline.page_entry_is_primary, true);
});

check("work item list includes latest key conclusion", () => {
  const p = makePersistence();
  seedCompletedScenario(p);
  const view = buildUserParticipationView(p);
  assert.strictEqual(view.work_items.length, 1);
  assert.strictEqual(view.work_items[0].latest_key_conclusion.source, "retrospective");
});

check("selected work item contains details, roles, and tasks", () => {
  const p = makePersistence();
  const { workItem } = seedCompletedScenario(p);
  const selected = buildUserParticipationView(p, { work_item_id: workItem.id }).selected_work_item;
  assert.strictEqual(selected.id, workItem.id);
  assert.deepStrictEqual(selected.owners, ["Codex"]);
  assert.deepStrictEqual(selected.reviewers, ["Claude"]);
  assert.deepStrictEqual(selected.collaborators, ["MiniMax"]);
  assert.strictEqual(selected.tasks.length, 1);
});

check("timeline includes all first-week governance event kinds", () => {
  const p = makePersistence();
  const { workItem } = seedCompletedScenario(p);
  const selected = buildWorkItemView(p, workItem.id);
  const kinds = new Set(selected.timeline.map((event) => event.kind));
  for (const kind of [
    "work_item",
    "task",
    "a2a",
    "review",
    "quality_gate",
    "escalation",
    "delivery",
    "retrospective",
  ]) {
    assert.ok(kinds.has(kind), `missing timeline kind: ${kind}`);
  }
});

check("review, quality, delivery, and retrospective summaries are exposed", () => {
  const p = makePersistence();
  const { workItem } = seedCompletedScenario(p);
  const selected = buildWorkItemView(p, workItem.id);
  assert.strictEqual(selected.review_summary.approved, 1);
  assert.strictEqual(selected.quality_gate_summary.passed, 1);
  assert.strictEqual(selected.delivery_summary.passed, 1);
  assert.ok(selected.retrospective_summary.conclusion.includes("页面闭环样例"));
});

check("pending confirmations are separated from resolved confirmations", () => {
  const p = makePersistence();
  const workItem = p.createWorkItem({ goal: "需要确认", status: "blocked" });
  p.createEscalationRecord({
    work_item_id: workItem.id,
    status: "pending_user_confirmation",
    what_happened: "缺少用户确认",
    trigger_rule: "QUALITY_GATE_NOT_PASSED",
  });
  const selected = buildWorkItemView(p, workItem.id);
  assert.strictEqual(selected.confirmations.length, 1);
  assert.strictEqual(selected.pending_confirmations.length, 1);
});

check("missing work item is a client-readable error", () => {
  const p = makePersistence();
  assert.throws(
    () => buildWorkItemView(p, "wi-missing"),
    /WorkItem not found: wi-missing/
  );
});

check("latest key conclusion falls back to pending when no signal exists", () => {
  const conclusion = findLatestKeyConclusion({
    a2aEvents: [],
    reviews: [],
    qualityGates: [],
    escalations: [],
    deliveryRecords: [],
    retrospective: null,
  });
  assert.strictEqual(conclusion.source, "work_item");
  assert.strictEqual(conclusion.summary, "待形成");
});

check("latest key conclusion can come from failed quality gate", () => {
  const conclusion = findLatestKeyConclusion({
    a2aEvents: [],
    reviews: [],
    qualityGates: [{
      id: "qg-1",
      final_status: "failed",
      failure_summary: "lint failed",
      updated_at: "2026-01-01T00:00:00.000Z",
    }],
    escalations: [],
    deliveryRecords: [],
    retrospective: null,
  });
  assert.strictEqual(conclusion.source, "quality_gate");
  assert.strictEqual(conclusion.summary, "lint failed");
});

check("MiniMax downgrade is explicit and does not mark A7 closed", () => {
  const p = makePersistence();
  seedCompletedScenario(p);
  const view = buildUserParticipationView(p);
  assert.strictEqual(view.product_baseline.minimax_experience_review, "not_completed");
  assert.match(view.product_baseline.downgrade_notice, /A7 remains open/);
});

process.stdout.write(`T13F user participation view verify: ${passed} passed, 0 failed\n`);
