"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createPersistence } = require("../storage");
const {
  createReview,
  createQualityGate,
} = require("../review-quality");
const { transitionWorkItem } = require("../work-items/state-machine");
const { registerWorkspace } = require("../worktree/isolation-governance");
const {
  evaluateDeliveryReadiness,
  expectedGitIdentity,
  getDeliveryRecords,
  isMainBranch,
  recordDeliveryCheck,
  recordFeaturePushResult,
  summarizeDelivery,
} = require("./delivery-safety");

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`ok ${passed} - ${name}`);
  } catch (error) {
    failed++;
    console.error(`not ok ${passed + failed} - ${name}`);
    console.error(error.stack || error.message);
  }
}

function makePersistence(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `clowder-t11-${label}-`));
  return {
    p: createPersistence(dir),
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

function seedReadyDelivery(p, overrides = {}) {
  const wi = p.createWorkItem({
    goal: "Deliver feature branch safely",
    status: overrides.status || "pending_verification",
    solution: {
      summary: "Add delivery safety checks.",
      approach: "Gate delivery through review, quality, workspace, and identity checks.",
    },
  });

  const task = p.createTask({
    work_item_id: wi.id,
    owner_agent: "Codex",
    boundary: "Git delivery safety module",
    dependencies: ["T8", "T9", "T10"],
    expected_artifacts: ["delivery-safety.js", "delivery-safety.verify.js"],
    reviewer_agent: "Claude",
    acceptance_criteria: ["Blocks unsafe delivery", "Records feature push readiness"],
  });

  p.workItemStore.update(wi.id, { tasks: [task.id] });

  if (overrides.review !== false) {
    createReview(p, {
      work_item_id: wi.id,
      task_id: task.id,
      author_agent: "Codex",
      reviewer_agent: "Claude",
      result: "approved",
      resolved: true,
      findings: [],
      required_fixes: [],
    });
  }

  if (overrides.quality !== false) {
    createQualityGate(p, {
      work_item_id: wi.id,
      task_id: task.id,
      gate_name: "npm run check",
      validation_method: "npm run check",
      result: "checked files OK",
      final_status: overrides.qualityStatus || "passed",
    });
  }

  if (overrides.workspace !== false) {
    registerWorkspace(p, {
      task_id: task.id,
      agent: "Codex",
      branch: "codex/t11-git-delivery-safety",
      worktree_path: "C:\\aiWorkspace\\clowder-ai-t11",
      base_ref: "origin/master",
      conflict_status: overrides.conflict_status || "clean",
      cleanup_status: "active",
    });
  }

  return { wi: p.workItemStore.read(wi.id), task };
}

function baseInput(wi, task, overrides = {}) {
  return {
    work_item_id: wi.id,
    task_id: task.id,
    action: "feature_push",
    actor_agent: "Codex",
    git_identity: "Clowder Codex <codex@clowder.local>",
    current_branch: "codex/t11-git-delivery-safety",
    target_branch: "codex/t11-git-delivery-safety",
    commit_sha: "abc1234",
    maintainability_comments: "T11 delivery guard clauses document trunk and identity risks.",
    ...overrides,
  };
}

check("expectedGitIdentity returns Codex identity", () => {
  assert.strictEqual(expectedGitIdentity("Codex"), "Clowder Codex <codex@clowder.local>");
  assert.strictEqual(expectedGitIdentity("codex"), "Clowder Codex <codex@clowder.local>");
});

check("isMainBranch recognizes main and master", () => {
  assert.strictEqual(isMainBranch("main"), true);
  assert.strictEqual(isMainBranch("master"), true);
  assert.strictEqual(isMainBranch("codex/t11"), false);
});

check("ready feature branch push passes all gates", () => {
  const { p, cleanup } = makePersistence("happy");
  try {
    const { wi, task } = seedReadyDelivery(p, { status: "ready_to_commit" });
    const decision = evaluateDeliveryReadiness(p, baseInput(wi, task));
    assert.strictEqual(decision.allowed, true);
    assert.strictEqual(decision.push_status, "ready");
    assert(decision.gates_checked.includes("non_author_review"));
    assert(decision.gates_checked.includes("quality_gate"));
    assert(decision.gates_checked.includes("worktree_binding"));
  } finally {
    cleanup();
  }
});

check("prepare commit can pass with workspace required false", () => {
  const { p, cleanup } = makePersistence("commit");
  try {
    const { wi, task } = seedReadyDelivery(p, { workspace: false });
    const decision = evaluateDeliveryReadiness(p, baseInput(wi, task, {
      action: "prepare_commit",
      require_workspace: false,
    }));
    assert.strictEqual(decision.allowed, true);
    assert.strictEqual(decision.push_status, "not_attempted");
  } finally {
    cleanup();
  }
});

check("missing review blocks ready_to_commit and feature push", () => {
  const { p, cleanup } = makePersistence("missing-review");
  try {
    const { wi, task } = seedReadyDelivery(p, { review: false });
    const decision = evaluateDeliveryReadiness(p, baseInput(wi, task));
    assert.strictEqual(decision.allowed, false);
    assert(decision.blockers.some((b) => b.code === "MISSING_APPROVED_REVIEW"));
  } finally {
    cleanup();
  }
});

check("failed quality gate blocks delivery", () => {
  const { p, cleanup } = makePersistence("failed-gate");
  try {
    const { wi, task } = seedReadyDelivery(p, { qualityStatus: "failed" });
    const decision = evaluateDeliveryReadiness(p, baseInput(wi, task));
    assert.strictEqual(decision.allowed, false);
    assert(decision.blockers.some((b) => b.code === "QUALITY_GATE_NOT_PASSED"));
  } finally {
    cleanup();
  }
});

check("missing worktree binding blocks feature push", () => {
  const { p, cleanup } = makePersistence("missing-worktree");
  try {
    const { wi, task } = seedReadyDelivery(p, { workspace: false });
    const decision = evaluateDeliveryReadiness(p, baseInput(wi, task));
    assert.strictEqual(decision.allowed, false);
    assert(decision.blockers.some((b) => b.code === "WORKTREE_BINDING_NOT_READY"));
  } finally {
    cleanup();
  }
});

check("workspace conflict blocks feature push", () => {
  const { p, cleanup } = makePersistence("conflict");
  try {
    const { wi, task } = seedReadyDelivery(p, { conflict_status: "file_conflict" });
    const decision = evaluateDeliveryReadiness(p, baseInput(wi, task));
    assert.strictEqual(decision.allowed, false);
    assert(decision.blockers.some((b) => b.code === "WORKTREE_BINDING_NOT_READY"));
  } finally {
    cleanup();
  }
});

check("wrong git identity blocks delivery", () => {
  const { p, cleanup } = makePersistence("identity");
  try {
    const { wi, task } = seedReadyDelivery(p);
    const decision = evaluateDeliveryReadiness(p, baseInput(wi, task, {
      git_identity: "lumen121 <lujinovo@gmail.com>",
    }));
    assert.strictEqual(decision.allowed, false);
    assert(decision.blockers.some((b) => b.code === "GIT_IDENTITY_NOT_ATTRIBUTABLE"));
  } finally {
    cleanup();
  }
});

check("target master branch is blocked even when high risk confirmed", () => {
  const { p, cleanup } = makePersistence("master");
  try {
    const { wi, task } = seedReadyDelivery(p);
    const decision = evaluateDeliveryReadiness(p, baseInput(wi, task, {
      target_branch: "master",
      main_branch_confirmed: true,
    }));
    assert.strictEqual(decision.allowed, false);
    assert(decision.blockers.some((b) => b.code === "MAIN_BRANCH_DELIVERY_BLOCKED"));
  } finally {
    cleanup();
  }
});

check("recordDeliveryCheck persists passed feature push readiness", () => {
  const { p, cleanup } = makePersistence("record-pass");
  try {
    const { wi, task } = seedReadyDelivery(p, { status: "ready_to_commit" });
    const { decision, record } = recordDeliveryCheck(p, baseInput(wi, task));
    const updatedWi = p.workItemStore.read(wi.id);
    assert.strictEqual(decision.allowed, true);
    assert.strictEqual(record.result, "passed");
    assert.strictEqual(record.push_status, "ready");
    assert.strictEqual(updatedWi.delivery_status.latest_delivery_record_id, record.id);
    assert.strictEqual(getDeliveryRecords(p, { work_item_id: wi.id }).length, 1);
  } finally {
    cleanup();
  }
});

check("recordDeliveryCheck persists blocked decision", () => {
  const { p, cleanup } = makePersistence("record-block");
  try {
    const { wi, task } = seedReadyDelivery(p, { review: false });
    const { record } = recordDeliveryCheck(p, baseInput(wi, task));
    const updatedWi = p.workItemStore.read(wi.id);
    assert.strictEqual(record.result, "blocked");
    assert(record.blockers.some((b) => b.code === "MISSING_APPROVED_REVIEW"));
    assert.strictEqual(updatedWi.delivery_status.blocked, true);
  } finally {
    cleanup();
  }
});

check("recordFeaturePushResult records success and updates WorkItem delivery_status", () => {
  const { p, cleanup } = makePersistence("push-success");
  try {
    const { wi, task } = seedReadyDelivery(p, { status: "ready_to_commit" });
    const { record } = recordDeliveryCheck(p, baseInput(wi, task));
    const pushed = recordFeaturePushResult(p, record.id, {
      push_status: "succeeded",
      command: "git push origin codex/t11-git-delivery-safety",
      commit_sha: "def5678",
    });
    const updatedWi = p.workItemStore.read(wi.id);
    assert.strictEqual(pushed.result, "passed");
    assert.strictEqual(pushed.push_status, "succeeded");
    assert.strictEqual(p.workItemStore.read(wi.id).status, "pushed");
    assert.strictEqual(updatedWi.delivery_status.push_status, "succeeded");
    assert.strictEqual(updatedWi.delivery_status.commit_sha, "def5678");
  } finally {
    cleanup();
  }
});

check("recordFeaturePushResult records failure details", () => {
  const { p, cleanup } = makePersistence("push-fail");
  try {
    const { wi, task } = seedReadyDelivery(p, { status: "ready_to_commit" });
    const { record } = recordDeliveryCheck(p, baseInput(wi, task));
    const pushed = recordFeaturePushResult(p, record.id, {
      push_status: "failed",
      command: "git push origin codex/t11-git-delivery-safety",
      failure_summary: "remote rejected push",
    });
    assert.strictEqual(pushed.result, "failed");
    assert.strictEqual(pushed.failure_summary, "remote rejected push");
  } finally {
    cleanup();
  }
});

check("summarizeDelivery returns counts and latest blocker codes", () => {
  const { p, cleanup } = makePersistence("summary");
  try {
    const { wi, task } = seedReadyDelivery(p, { review: false });
    recordDeliveryCheck(p, baseInput(wi, task));
    const summary = summarizeDelivery(p, wi.id);
    assert.strictEqual(summary.total, 1);
    assert.strictEqual(summary.blocked, 1);
    assert(summary.latest.blocker_codes.includes("MISSING_APPROVED_REVIEW"));
  } finally {
    cleanup();
  }
});

check("invalid final push status is rejected", () => {
  const { p, cleanup } = makePersistence("bad-push-status");
  try {
    const { wi, task } = seedReadyDelivery(p, { status: "ready_to_commit" });
    const { record } = recordDeliveryCheck(p, baseInput(wi, task));
    assert.throws(
      () => recordFeaturePushResult(p, record.id, { push_status: "ready" }),
      /Use succeeded or failed/
    );
  } finally {
    cleanup();
  }
});

check("state can advance to ready_to_commit after delivery readiness passes", () => {
  const { p, cleanup } = makePersistence("state");
  try {
    const { wi, task } = seedReadyDelivery(p);
    const decision = evaluateDeliveryReadiness(p, baseInput(wi, task, {
      action: "prepare_commit",
    }));
    assert.strictEqual(decision.allowed, true);
    const advanced = transitionWorkItem(p, wi.id, "ready_to_commit");
    assert.strictEqual(advanced.status, "ready_to_commit");
  } finally {
    cleanup();
  }
});

console.log(`\nT11 delivery safety verification: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
