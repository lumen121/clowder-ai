"use strict";

const { spawn } = require("child_process");
const os = require("os");

const {
  buildTaskContext,
  formatTaskContextPrompt,
  validateTaskContext,
} = require("./task-context");

const DEFAULT_TIMEOUT_MS = 30000;
const OUTPUT_LIMIT = 20000;
const isWindows = os.platform() === "win32";

const AGENT_CONFIGS = Object.freeze({
  codex: {
    identity: "Codex",
    command: "codex",
    windowsShell: true,
    args: () => [
      "exec",
      "--json",
      "--color",
      "never",
      "--skip-git-repo-check",
      "-",
    ],
    stdin: (prompt) => prompt,
  },
  claude: {
    identity: "Claude",
    command: "claude",
    windowsShell: false,
    args: (prompt) => [
      "-p",
      prompt,
      "--output-format",
      "stream-json",
      "--verbose",
    ],
  },
  minimax: {
    identity: "MiniMax",
    command: "mmx",
    windowsShell: true,
    args: (prompt) => [
      "text",
      "chat",
      "--message",
      `user:${compactPrompt(prompt)}`,
      "--output",
      "json",
      "--quiet",
      "--non-interactive",
    ],
  },
});

function listAgents() {
  return Object.keys(AGENT_CONFIGS);
}

async function invokeAgent(agent, taskContextInput, options = {}) {
  const config = AGENT_CONFIGS[agent];
  if (!config) {
    throw new Error(`Unknown agent "${agent}". Supported agents: ${listAgents().join(", ")}`);
  }

  const taskContext = buildTaskContext(taskContextInput);
  const prompt = options.prompt || formatTaskContextPrompt(taskContext);
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const runner = options.runner || runCommand;
  const startedAt = new Date();

  try {
    const raw = await runner(buildCommand(config, prompt), { timeoutMs, cwd: options.cwd });
    return normalizeResult({
      agent,
      identity: config.identity,
      taskContext,
      timeoutMs,
      startedAt,
      raw,
    });
  } catch (error) {
    return normalizeThrownError({
      agent,
      identity: config.identity,
      taskContext,
      timeoutMs,
      startedAt,
      error,
    });
  }
}

function buildCommand(config, prompt) {
  let command = config.command;
  let args = config.args(prompt);
  const stdin = typeof config.stdin === "function" ? config.stdin(prompt) : null;
  const shellWrapped = isWindows && config.windowsShell;

  if (shellWrapped) {
    const cmdLine = [command, ...args].map(escapeCmdArg).join(" ");
    command = process.env.ComSpec || "cmd.exe";
    args = ["/d", "/c", cmdLine];
  }

  return {
    command,
    args,
    stdin,
    shellWrapped,
    displayCommand: `${config.command} ${config.args("<task-context>").join(" ")}`,
  };
}

function runCommand(commandSpec, options = {}) {
  return new Promise((resolve, reject) => {
    const startedAtMs = Date.now();
    const child = spawn(commandSpec.command, commandSpec.args, {
      cwd: options.cwd,
      stdio: [commandSpec.stdin == null ? "ignore" : "pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout = appendLimited(stdout, chunk.toString("utf8"), OUTPUT_LIMIT);
    });

    child.stderr.on("data", (chunk) => {
      stderr = appendLimited(stderr, chunk.toString("utf8"), OUTPUT_LIMIT);
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(Object.assign(error, { classification: classifySpawnError(error) }));
    });

    if (commandSpec.stdin != null) {
      child.stdin.end(commandSpec.stdin, "utf8");
    }

    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode,
        signal,
        timedOut,
        durationMs: Date.now() - startedAtMs,
      });
    });
  });
}

function normalizeResult({ agent, identity, taskContext, timeoutMs, startedAt, raw }) {
  const classification = classifyCompletedResult(raw);
  const success = !raw.timedOut && raw.exitCode === 0;

  return {
    agent,
    identity,
    task_id: taskContext.task_id,
    success,
    stdout: raw.stdout || "",
    stderr: raw.stderr || "",
    exit_code: raw.exitCode,
    signal: raw.signal || null,
    timed_out: Boolean(raw.timedOut),
    timeout_ms: timeoutMs,
    duration_ms: raw.durationMs || 0,
    error_classification: classification,
    started_at: startedAt.toISOString(),
    completed_at: new Date().toISOString(),
  };
}

function normalizeThrownError({ agent, identity, taskContext, timeoutMs, startedAt, error }) {
  const classification = error.classification || classifySpawnError(error);
  return {
    agent,
    identity,
    task_id: taskContext.task_id,
    success: false,
    stdout: "",
    stderr: error.message || String(error),
    exit_code: null,
    signal: null,
    timed_out: classification === "timeout",
    timeout_ms: timeoutMs,
    duration_ms: 0,
    error_classification: classification,
    started_at: startedAt.toISOString(),
    completed_at: new Date().toISOString(),
  };
}

function classifyCompletedResult(raw) {
  if (raw.timedOut) {
    return "timeout";
  }
  if (raw.exitCode === 0) {
    return "none";
  }
  if (raw.exitCode === 2) {
    return "usage_error";
  }
  if (raw.exitCode === 3) {
    return "authentication_error";
  }
  if (raw.exitCode === 4) {
    return "quota_exceeded";
  }
  if (raw.exitCode === 10) {
    return "content_filter";
  }
  return "nonzero_exit";
}

function classifySpawnError(error) {
  if (error && error.code === "ENOENT") {
    return "cli_not_found";
  }
  if (error && error.code === "ETIMEDOUT") {
    return "timeout";
  }
  return "spawn_error";
}

function escapeCmdArg(arg) {
  const value = String(arg);
  if (/[ \t&|<>^"%!()]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function appendLimited(current, next, limit) {
  const combined = current + next;
  if (combined.length <= limit) {
    return combined;
  }
  return combined.slice(combined.length - limit);
}

function compactPrompt(prompt) {
  return String(prompt).replace(/\s+/g, " ").trim();
}

module.exports = {
  AGENT_CONFIGS,
  DEFAULT_TIMEOUT_MS,
  buildCommand,
  classifyCompletedResult,
  invokeAgent,
  listAgents,
  runCommand,
  validateTaskContext,
};
