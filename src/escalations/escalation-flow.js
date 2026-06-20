"use strict";

const { evaluateHarnessRails, evaluateHighRiskAction } = require("../harness/core-rails");

const ESCALATION_STATUSES = Object.freeze([
  "pending_user_confirmation",
  "confirmed",
  "rejected",
  "needs_more_info",
]);

const USER_DECISIONS = Object.freeze([
  "confirm",
  "reject",
  "request_info",
]);

const DEFAULT_OPTIONS = Object.freeze([
  "confirm",
  "reject",
  "request_more_information",
]);

const DECISION_TO_STATUS = Object.freeze({
  confirm: "confirmed",
  reject: "rejected",
  request_info: "needs_more_info",
});

/**
 * Create a structured escalation record from an already-evaluated Harness
 * decision. T12 owns only the escalation and user decision loop; it does not
 * override T8 gates or silently advance WorkItem state.
 */
function createEscalationFromHarnessDecision(persistence, decision, input = {}) {
  assertPersistence(persistence);
  if (!decision || typeof decision !== "object") {
    throw new Error("decision is required.");
  }
  if (decision.allowed !== false && decision.blocked !== true) {
    throw new Error("Only blocked Harness decisions can create escalation records.");
  }

  const workItemId = requireText(
    input.work_item_id || input.workItemId || decision.work_item_id,
    "work_item_id"
  );
  const blockers = Array.isArray(decision.blockers) ? decision.blockers : [];
  const primaryBlocker = blockers[0] || {};
  const options = normalizeOptions(input.options);
  const recommendedNextStep = normalizeText(input.recommended_next_step) ||
    normalizeText(primaryBlocker.next_action) ||
    firstText(decision.next_actions) ||
    "Pause and wait for user confirmation.";

  return persistence.createEscalationRecord({
    work_item_id: workItemId,
    task_id: normalizeText(input.task_id || input.taskId || decision.task_id) || null,
    status: "pending_user_confirmation",
    trigger_type: normalizeText(input.trigger_type) || "harness_block",
    trigger_rule: normalizeText(input.trigger_rule) || normalizeText(primaryBlocker.code),
    what_happened: normalizeText(input.what_happened) ||
      formatHarnessWhatHappened(decision, blockers),
    blocked_gate: normalizeText(input.blocked_gate) ||
      normalizeText(primaryBlocker.blocked_gate) ||
      inferBlockedGate(decision),
    options,
    risks: normalizeText(input.risks) || describeRisks(decision, blockers),
    recommended_next_step: recommendedNextStep,
    affected_tasks: normalizeArray(input.affected_tasks || input.affectedTasks),
    target_status: normalizeText(input.target_status || decision.target_status) || null,
    action: normalizeAction(input.action || decision.action),
    blockers,
    user_decision: "",
    decision_detail: "",
    decided_by: "",
    decided_at: "",
    next_action_after_decision: "",
  });
}

function createEscalationForHarnessBlock(persistence, params = {}, input = {}) {
  const decision = evaluateHarnessRails(persistence, params);
  if (decision.allowed) {
    throw new Error("Harness decision is allowed; escalation is not required.");
  }
  return createEscalationFromHarnessDecision(persistence, decision, {
    ...input,
    work_item_id: input.work_item_id || params.work_item_id || params.workItemId,
    task_id: input.task_id || params.task_id || params.taskId,
  });
}

function createEscalationForHighRiskAction(persistence, action = {}, input = {}) {
  assertPersistence(persistence);
  const decision = evaluateHighRiskAction(action, input);
  if (decision.allowed) {
    throw new Error("High-risk action is already confirmed or not risky; escalation is not required.");
  }

  return createEscalationFromHarnessDecision(
    persistence,
    {
      allowed: false,
      blocked: true,
      work_item_id: input.work_item_id || input.workItemId || null,
      task_id: input.task_id || input.taskId || null,
      target_status: input.target_status || null,
      action: decision.action,
      gates_checked: ["high_risk_action"],
      blockers: decision.blockers,
      next_actions: decision.blockers.map((item) => item.next_action).filter(Boolean),
    },
    {
      ...input,
      trigger_type: "high_risk_action",
      action: decision.action,
      risks: input.risks ||
        "Continuing without explicit user confirmation could bypass governance or change repository/project state.",
    }
  );
}

function listPendingEscalations(persistence, filter = {}) {
  assertPersistence(persistence);
  const workItemId = normalizeText(filter.work_item_id || filter.workItemId);
  return sortByUpdatedAtDesc(
    persistence.escalationRecordStore.list((record) => {
      if (record.status !== "pending_user_confirmation" &&
          record.status !== "needs_more_info") {
        return false;
      }
      return workItemId ? record.work_item_id === workItemId : true;
    })
  );
}

function getEscalation(persistence, escalationId) {
  assertPersistence(persistence);
  const id = requireText(escalationId, "escalation_id");
  const record = persistence.escalationRecordStore.read(id);
  if (!record) {
    throw new Error(`EscalationRecord not found: ${id}`);
  }
  return record;
}

function recordUserEscalationDecision(persistence, escalationId, input = {}) {
  assertPersistence(persistence);
  const id = requireText(escalationId, "escalation_id");
  const existing = persistence.escalationRecordStore.read(id);
  if (!existing) {
    throw new Error(`EscalationRecord not found: ${id}`);
  }

  const decision = normalizeDecision(input.decision || input.user_decision);
  const decidedBy = requireText(input.decided_by || input.user || input.confirmed_by, "decided_by");
  const detail = normalizeText(input.detail || input.decision_detail || input.message);
  if (decision === "request_info" && !detail) {
    throw new Error("decision_detail is required when requesting more information.");
  }

  const decidedAt = input.decided_at || new Date().toISOString();
  const nextAction = normalizeText(input.next_action || input.next_action_after_decision) ||
    defaultNextActionForDecision(decision);
  const decisionEntry = {
    decision,
    detail,
    decided_by: decidedBy,
    decided_at: decidedAt,
    next_action: nextAction,
  };

  const history = Array.isArray(existing.decision_history)
    ? [...existing.decision_history, decisionEntry]
    : [decisionEntry];

  const updated = persistence.escalationRecordStore.update(id, {
    status: DECISION_TO_STATUS[decision],
    user_decision: decision,
    decision_detail: detail,
    decided_by: decidedBy,
    decided_at: decidedAt,
    next_action_after_decision: nextAction,
    decision_history: history,
  });

  recordDecisionA2A(persistence, updated, decisionEntry);
  updateWorkItemEscalationSummary(persistence, updated);
  return persistence.escalationRecordStore.read(id);
}

function recordDecisionA2A(persistence, escalation, decisionEntry) {
  if (!persistence.createA2AEvent || !escalation.work_item_id) {
    return null;
  }

  return persistence.createA2AEvent({
    from_agent: "user",
    to_agent: "system",
    work_item_id: escalation.work_item_id,
    task_id: escalation.task_id || null,
    purpose: "execution_sync",
    context: JSON.stringify({
      kind: "escalation_user_decision",
      escalation_id: escalation.id,
      decision: decisionEntry.decision,
      recorded_at: decisionEntry.decided_at,
    }),
    claim_or_request: `User decision for escalation ${escalation.id}`,
    response: decisionEntry.detail || decisionEntry.decision,
    conclusion: decisionEntry.decision,
    next_action: decisionEntry.next_action,
    requires_user_intervention: escalation.status === "needs_more_info",
  });
}

function updateWorkItemEscalationSummary(persistence, escalation) {
  if (!persistence.workItemStore || !escalation.work_item_id) {
    return null;
  }

  const workItem = persistence.workItemStore.read(escalation.work_item_id);
  if (!workItem) {
    return null;
  }

  const existingMetadata = workItem.metadata || {};
  const existingEscalations = Array.isArray(workItem.escalations)
    ? workItem.escalations
    : [];
  const escalationIds = existingEscalations.includes(escalation.id)
    ? existingEscalations
    : [...existingEscalations, escalation.id];

  return persistence.workItemStore.update(workItem.id, {
    escalations: escalationIds,
    metadata: {
      ...existingMetadata,
      latest_escalation_decision: {
        escalation_id: escalation.id,
        status: escalation.status,
        user_decision: escalation.user_decision,
        decided_by: escalation.decided_by,
        decided_at: escalation.decided_at,
        next_action: escalation.next_action_after_decision,
      },
    },
  });
}

function formatForPage(record) {
  return {
    id: record.id,
    work_item_id: record.work_item_id,
    task_id: record.task_id || null,
    status: record.status || "pending_user_confirmation",
    trigger_type: record.trigger_type || "",
    trigger_rule: record.trigger_rule || "",
    what_happened: record.what_happened || "",
    blocked_gate: record.blocked_gate || "",
    options: Array.isArray(record.options) ? record.options : [],
    risks: record.risks || "",
    recommended_next_step: record.recommended_next_step || "",
    affected_tasks: Array.isArray(record.affected_tasks) ? record.affected_tasks : [],
    user_decision: record.user_decision || "",
    decision_detail: record.decision_detail || "",
    decided_by: record.decided_by || "",
    decided_at: record.decided_at || "",
    next_action_after_decision: record.next_action_after_decision || "",
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

function assertPersistence(persistence) {
  if (!persistence || !persistence.escalationRecordStore || !persistence.createEscalationRecord) {
    throw new Error("A valid T3 persistence instance is required.");
  }
}

function requireText(value, fieldName) {
  const text = normalizeText(value);
  if (!text) {
    throw new Error(`${fieldName} is required.`);
  }
  return text;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => normalizeText(item)).filter(Boolean);
}

function normalizeOptions(value) {
  const options = normalizeArray(value);
  return options.length > 0 ? options : [...DEFAULT_OPTIONS];
}

function normalizeAction(action) {
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    return null;
  }
  return {
    type: normalizeText(action.type),
    target_branch: normalizeText(action.target_branch || action.targetBranch),
    confirmed: action.confirmed === true,
    destructive: action.destructive === true,
    bypass_review: action.bypass_review === true || action.bypassReview === true,
    bypass_quality_gate: action.bypass_quality_gate === true || action.bypassQualityGate === true,
  };
}

function normalizeDecision(value) {
  const decision = normalizeText(value);
  if (!USER_DECISIONS.includes(decision)) {
    throw new Error(`Invalid user decision: ${decision || "(empty)"}.`);
  }
  return decision;
}

function firstText(value) {
  if (!Array.isArray(value)) {
    return "";
  }
  return normalizeText(value.find((item) => normalizeText(item)));
}

function formatHarnessWhatHappened(decision, blockers) {
  if (blockers.length === 0) {
    return "Harness blocked the requested action.";
  }
  const codes = blockers.map((item) => item.code).filter(Boolean).join(", ");
  const message = blockers[0].message || "Harness blocked the requested action.";
  const target = decision.target_status ? ` Target status: ${decision.target_status}.` : "";
  return `${message}${codes ? ` Blocker codes: ${codes}.` : ""}${target}`;
}

function describeRisks(decision, blockers) {
  const gates = new Set();
  for (const item of blockers) {
    if (item.blocked_gate) {
      gates.add(item.blocked_gate);
    }
  }
  if (gates.size > 0) {
    return `Continuing without resolution may bypass ${Array.from(gates).join(", ")} governance.`;
  }
  if (decision.action && decision.action.type) {
    return `Continuing action "${decision.action.type}" without confirmation may create an unrecoverable or unaudited change.`;
  }
  return "Continuing without user confirmation may hide a blocked governance decision.";
}

function inferBlockedGate(decision) {
  const gates = Array.isArray(decision.gates_checked) ? decision.gates_checked : [];
  return gates[gates.length - 1] || "";
}

function defaultNextActionForDecision(decision) {
  if (decision === "confirm") {
    return "resume_blocked_flow";
  }
  if (decision === "reject") {
    return "stop_or_rework";
  }
  return "collect_more_information";
}

function sortByUpdatedAtDesc(records) {
  return [...records].sort((a, b) => {
    const at = new Date(a.updated_at || a.created_at || 0).getTime();
    const bt = new Date(b.updated_at || b.created_at || 0).getTime();
    return bt - at;
  });
}

module.exports = {
  ESCALATION_STATUSES,
  USER_DECISIONS,
  createEscalationForHarnessBlock,
  createEscalationForHighRiskAction,
  createEscalationFromHarnessDecision,
  formatForPage,
  getEscalation,
  listPendingEscalations,
  recordUserEscalationDecision,
};
