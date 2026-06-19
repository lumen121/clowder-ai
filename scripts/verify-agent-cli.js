#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const { invokeAgent } = require("../src/agents/cli-adapter");
const {
  recordAgentInvocation,
  sanitizeResult,
  summarizeText,
} = require("../src/agents/response-recording");

const ROOT = path.resolve(__dirname, "..");
const VERIFY_DATA_DIR = path.join(ROOT, "data", "__t4-agent-verify");
const AGENTS = ["codex", "claude", "minimax"];

async function main() {
  const timeoutMs = Number(process.env.CLOWDER_AGENT_VERIFY_TIMEOUT_MS || 45000);
  const context = sampleContext();
  const results = [];

  for (const agent of AGENTS) {
    const result = await invokeAgent(agent, context, {
      cwd: ROOT,
      timeoutMs,
    });

    const record = recordAgentInvocation(result, {
      dataDir: VERIFY_DATA_DIR,
      workItemId: "t4-agent-cli-adapter",
    });
    results.push({ result: sanitizeResult(result), record_id: record.id });
  }

  const summary = results.map(({ result, record_id }) => ({
    agent: result.agent,
    identity: result.identity,
    success: result.success,
    exit_code: result.exit_code,
    timed_out: result.timed_out,
    error_classification: result.error_classification,
    record_id,
    stdout_summary: summarizeText(result.stdout, 240),
    stderr_summary: summarizeText(result.stderr, 240),
  }));

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

  if (summary.some((item) => !item.success)) {
    process.exitCode = 1;
  }
}

function sampleContext() {
  return {
    identity: "Clowder Codex <codex@clowder.local>",
    task_id: "T4",
    goal: "Perform a minimal real CLI smoke invocation for Clowder AI T4.",
    boundary: "Do not modify files. Reply with one concise acknowledgement.",
    dependencies: ["T1 baseline", "T3 persistence"],
    review_party: "Claude",
    acceptance: [
      "CLI returns a process result",
      "stdout stderr exit code and timeout are captured",
    ],
    prohibited_items: ["Do not edit files", "Do not push commits"],
    allowed_actions: ["Read this prompt", "Return a short acknowledgement"],
    file_module_boundary: ["No repository file changes during this smoke call"],
    verification: ["npm run verify:agents"],
    quality_gate: ["Failure must be classified and recorded"],
    failure_handling: ["If CLI is unavailable, record blocker for manual follow-up"],
    maintainability_comments: "This smoke prompt verifies adapter invocation only.",
    git_identity: "Clowder Codex <codex@clowder.local>",
  };
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
