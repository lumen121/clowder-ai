"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createPersistence } = require("../storage");
const {
  normalizeBreakdownInput,
  recordSolutionAndTaskBreakdown,
  validateSolutionBreakdown,
} = require("./solution-breakdown");

let passed = 0;
let failed = 0;

function check(desc, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failed += 1;
    console.error(`  FAIL [${desc}]: ${error.message}`);
  }
}

function makePersistence(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `clowder-t7-${label}-`));
  return {
    dir,
    p: createPersistence(dir),
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

function validInput() {
  return {
    solution: {
      summary: "实现最小方案记录和任务拆解流程",
      approach: "复用 T3 Task Store、T5 状态机和 T6 A2AEvent。",
      assumptions: ["首版单用户单项目"],
      risks: ["真实 Harness 护栏留到 T8"],
    },
    tasks: [
      {
        task_key: "design",
        title: "定义方案拆解结构",
        owner_agent: "Codex",
        collaborators: [],
        boundary: "仅方案拆解应用服务和验证脚本",
        dependencies: [],
        expected_artifacts: ["src/work-items/solution-breakdown.js"],
        reviewer_agent: "Claude",
        acceptance_criteria: ["缺字段会阻断", "Task 写入 T3 Store"],
        parallelizable: false,
      },
      {
        task_key: "review",
        title: "非作者 Review",
        owner_agent: "Claude",
        collaborators: [],
        boundary: "只 Review T7 产物",
        dependencies: ["design"],
        expected_artifacts: ["docs/execution/41-t7-review-by-claude.md"],
        reviewer_agent: "Codex",
        acceptance_criteria: ["Review 结论可追踪"],
        parallelizable: false,
      },
    ],
  };
}

console.log("T7 方案与任务拆解流程验证\n");

console.log("── 输入归一化与字段校验 ──");

check("normalizeBreakdownInput accepts complete input", () => {
  const normalized = normalizeBreakdownInput(validInput());
  assert.strictEqual(normalized.solution.summary.includes("最小方案"), true);
  assert.strictEqual(normalized.tasks.length, 2);
  assert.strictEqual(normalized.tasks[0].owner_agent, "Codex");
});

check("missing solution.summary is blocked", () => {
  const input = validInput();
  input.solution.summary = "";
  assert.throws(() => normalizeBreakdownInput(input), /solution\.summary/);
});

check("missing reviewer_agent is blocked", () => {
  const input = validInput();
  delete input.tasks[0].reviewer_agent;
  assert.throws(() => normalizeBreakdownInput(input), /reviewer_agent/);
});

check("author self-review is blocked", () => {
  const input = validInput();
  input.tasks[0].reviewer_agent = "Codex";
  assert.throws(() => normalizeBreakdownInput(input), /non-author/);
});

check("empty expected_artifacts is blocked", () => {
  const input = validInput();
  input.tasks[0].expected_artifacts = [];
  assert.throws(() => normalizeBreakdownInput(input), /expected_artifacts/);
});

check("duplicate task_key is blocked", () => {
  const input = validInput();
  input.tasks[1].task_key = "design";
  assert.throws(() => normalizeBreakdownInput(input), /Duplicate task_key/);
});

console.log("\n── 依赖与状态前置校验 ──");

check("unsatisfied dependency is blocked", () => {
  const { p, cleanup } = makePersistence("dependency");
  try {
    const wi = p.createWorkItem({ goal: "依赖验证" });
    const input = validInput();
    input.tasks[0].dependencies = ["missing-task"];
    assert.throws(
      () => validateSolutionBreakdown(p, wi.id, input),
      /unsatisfied dependency/
    );
  } finally {
    cleanup();
  }
});

check("dependency cycle is blocked", () => {
  const { p, cleanup } = makePersistence("cycle");
  try {
    const wi = p.createWorkItem({ goal: "循环依赖验证" });
    const input = validInput();
    input.tasks[0].dependencies = ["review"];
    input.tasks[1].dependencies = ["design"];
    assert.throws(
      () => validateSolutionBreakdown(p, wi.id, input),
      /dependency cycle/
    );
  } finally {
    cleanup();
  }
});

check("dependency cycle via existing task ids is blocked", () => {
  const { p, cleanup } = makePersistence("cycle-by-id");
  try {
    const wi = p.createWorkItem({ goal: "ID 循环依赖验证" });
    const taskA = p.createTask({
      work_item_id: wi.id,
      owner_agent: "Codex",
      boundary: "existing a",
      reviewer_agent: "Claude",
      dependencies: [],
      expected_artifacts: ["a"],
      acceptance_criteria: ["ok"],
      metadata: { task_key: "a" },
    });
    const taskB = p.createTask({
      work_item_id: wi.id,
      owner_agent: "Claude",
      boundary: "existing b",
      reviewer_agent: "Codex",
      dependencies: [],
      expected_artifacts: ["b"],
      acceptance_criteria: ["ok"],
      metadata: { task_key: "b" },
    });

    const input = validInput();
    input.tasks[0].id = taskA.id;
    input.tasks[0].dependencies = [taskB.id];
    input.tasks[1].id = taskB.id;
    input.tasks[1].dependencies = [taskA.id];

    assert.throws(
      () => validateSolutionBreakdown(p, wi.id, input),
      /dependency cycle/
    );
  } finally {
    cleanup();
  }
});

check("post-development work item status is blocked", () => {
  const { p, cleanup } = makePersistence("status");
  try {
    const wi = p.createWorkItem({ goal: "状态验证", status: "in_development" });
    assert.throws(
      () => validateSolutionBreakdown(p, wi.id, validInput()),
      /pre-development/
    );
  } finally {
    cleanup();
  }
});

console.log("\n── 持久化、状态推进与 A2A 记录 ──");

check("recordSolutionAndTaskBreakdown creates tasks and advances status", () => {
  const { p, cleanup } = makePersistence("happy");
  try {
    const wi = p.createWorkItem({ goal: "实现 T7", type: "feature" });
    const result = recordSolutionAndTaskBreakdown(p, wi.id, validInput(), {
      reviewAgent: "Claude",
      a2aConclusion: "awaiting_review",
    });

    assert.strictEqual(result.ready_for_development, true);
    assert.strictEqual(result.workItem.status, "ready_for_development");
    assert.strictEqual(result.tasks.length, 2);
    assert.strictEqual(result.tasks[0].reviewer_agent, "Claude");
    assert.ok(result.tasks[1].dependencies.includes(result.tasks[0].id));
    assert.strictEqual(result.a2aEvent.purpose, "task_breakdown_feedback");
    assert.strictEqual(result.a2aEvent.to_agent, "Claude");

    const stored = p.workItemStore.read(wi.id);
    assert.strictEqual(stored.solution.summary.includes("最小方案"), true);
    assert.deepStrictEqual(stored.tasks, result.tasks.map((task) => task.id));
    assert.strictEqual(stored.metadata.solution_breakdown.ready_for_development, true);
  } finally {
    cleanup();
  }
});

check("solution_review status advances directly to ready_for_development", () => {
  const { p, cleanup } = makePersistence("solution-review");
  try {
    const wi = p.createWorkItem({
      goal: "方案评估中工作项",
      status: "solution_review",
    });
    const result = recordSolutionAndTaskBreakdown(p, wi.id, validInput());
    assert.strictEqual(result.workItem.status, "ready_for_development");
    assert.strictEqual(result.statusTransitions.length, 1);
  } finally {
    cleanup();
  }
});

check("ready_for_development status remains ready", () => {
  const { p, cleanup } = makePersistence("ready");
  try {
    const wi = p.createWorkItem({
      goal: "已就绪工作项",
      status: "ready_for_development",
    });
    const result = recordSolutionAndTaskBreakdown(p, wi.id, validInput());
    assert.strictEqual(result.workItem.status, "ready_for_development");
    assert.strictEqual(result.statusTransitions.length, 1);
  } finally {
    cleanup();
  }
});

check("recordA2A=false skips A2A creation", () => {
  const { p, cleanup } = makePersistence("no-a2a");
  try {
    const wi = p.createWorkItem({ goal: "不记录 A2A" });
    const result = recordSolutionAndTaskBreakdown(p, wi.id, validInput(), {
      recordA2A: false,
    });
    assert.strictEqual(result.a2aEvent, null);
    assert.strictEqual(p.a2aEventStore.count(), 0);
  } finally {
    cleanup();
  }
});

check("existing metadata is preserved when writing solution breakdown", () => {
  const { p, cleanup } = makePersistence("metadata");
  try {
    const wi = p.createWorkItem({
      goal: "元数据验证",
      metadata: { blocking: { blocked_from: "needs_clarification", reason: "待确认" } },
    });
    const result = recordSolutionAndTaskBreakdown(p, wi.id, validInput(), {
      reviewAgent: "Claude",
    });
    assert.strictEqual(result.workItem.metadata.blocking.reason, "待确认");
    assert.strictEqual(result.workItem.metadata.solution_breakdown.review_agent, "Claude");
  } finally {
    cleanup();
  }
});

check("updating existing task preserves its status", () => {
  const { p, cleanup } = makePersistence("task-status");
  try {
    const wi = p.createWorkItem({ goal: "状态保留" });
    const existingTask = p.createTask({
      work_item_id: wi.id,
      owner_agent: "Claude",
      boundary: "existing task",
      reviewer_agent: "Codex",
      dependencies: [],
      expected_artifacts: ["docs/execution/41-t7-review-by-claude.md"],
      acceptance_criteria: ["保留状态"],
      status: "blocked",
      metadata: { task_key: "design" },
    });

    const input = validInput();
    input.tasks[0].id = existingTask.id;
    const result = recordSolutionAndTaskBreakdown(p, wi.id, input);

    const updated = result.tasks.find((task) => task.id === existingTask.id);
    assert.strictEqual(updated.status, "blocked");
  } finally {
    cleanup();
  }
});

check("updating existing task preserves metadata", () => {
  const { p, cleanup } = makePersistence("task-metadata");
  try {
    const wi = p.createWorkItem({ goal: "任务元数据保留" });
    const existingTask = p.createTask({
      work_item_id: wi.id,
      owner_agent: "Claude",
      boundary: "existing metadata task",
      reviewer_agent: "Codex",
      dependencies: [],
      expected_artifacts: ["docs/execution/41-t7-review-by-claude.md"],
      acceptance_criteria: ["保留元数据"],
      metadata: { task_key: "design", custom_note: "keep-me" },
    });

    const input = validInput();
    input.tasks[0].id = existingTask.id;
    const result = recordSolutionAndTaskBreakdown(p, wi.id, input);

    const updated = result.tasks.find((task) => task.id === existingTask.id);
    assert.strictEqual(updated.metadata.custom_note, "keep-me");
    assert.strictEqual(updated.metadata.task_key, "design");
  } finally {
    cleanup();
  }
});

console.log("\n── 原子性边界 ──");

check("validation failure writes no tasks", () => {
  const { p, cleanup } = makePersistence("no-write");
  try {
    const wi = p.createWorkItem({ goal: "失败不写入" });
    const input = validInput();
    input.tasks[0].acceptance_criteria = [];
    assert.throws(() => recordSolutionAndTaskBreakdown(p, wi.id, input));
    assert.strictEqual(p.taskStore.count(), 0);
    assert.strictEqual(p.workItemStore.read(wi.id).status, "needs_clarification");
  } finally {
    cleanup();
  }
});

check("partial task creation rolls back", () => {
  const { p, cleanup } = makePersistence("rollback");
  try {
    const wi = p.createWorkItem({ goal: "回滚验证" });
    const originalCreateTask = p.createTask.bind(p);
    let createCount = 0;
    p.createTask = (input) => {
      createCount += 1;
      if (createCount === 2) {
        throw new Error("boom");
      }
      return originalCreateTask(input);
    };

    const input = validInput();
    input.tasks[0].id = null;
    input.tasks[1].id = null;
    assert.throws(() => recordSolutionAndTaskBreakdown(p, wi.id, input), /boom/);
    assert.strictEqual(p.taskStore.count(), 0);
    assert.strictEqual(p.workItemStore.read(wi.id).status, "needs_clarification");
  } finally {
    cleanup();
  }
});

console.log(`\n${"═".repeat(50)}`);
console.log(`结果: ${passed} 通过, ${failed} 失败, ${passed + failed} 总计`);
console.log(`${"═".repeat(50)}`);
if (failed > 0) process.exit(1);
