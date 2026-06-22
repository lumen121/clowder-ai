"use strict";

const { summarizeDelivery } = require("../git-delivery/delivery-safety");
const { summarizeQualityGates, summarizeReviews } = require("../review-quality");
const { summarizeRetrospective } = require("../retrospective");

function buildUserParticipationView(persistence, options = {}) {
  const workItems = sortByTimeDesc(persistence.workItemStore.list());
  const selectedId = normalizeText(options.work_item_id || options.workItemId) ||
    (workItems[0] ? workItems[0].id : null);

  return {
    generated_at: new Date().toISOString(),
    product_baseline: {
      page_entry_is_primary: true,
      cli_is_internal_entry: true,
      minimax_experience_review: "not_completed",
      downgrade_notice:
        "T13F is a functional fallback while MiniMax is unavailable; A7 remains open.",
    },
    work_items: workItems.map((workItem) => buildWorkItemSummary(persistence, workItem)),
    selected_work_item: selectedId ? buildWorkItemView(persistence, selectedId) : null,
  };
}

function buildWorkItemView(persistence, workItemId) {
  const workItem = persistence.workItemStore.read(workItemId);
  if (!workItem) {
    throw new Error(`WorkItem not found: ${workItemId}`);
  }

  const tasks = sortByTimeAsc(persistence.taskStore.list(
    (task) => task.work_item_id === workItem.id
  ));
  const a2aEvents = sortByTimeAsc(persistence.a2aEventStore.list(
    (event) => event.work_item_id === workItem.id
  ));
  const reviews = sortByTimeAsc(persistence.reviewRecordStore.list(
    (review) => review.work_item_id === workItem.id
  ));
  const qualityGates = sortByTimeAsc(persistence.qualityGateRunStore.list(
    (gate) => gate.work_item_id === workItem.id
  ));
  const escalations = sortByTimeAsc(persistence.escalationRecordStore.list(
    (record) => record.work_item_id === workItem.id
  ));
  const deliveryRecords = sortByTimeAsc(persistence.deliveryRecordStore.list(
    (record) => record.work_item_id === workItem.id
  ));
  const retrospective = safeRetrospectiveSummary(persistence, workItem.id);

  const reviewSummary = summarizeReviews(persistence, workItem.id);
  const qualitySummary = summarizeQualityGates(persistence, workItem.id);
  const deliverySummary = summarizeDelivery(persistence, workItem.id);
  const latestKeyConclusion = findLatestKeyConclusion({
    a2aEvents,
    reviews,
    qualityGates,
    escalations,
    deliveryRecords,
    retrospective,
  });

  return {
    id: workItem.id,
    type: workItem.type,
    title: workItem.title || firstLine(workItem.goal),
    goal: workItem.goal || "",
    scope: workItem.scope || "",
    status: workItem.status,
    assumptions: asArray(workItem.assumptions),
    ambiguities: asArray(workItem.ambiguities),
    risks: asArray(workItem.risks),
    owners: unique(tasks.map((task) => task.owner_agent).filter(Boolean)),
    reviewers: unique(tasks.map((task) => task.reviewer_agent).filter(Boolean)),
    collaborators: unique(tasks.flatMap((task) => asArray(task.collaborators))),
    dependencies: unique(tasks.flatMap((task) => asArray(task.dependencies))),
    latest_key_conclusion: latestKeyConclusion,
    tasks: tasks.map(formatTask),
    timeline: buildTimeline({
      workItem,
      tasks,
      a2aEvents,
      reviews,
      qualityGates,
      escalations,
      deliveryRecords,
      retrospective,
    }),
    confirmations: escalations.map(formatEscalation),
    pending_confirmations: escalations
      .filter((record) =>
        record.status === "pending_user_confirmation" ||
        record.status === "needs_more_info"
      )
      .map(formatEscalation),
    review_summary: reviewSummary,
    quality_gate_summary: qualitySummary,
    delivery_summary: deliverySummary,
    retrospective_summary: retrospective,
    minimax_experience_review: {
      status: "not_completed",
      reason: "MiniMax is currently unavailable during the development sprint.",
      next_step: "MiniMax should review page experience when available or remain recorded as A7 downgrade risk.",
    },
  };
}

function buildWorkItemSummary(persistence, workItem) {
  const view = buildWorkItemView(persistence, workItem.id);
  return {
    id: view.id,
    type: view.type,
    title: view.title,
    status: view.status,
    owners: view.owners,
    reviewers: view.reviewers,
    pending_confirmations: view.pending_confirmations.length,
    latest_key_conclusion: view.latest_key_conclusion,
    updated_at: workItem.updated_at || workItem.created_at,
  };
}

function buildTimeline(input) {
  const events = [];
  const workItemTitle = input.workItem.title || firstLine(input.workItem.goal);

  events.push({
    kind: "work_item",
    title: "工作项创建",
    actor: "user",
    status: input.workItem.status,
    summary: workItemTitle,
    at: input.workItem.created_at,
    record_id: input.workItem.id,
  });

  for (const task of input.tasks) {
    events.push({
      kind: "task",
      title: task.metadata && task.metadata.title ? task.metadata.title : task.id,
      actor: task.owner_agent,
      status: task.status,
      summary: task.boundary || "任务边界待补充",
      at: task.updated_at || task.created_at,
      record_id: task.id,
    });
  }

  for (const event of input.a2aEvents) {
    events.push({
      kind: "a2a",
      title: event.purpose,
      actor: `${event.from_agent} -> ${event.to_agent}`,
      status: event.conclusion || (event.requires_user_intervention ? "needs_user" : "recorded"),
      summary: event.conclusion || event.next_action || event.claim_or_request || event.response,
      at: event.updated_at || event.created_at,
      record_id: event.id,
      requires_user_intervention: event.requires_user_intervention === true,
    });
  }

  for (const review of input.reviews) {
    events.push({
      kind: "review",
      title: "非作者 Review",
      actor: `${review.author_agent} -> ${review.reviewer_agent}`,
      status: review.result,
      summary: summarizeFindings(review.findings) || summarizeFixes(review.required_fixes) || review.scope,
      at: review.updated_at || review.created_at,
      record_id: review.id,
    });
  }

  for (const gate of input.qualityGates) {
    events.push({
      kind: "quality_gate",
      title: gate.gate_name,
      actor: "quality-gate",
      status: gate.final_status,
      summary: gate.failure_summary || gate.failure_reason || gate.result || gate.validation_method,
      at: gate.updated_at || gate.created_at,
      record_id: gate.id,
    });
  }

  for (const escalation of input.escalations) {
    events.push({
      kind: "escalation",
      title: escalation.trigger_rule || escalation.blocked_gate || "人工确认",
      actor: escalation.decided_by || "user",
      status: escalation.status || "pending_user_confirmation",
      summary: escalation.user_decision || escalation.recommended_next_step || escalation.what_happened,
      at: escalation.updated_at || escalation.created_at,
      record_id: escalation.id,
      requires_user_intervention:
        escalation.status === "pending_user_confirmation" ||
        escalation.status === "needs_more_info",
    });
  }

  for (const delivery of input.deliveryRecords) {
    events.push({
      kind: "delivery",
      title: delivery.action,
      actor: delivery.actor_agent,
      status: delivery.result,
      summary: delivery.failure_summary || delivery.push_status || delivery.target_branch,
      at: delivery.updated_at || delivery.created_at,
      record_id: delivery.id,
    });
  }

  if (input.retrospective) {
    events.push({
      kind: "retrospective",
      title: "复盘记录",
      actor: "system",
      status: input.retrospective.confirmed_as_baseline ? "baseline_confirmed" : "recorded",
      summary: input.retrospective.conclusion || "复盘摘要已形成",
      at: input.retrospective.created_at,
      record_id: input.retrospective.retrospective_id,
    });
  }

  return sortByTimeAsc(events);
}

function findLatestKeyConclusion(input) {
  const candidates = [];

  for (const event of input.a2aEvents) {
    const summary = normalizeText(event.conclusion) || normalizeText(event.next_action);
    if (summary) {
      candidates.push({
        source: "a2a",
        status: event.purpose,
        summary,
        at: event.updated_at || event.created_at,
        record_id: event.id,
      });
    }
  }

  for (const review of input.reviews) {
    const summary = summarizeFindings(review.findings) ||
      summarizeFixes(review.required_fixes) ||
      review.result;
    candidates.push({
      source: "review",
      status: review.result,
      summary,
      at: review.updated_at || review.created_at,
      record_id: review.id,
    });
  }

  for (const gate of input.qualityGates) {
    candidates.push({
      source: "quality_gate",
      status: gate.final_status,
      summary: gate.failure_summary || gate.failure_reason || gate.result || gate.final_status,
      at: gate.updated_at || gate.created_at,
      record_id: gate.id,
    });
  }

  for (const escalation of input.escalations) {
    const summary = escalation.user_decision ||
      escalation.decision_detail ||
      escalation.recommended_next_step;
    if (summary) {
      candidates.push({
        source: "escalation",
        status: escalation.status || "",
        summary,
        at: escalation.updated_at || escalation.created_at,
        record_id: escalation.id,
      });
    }
  }

  for (const delivery of input.deliveryRecords) {
    candidates.push({
      source: "delivery",
      status: delivery.result,
      summary: delivery.failure_summary || delivery.push_status || delivery.result,
      at: delivery.updated_at || delivery.created_at,
      record_id: delivery.id,
    });
  }

  if (input.retrospective && input.retrospective.conclusion) {
    candidates.push({
      source: "retrospective",
      status: input.retrospective.confirmed_as_baseline ? "baseline_confirmed" : "recorded",
      summary: input.retrospective.conclusion,
      at: input.retrospective.created_at,
      record_id: input.retrospective.retrospective_id,
    });
  }

  return sortByTimeDesc(candidates)[0] || {
    source: "work_item",
    status: "pending",
    summary: "待形成",
    at: null,
    record_id: null,
  };
}

function formatTask(task) {
  return {
    id: task.id,
    title: task.metadata && task.metadata.title ? task.metadata.title : task.id,
    owner_agent: task.owner_agent,
    reviewer_agent: task.reviewer_agent,
    collaborators: asArray(task.collaborators),
    boundary: task.boundary || "",
    dependencies: asArray(task.dependencies),
    expected_artifacts: asArray(task.expected_artifacts),
    acceptance_criteria: asArray(task.acceptance_criteria),
    status: task.status,
    parallelizable: task.parallelizable === true,
  };
}

function formatEscalation(record) {
  return {
    id: record.id,
    work_item_id: record.work_item_id,
    task_id: record.task_id || null,
    status: record.status || "pending_user_confirmation",
    trigger_type: record.trigger_type || "",
    trigger_rule: record.trigger_rule || "",
    what_happened: record.what_happened || "",
    blocked_gate: record.blocked_gate || "",
    options: asArray(record.options),
    risks: record.risks || "",
    recommended_next_step: record.recommended_next_step || "",
    user_decision: record.user_decision || "",
    decision_detail: record.decision_detail || "",
    decided_by: record.decided_by || "",
    decided_at: record.decided_at || "",
    updated_at: record.updated_at || record.created_at,
  };
}

function safeRetrospectiveSummary(persistence, workItemId) {
  try {
    return summarizeRetrospective(persistence, workItemId);
  } catch {
    return null;
  }
}

function summarizeFindings(findings) {
  return asArray(findings)
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") return item.description || item.summary || "";
      return "";
    })
    .filter(Boolean)
    .slice(0, 3)
    .join("; ");
}

function summarizeFixes(fixes) {
  return asArray(fixes).filter(Boolean).slice(0, 3).join("; ");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstLine(value) {
  return normalizeText(value).split(/\r?\n/)[0].slice(0, 80);
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function unique(values) {
  return Array.from(new Set(values.map(normalizeText).filter(Boolean)));
}

function sortByTimeAsc(records) {
  return [...records].sort((a, b) => timestamp(a) - timestamp(b));
}

function sortByTimeDesc(records) {
  return [...records].sort((a, b) => timestamp(b) - timestamp(a));
}

function timestamp(record) {
  return new Date(record.at || record.updated_at || record.created_at || 0).getTime();
}

module.exports = {
  buildUserParticipationView,
  buildWorkItemView,
  findLatestKeyConclusion,
};
