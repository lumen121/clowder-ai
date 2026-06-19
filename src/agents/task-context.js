"use strict";

const REQUIRED_FIELDS = Object.freeze([
  "identity",
  "task_id",
  "goal",
  "boundary",
  "dependencies",
  "review_party",
  "acceptance",
  "prohibited_items",
  "allowed_actions",
  "file_module_boundary",
  "verification",
  "quality_gate",
  "failure_handling",
  "maintainability_comments",
  "git_identity",
]);

const ARRAY_FIELDS = Object.freeze([
  "dependencies",
  "acceptance",
  "prohibited_items",
  "allowed_actions",
  "file_module_boundary",
  "verification",
  "quality_gate",
  "failure_handling",
]);

function buildTaskContext(input = {}) {
  const context = {
    identity: normalizeText(input.identity),
    task_id: normalizeText(input.task_id || input.taskId),
    goal: normalizeText(input.goal),
    boundary: normalizeText(input.boundary),
    dependencies: normalizeList(input.dependencies),
    review_party: normalizeText(input.review_party || input.reviewParty),
    acceptance: normalizeList(input.acceptance),
    prohibited_items: normalizeList(input.prohibited_items || input.prohibitedItems),
    allowed_actions: normalizeList(input.allowed_actions || input.allowedActions),
    file_module_boundary: normalizeList(
      input.file_module_boundary || input.fileModuleBoundary,
    ),
    verification: normalizeList(input.verification),
    quality_gate: normalizeList(input.quality_gate || input.qualityGate),
    failure_handling: normalizeList(input.failure_handling || input.failureHandling),
    maintainability_comments: normalizeText(
      input.maintainability_comments || input.maintainabilityComments,
    ),
    git_identity: normalizeText(input.git_identity || input.gitIdentity),
  };

  validateTaskContext(context);
  return context;
}

function validateTaskContext(context) {
  const missing = [];
  for (const field of REQUIRED_FIELDS) {
    if (ARRAY_FIELDS.includes(field)) {
      if (!Array.isArray(context[field]) || context[field].length === 0) {
        missing.push(field);
      }
      continue;
    }

    if (!normalizeText(context[field])) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Task context missing required fields: ${missing.join(", ")}`);
  }

  return true;
}

function formatTaskContextPrompt(context) {
  validateTaskContext(context);
  return [
    "You are being invoked by Clowder AI as a local Agent CLI.",
    "Return a concise acknowledgement and do not modify files.",
    "",
    "Structured task context:",
    JSON.stringify(context, null, 2),
  ].join("\n");
}

function normalizeText(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean);
  }

  const text = normalizeText(value);
  return text ? [text] : [];
}

module.exports = {
  REQUIRED_FIELDS,
  buildTaskContext,
  formatTaskContextPrompt,
  validateTaskContext,
};
