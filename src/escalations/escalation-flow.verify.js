"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createPersistence } = require("../storage");
const {
  createEscalationForHarnessBlock,
  createEscalationForHighRiskAction,
  createEscalationFromHarnessDecision,
  formatForPage,
  listPendingEscalations,
  recordUserEscalationDecision,
} = require("./escalation-flow");

let passed = 0;
let failed = 0;

function check(desc, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failed += 1;
    console.error(`  FAIL [${desc}]: ${error.stack || error.message}`);
  }
}

function makePersistence(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `clowder-t12-${label}-`));
  return {
    dir,
    p: createPersistence(dir),
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

function createReadyWorkItem(p) {
  const workItem = p.createWorkItem({
    goal: "Ship a guarded feature",
    status: "pending_review",
    solution: { summary: "Feature", approach: "Implement with checks." },
  });
  const task = p.createTask({
    work_item_id: workItem.id,
    owner_agent: "Codex",
    boundary: "T12 verification task",
    dependencies: [],
    expected_artifacts: ["src/escalations/escalation-flow.js"],
    reviewer_agent: "Claude",
    acceptance_criteria: ["Escalation can be confirmed"],
  });
  p.workItemStore.update(workItem.id, { tasks: [task.id] });
  return { workItem: p.workItemStore.read(workItem.id), task };
}

console.log("T12 escalation and page confirmation verification\n");

console.log("-- escalation creation --");

check("major ambiguity escalation can be created from blocked Harness decision", () => {
  const { p, cleanup } = makePersistence("ambiguity");
  try {
    const wi = p.createWorkItem({ goal: "Ambiguous scope", status: "needs_clarification" });
    const escalation = createEscalationFromHarnessDecision(p, {
      allowed: false,
      blocked: true,
      work_item_id: wi.id,
      target_status: "ready_for_development",
      gates_checked: ["solution_task_breakdown"],
      blockers: [{
        code: "MAJOR_AMBIGUITY",
        message: "The implementation scope conflicts with the product baseline.",
        next_action: "Ask the product owner to confirm the boundary.",
        blocked_gate: "solution",
        severity: "blocker",
      }],
      next_actions: ["Ask the product owner to confirm the boundary."],
    }, {
      trigger_type: "major_ambiguity",
      affected_tasks: ["T12"],
    });

    assert.match(escalation.id, /^esc-/);
    assert.strictEqual(escalation.status, "pending_user_confirmation");
    assert.strictEqual(escalation.trigger_rule, "MAJOR_AMBIGUITY");
    assert.strictEqual(escalation.blocked_gate, "solution");
    assert.ok(escalation.risks.includes("solution"));
    assert.deepStrictEqual(escalation.affected_tasks, ["T12"]);
  } finally {
    cleanup();
  }
});

check("missing non-author review creates a pending escalation from T8 decision", () => {
  const { p, cleanup } = makePersistence("missing-review");
  try {
    const { workItem } = createReadyWorkItem(p);

    const escalation = createEscalationForHarnessBlock(p, {
      workItemId: workItem.id,
      targetStatus: "pending_verification",
    });

    assert.strictEqual(escalation.work_item_id, workItem.id);
    assert.strictEqual(escalation.trigger_type, "harness_block");
    assert.ok(escalation.blockers.some((item) => item.code === "MISSING_APPROVED_REVIEW"));
    assert.strictEqual(escalation.status, "pending_user_confirmation");
  } finally {
    cleanup();
  }
});

check("failed quality gate blocker is preserved in escalation details", () => {
  const { p, cleanup } = makePersistence("failed-gate");
  try {
    const { workItem, task } = createReadyWorkItem(p);
    p.workItemStore.update(workItem.id, { status: "pending_verification" });
    p.createReviewRecord({
      work_item_id: workItem.id,
      task_id: task.id,
      author_agent: "Codex",
      reviewer_agent: "Claude",
      result: "approved",
      required_fixes: [],
      resolved: true,
    });
    p.createQualityGateRun({
      work_item_id: workItem.id,
      task_id: task.id,
      gate_name: "npm test",
      validation_method: "npm test",
      result: "failed",
      final_status: "failed",
    });

    const escalation = createEscalationForHarnessBlock(p, {
      workItemId: workItem.id,
      targetStatus: "ready_to_commit",
      actorAgent: "Codex",
      gitIdentity: "Clowder Codex <codex@clowder.local>",
      maintainabilityComments: "Comment non-obvious decision branches.",
    });

    assert.ok(escalation.blockers.some((item) => item.code === "QUALITY_GATE_NOT_PASSED"));
    assert.strictEqual(escalation.blocked_gate, "quality_gate");
  } finally {
    cleanup();
  }
});

check("high-risk action creates escalation record", () => {
  const { p, cleanup } = makePersistence("high-risk");
  try {
    const wi = p.createWorkItem({ goal: "Push to master", status: "ready_to_commit" });
    const escalation = createEscalationForHighRiskAction(
      p,
      { type: "push", target_branch: "master" },
      { work_item_id: wi.id }
    );

    assert.strictEqual(escalation.trigger_type, "high_risk_action");
    assert.strictEqual(escalation.action.type, "push");
    assert.strictEqual(escalation.action.target_branch, "master");
    assert.ok(escalation.blockers.some(
      (item) => item.code === "HIGH_RISK_ACTION_REQUIRES_CONFIRMATION"
    ));
  } finally {
    cleanup();
  }
});

check("allowed Harness decision is not escalated", () => {
  const { p, cleanup } = makePersistence("allowed");
  try {
    assert.throws(
      () => createEscalationFromHarnessDecision(p, {
        allowed: true,
        blocked: false,
        work_item_id: "wi-ok",
        blockers: [],
      }),
      /Only blocked/
    );
  } finally {
    cleanup();
  }
});

console.log("-- user decision writeback --");

check("user confirmation is persisted and mirrored to A2A and WorkItem metadata", () => {
  const { p, cleanup } = makePersistence("confirm");
  try {
    const wi = p.createWorkItem({ goal: "Confirm escalation", status: "blocked" });
    const escalation = createEscalationFromHarnessDecision(p, {
      allowed: false,
      blocked: true,
      work_item_id: wi.id,
      blockers: [{
        code: "HIGH_RISK_ACTION_REQUIRES_CONFIRMATION",
        message: "Confirm before push.",
        next_action: "Wait for user confirmation.",
        blocked_gate: "permission",
      }],
      next_actions: ["Wait for user confirmation."],
    });

    const updated = recordUserEscalationDecision(p, escalation.id, {
      decision: "confirm",
      decided_by: "user",
      detail: "允许继续 feature 分支推送。",
    });
    const workItem = p.workItemStore.read(wi.id);
    const a2aEvents = p.a2aEventStore.list((item) =>
      item.work_item_id === wi.id &&
      item.context.includes("escalation_user_decision")
    );

    assert.strictEqual(updated.status, "confirmed");
    assert.strictEqual(updated.user_decision, "confirm");
    assert.strictEqual(workItem.metadata.latest_escalation_decision.user_decision, "confirm");
    assert.ok(workItem.escalations.includes(escalation.id));
    assert.strictEqual(a2aEvents.length, 1);
  } finally {
    cleanup();
  }
});

check("user rejection is persisted with stop/rework next action", () => {
  const { p, cleanup } = makePersistence("reject");
  try {
    const wi = p.createWorkItem({ goal: "Reject escalation", status: "blocked" });
    const escalation = createEscalationForHighRiskAction(
      p,
      { type: "deploy" },
      { work_item_id: wi.id }
    );
    const updated = recordUserEscalationDecision(p, escalation.id, {
      decision: "reject",
      decided_by: "user",
      detail: "不允许部署。",
    });

    assert.strictEqual(updated.status, "rejected");
    assert.strictEqual(updated.next_action_after_decision, "stop_or_rework");
  } finally {
    cleanup();
  }
});

check("request_info requires detail and remains visible as pending", () => {
  const { p, cleanup } = makePersistence("request-info");
  try {
    const wi = p.createWorkItem({ goal: "Need more info", status: "blocked" });
    const escalation = createEscalationForHighRiskAction(
      p,
      { type: "force_push" },
      { work_item_id: wi.id }
    );

    assert.throws(
      () => recordUserEscalationDecision(p, escalation.id, {
        decision: "request_info",
        decided_by: "user",
      }),
      /decision_detail/
    );

    const updated = recordUserEscalationDecision(p, escalation.id, {
      decision: "request_info",
      decided_by: "user",
      detail: "请先说明 force push 会覆盖哪些提交。",
    });
    const pending = listPendingEscalations(p);

    assert.strictEqual(updated.status, "needs_more_info");
    assert.ok(pending.some((item) => item.id === escalation.id));
  } finally {
    cleanup();
  }
});

console.log("-- page query shape --");

check("listPendingEscalations filters resolved records", () => {
  const { p, cleanup } = makePersistence("pending-list");
  try {
    const wi = p.createWorkItem({ goal: "List pending", status: "blocked" });
    const pending = createEscalationForHighRiskAction(p, { type: "deploy" }, {
      work_item_id: wi.id,
    });
    const resolved = createEscalationForHighRiskAction(p, { type: "force_push" }, {
      work_item_id: wi.id,
    });
    recordUserEscalationDecision(p, resolved.id, {
      decision: "confirm",
      decided_by: "user",
      detail: "Confirmed.",
    });

    const records = listPendingEscalations(p, { work_item_id: wi.id });
    assert.deepStrictEqual(records.map((item) => item.id), [pending.id]);
  } finally {
    cleanup();
  }
});

check("formatForPage exposes confirmation fields without raw Store internals", () => {
  const { p, cleanup } = makePersistence("page-format");
  try {
    const wi = p.createWorkItem({ goal: "Page format", status: "blocked" });
    const escalation = createEscalationForHighRiskAction(p, { type: "deploy" }, {
      work_item_id: wi.id,
    });
    const pageRecord = formatForPage(escalation);

    assert.strictEqual(pageRecord.id, escalation.id);
    assert.strictEqual(pageRecord.status, "pending_user_confirmation");
    assert.ok(Array.isArray(pageRecord.options));
    assert.ok(Object.prototype.hasOwnProperty.call(pageRecord, "recommended_next_step"));
  } finally {
    cleanup();
  }
});

console.log(`\n${"=".repeat(50)}`);
console.log(`Result: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"=".repeat(50)}`);

if (failed > 0) {
  process.exit(1);
}
