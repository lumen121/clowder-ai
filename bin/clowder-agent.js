#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const { invokeAgent, listAgents } = require("../src/agents/cli-adapter");
const { recordAgentInvocation } = require("../src/agents/response-recording");

async function main(argv) {
  const command = argv[2];
  if (!command || command === "--help" || command === "-h") {
    printUsage();
    return 0;
  }

  if (command !== "invoke") {
    throw new Error(`Unknown command: ${command}`);
  }

  const options = parseArgs(argv.slice(3));
  if (options.help) {
    printUsage();
    return 0;
  }

  const context = readContext(options);
  const result = await invokeAgent(options.agent, context, {
    timeoutMs: options.timeoutMs,
    cwd: options.cwd,
  });

  let record = null;
  if (options.record) {
    record = recordAgentInvocation(result, {
      dataDir: options.dataDir,
      workItemId: options.workItemId,
    });
  }

  process.stdout.write(`${JSON.stringify({ result, record }, null, 2)}\n`);
  return result.success ? 0 : 1;
}

function parseArgs(args) {
  const options = {
    agent: null,
    contextFile: null,
    dataDir: path.join(process.cwd(), "data"),
    timeoutMs: undefined,
    workItemId: "t4-agent-cli-adapter",
    cwd: process.cwd(),
    record: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--agent":
        options.agent = requireValue(args, (index += 1), arg);
        break;
      case "--context-file":
        options.contextFile = requireValue(args, (index += 1), arg);
        break;
      case "--cwd":
        options.cwd = requireValue(args, (index += 1), arg);
        break;
      case "--data-dir":
        options.dataDir = requireValue(args, (index += 1), arg);
        break;
      case "--record":
        options.record = true;
        break;
      case "--timeout-ms":
        options.timeoutMs = Number(requireValue(args, (index += 1), arg));
        break;
      case "--work-item-id":
        options.workItemId = requireValue(args, (index += 1), arg);
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.agent) {
    throw new Error("--agent is required.");
  }
  if (!listAgents().includes(options.agent)) {
    throw new Error(`Unknown agent: ${options.agent}`);
  }
  if (!options.contextFile) {
    throw new Error("--context-file is required.");
  }
  if (options.timeoutMs !== undefined && (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)) {
    throw new Error("--timeout-ms must be a positive number.");
  }

  return options;
}

function readContext(options) {
  const raw = fs.readFileSync(path.resolve(options.contextFile), "utf8");
  return JSON.parse(raw);
}

function requireValue(args, index, flag) {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function printUsage() {
  process.stdout.write(`Usage:
  node bin/clowder-agent.js invoke --agent <codex|claude|minimax> --context-file context.json
  node bin/clowder-agent.js invoke --agent codex --context-file context.json --record --data-dir data

Options:
  --agent          Target Agent CLI adapter.
  --context-file   UTF-8 JSON file containing the structured task context.
  --timeout-ms     Per-agent timeout in milliseconds. Defaults to 30000.
  --record         Persist sanitized result as a T3 A2AEvent.
  --data-dir       Persistence root. Defaults to data.
  --work-item-id   A2A work_item_id. Defaults to t4-agent-cli-adapter.
  --cwd            CLI working directory. Defaults to current directory.
`);
}

main(process.argv)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
