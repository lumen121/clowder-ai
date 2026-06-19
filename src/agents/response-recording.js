"use strict";

const path = require("path");

const { createPersistence } = require("../storage");

const SECRET_PATTERNS = Object.freeze([
  /\b(?:sk|ghp|gho|github_pat|xoxb|AKIA)[A-Za-z0-9_\-]{12,}\b/g,
  /\b[A-Za-z0-9_]*TOKEN[A-Za-z0-9_]*=([^\s]+)/gi,
  /\b[A-Za-z0-9_]*KEY[A-Za-z0-9_]*=([^\s]+)/gi,
]);

function recordAgentInvocation(result, options = {}) {
  const dataDir = options.dataDir || path.join(process.cwd(), "data");
  const persistence = options.persistence || createPersistence(dataDir);
  const sanitized = sanitizeResult(result);

  return persistence.createA2AEvent({
    from_agent: sanitized.identity,
    to_agent: "Clowder",
    work_item_id: options.workItemId || "t4-agent-cli-adapter",
    task_id: sanitized.task_id || "T4",
    purpose: "execution_sync",
    context: JSON.stringify({
      kind: "agent_cli_invocation_result",
      agent: sanitized.agent,
      identity: sanitized.identity,
      task_id: sanitized.task_id,
      success: sanitized.success,
      exit_code: sanitized.exit_code,
      timed_out: sanitized.timed_out,
      error_classification: sanitized.error_classification,
      timeout_ms: sanitized.timeout_ms,
      duration_ms: sanitized.duration_ms,
    }),
    claim_or_request: "T4 Agent CLI invocation result captured through adapter.",
    response: JSON.stringify({
      stdout: summarizeText(sanitized.stdout),
      stderr: summarizeText(sanitized.stderr),
    }),
    conclusion: sanitized.success ? "success" : "failure",
    next_action: sanitized.success ? "available_for_review" : "manual_follow_up_required",
    requires_user_intervention: !sanitized.success,
  });
}

function sanitizeResult(result) {
  return {
    ...result,
    stdout: redactSensitiveText(result.stdout || ""),
    stderr: redactSensitiveText(result.stderr || ""),
  };
}

function redactSensitiveText(value) {
  let text = String(value || "");
  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, (match, captured) => {
      if (captured) {
        return match.replace(captured, "[REDACTED]");
      }
      return "[REDACTED]";
    });
  }

  text = text.replace(/[A-Za-z]:\\(?:Users|aiWorkspace)\\[^\s"'<>]+/g, "[LOCAL_PATH]");
  text = text.replace(/\/(?:Users|home|tmp)\/[^\s"'<>]+/g, "[LOCAL_PATH]");
  return text;
}

function summarizeText(value, limit = 1200) {
  const text = redactSensitiveText(value).trim();
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}...[truncated]`;
}

module.exports = {
  recordAgentInvocation,
  redactSensitiveText,
  sanitizeResult,
  summarizeText,
};
