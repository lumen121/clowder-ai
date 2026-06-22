"use strict";

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const { createA2AEvent } = require("../a2a/orchestrator");
const { recordDeliveryCheck, recordFeaturePushResult } = require("../git-delivery/delivery-safety");
const { createEscalationForHarnessBlock, recordUserEscalationDecision } = require("../escalations/escalation-flow");
const { createQualityGate, createReview } = require("../review-quality");
const { generateRetrospective } = require("../retrospective");
const { createPersistence } = require("../storage");
const { startServer } = require("../server/work-item-page-server");
const { registerWorkspace } = require("../worktree/isolation-governance");
const { recordSolutionAndTaskBreakdown } = require("../work-items/solution-breakdown");
const { transitionWorkItem } = require("../work-items/state-machine");

let passed = 0;

async function run() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "clowder-t16-e2e-"));
  const created = await createWorkItemsThroughPageApi(dataDir);
  const persistence = createPersistence(dataDir);

  const success = runSuccessPath(persistence, created.successId);
  const failure = runBlockedFailurePath(persistence, created.failureId);
  const apiView = await readWorkspaceThroughPageApi(dataDir, success.workItem.id);
  verifySuccessPathView(apiView.selected_work_item, success);
  const failureApiView = await readWorkspaceThroughPageApi(dataDir, failure.workItem.id);
  verifyFailurePathView(failureApiView.selected_work_item, failure);
  verifyWorkspaceList(apiView);

  process.stdout.write(`T16 E2E validation verify: ${passed} passed, 0 failed\n`);
}

function check(name, fn) {
  fn();
  passed++;
}

async function createWorkItemsThroughPageApi(dataDir) {
  const server = startServer({ host: "127.0.0.1", port: 0, dataDir });
  try {
    const success = await postJson(server, "/api/work-items", {
      raw_request: "实现页面查看协作闭环的成功路径",
      type: "feature",
      title: "T16 成功路径",
    });
    const failure = await postJson(server, "/api/work-items", {
      raw_request: "修复质量门禁失败时页面不可见的问题",
      type: "bug_fix",
      title: "T16 失败路径",
    });
    check("page API creates success work item", () => {
      assert.strictEqual(success.response.statusCode, 201);
      assert.strictEqual(success.body.work_item.metadata.source, "page");
    });
    check("page API creates failure work item", () => {
      assert.strictEqual(failure.response.statusCode, 201);
      assert.strictEqual(failure.body.work_item.type, "bug_fix");
    });
    return {
      successId: success.body.work_item.id,
      failureId: failure.body.work_item.id,
    };
  } finally {
    server.close();
  }
}

function runSuccessPath(p, workItemId) {
  const breakdown = recordSolutionAndTaskBreakdown(p, workItemId, {
    solution: {
      summary: "用 T13F 页面投影展示协作闭环",
      approach: "聚合 T3 Store 并通过 /api/console/workspace 暴露页面视角",
      assumptions: ["MiniMax 暂不可用，记录 A7 降级风险"],
      risks: ["体验 Review 后续仍需补齐"],
    },
    tasks: [{
      task_key: "t16-success-page",
      title: "跑通成功路径",
      owner_agent: "Codex",
      collaborators: ["MiniMax"],
      boundary: "验证页面录入、A2A、Review、门禁、交付和复盘可见",
      dependencies: [],
      expected_artifacts: ["docs/execution/72-t16-e2e-validation-result.md"],
      reviewer_agent: "Claude",
      acceptance_criteria: ["成功路径在页面 API 中可见"],
      parallelizable: false,
    }],
  }, {
    reviewAgent: "Claude",
    a2aConclusion: "breakdown_ready",
    a2aNextAction: "start_development",
  });

  const task = breakdown.tasks[0];
  transitionWorkItem(p, workItemId, "in_development");
  createA2AEvent(p, {
    from_agent: "Codex",
    to_agent: "Claude",
    work_item_id: workItemId,
    task_id: task.id,
    purpose: "execution_sync",
    claim_or_request: "T16 成功路径实现已进入开发",
    response: "继续推进",
    conclusion: "in_development",
    next_action: "request_review",
  });
  transitionWorkItem(p, workItemId, "pending_review");
  createReview(p, {
    work_item_id: workItemId,
    task_id: task.id,
    author_agent: "Codex",
    reviewer_agent: "Claude",
    scope: "T16 成功路径",
    findings: ["成功路径记录完整"],
    result: "approved",
    required_fixes: [],
    resolved: true,
  });
  transitionWorkItem(p, workItemId, "pending_verification");
  createQualityGate(p, {
    work_item_id: workItemId,
    task_id: task.id,
    gate_name: "verify:e2e",
    validation_method: "node src/e2e/t16-e2e-validation.verify.js",
    result: "success path passed",
    final_status: "passed",
  });
  transitionWorkItem(p, workItemId, "ready_to_commit");
  registerWorkspace(p, {
    task_id: task.id,
    agent: "Codex",
    branch: "codex/t16-success",
    worktree_path: path.join(os.tmpdir(), "clowder-ai-t16-success"),
    base_ref: "master",
    changed_files: ["src/e2e/t16-e2e-validation.verify.js"],
    conflict_status: "clean",
  });
  const delivery = recordDeliveryCheck(p, {
    work_item_id: workItemId,
    task_id: task.id,
    action: "feature_push",
    actor_agent: "Codex",
    git_identity: "Clowder Codex <codex@clowder.local>",
    current_branch: "codex/t16-success",
    target_branch: "codex/t16-success",
    maintainability_comments_satisfied: true,
    require_workspace: true,
  });
  check("success delivery readiness passes", () => {
    assert.strictEqual(delivery.decision.allowed, true);
    assert.strictEqual(delivery.record.result, "passed");
  });
  recordFeaturePushResult(p, delivery.record.id, {
    push_status: "succeeded",
    command: "git push origin codex/t16-success",
    commit_sha: "abc1234",
  });
  transitionWorkItem(p, workItemId, "completed");
  const retro = generateRetrospective(p, workItemId, {
    retrospective_conclusion: "成功路径已串联页面录入、协作、Review、门禁、交付和复盘。",
    process_improvement_suggestions: ["失败路径继续保留显性阻断证据"],
    technical_execution_suggestions: ["页面聚合继续保持在服务层"],
  });

  return {
    workItem: p.workItemStore.read(workItemId),
    task,
    retrospective: retro,
  };
}

function runBlockedFailurePath(p, workItemId) {
  const breakdown = recordSolutionAndTaskBreakdown(p, workItemId, {
    solution: {
      summary: "验证门禁失败被阻断",
      approach: "记录失败 QualityGateRun 后请求 ready_to_commit，确认 Harness 阻断",
      assumptions: [],
      risks: ["质量门禁失败不得静默跳过"],
    },
    tasks: [{
      task_key: "t16-failure-gate",
      title: "构造失败路径",
      owner_agent: "Codex",
      collaborators: [],
      boundary: "验证质量门禁失败与用户确认可见",
      dependencies: [],
      expected_artifacts: ["质量门禁失败记录"],
      reviewer_agent: "Claude",
      acceptance_criteria: ["失败路径在页面 API 中可见"],
      parallelizable: false,
    }],
  }, {
    reviewAgent: "Claude",
    a2aConclusion: "failure_path_ready",
  });

  const task = breakdown.tasks[0];
  transitionWorkItem(p, workItemId, "in_development");
  transitionWorkItem(p, workItemId, "pending_review");
  createReview(p, {
    work_item_id: workItemId,
    task_id: task.id,
    author_agent: "Codex",
    reviewer_agent: "Claude",
    scope: "T16 失败路径",
    findings: [],
    result: "approved",
    required_fixes: [],
    resolved: true,
  });
  transitionWorkItem(p, workItemId, "pending_verification");
  createQualityGate(p, {
    work_item_id: workItemId,
    task_id: task.id,
    gate_name: "verify:e2e-failure",
    validation_method: "simulated failing gate",
    result: "1 failed",
    failure_reason: "Simulated quality gate failure",
    failed_command: "npm run verify:e2e-failure",
    failure_summary: "质量门禁失败路径被正确阻断",
    impact_scope: "blocks ready_to_commit",
    next_actions: "record escalation and wait for user decision",
    final_status: "failed",
  });
  const delivery = recordDeliveryCheck(p, {
    work_item_id: workItemId,
    task_id: task.id,
    action: "prepare_commit",
    actor_agent: "Codex",
    git_identity: "Clowder Codex <codex@clowder.local>",
    current_branch: "codex/t16-failure",
    target_branch: "codex/t16-failure",
    maintainability_comments_satisfied: true,
  });
  check("failure delivery readiness is blocked by quality gate", () => {
    assert.strictEqual(delivery.decision.allowed, false);
    assert.ok(delivery.decision.blockers.some((item) => item.code === "QUALITY_GATE_NOT_PASSED"));
  });
  const escalation = createEscalationForHarnessBlock(
    p,
    {
      workItemId,
      taskId: task.id,
      targetStatus: "ready_to_commit",
    },
    {
      trigger_type: "quality_gate_failure",
      risks: "继续会绕过失败门禁。",
      recommended_next_step: "修复门禁失败或由用户补充信息。",
    }
  );
  recordUserEscalationDecision(p, escalation.id, {
    decision: "request_info",
    decided_by: "user",
    detail: "先记录失败证据，不允许进入交付。",
  });
  transitionWorkItem(p, workItemId, "blocked", { reason: "Quality gate failed in T16 sample." });
  const retro = generateRetrospective(p, workItemId, {
    retrospective_conclusion: "失败路径按预期被质量门禁阻断，页面可见升级记录。",
    process_improvement_suggestions: ["保持失败门禁显性展示"],
  });

  return {
    workItem: p.workItemStore.read(workItemId),
    task,
    delivery: delivery.record,
    retrospective: retro,
  };
}

async function readWorkspaceThroughPageApi(dataDir, workItemId) {
  const server = startServer({ host: "127.0.0.1", port: 0, dataDir });
  try {
    const result = await getJson(
      server,
      `/api/console/workspace?work_item_id=${encodeURIComponent(workItemId)}`
    );
    check(`workspace API returns ${workItemId}`, () => {
      assert.strictEqual(result.response.statusCode, 200);
      assert.strictEqual(result.body.selected_work_item.id, workItemId);
    });
    return result.body;
  } finally {
    server.close();
  }
}

function verifySuccessPathView(view, success) {
  check("success path reaches completed status", () => {
    assert.strictEqual(view.status, "completed");
    assert.strictEqual(success.workItem.status, "completed");
  });
  check("success path exposes core timeline kinds", () => {
    const kinds = new Set(view.timeline.map((event) => event.kind));
    for (const kind of ["work_item", "task", "a2a", "review", "quality_gate", "delivery", "retrospective"]) {
      assert.ok(kinds.has(kind), `missing ${kind}`);
    }
  });
  check("success path exposes review gate and retrospective", () => {
    assert.strictEqual(view.review_summary.approved, 1);
    assert.strictEqual(view.quality_gate_summary.passed, 1);
    assert.ok(view.retrospective_summary.conclusion.includes("成功路径"));
  });
}

function verifyFailurePathView(view) {
  check("failure path reaches blocked status", () => {
    assert.strictEqual(view.status, "blocked");
  });
  check("failure path exposes failed quality gate", () => {
    assert.strictEqual(view.quality_gate_summary.failed, 1);
    assert.ok(view.quality_gate_summary.failures[0].failure_summary.includes("质量门禁失败"));
  });
  check("failure path exposes escalation and user decision", () => {
    assert.strictEqual(view.confirmations.length, 1);
    assert.strictEqual(view.confirmations[0].user_decision, "request_info");
  });
  check("failure path latest conclusion is retrospective", () => {
    assert.strictEqual(view.latest_key_conclusion.source, "retrospective");
  });
}

function verifyWorkspaceList(view) {
  check("workspace list contains both E2E work items", () => {
    assert.ok(view.work_items.length >= 2);
  });
  check("MiniMax downgrade remains explicit in E2E view", () => {
    assert.strictEqual(view.product_baseline.minimax_experience_review, "not_completed");
  });
}

function postJson(server, requestPath, payload) {
  return requestJson(server, requestPath, "POST", payload);
}

function getJson(server, requestPath) {
  return requestJson(server, requestPath, "GET", null);
}

function requestJson(server, requestPath, method, payload) {
  return new Promise((resolve, reject) => {
    const send = () => {
      const { port } = server.address();
      const json = payload ? JSON.stringify(payload) : "";
      const request = http.request(
        {
          host: "127.0.0.1",
          port,
          path: requestPath,
          method,
          headers: json ? {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(json),
          } : undefined,
        },
        (response) => {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            body += chunk;
          });
          response.on("end", () => {
            try {
              resolve({ response, body: JSON.parse(body) });
            } catch (error) {
              reject(error);
            }
          });
        }
      );
      request.on("error", reject);
      request.end(json);
    };
    if (server.listening) {
      send();
    } else {
      server.once("listening", send);
    }
    server.on("error", reject);
  });
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
