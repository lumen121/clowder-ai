"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createPersistence } = require("../storage");
const {
  evaluateHarnessRails,
  evaluateHighRiskAction,
  guardedTransitionWorkItem,
} = require("./core-rails");

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `clowder-t8-${label}-`));
  return {
    dir,
    p: createPersistence(dir),
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

function createReadyWorkItem(p) {
  const wi = p.createWorkItem({
    goal: "Implement Harness rails",
    status: "ready_for_development",
    solution: {
      summary: "Core Harness rails",
      approach: "Evaluate status advancement gates before calling T5 transitions.",
    },
  });
  const task = p.createTask({
    work_item_id: wi.id,
    owner_agent: "Codex",
    boundary: "T8 Harness guard only",
    dependencies: [],
    expected_artifacts: ["src/harness/core-rails.js"],
    reviewer_agent: "Claude",
    acceptance_criteria: ["Blocks missing review", "Blocks failed gates"],
  });
  p.workItemStore.update(wi.id, {
    tasks: [task.id],
    metadata: {
      solution_breakdown: {
        ready_for_development: true,
        task_ids: [task.id],
        review_agent: "Claude",
      },
    },
  });
  return { workItem: p.workItemStore.read(wi.id), task };
}

function addApprovedReview(p, wi, task) {
  return p.createReviewRecord({
    work_item_id: wi.id,
    task_id: task.id,
    author_agent: "Codex",
    reviewer_agent: "Claude",
    scope: "T8 Harness rails",
    findings: [],
    result: "approved",
    required_fixes: [],
    resolved: true,
  });
}

function addPassingGate(p, wi, task) {
  return p.createQualityGateRun({
    work_item_id: wi.id,
    task_id: task.id,
    gate_name: "t8-verify",
    validation_method: "node src/harness/core-rails.verify.js",
    result: "passed",
    final_status: "passed",
  });
}

console.log("T8 Harness core rails verification\n");

console.log("-- solution and task contract --");

check("missing solution blocks ready_for_development", () => {
  const { p, cleanup } = makePersistence("missing-solution");
  try {
    const wi = p.createWorkItem({ goal: "No solution", status: "solution_review" });
    const decision = evaluateHarnessRails(p, {
      workItemId: wi.id,
      targetStatus: "ready_for_development",
    });
    assert.strictEqual(decision.allowed, false);
    assert.ok(decision.blockers.some((item) => item.code === "MISSING_SOLUTION"));
  } finally {
    cleanup();
  }
});

check("missing task breakdown blocks development entry", () => {
  const { p, cleanup } = makePersistence("missing-tasks");
  try {
    const wi = p.createWorkItem({
      goal: "No tasks",
      status: "solution_review",
      solution: { summary: "s", approach: "a" },
    });
    const decision = evaluateHarnessRails(p, {
      workItemId: wi.id,
      targetStatus: "ready_for_development",
    });
    assert.strictEqual(decision.allowed, false);
    assert.ok(decision.blockers.some((item) => item.code === "MISSING_TASK_BREAKDOWN"));
  } finally {
    cleanup();
  }
});

check("incomplete task contract is blocked", () => {
  const { p, cleanup } = makePersistence("incomplete-task");
  try {
    const wi = p.createWorkItem({
      goal: "Bad task",
      status: "solution_review",
      solution: { summary: "s", approach: "a" },
    });
    const task = p.createTask({
      work_item_id: wi.id,
      owner_agent: "Codex",
      boundary: "",
      reviewer_agent: "Claude",
      expected_artifacts: [],
      acceptance_criteria: [],
    });
    p.workItemStore.update(wi.id, { tasks: [task.id] });
    const decision = evaluateHarnessRails(p, {
      workItemId: wi.id,
      targetStatus: "ready_for_development",
    });
    assert.strictEqual(decision.allowed, false);
    assert.ok(decision.blockers.some((item) => item.code === "INCOMPLETE_TASK_CONTRACT"));
  } finally {
    cleanup();
  }
});

check("author self-review in task contract is blocked", () => {
  const { p, cleanup } = makePersistence("self-review-task");
  try {
    const wi = p.createWorkItem({
      goal: "Self review",
      status: "solution_review",
      solution: { summary: "s", approach: "a" },
    });
    const task = p.createTask({
      work_item_id: wi.id,
      owner_agent: "Codex",
      boundary: "bad review",
      dependencies: [],
      expected_artifacts: ["x"],
      reviewer_agent: "Codex",
      acceptance_criteria: ["x"],
    });
    p.workItemStore.update(wi.id, { tasks: [task.id] });
    const decision = evaluateHarnessRails(p, {
      workItemId: wi.id,
      targetStatus: "ready_for_development",
    });
    assert.strictEqual(decision.allowed, false);
    assert.ok(decision.blockers.some((item) => item.code === "AUTHOR_SELF_REVIEW"));
  } finally {
    cleanup();
  }
});

console.log("-- state and review gates --");

check("illegal T5 transition is blocked before other gates matter", () => {
  const { p, cleanup } = makePersistence("illegal-transition");
  try {
    const { workItem } = createReadyWorkItem(p);
    const decision = evaluateHarnessRails(p, {
      workItemId: workItem.id,
      targetStatus: "completed",
    });
    assert.strictEqual(decision.allowed, false);
    assert.ok(decision.blockers.some((item) => item.code === "ILLEGAL_STATUS_TRANSITION"));
  } finally {
    cleanup();
  }
});

check("missing approved review blocks pending_verification", () => {
  const { p, cleanup } = makePersistence("missing-review");
  try {
    const { workItem } = createReadyWorkItem(p);
    p.workItemStore.update(workItem.id, { status: "pending_review" });
    const decision = evaluateHarnessRails(p, {
      workItemId: workItem.id,
      targetStatus: "pending_verification",
    });
    assert.strictEqual(decision.allowed, false);
    assert.ok(decision.blockers.some((item) => item.code === "MISSING_APPROVED_REVIEW"));
  } finally {
    cleanup();
  }
});

check("changes_requested review blocks pending_verification", () => {
  const { p, cleanup } = makePersistence("changes-requested");
  try {
    const { workItem, task } = createReadyWorkItem(p);
    p.workItemStore.update(workItem.id, { status: "pending_review" });
    p.createReviewRecord({
      work_item_id: workItem.id,
      task_id: task.id,
      author_agent: "Codex",
      reviewer_agent: "Claude",
      result: "changes_requested",
      required_fixes: ["fix"],
      resolved: false,
    });
    const decision = evaluateHarnessRails(p, {
      workItemId: workItem.id,
      targetStatus: "pending_verification",
    });
    assert.strictEqual(decision.allowed, false);
    assert.ok(decision.blockers.some((item) => item.code === "MISSING_APPROVED_REVIEW"));
  } finally {
    cleanup();
  }
});

check("approved non-author review allows pending_verification", () => {
  const { p, cleanup } = makePersistence("approved-review");
  try {
    const { workItem, task } = createReadyWorkItem(p);
    p.workItemStore.update(workItem.id, { status: "pending_review" });
    addApprovedReview(p, workItem, task);
    const decision = evaluateHarnessRails(p, {
      workItemId: workItem.id,
      targetStatus: "pending_verification",
    });
    assert.strictEqual(decision.allowed, true);
    assert.deepStrictEqual(decision.blockers, []);
  } finally {
    cleanup();
  }
});

console.log("-- quality and delivery gates --");

check("missing quality gate blocks ready_to_commit", () => {
  const { p, cleanup } = makePersistence("missing-quality");
  try {
    const { workItem, task } = createReadyWorkItem(p);
    p.workItemStore.update(workItem.id, { status: "pending_verification" });
    addApprovedReview(p, workItem, task);
    const decision = evaluateHarnessRails(p, {
      workItemId: workItem.id,
      targetStatus: "ready_to_commit",
      actorAgent: "Codex",
      gitIdentity: "Clowder Codex <codex@clowder.local>",
      maintainabilityComments: "Comment non-obvious guard branches.",
    });
    assert.strictEqual(decision.allowed, false);
    assert.ok(decision.blockers.some((item) => item.code === "QUALITY_GATE_NOT_PASSED"));
  } finally {
    cleanup();
  }
});

check("failed quality gate blocks ready_to_commit", () => {
  const { p, cleanup } = makePersistence("failed-quality");
  try {
    const { workItem, task } = createReadyWorkItem(p);
    p.workItemStore.update(workItem.id, { status: "pending_verification" });
    addApprovedReview(p, workItem, task);
    p.createQualityGateRun({
      work_item_id: workItem.id,
      task_id: task.id,
      gate_name: "unit",
      validation_method: "npm test",
      result: "failed",
      final_status: "failed",
    });
    const decision = evaluateHarnessRails(p, {
      workItemId: workItem.id,
      targetStatus: "ready_to_commit",
      actorAgent: "Codex",
      gitIdentity: "Clowder Codex <codex@clowder.local>",
      maintainabilityComments: "Comment non-obvious guard branches.",
    });
    assert.strictEqual(decision.allowed, false);
    assert.ok(decision.blockers.some((item) => item.code === "QUALITY_GATE_NOT_PASSED"));
  } finally {
    cleanup();
  }
});

check("missing git identity blocks delivery state", () => {
  const { p, cleanup } = makePersistence("missing-git");
  try {
    const { workItem, task } = createReadyWorkItem(p);
    p.workItemStore.update(workItem.id, { status: "pending_verification" });
    addApprovedReview(p, workItem, task);
    addPassingGate(p, workItem, task);
    const decision = evaluateHarnessRails(p, {
      workItemId: workItem.id,
      targetStatus: "ready_to_commit",
      maintainabilityComments: "Comment non-obvious guard branches.",
    });
    assert.strictEqual(decision.allowed, false);
    assert.ok(decision.blockers.some((item) => item.code === "GIT_IDENTITY_NOT_ATTRIBUTABLE"));
  } finally {
    cleanup();
  }
});

check("wrong agent git identity blocks delivery state", () => {
  const { p, cleanup } = makePersistence("wrong-git");
  try {
    const { workItem, task } = createReadyWorkItem(p);
    p.workItemStore.update(workItem.id, { status: "pending_verification" });
    addApprovedReview(p, workItem, task);
    addPassingGate(p, workItem, task);
    const decision = evaluateHarnessRails(p, {
      workItemId: workItem.id,
      targetStatus: "ready_to_commit",
      actorAgent: "Codex",
      gitIdentity: "Clowder Claude <claude@clowder.local>",
      maintainabilityComments: "Comment non-obvious guard branches.",
    });
    assert.strictEqual(decision.allowed, false);
    assert.ok(decision.blockers.some((item) => item.code === "GIT_IDENTITY_NOT_ATTRIBUTABLE"));
  } finally {
    cleanup();
  }
});

check("missing maintainability comment requirement blocks delivery state", () => {
  const { p, cleanup } = makePersistence("missing-comments");
  try {
    const { workItem, task } = createReadyWorkItem(p);
    p.workItemStore.update(workItem.id, { status: "pending_verification" });
    addApprovedReview(p, workItem, task);
    addPassingGate(p, workItem, task);
    const decision = evaluateHarnessRails(p, {
      workItemId: workItem.id,
      targetStatus: "ready_to_commit",
      actorAgent: "Codex",
      gitIdentity: "Clowder Codex <codex@clowder.local>",
    });
    assert.strictEqual(decision.allowed, false);
    assert.ok(decision.blockers.some(
      (item) => item.code === "MISSING_MAINTAINABILITY_COMMENTS_REQUIREMENT"
    ));
  } finally {
    cleanup();
  }
});

check("review, quality gate, git identity, comments allow ready_to_commit", () => {
  const { p, cleanup } = makePersistence("happy-delivery");
  try {
    const { workItem, task } = createReadyWorkItem(p);
    p.workItemStore.update(workItem.id, { status: "pending_verification" });
    addApprovedReview(p, workItem, task);
    addPassingGate(p, workItem, task);
    const decision = evaluateHarnessRails(p, {
      workItemId: workItem.id,
      targetStatus: "ready_to_commit",
      actorAgent: "Codex",
      gitIdentity: "Clowder Codex <codex@clowder.local>",
      maintainabilityComments: "Comment non-obvious guard branches.",
    });
    assert.strictEqual(decision.allowed, true);
  } finally {
    cleanup();
  }
});

check("snake_case maintainability satisfaction flag allows delivery state", () => {
  const { p, cleanup } = makePersistence("snake-maintainability");
  try {
    const { workItem, task } = createReadyWorkItem(p);
    p.workItemStore.update(workItem.id, { status: "pending_verification" });
    addApprovedReview(p, workItem, task);
    addPassingGate(p, workItem, task);
    const decision = evaluateHarnessRails(p, {
      workItemId: workItem.id,
      targetStatus: "ready_to_commit",
      actor_agent: "Codex",
      git_identity: "Clowder Codex <codex@clowder.local>",
      maintainability_comments_satisfied: true,
    });
    assert.strictEqual(decision.allowed, true);
  } finally {
    cleanup();
  }
});

check("work-item-level quality gate without task_id satisfies task gates", () => {
  const { p, cleanup } = makePersistence("global-quality");
  try {
    const { workItem, task } = createReadyWorkItem(p);
    p.workItemStore.update(workItem.id, { status: "pending_verification" });
    addApprovedReview(p, workItem, task);
    p.createQualityGateRun({
      work_item_id: workItem.id,
      gate_name: "global-gate",
      validation_method: "npm test",
      result: "passed",
      final_status: "passed",
    });
    const decision = evaluateHarnessRails(p, {
      workItemId: workItem.id,
      targetStatus: "ready_to_commit",
      actorAgent: "Codex",
      gitIdentity: "Clowder Codex <codex@clowder.local>",
      maintainabilityComments: "Comment non-obvious guard branches.",
    });
    assert.strictEqual(decision.allowed, true);
  } finally {
    cleanup();
  }
});

console.log("-- high-risk actions --");

check("high-risk action is blocked without explicit confirmation", () => {
  const decision = evaluateHighRiskAction({ type: "deploy" });
  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.high_risk, true);
  assert.ok(decision.blockers.some(
    (item) => item.code === "HIGH_RISK_ACTION_REQUIRES_CONFIRMATION"
  ));
});

check("push to main is treated as high-risk", () => {
  const decision = evaluateHighRiskAction({ type: "push", target_branch: "main" });
  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.high_risk, true);
});

check("high-risk action with confirmation is allowed", () => {
  const decision = evaluateHighRiskAction({ type: "deploy", confirmed: true });
  assert.strictEqual(decision.allowed, true);
  assert.strictEqual(decision.high_risk, true);
});

check("normal feature push action is not high-risk", () => {
  const decision = evaluateHighRiskAction({
    type: "push",
    target_branch: "codex/t8-harness-core-rails",
  });
  assert.strictEqual(decision.allowed, true);
  assert.strictEqual(decision.high_risk, false);
});

console.log("-- guarded transition wrapper --");

check("guardedTransitionWorkItem advances when all rails pass", () => {
  const { p, cleanup } = makePersistence("guarded-success");
  try {
    const { workItem, task } = createReadyWorkItem(p);
    p.workItemStore.update(workItem.id, { status: "pending_review" });
    addApprovedReview(p, workItem, task);
    const result = guardedTransitionWorkItem(
      p,
      workItem.id,
      "pending_verification"
    );
    assert.strictEqual(result.decision.allowed, true);
    assert.strictEqual(result.workItem.status, "pending_verification");
  } finally {
    cleanup();
  }
});

check("guardedTransitionWorkItem throws with decision when blocked", () => {
  const { p, cleanup } = makePersistence("guarded-blocked");
  try {
    const { workItem } = createReadyWorkItem(p);
    p.workItemStore.update(workItem.id, { status: "pending_review" });
    assert.throws(
      () => guardedTransitionWorkItem(p, workItem.id, "pending_verification"),
      (error) => {
        assert.ok(error.decision);
        assert.strictEqual(error.decision.allowed, false);
        return /Harness blocked/.test(error.message);
      }
    );
  } finally {
    cleanup();
  }
});

console.log(`\n${"=".repeat(50)}`);
console.log(`Result: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"=".repeat(50)}`);
if (failed > 0) process.exit(1);
