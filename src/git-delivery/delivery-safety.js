"use strict";

/**
 * T11 — Git feature 分支交付安全流程
 *
 * 本模块是 Git 交付管理器的最小治理实现：
 *   - 复用 T8 Harness 护栏校验 Review、质量门禁、Git 身份和高风险动作。
 *   - 复用 T10 preMergeCheck 校验 branch/worktree 绑定和冲突状态。
 *   - 记录交付检查结果、执行 Agent、分支、commit、push 状态和阻断原因。
 *
 * 范围边界：
 *   - 不创建 PR。
 *   - 不合并主干。
 *   - 不部署。
 *   - 不执行 force push。
 */

const {
  EXPECTED_GIT_IDENTITIES,
  evaluateHarnessRails,
} = require("../harness/core-rails");
const { preMergeCheck } = require("../worktree/isolation-governance");
const { transitionWorkItem } = require("../work-items/state-machine");

const MAIN_BRANCHES = Object.freeze(["main", "master"]);
const DELIVERY_ACTIONS = Object.freeze(["prepare_commit", "feature_push"]);
const PUSH_STATUSES = Object.freeze(["not_attempted", "ready", "succeeded", "failed"]);

function evaluateDeliveryReadiness(persistence, input = {}) {
  const normalized = normalizeDeliveryInput(input);
  const blockers = [];
  const gatesChecked = [];

  if (!normalized.work_item_id) {
    blockers.push(blocker(
      "MISSING_WORK_ITEM_ID",
      "work_item_id is required for delivery checks.",
      "Pass the WorkItem id before checking delivery readiness.",
      "context"
    ));
  }
  if (!normalized.actor_agent) {
    blockers.push(blocker(
      "MISSING_ACTOR_AGENT",
      "actor_agent is required for Git identity attribution.",
      "Pass the executing Agent identity.",
      "identity"
    ));
  }
  if (!DELIVERY_ACTIONS.includes(normalized.action)) {
    blockers.push(blocker(
      "UNSUPPORTED_DELIVERY_ACTION",
      `Unsupported delivery action: ${normalized.action}`,
      `Use one of: ${DELIVERY_ACTIONS.join(", ")}.`,
      "delivery"
    ));
  }

  const currentBranchDecision = evaluateBranchSafety("current", normalized.current_branch);
  const targetBranchDecision = evaluateBranchSafety("target", normalized.target_branch);
  gatesChecked.push("branch_safety");
  blockers.push(...currentBranchDecision.blockers, ...targetBranchDecision.blockers);

  const harnessDecision = evaluateHarnessRails(persistence, {
    workItemId: normalized.work_item_id,
    taskId: normalized.task_id || undefined,
    targetStatus: normalized.action === "feature_push" ? "pushed" : "ready_to_commit",
    actorAgent: normalized.actor_agent,
    gitIdentity: normalized.git_identity,
    maintainabilityComments: normalized.maintainability_comments,
    maintainabilityCommentsSatisfied: normalized.maintainability_comments_satisfied,
    action: {
      type: normalized.action === "feature_push" ? "push" : "prepare_commit",
      target_branch: normalized.target_branch,
      confirmed: normalized.main_branch_confirmed,
    },
  });
  gatesChecked.push(...harnessDecision.gates_checked);
  blockers.push(...harnessDecision.blockers);

  if (normalized.action === "feature_push" || normalized.require_workspace === true) {
    gatesChecked.push("worktree_binding");
    const workspaceDecision = evaluateWorkspaceBinding(persistence, normalized);
    blockers.push(...workspaceDecision.blockers);
  }

  const uniqueBlockers = dedupeBlockers(blockers);
  const allowed = uniqueBlockers.length === 0;
  return {
    allowed,
    blocked: !allowed,
    action: normalized.action,
    work_item_id: normalized.work_item_id || null,
    task_id: normalized.task_id || null,
    actor_agent: normalized.actor_agent || null,
    git_identity: normalized.git_identity || null,
    current_branch: normalized.current_branch || null,
    target_branch: normalized.target_branch || null,
    remote: normalized.remote,
    commit_sha: normalized.commit_sha || null,
    gates_checked: Array.from(new Set(gatesChecked)),
    blockers: uniqueBlockers,
    next_actions: nextActions(uniqueBlockers),
    push_status: allowed && normalized.action === "feature_push" ? "ready" : "not_attempted",
  };
}

function recordDeliveryCheck(persistence, input = {}) {
  const decision = evaluateDeliveryReadiness(persistence, input);
  const record = persistence.createDeliveryRecord({
    work_item_id: decision.work_item_id || "",
    task_id: decision.task_id,
    action: decision.action,
    actor_agent: decision.actor_agent || "",
    git_identity: decision.git_identity || "",
    current_branch: decision.current_branch || "",
    target_branch: decision.target_branch || "",
    remote: decision.remote || "origin",
    commit_sha: decision.commit_sha || "",
    workspace_id: getWorkspaceId(persistence, decision.target_branch),
    result: decision.allowed ? "passed" : "blocked",
    push_status: decision.push_status,
    blockers: decision.blockers,
    gates_checked: decision.gates_checked,
  });

  updateWorkItemDeliveryStatus(persistence, decision.work_item_id, {
    latest_delivery_record_id: record.id,
    result: record.result,
    action: record.action,
    push_status: record.push_status,
    target_branch: record.target_branch,
    blocked: decision.blocked,
    blocker_codes: decision.blockers.map((item) => item.code),
    updated_at: record.updated_at,
  });

  return {
    decision,
    record,
  };
}

function recordFeaturePushResult(persistence, deliveryRecordId, result = {}) {
  const existing = persistence.deliveryRecordStore.read(deliveryRecordId);
  if (!existing) {
    throw new Error(`DeliveryRecord not found: ${deliveryRecordId}`);
  }

  const status = normalizePushStatus(result.push_status || result.status);
  const patch = {
    push_status: status,
    result: status === "succeeded" ? "passed" : "failed",
    command: normalizeText(result.command),
    failure_summary: status === "failed" ? normalizeText(result.failure_summary || result.error) : "",
  };

  if (result.commit_sha !== undefined) {
    patch.commit_sha = normalizeText(result.commit_sha);
  }

  const updated = persistence.deliveryRecordStore.update(deliveryRecordId, patch);
  if (updated.push_status === "succeeded") {
    const workItem = persistence.workItemStore.read(existing.work_item_id);
    if (workItem && workItem.status === "ready_to_commit") {
      transitionWorkItem(persistence, existing.work_item_id, "pushed");
    }
  }
  updateWorkItemDeliveryStatus(persistence, existing.work_item_id, {
    latest_delivery_record_id: updated.id,
    result: updated.result,
    action: updated.action,
    push_status: updated.push_status,
    target_branch: updated.target_branch,
    commit_sha: updated.commit_sha,
    failure_summary: updated.failure_summary,
    updated_at: updated.updated_at,
  });

  return updated;
}

function getDeliveryRecords(persistence, filters = {}) {
  const hasFilter = Object.values(filters).some((value) => value !== undefined && value !== null);
  if (!hasFilter) {
    return persistence.deliveryRecordStore.list();
  }
  return persistence.deliveryRecordStore.list((record) => {
    if (filters.work_item_id !== undefined && record.work_item_id !== filters.work_item_id) {
      return false;
    }
    if (filters.task_id !== undefined && record.task_id !== filters.task_id) {
      return false;
    }
    if (filters.action !== undefined && record.action !== filters.action) {
      return false;
    }
    if (filters.result !== undefined && record.result !== filters.result) {
      return false;
    }
    if (filters.push_status !== undefined && record.push_status !== filters.push_status) {
      return false;
    }
    return true;
  });
}

function summarizeDelivery(persistence, workItemId) {
  const records = getDeliveryRecords(persistence, { work_item_id: workItemId });
  const summary = {
    work_item_id: workItemId,
    total: records.length,
    passed: 0,
    blocked: 0,
    failed: 0,
    latest: null,
  };
  if (records.length === 0) {
    return summary;
  }

  for (const record of records) {
    summary[record.result] = (summary[record.result] || 0) + 1;
  }

  const latest = latestRecord(records);
  summary.latest = {
    id: latest.id,
    action: latest.action,
    result: latest.result,
    push_status: latest.push_status,
    target_branch: latest.target_branch,
    blocker_codes: Array.isArray(latest.blockers) ? latest.blockers.map((item) => item.code) : [],
    at: latest.updated_at || latest.created_at,
  };
  return summary;
}

function expectedGitIdentity(agent) {
  return EXPECTED_GIT_IDENTITIES[normalizeAgent(agent)] || null;
}

function isMainBranch(branch) {
  return MAIN_BRANCHES.includes(normalizeText(branch).toLowerCase());
}

function normalizeDeliveryInput(input) {
  const actorAgent = normalizeAgent(input.actorAgent || input.actor_agent);
  return {
    work_item_id: normalizeText(input.workItemId || input.work_item_id),
    task_id: normalizeText(input.taskId || input.task_id) || null,
    action: normalizeText(input.action || "prepare_commit"),
    actor_agent: actorAgent,
    git_identity: normalizeText(input.gitIdentity || input.git_identity),
    current_branch: normalizeText(input.currentBranch || input.current_branch),
    target_branch: normalizeText(input.targetBranch || input.target_branch || input.currentBranch || input.current_branch),
    remote: normalizeText(input.remote) || "origin",
    commit_sha: normalizeText(input.commitSha || input.commit_sha),
    maintainability_comments: normalizeText(
      input.maintainabilityComments ||
      input.maintainability_comments ||
      input.maintainabilityCommentsRequirement ||
      input.maintainability_comments_requirement
    ),
    maintainability_comments_satisfied: input.maintainabilityCommentsSatisfied === true ||
      input.maintainability_comments_satisfied === true,
    main_branch_confirmed: input.mainBranchConfirmed === true ||
      input.main_branch_confirmed === true ||
      input.highRiskConfirmed === true ||
      input.high_risk_confirmed === true,
    require_workspace: input.requireWorkspace === true || input.require_workspace === true,
  };
}

function evaluateBranchSafety(label, branch) {
  if (!branch) {
    return {
      blockers: [blocker(
        label === "target" ? "MISSING_TARGET_BRANCH" : "MISSING_CURRENT_BRANCH",
        `${label}_branch is required for delivery checks.`,
        "Pass the current and target feature branch names.",
        "branch"
      )],
    };
  }

  // 主干推送或从主干直接交付属于高风险路径。即使调用方声明已确认，
  // T11 仍只把它作为阻断记录，避免零阶段误把主干当作默认交付出口。
  if (isMainBranch(branch)) {
    return {
      blockers: [blocker(
        label === "target" ? "MAIN_BRANCH_DELIVERY_BLOCKED" : "CURRENT_BRANCH_IS_MAIN",
        `${label}_branch "${branch}" is a protected trunk branch.`,
        "Use a feature branch for T11 delivery, or escalate explicit trunk delivery separately.",
        "branch"
      )],
    };
  }

  return { blockers: [] };
}

function evaluateWorkspaceBinding(persistence, input) {
  const result = preMergeCheck(persistence, input.target_branch);
  if (!result.pass) {
    return {
      blockers: result.reasons.map((reason) => blocker(
        "WORKTREE_BINDING_NOT_READY",
        reason,
        "Register or fix the task branch/worktree binding before delivery.",
        "worktree"
      )),
    };
  }
  if (input.task_id && result.workspace && result.workspace.task_id !== input.task_id) {
    return {
      blockers: [blocker(
        "WORKTREE_TASK_MISMATCH",
        `Workspace branch "${input.target_branch}" is bound to ${result.workspace.task_id}, not ${input.task_id}.`,
        "Use the branch bound to the current task or update the workspace record.",
        "worktree"
      )],
    };
  }
  return { blockers: [] };
}

function getWorkspaceId(persistence, branch) {
  if (!branch) return null;
  const result = preMergeCheck(persistence, branch);
  return result.workspace ? result.workspace.id : null;
}

function updateWorkItemDeliveryStatus(persistence, workItemId, status) {
  if (!workItemId) return;
  const workItem = persistence.workItemStore.read(workItemId);
  if (!workItem) return;
  persistence.workItemStore.update(workItemId, {
    delivery_status: status,
  });
}

function normalizePushStatus(status) {
  const normalized = normalizeText(status);
  if (!PUSH_STATUSES.includes(normalized) || normalized === "not_attempted" || normalized === "ready") {
    throw new Error(`Invalid final push status: ${status}. Use succeeded or failed.`);
  }
  return normalized;
}

function latestRecord(records) {
  return [...records].sort((a, b) => {
    const at = new Date(a.updated_at || a.created_at || 0).getTime();
    const bt = new Date(b.updated_at || b.created_at || 0).getTime();
    return bt - at;
  })[0];
}

function dedupeBlockers(blockers) {
  const seen = new Set();
  const result = [];
  for (const item of blockers) {
    const key = `${item.code}|${item.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

function nextActions(blockers) {
  const actions = [];
  for (const item of blockers) {
    if (item.next_action && !actions.includes(item.next_action)) {
      actions.push(item.next_action);
    }
  }
  return actions;
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

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

module.exports = {
  DELIVERY_ACTIONS,
  MAIN_BRANCHES,
  PUSH_STATUSES,
  evaluateDeliveryReadiness,
  recordDeliveryCheck,
  recordFeaturePushResult,
  getDeliveryRecords,
  summarizeDelivery,
  expectedGitIdentity,
  isMainBranch,
};
