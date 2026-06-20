"use strict";

const { transition, transitionWorkItem } = require("../work-items/state-machine");

const SOLUTION_GATE_TARGETS = Object.freeze([
  "ready_for_development",
  "in_development",
  "pending_review",
  "pending_verification",
  "ready_to_commit",
  "pushed",
  "completed",
]);

const REVIEW_GATE_TARGETS = Object.freeze([
  "pending_verification",
  "ready_to_commit",
  "pushed",
  "completed",
]);

const QUALITY_GATE_TARGETS = Object.freeze([
  "ready_to_commit",
  "pushed",
  "completed",
]);

const DELIVERY_GATE_TARGETS = Object.freeze([
  "ready_to_commit",
  "pushed",
  "completed",
]);

const HIGH_RISK_ACTION_TYPES = Object.freeze([
  "deploy",
  "merge_main",
  "merge_master",
  "push_main",
  "push_master",
  "direct_push_main",
  "direct_push_master",
  "force_push",
  "delete_file",
  "destructive_change",
  "bypass_review",
  "bypass_quality_gate",
  "auto_merge_pr",
]);

const EXPECTED_GIT_IDENTITIES = Object.freeze({
  Codex: "Clowder Codex <codex@clowder.local>",
  Claude: "Clowder Claude <claude@clowder.local>",
  MiniMax: "Clowder MiniMax <minimax@clowder.local>",
  Architect: "Clowder Architect <architect@clowder.local>",
});

function evaluateHarnessRails(persistence, params = {}) {
  const blockers = [];
  const gatesChecked = [];
  const targetStatus = normalizeText(params.targetStatus || params.target_status);
  const workItemId = normalizeText(params.workItemId || params.work_item_id);
  let workItem = null;
  let tasks = [];

  if (workItemId) {
    workItem = persistence.workItemStore.read(workItemId);
    if (!workItem) {
      blockers.push(blocker(
        "MISSING_WORK_ITEM",
        `WorkItem not found: ${workItemId}`,
        "Create or restore the WorkItem before running Harness gates.",
        "context"
      ));
    }
  } else if (targetStatus) {
    blockers.push(blocker(
      "MISSING_WORK_ITEM_ID",
      "workItemId is required for status advancement.",
      "Pass the WorkItem id that is being advanced.",
      "context"
    ));
  }

  if (workItem && targetStatus) {
    gatesChecked.push("state_transition");
    try {
      transition(workItem.status, targetStatus, params.transitionOptions || params);
    } catch (error) {
      blockers.push(blocker(
        "ILLEGAL_STATUS_TRANSITION",
        error.message,
        "Follow the T5 state-machine path or move the WorkItem to blocked with a reason.",
        "state"
      ));
    }
  }

  if (workItem) {
    const taskResult = getRelevantTasks(persistence, workItem, params.taskId || params.task_id);
    tasks = taskResult.tasks;
    blockers.push(...taskResult.blockers);
  }

  if (workItem && targetStatus && targetStatus !== "blocked") {
    if (SOLUTION_GATE_TARGETS.includes(targetStatus)) {
      gatesChecked.push("solution_task_breakdown");
      blockers.push(...validateSolutionAndTaskContract(workItem, tasks));
    }

    if (REVIEW_GATE_TARGETS.includes(targetStatus)) {
      gatesChecked.push("non_author_review");
      blockers.push(...validateReviewGate(persistence, workItem, tasks));
    }

    if (QUALITY_GATE_TARGETS.includes(targetStatus)) {
      gatesChecked.push("quality_gate");
      blockers.push(...validateQualityGate(persistence, workItem, tasks));
    }

    if (DELIVERY_GATE_TARGETS.includes(targetStatus)) {
      gatesChecked.push("delivery_readiness");
      blockers.push(...validateDeliveryReadiness(params));
    }
  }

  const actionDecision = evaluateHighRiskAction(params.action, params);
  if (actionDecision.high_risk) {
    gatesChecked.push("high_risk_action");
  }
  blockers.push(...actionDecision.blockers);

  return buildDecision({
    allowed: blockers.length === 0,
    blockers,
    gatesChecked,
    workItemId,
    taskId: normalizeText(params.taskId || params.task_id) || null,
    targetStatus: targetStatus || null,
    action: actionDecision.action,
  });
}

function guardedTransitionWorkItem(persistence, workItemId, targetStatus, options = {}) {
  const decision = evaluateHarnessRails(persistence, {
    ...options,
    workItemId,
    targetStatus,
  });

  if (!decision.allowed) {
    const error = new Error(formatDecisionError(decision));
    error.decision = decision;
    throw error;
  }

  return {
    decision,
    workItem: transitionWorkItem(
      persistence,
      workItemId,
      targetStatus,
      options.transitionOptions || options
    ),
  };
}

function evaluateHighRiskAction(action = {}, options = {}) {
  const normalizedAction = normalizeAction(action);
  if (!normalizedAction.type) {
    return {
      allowed: true,
      high_risk: false,
      action: normalizedAction,
      blockers: [],
    };
  }

  const highRisk = isHighRiskAction(normalizedAction);
  const confirmed = normalizedAction.confirmed === true ||
    options.highRiskConfirmed === true ||
    options.high_risk_confirmed === true;

  if (!highRisk || confirmed) {
    return {
      allowed: true,
      high_risk: highRisk,
      action: normalizedAction,
      blockers: [],
    };
  }

  return {
    allowed: false,
    high_risk: true,
    action: normalizedAction,
    blockers: [
      blocker(
        "HIGH_RISK_ACTION_REQUIRES_CONFIRMATION",
        `High-risk action "${normalizedAction.type}" requires explicit confirmation.`,
        "Pause and obtain user confirmation before continuing.",
        "permission"
      ),
    ],
  };
}

function validateSolutionAndTaskContract(workItem, tasks) {
  const blockers = [];

  if (!hasSolution(workItem.solution)) {
    blockers.push(blocker(
      "MISSING_SOLUTION",
      "A solution summary and approach are required before development gates.",
      "Record the solution and have it evaluated before advancing.",
      "solution"
    ));
  }

  if (!Array.isArray(tasks) || tasks.length === 0) {
    blockers.push(blocker(
      "MISSING_TASK_BREAKDOWN",
      "At least one task breakdown record is required before development gates.",
      "Run the T7 task breakdown flow and persist Task records.",
      "task_breakdown"
    ));
    return blockers;
  }

  for (const task of tasks) {
    blockers.push(...validateTaskContract(task));
  }

  return blockers;
}

function validateTaskContract(task) {
  const blockers = [];
  const label = task && task.id ? `Task ${task.id}` : "Task";

  if (!task) {
    return [blocker(
      "MISSING_TASK_RECORD",
      "A referenced task record is missing.",
      "Restore the Task record or rerun task breakdown.",
      "task_breakdown"
    )];
  }

  if (!normalizeText(task.owner_agent)) {
    blockers.push(incompleteTaskBlocker(label, "owner_agent"));
  }
  if (!normalizeText(task.boundary)) {
    blockers.push(incompleteTaskBlocker(label, "boundary"));
  }
  if (!Array.isArray(task.dependencies)) {
    blockers.push(incompleteTaskBlocker(label, "dependencies"));
  }
  if (!Array.isArray(task.expected_artifacts) || task.expected_artifacts.length === 0) {
    blockers.push(incompleteTaskBlocker(label, "expected_artifacts"));
  }
  if (!normalizeText(task.reviewer_agent)) {
    blockers.push(incompleteTaskBlocker(label, "reviewer_agent"));
  }
  if (!Array.isArray(task.acceptance_criteria) || task.acceptance_criteria.length === 0) {
    blockers.push(incompleteTaskBlocker(label, "acceptance_criteria"));
  }
  if (
    normalizeText(task.owner_agent) &&
    normalizeText(task.reviewer_agent) &&
    task.owner_agent === task.reviewer_agent
  ) {
    blockers.push(blocker(
      "AUTHOR_SELF_REVIEW",
      `${label} assigns the author as the reviewer.`,
      "Assign a non-author reviewer before advancing.",
      "review"
    ));
  }

  return blockers;
}

function validateReviewGate(persistence, workItem, tasks) {
  const blockers = [];
  const reviews = persistence.reviewRecordStore.list(
    (record) => record.work_item_id === workItem.id
  );

  if (reviews.length === 0) {
    return [blocker(
      "MISSING_APPROVED_REVIEW",
      "No non-author approved ReviewRecord exists for this WorkItem.",
      "Request and record non-author review before verification or delivery.",
      "review"
    )];
  }

  for (const task of tasks) {
    if (!hasApprovedReviewForTask(reviews, task)) {
      blockers.push(blocker(
        "MISSING_APPROVED_REVIEW",
        `No approved non-author review covers Task ${task.id}.`,
        "Record an approved ReviewRecord from the designated non-author reviewer.",
        "review"
      ));
    }
  }

  return blockers;
}

function validateQualityGate(persistence, workItem, tasks) {
  const blockers = [];
  const gates = persistence.qualityGateRunStore.list(
    (record) => record.work_item_id === workItem.id
  );

  if (gates.length === 0) {
    return [blocker(
      "QUALITY_GATE_NOT_PASSED",
      "No passing QualityGateRun exists for this WorkItem.",
      "Run and record the required quality gate before delivery.",
      "quality_gate"
    )];
  }

  for (const task of tasks) {
    const latest = latestRecord(gates.filter(
      // A QualityGateRun without task_id is treated as a work-item-level gate
      // and can satisfy every task under the same WorkItem.
      (record) => record.task_id === task.id || record.task_id == null
    ));

    if (!latest || latest.final_status !== "passed") {
      blockers.push(blocker(
        "QUALITY_GATE_NOT_PASSED",
        `Latest quality gate for Task ${task.id} is not passed.`,
        "Fix the failure or record a passing gate before delivery.",
        "quality_gate"
      ));
    }
  }

  return blockers;
}

function validateDeliveryReadiness(params) {
  const blockers = [];
  const maintainability = params.maintainabilityComments ||
    params.maintainability_comments ||
    params.maintainabilityCommentsRequirement ||
    params.maintainability_comments_requirement;

  const maintainabilitySatisfied =
    params.maintainabilityCommentsSatisfied === true ||
    params.maintainability_comments_satisfied === true;

  if (!maintainabilitySatisfied && !normalizeText(maintainability)) {
    blockers.push(blocker(
      "MISSING_MAINTAINABILITY_COMMENTS_REQUIREMENT",
      "Delivery requires an explicit maintainability comment requirement or satisfaction flag.",
      "Document the maintainability comment requirement or verify it is satisfied.",
      "delivery"
    ));
  }

  const gitIdentity = normalizeText(
    params.gitIdentity ||
    params.git_identity ||
    (params.action && (params.action.gitIdentity || params.action.git_identity))
  );
  const actorAgent = normalizeAgent(params.actorAgent || params.actor_agent);
  const expectedIdentity = EXPECTED_GIT_IDENTITIES[actorAgent];

  if (!gitIdentity) {
    blockers.push(blocker(
      "GIT_IDENTITY_NOT_ATTRIBUTABLE",
      "Git identity is required before delivery or repository write actions.",
      "Use the current executing Agent identity before continuing.",
      "delivery"
    ));
  } else if (expectedIdentity && gitIdentity !== expectedIdentity) {
    blockers.push(blocker(
      "GIT_IDENTITY_NOT_ATTRIBUTABLE",
      `Git identity "${gitIdentity}" does not match ${actorAgent}.`,
      `Use "${expectedIdentity}" for this Agent-owned action.`,
      "delivery"
    ));
  } else if (!expectedIdentity && !/<[^<>]+@clowder\.local>$/.test(gitIdentity)) {
    blockers.push(blocker(
      "GIT_IDENTITY_NOT_ATTRIBUTABLE",
      `Git identity "${gitIdentity}" is not a Clowder Agent identity.`,
      "Use an Agent-scoped clowder.local identity.",
      "delivery"
    ));
  }

  return blockers;
}

function getRelevantTasks(persistence, workItem, taskId) {
  const blockers = [];
  if (taskId) {
    const task = persistence.taskStore.read(taskId);
    if (!task || task.work_item_id !== workItem.id) {
      blockers.push(blocker(
        "MISSING_TASK_RECORD",
        `Task not found for WorkItem ${workItem.id}: ${taskId}`,
        "Pass a valid taskId or rerun task breakdown.",
        "task_breakdown"
      ));
      return { tasks: [], blockers };
    }
    return { tasks: [task], blockers };
  }

  const taskIds = Array.isArray(workItem.tasks) ? workItem.tasks : [];
  if (taskIds.length > 0) {
    const tasks = [];
    for (const id of taskIds) {
      const task = persistence.taskStore.read(id);
      if (!task) {
        blockers.push(blocker(
          "MISSING_TASK_RECORD",
          `WorkItem references a missing Task: ${id}`,
          "Restore the Task record or rerun task breakdown.",
          "task_breakdown"
        ));
      } else {
        tasks.push(task);
      }
    }
    return { tasks, blockers };
  }

  return {
    tasks: persistence.taskStore.list((task) => task.work_item_id === workItem.id),
    blockers,
  };
}

function hasApprovedReviewForTask(reviews, task) {
  return reviews.some((review) => {
    if (review.task_id && review.task_id !== task.id) {
      return false;
    }
    if (review.result !== "approved") {
      return false;
    }
    if (review.author_agent && review.reviewer_agent && review.author_agent === review.reviewer_agent) {
      return false;
    }
    if (task.reviewer_agent && review.reviewer_agent && task.reviewer_agent !== review.reviewer_agent) {
      return false;
    }
    return review.resolved === true ||
      !Array.isArray(review.required_fixes) ||
      review.required_fixes.length === 0;
  });
}

function latestRecord(records) {
  if (!records || records.length === 0) {
    return null;
  }
  return [...records].sort((a, b) => {
    const at = new Date(a.updated_at || a.created_at || 0).getTime();
    const bt = new Date(b.updated_at || b.created_at || 0).getTime();
    return bt - at;
  })[0];
}

function hasSolution(solution) {
  if (typeof solution === "string") {
    return normalizeText(solution).length > 0;
  }
  if (!solution || typeof solution !== "object" || Array.isArray(solution)) {
    return false;
  }
  return normalizeText(solution.summary).length > 0 &&
    normalizeText(solution.approach).length > 0;
}

function incompleteTaskBlocker(label, fieldName) {
  return blocker(
    "INCOMPLETE_TASK_CONTRACT",
    `${label} is missing required field: ${fieldName}.`,
    "Complete the task contract before advancing.",
    "task_breakdown"
  );
}

function blocker(code, message, nextAction, gate) {
  return {
    code,
    message,
    next_action: nextAction,
    blocked_gate: gate,
    severity: "blocker",
  };
}

function buildDecision(input) {
  const nextActions = [];
  for (const item of input.blockers) {
    if (item.next_action && !nextActions.includes(item.next_action)) {
      nextActions.push(item.next_action);
    }
  }

  return {
    allowed: input.allowed,
    blocked: !input.allowed,
    work_item_id: input.workItemId || null,
    task_id: input.taskId || null,
    target_status: input.targetStatus || null,
    action: input.action,
    gates_checked: Array.from(new Set(input.gatesChecked)),
    blockers: input.blockers,
    next_actions: nextActions,
  };
}

function formatDecisionError(decision) {
  const codes = decision.blockers.map((item) => item.code).join(", ");
  return `Harness blocked status advancement: ${codes}`;
}

function normalizeAction(action = {}) {
  return {
    type: normalizeText(action.type || action.action || action.name).toLowerCase(),
    target_branch: normalizeText(action.target_branch || action.targetBranch || action.branch),
    confirmed: action.confirmed === true || action.user_confirmed === true,
    destructive: action.destructive === true,
    bypass_review: action.bypass_review === true || action.bypassReview === true,
    bypass_quality_gate: action.bypass_quality_gate === true || action.bypassQualityGate === true,
  };
}

function isHighRiskAction(action) {
  if (HIGH_RISK_ACTION_TYPES.includes(action.type)) {
    return true;
  }
  if (action.destructive || action.bypass_review || action.bypass_quality_gate) {
    return true;
  }
  if ((action.type === "push" || action.type === "direct_push") &&
      ["main", "master"].includes(action.target_branch)) {
    return true;
  }
  return false;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAgent(value) {
  const text = normalizeText(value);
  const aliases = {
    codex: "Codex",
    claude: "Claude",
    minimax: "MiniMax",
    architect: "Architect",
  };
  return aliases[text.toLowerCase()] || text;
}

module.exports = {
  DELIVERY_GATE_TARGETS,
  EXPECTED_GIT_IDENTITIES,
  HIGH_RISK_ACTION_TYPES,
  QUALITY_GATE_TARGETS,
  REVIEW_GATE_TARGETS,
  SOLUTION_GATE_TARGETS,
  evaluateHarnessRails,
  evaluateHighRiskAction,
  guardedTransitionWorkItem,
};
