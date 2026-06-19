"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  TRANSITIONS,
  WORK_ITEM_STATUSES,
  canTransition,
  isBlocked,
  isTerminal,
  transition,
  transitionWorkItem,
} = require("./state-machine");
const { createPersistence } = require("../storage");

let passed = 0;
let failed = 0;

function check(desc, fn) {
  try {
    fn();
    passed += 1;
  } catch (e) {
    failed += 1;
    console.error(`  FAIL [${desc}]: ${e.message}`);
  }
}

// ── Section 1: TRANSITIONS map integrity ──
console.log("── TRANSITIONS 映射完整性 ──");

check("TRANSITIONS 包含所有 11 个状态", () => {
  for (const s of WORK_ITEM_STATUSES) {
    assert.ok(Object.prototype.hasOwnProperty.call(TRANSITIONS, s), `缺少状态: ${s}`);
  }
});

check("TRANSITIONS is frozen", () => {
  assert.strictEqual(Object.isFrozen(TRANSITIONS), true);
});

check("completed has no forward transitions", () => {
  assert.deepStrictEqual(TRANSITIONS.completed, []);
});

check("pending_review has two forward targets", () => {
  assert.deepStrictEqual(TRANSITIONS.pending_review, ["needs_fix", "pending_verification"]);
});

// ── Section 2: Normal flow ──
console.log("── 正常状态流转 ──");

const NORMAL_FLOW = [
  ["needs_clarification", "solution_review"],
  ["solution_review", "ready_for_development"],
  ["ready_for_development", "in_development"],
  ["in_development", "pending_review"],
  ["pending_review", "needs_fix"],
  ["needs_fix", "in_development"],
  ["pending_review", "pending_verification"],
  ["pending_verification", "ready_to_commit"],
  ["ready_to_commit", "pushed"],
  ["pushed", "completed"],
];

for (const [from, to] of NORMAL_FLOW) {
  check(`${from} → ${to}`, () => {
    const r = transition(from, to);
    assert.strictEqual(r.status, to);
    assert.strictEqual(r.previousStatus, undefined);
    assert.strictEqual(r.reason, undefined);
  });
}

// ── Section 3: Self-transition (no-op) ──
console.log("── 自转移 no-op ──");

check("pending_review → pending_review is no-op", () => {
  const r = transition("pending_review", "pending_review");
  assert.strictEqual(r.status, "pending_review");
});

check("blocked → blocked throws (already blocked)", () => {
  assert.throws(
    () => transition("blocked", "blocked"),
    /already blocked/,
  );
});

// ── Section 4: Blocked entry ──
console.log("── blocked 入口 ──");

check("needs_clarification → blocked with reason", () => {
  const r = transition("needs_clarification", "blocked", { reason: "重大需求歧义" });
  assert.strictEqual(r.status, "blocked");
  assert.strictEqual(r.previousStatus, "needs_clarification");
  assert.strictEqual(r.reason, "重大需求歧义");
});

check("in_development → blocked records previousStatus", () => {
  const r = transition("in_development", "blocked", { reason: "worktree 冲突" });
  assert.strictEqual(r.previousStatus, "in_development");
});

check("completed → blocked (terminal can be blocked too)", () => {
  const r = transition("completed", "blocked", { reason: "交付后发现回归" });
  assert.strictEqual(r.status, "blocked");
  assert.strictEqual(r.previousStatus, "completed");
});

check("blocked requires non-empty reason", () => {
  assert.throws(
    () => transition("needs_clarification", "blocked"),
    /reason is required/,
  );
  assert.throws(
    () => transition("needs_clarification", "blocked", { reason: "" }),
    /reason is required/,
  );
  assert.throws(
    () => transition("needs_clarification", "blocked", { reason: "   " }),
    /reason is required/,
  );
});

// ── Section 5: Blocked exit (unblock) ──
console.log("── blocked 出口 ──");

check("blocked → previousStatus (solution_review)", () => {
  const r = transition("blocked", "solution_review", { previousStatus: "solution_review" });
  assert.strictEqual(r.status, "solution_review");
  assert.strictEqual(r.previousStatus, null);
});

check("blocked → previousStatus (in_development)", () => {
  const r = transition("blocked", "in_development", { previousStatus: "in_development" });
  assert.strictEqual(r.status, "in_development");
});

check("unblock target must match previousStatus", () => {
  assert.throws(
    () => transition("blocked", "solution_review", { previousStatus: "in_development" }),
    /must match previous status/,
  );
});

check("unblock without previousStatus throws", () => {
  assert.throws(
    () => transition("blocked", "solution_review"),
    /Cannot unblock without specifying the previous status/,
  );
});

check("unblock with invalid previousStatus throws", () => {
  assert.throws(
    () => transition("blocked", "solution_review", { previousStatus: "nonexistent" }),
    /Unknown previous status/,
  );
});

check("unblock from nested blocked throws", () => {
  assert.throws(
    () => transition("blocked", "solution_review", { previousStatus: "blocked" }),
    /nested blocked/,
  );
});

// ── Section 6: Illegal transitions ──
console.log("── 非法转移拦截 ──");

check("needs_clarification → in_development rejected", () => {
  assert.throws(
    () => transition("needs_clarification", "in_development"),
    /Cannot transition from "needs_clarification" to "in_development"/,
  );
});

check("pending_review → completed rejected", () => {
  assert.throws(
    () => transition("pending_review", "completed"),
    /Cannot transition from "pending_review" to "completed"/,
  );
});

check("completed → pushed rejected (terminal)", () => {
  assert.throws(
    () => transition("completed", "pushed"),
    /terminal state/,
  );
});

check("invalid current status throws", () => {
  assert.throws(
    () => transition("garbage_status", "needs_clarification"),
    /Unknown current status/,
  );
});

check("invalid target status throws", () => {
  assert.throws(
    () => transition("needs_clarification", "garbage_status"),
    /Unknown target status/,
  );
});

check("error message lists valid targets", () => {
  try {
    transition("pending_review", "pushed");
    assert.fail("should have thrown");
  } catch (e) {
    assert.ok(e.message.includes('Valid transitions from "pending_review"'));
    assert.ok(e.message.includes("needs_fix"));
    assert.ok(e.message.includes("pending_verification"));
    assert.ok(e.message.includes("blocked"));
  }
});

// ── Section 7: Convenience predicates ──
console.log("── 辅助判断函数 ──");

check("isTerminal(completed) is true", () => {
  assert.strictEqual(isTerminal("completed"), true);
});

check("isTerminal(in_development) is false", () => {
  assert.strictEqual(isTerminal("in_development"), false);
});

check("isBlocked(blocked) is true", () => {
  assert.strictEqual(isBlocked("blocked"), true);
});

check("isBlocked(needs_clarification) is false", () => {
  assert.strictEqual(isBlocked("needs_clarification"), false);
});

check("canTransition returns true for valid", () => {
  assert.strictEqual(canTransition("needs_clarification", "solution_review"), true);
});

check("canTransition returns false for invalid", () => {
  assert.strictEqual(canTransition("needs_clarification", "completed"), false);
});

// ── Section 8: transitionWorkItem (persistence-coupled API) ──
console.log("── transitionWorkItem 持久化集成 ──");

check("transitionWorkItem advances status through T3 Store", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clowder-t5-api-"));
  try {
    const p = createPersistence(tempDir);
    const wi = p.createWorkItem({ goal: "API 测试" });
    assert.strictEqual(wi.status, "needs_clarification");

    const u1 = transitionWorkItem(p, wi.id, "solution_review");
    assert.strictEqual(u1.status, "solution_review");

    const u2 = transitionWorkItem(p, wi.id, "ready_for_development");
    assert.strictEqual(u2.status, "ready_for_development");

    // Verify store persistence
    const reRead = p.workItemStore.read(wi.id);
    assert.strictEqual(reRead.status, "ready_for_development");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

check("transitionWorkItem block → metadata.blocking populated", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clowder-t5-block-"));
  try {
    const p = createPersistence(tempDir);
    const wi = p.createWorkItem({ goal: "阻塞测试" });

    transitionWorkItem(p, wi.id, "solution_review");
    const blocked = transitionWorkItem(p, wi.id, "blocked", { reason: "质量门禁持续失败" });

    assert.strictEqual(blocked.status, "blocked");
    assert.ok(blocked.metadata.blocking, "metadata.blocking should exist");
    assert.strictEqual(blocked.metadata.blocking.blocked_from, "solution_review");
    assert.strictEqual(blocked.metadata.blocking.reason, "质量门禁持续失败");
    assert.ok(blocked.metadata.blocking.blocked_at, "blocked_at should be set");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

check("transitionWorkItem unblock reads previousStatus from metadata.blocking", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clowder-t5-unblock-"));
  try {
    const p = createPersistence(tempDir);
    const wi = p.createWorkItem({ goal: "解除阻塞测试" });

    transitionWorkItem(p, wi.id, "solution_review");
    transitionWorkItem(p, wi.id, "blocked", { reason: "需要用户确认" });

    // Unblock — previousStatus resolved automatically from metadata.blocking
    const unblocked = transitionWorkItem(p, wi.id, "solution_review");
    assert.strictEqual(unblocked.status, "solution_review");
    assert.strictEqual(unblocked.metadata.blocking, null);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

check("transitionWorkItem throws on illegal transition", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clowder-t5-illegal-"));
  try {
    const p = createPersistence(tempDir);
    const wi = p.createWorkItem({ goal: "非法转移测试" });
    assert.throws(
      () => transitionWorkItem(p, wi.id, "completed"),
      /Cannot transition/,
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

check("transitionWorkItem throws on missing WorkItem", () => {
  const p = createPersistence(fs.mkdtempSync(path.join(os.tmpdir(), "clowder-t5-missing-")));
  assert.throws(
    () => transitionWorkItem(p, "nonexistent-id", "solution_review"),
    /WorkItem not found/,
  );
});

check("full happy path with transitionWorkItem", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clowder-t5-full-"));
  try {
    const p = createPersistence(tempDir);
    const wi = p.createWorkItem({ goal: "全路径测试" });

    const path_ = ["solution_review", "ready_for_development", "in_development",
      "pending_review", "pending_verification", "ready_to_commit", "pushed", "completed"];

    for (const target of path_) {
      const updated = transitionWorkItem(p, wi.id, target);
      assert.strictEqual(updated.status, target);
    }

    const final = p.workItemStore.read(wi.id);
    assert.strictEqual(final.status, "completed");
    assert.strictEqual(isTerminal(final.status), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// ── Section 9: canTransition with opts passthrough ──
console.log("── canTransition opts 穿透 ──");

check("canTransition with block reason returns true", () => {
  assert.strictEqual(
    canTransition("in_development", "blocked", { reason: "冲突" }),
    true,
  );
});

check("canTransition without block reason returns false", () => {
  assert.strictEqual(
    canTransition("in_development", "blocked"),
    false,
  );
});

// ── Results ──
console.log(`\n${"═".repeat(50)}`);
console.log(`结果: ${passed} 通过, ${failed} 失败, ${passed + failed} 总计`);
console.log(`${"═".repeat(50)}`);
if (failed > 0) process.exit(1);
