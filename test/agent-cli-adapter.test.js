"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { invokeAgent } = require("../src/agents/cli-adapter");
const { buildTaskContext } = require("../src/agents/task-context");
const {
  recordAgentInvocation,
  redactSensitiveText,
} = require("../src/agents/response-recording");

async function run() {
  testTaskContextValidation();
  await testSuccessfulInvocationNormalization();
  await testTimeoutClassification();
  await testCliNotFoundClassification();
  testRedaction();
  testA2AResultRecording();
  process.stdout.write("agent-cli-adapter tests passed\n");
}

function sampleContext() {
  return {
    identity: "Clowder Codex <codex@clowder.local>",
    task_id: "T4",
    goal: "Verify minimal Agent CLI adapter.",
    boundary: "No file modification during smoke prompt.",
    dependencies: ["T1", "T3"],
    review_party: "Claude",
    acceptance: ["stdout/stderr/exit/timeout are normalized"],
    prohibited_items: ["Do not modify files"],
    allowed_actions: ["read context", "return acknowledgement"],
    file_module_boundary: ["src/agents", "bin/clowder-agent.js"],
    verification: ["npm run check", "npm test", "npm run verify:agents"],
    quality_gate: ["non-author review required"],
    failure_handling: ["record blocker when CLI unavailable"],
    maintainability_comments: "Comment only non-obvious adapter boundaries.",
    git_identity: "Clowder Codex <codex@clowder.local>",
  };
}

function testTaskContextValidation() {
  const context = buildTaskContext(sampleContext());
  assert.strictEqual(context.task_id, "T4");

  assert.throws(
    () => buildTaskContext({ ...sampleContext(), git_identity: "" }),
    /git_identity/,
  );
}

async function testSuccessfulInvocationNormalization() {
  const result = await invokeAgent("codex", sampleContext(), {
    runner: async () => ({
      stdout: "ok",
      stderr: "",
      exitCode: 0,
      signal: null,
      timedOut: false,
      durationMs: 12,
    }),
  });

  assert.strictEqual(result.agent, "codex");
  assert.strictEqual(result.identity, "Codex");
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.exit_code, 0);
  assert.strictEqual(result.error_classification, "none");
}

async function testTimeoutClassification() {
  const result = await invokeAgent("claude", sampleContext(), {
    runner: async () => ({
      stdout: "",
      stderr: "slow",
      exitCode: null,
      signal: "SIGTERM",
      timedOut: true,
      durationMs: 30,
    }),
  });

  assert.strictEqual(result.success, false);
  assert.strictEqual(result.timed_out, true);
  assert.strictEqual(result.error_classification, "timeout");
}

async function testCliNotFoundClassification() {
  const result = await invokeAgent("minimax", sampleContext(), {
    runner: async () => {
      const error = new Error("spawn mmx ENOENT");
      error.code = "ENOENT";
      throw error;
    },
  });

  assert.strictEqual(result.success, false);
  assert.strictEqual(result.exit_code, null);
  assert.strictEqual(result.error_classification, "cli_not_found");
}

function testRedaction() {
  const text = redactSensitiveText(
    "GH_CLOWDER_AI_TOKEN=ghp_1234567890abcdef C:\\Users\\someone\\secret\\file.txt",
  );

  assert.ok(!text.includes("ghp_1234567890abcdef"));
  assert.ok(!text.includes("C:\\Users\\someone"));
  assert.ok(text.includes("[REDACTED]"));
  assert.ok(text.includes("[LOCAL_PATH]"));
}

function testA2AResultRecording() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "clowder-t4-a2a-"));
  const record = recordAgentInvocation(
    {
      agent: "codex",
      identity: "Codex",
      task_id: "T4",
      success: true,
      stdout: "ack",
      stderr: "",
      exit_code: 0,
      timed_out: false,
      timeout_ms: 30000,
      duration_ms: 8,
      error_classification: "none",
    },
    {
      dataDir,
      workItemId: "t4-agent-cli-adapter",
    },
  );

  assert.match(record.id, /^a2a-/);
  assert.strictEqual(record.purpose, "execution_sync");
  assert.strictEqual(record.from_agent, "Codex");
  assert.strictEqual(record.requires_user_intervention, false);
  assert.ok(fs.existsSync(path.join(dataDir, "a2a-events.json")));
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
