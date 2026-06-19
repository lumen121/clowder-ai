"use strict";

const { WORK_ITEM_STATUSES } = require("../storage");

// Valid forward transitions for each non-blocked status.
// blocked entry is handled globally (any status → blocked).
// blocked exit is resolved dynamically via metadata.blocking.blocked_from.
//
// pending_review has two valid exits by design:
//   → needs_fix        (Review found issues, rework required)
//   → pending_verification (Review passed, proceed to verification)
const TRANSITIONS = Object.freeze({
  needs_clarification:   Object.freeze(["solution_review"]),
  solution_review:       Object.freeze(["ready_for_development"]),
  ready_for_development: Object.freeze(["in_development"]),
  in_development:        Object.freeze(["pending_review"]),
  pending_review:        Object.freeze(["needs_fix", "pending_verification"]),
  needs_fix:             Object.freeze(["in_development"]),
  pending_verification:  Object.freeze(["ready_to_commit"]),
  ready_to_commit:       Object.freeze(["pushed"]),
  pushed:                Object.freeze(["completed"]),
  completed:             Object.freeze([]),
  blocked:               Object.freeze([]),  // resolved via metadata.blocking
});

const STATUS_SET = new Set(WORK_ITEM_STATUSES);

// ── Pure validation ────────────────────────────────────────────────

/**
 * Validate a status transition and return the computed result.
 *
 * Pure function — does NOT read or write any Store. The caller is
 * responsible for persistence.
 *
 * Self-transitions (same current and target) are accepted as no-ops,
 * except blocked → blocked which always throws.
 *
 * @param {string} currentStatus
 * @param {string} targetStatus
 * @param {object} [opts]
 * @param {string} [opts.reason]          — required when blocking
 * @param {string} [opts.previousStatus]  — required when unblocking,
 *                                          must equal metadata.blocking.blocked_from
 * @returns {{ status: string, previousStatus?: string|null, reason?: string }}
 * @throws {Error} on illegal transition
 */
function transition(currentStatus, targetStatus, opts = {}) {
  if (!STATUS_SET.has(currentStatus)) {
    throw new Error(`Unknown current status: "${currentStatus}"`);
  }
  if (!STATUS_SET.has(targetStatus)) {
    throw new Error(`Unknown target status: "${targetStatus}"`);
  }

  // blocked → blocked is always illegal
  if (currentStatus === "blocked" && targetStatus === "blocked") {
    throw new Error("Work item is already blocked.");
  }

  // Self-transition is not an error (except blocked, caught above).
  if (targetStatus === currentStatus) {
    return { status: currentStatus };
  }

  // ── blocked ENTRY: any status → blocked ──
  if (targetStatus === "blocked") {
    const reason = String(opts.reason || "").trim();
    if (!reason) {
      throw new Error("A reason is required when blocking a work item.");
    }
    return { status: "blocked", previousStatus: currentStatus, reason };
  }

  // ── blocked EXIT: blocked → <previousStatus> ──
  if (currentStatus === "blocked") {
    const previousStatus = opts.previousStatus;
    if (!previousStatus) {
      throw new Error(
        "Cannot unblock without specifying the previous status. " +
        "Pass { previousStatus } to indicate where to return."
      );
    }
    if (!STATUS_SET.has(previousStatus)) {
      throw new Error(`Unknown previous status: "${previousStatus}"`);
    }
    if (previousStatus === "blocked") {
      throw new Error("Cannot unblock from nested blocked. The previous status is corrupt.");
    }
    if (targetStatus !== previousStatus) {
      throw new Error(
        `When unblocking, target status must match previous status. ` +
        `Expected "${previousStatus}", got "${targetStatus}".`
      );
    }
    return { status: targetStatus, previousStatus: null };
  }

  // ── NORMAL transition ──
  const validTargets = TRANSITIONS[currentStatus];
  if (!validTargets || validTargets.length === 0) {
    throw new Error(
      `"${currentStatus}" is a terminal state with no forward transitions.`
    );
  }

  if (!validTargets.includes(targetStatus)) {
    throw new Error(
      `Cannot transition from "${currentStatus}" to "${targetStatus}". ` +
      `Valid transitions from "${currentStatus}" are: ${formatTargets(validTargets)}, blocked.`
    );
  }

  return { status: targetStatus };
}

// ── Persistence-coupled interface ──────────────────────────────────

/**
 * Read a WorkItem, validate the transition, and write the result back
 * through T3 Store. This is the primary production API for callers that
 * need to advance work item state.
 *
 * Blocked metadata is stored in `metadata.blocking`:
 *   { blocked_from, reason, blocked_at }
 * On unblock, `metadata.blocking` is set to null.
 *
 * @param {object}  persistence   — T3 persistence instance (or default require("../storage"))
 * @param {string}  workItemId    — the WorkItem id
 * @param {string}  targetStatus  — desired target status
 * @param {object}  [opts]
 * @param {string}  [opts.reason] — required when blocking
 * @returns {object} the updated WorkItem (deep copy from Store)
 * @throws {Error} on illegal transition, missing WorkItem, or store failure
 */
function transitionWorkItem(persistence, workItemId, targetStatus, opts = {}) {
  const wi = persistence.workItemStore.read(workItemId);
  if (!wi) {
    throw new Error(`WorkItem not found: ${workItemId}`);
  }

  // Resolve previousStatus from stored blocking metadata (if currently blocked).
  if (wi.status === "blocked" && wi.metadata && wi.metadata.blocking) {
    opts.previousStatus = wi.metadata.blocking.blocked_from;
  }

  const result = transition(wi.status, targetStatus, opts);

  // Build the update patch — only `status` for normal transitions.
  const patch = { status: result.status };

  // Merge metadata.blocking.
  // Entering blocked: previousStatus is a string (the state we came from).
  // Leaving blocked: previousStatus is explicitly null.
  // Normal transition: previousStatus is undefined (absent).
  if (typeof result.previousStatus === "string") {
    patch.metadata = Object.assign({}, wi.metadata, {
      blocking: {
        blocked_from: result.previousStatus,
        reason: result.reason,
        blocked_at: new Date().toISOString(),
      },
    });
  } else if (result.previousStatus === null) {
    patch.metadata = Object.assign({}, wi.metadata, { blocking: null });
  }

  return persistence.workItemStore.update(workItemId, patch);
}

// ── Predicates ──────────────────────────────────────────────────────

/**
 * Check whether a transition is legal (does not throw).
 * Supports opts for blocked entry/unblock scenarios.
 */
function canTransition(currentStatus, targetStatus, opts = {}) {
  try {
    transition(currentStatus, targetStatus, opts);
    return true;
  } catch {
    return false;
  }
}

function isTerminal(status) {
  return status === "completed";
}

function isBlocked(status) {
  return status === "blocked";
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatTargets(targets) {
  return targets.map((t) => `'${t}'`).join(", ");
}

module.exports = {
  TRANSITIONS,
  WORK_ITEM_STATUSES,
  canTransition,
  isBlocked,
  isTerminal,
  transition,
  transitionWorkItem,
};
