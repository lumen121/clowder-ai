#!/usr/bin/env node
/**
 * storage/index.js — 模型工厂函数与 Store 实例
 *
 * 每个模型提供：
 *  - createXxx(input)  校验 + 补默认值 + 写入 Store → 返回完整记录
 *  - xxxStore          底层 Store 实例（用于 read/update/delete/list）
 *
 * 模型定义来源：docs/architecture/14-system-architecture-design.md
 *
 * 支持可注入 dataDir：
 *   const { createWorkItem, workItemStore } = createPersistence("/tmp/test");
 * 默认实例使用 data/ 目录。
 */

const { Store } = require("./store");

// ═══════════════════════════════════════════════════════════════════════
// 工具
// ═══════════════════════════════════════════════════════════════════════

function isEmpty(v) {
  return v == null || v === "";
}

/**
 * 构建模型工厂
 * @param {Store} store
 * @param {object} defaults    默认值
 * @param {object} required    必填字段映射 { field: label }
 */
function modelFactory(store, defaults = {}, required = {}) {
  return function create(input = {}) {
    const missing = [];
    for (const [field, label] of Object.entries(required)) {
      if (isEmpty(input[field]) && isEmpty(defaults[field])) {
        missing.push(label || field);
      }
    }
    if (missing.length) {
      throw new Error(`${store.name} 缺少必填字段: ${missing.join(", ")}`);
    }
    return store.create({ ...defaults, ...input });
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 常量（与 dataDir 无关）
// ═══════════════════════════════════════════════════════════════════════

const WORK_ITEM_TYPES = ["feature", "bug_fix"];

const WORK_ITEM_STATUSES = [
  "needs_clarification", "solution_review", "ready_for_development",
  "in_development", "pending_review", "needs_fix", "pending_verification",
  "ready_to_commit", "pushed", "completed", "blocked",
];

const WORK_ITEM_DEFAULTS = {
  type: "feature", status: "needs_clarification", goal: "", scope: "",
  assumptions: [], ambiguities: [], risks: [], solution: null,
  tasks: [], disagreements: [], escalations: [],
  review_status: null, quality_status: null,
  delivery_status: null, retrospective_status: null,
};

const WORK_ITEM_REQUIRED = { goal: "goal" };

// ── Task ────────────────────────────────────────────────────────────

const TASK_STATUSES = ["pending", "in_progress", "completed", "blocked"];

const TASK_DEFAULTS = {
  work_item_id: "", owner_agent: "", collaborators: [], boundary: "",
  dependencies: [], expected_artifacts: [], reviewer_agent: "",
  acceptance_criteria: [], parallelizable: false, workspace_id: null,
  status: "pending",
};

const TASK_REQUIRED = {
  work_item_id: "work_item_id",
  owner_agent: "owner_agent",
};

// ── A2AEvent ────────────────────────────────────────────────────────

const A2A_PURPOSES = [
  "clarification_request", "requirement_challenge", "solution_question",
  "risk_alert", "task_breakdown_feedback", "task_handover",
  "execution_sync", "review_request", "fix_request",
  "verification_request", "disagreement_escalation", "retrospective_feedback",
];

const A2A_DEFAULTS = {
  from_agent: "", to_agent: "", work_item_id: "", task_id: null,
  purpose: "", context: "", claim_or_request: "", response: "",
  conclusion: "", next_action: "", requires_user_intervention: false,
};

const A2A_REQUIRED = {
  from_agent: "from_agent", to_agent: "to_agent",
  work_item_id: "work_item_id", purpose: "purpose",
};

// ── ReviewRecord ────────────────────────────────────────────────────

const REVIEW_RESULTS = [
  "approved", "changes_requested", "disputed", "user_confirmation_required",
];

const REVIEW_DEFAULTS = {
  work_item_id: "", task_id: null, author_agent: "", reviewer_agent: "",
  scope: "", findings: [], result: "approved", required_fixes: [],
  resolved: false,
};

const REVIEW_REQUIRED = {
  work_item_id: "work_item_id",
  author_agent: "author_agent",
  reviewer_agent: "reviewer_agent",
};

// ── QualityGateRun ──────────────────────────────────────────────────

const QG_FINAL_STATUSES = ["passed", "failed", "blocked", "user_confirmed"];

const QUALITY_GATE_DEFAULTS = {
  work_item_id: "", task_id: null, gate_name: "", validation_method: "",
  result: "", failure_reason: "", safe_fix_attempted: false,
  final_status: "passed",
};

const QUALITY_GATE_REQUIRED = {
  work_item_id: "work_item_id", gate_name: "gate_name",
};

// ── WorkspaceRecord ─────────────────────────────────────────────────

const WS_CONFLICT_STATUSES = [
  "clean", "file_conflict", "semantic_conflict_risk", "resolved",
];

const WORKSPACE_DEFAULTS = {
  agent: "", task_id: "", branch: "", worktree_path: "",
  base_ref: "", changed_files: [], merge_order: 0,
  conflict_status: "clean", cleanup_status: "active",
};

const WORKSPACE_REQUIRED = {
  agent: "agent", task_id: "task_id", branch: "branch",
};

// ── EscalationRecord ────────────────────────────────────────────────

const ESCALATION_DEFAULTS = {
  work_item_id: "", trigger_rule: "", what_happened: "",
  blocked_gate: "", options: [], risks: "",
  recommended_next_step: "", user_decision: "",
};

const ESCALATION_REQUIRED = {
  work_item_id: "work_item_id", what_happened: "what_happened",
};

// ── RetrospectiveMemory ─────────────────────────────────────────────

const RETROSPECTIVE_DEFAULTS = {
  work_item_id: "", effective_patterns: [], failure_causes: [],
  review_findings: [], quality_gate_results: [],
  user_intervention_reasons: [], process_improvement_suggestions: [],
  technical_execution_suggestions: [], confirmed_as_baseline: false,
};

const RETROSPECTIVE_REQUIRED = {
  work_item_id: "work_item_id",
};

// ═══════════════════════════════════════════════════════════════════════
// createPersistence(dataDir) — 可注入 dataDir 的工厂函数
// ═══════════════════════════════════════════════════════════════════════

function createPersistence(dataDir = "data") {
  // ── Store 实例 ──────────────────────────────────────────────────

  const workItemStore = new Store("work-items", dataDir, { idPrefix: "wi" });
  const taskStore = new Store("tasks", dataDir, { idPrefix: "task" });
  const a2aEventStore = new Store("a2a-events", dataDir, { idPrefix: "a2a" });
  const reviewRecordStore = new Store("review-records", dataDir, { idPrefix: "rev" });
  const qualityGateRunStore = new Store("quality-gate-runs", dataDir, { idPrefix: "qg" });
  const workspaceRecordStore = new Store("workspace-records", dataDir, { idPrefix: "ws" });
  const escalationRecordStore = new Store("escalation-records", dataDir, { idPrefix: "esc" });
  const retrospectiveMemoryStore = new Store("retrospective-memories", dataDir, { idPrefix: "retro" });

  // ── WorkItem 工厂 ───────────────────────────────────────────────

  function createWorkItem(input = {}) {
    if (input.type && !WORK_ITEM_TYPES.includes(input.type)) {
      throw new Error(
        `无效的 WorkItem 类型: "${input.type}"，仅支持: ${WORK_ITEM_TYPES.join(", ")}`
      );
    }
    if (input.status && !WORK_ITEM_STATUSES.includes(input.status)) {
      throw new Error(`无效的 WorkItem 状态: "${input.status}"`);
    }
    return modelFactory(workItemStore, WORK_ITEM_DEFAULTS, WORK_ITEM_REQUIRED)(input);
  }

  // ── Task 工厂 ───────────────────────────────────────────────────

  function createTask(input = {}) {
    if (input.status && !TASK_STATUSES.includes(input.status)) {
      throw new Error(`无效的 Task 状态: "${input.status}"`);
    }
    return modelFactory(taskStore, TASK_DEFAULTS, TASK_REQUIRED)(input);
  }

  // ── A2AEvent 工厂 ───────────────────────────────────────────────

  function createA2AEvent(input = {}) {
    if (input.purpose && !A2A_PURPOSES.includes(input.purpose)) {
      throw new Error(`无效的 A2A 交互目的: "${input.purpose}"`);
    }
    return modelFactory(a2aEventStore, A2A_DEFAULTS, A2A_REQUIRED)(input);
  }

  // ── ReviewRecord 工厂 ───────────────────────────────────────────

  function createReviewRecord(input = {}) {
    if (input.result && !REVIEW_RESULTS.includes(input.result)) {
      throw new Error(
        `无效的 Review 结果: "${input.result}"，仅支持: ${REVIEW_RESULTS.join(", ")}`
      );
    }
    if (
      input.author_agent && input.reviewer_agent &&
      input.author_agent === input.reviewer_agent
    ) {
      throw new Error(
        `作者不能自审: author_agent 和 reviewer_agent 不能相同 ("${input.author_agent}")`
      );
    }
    return modelFactory(reviewRecordStore, REVIEW_DEFAULTS, REVIEW_REQUIRED)(input);
  }

  // ── QualityGateRun 工厂 ─────────────────────────────────────────

  function createQualityGateRun(input = {}) {
    if (input.final_status && !QG_FINAL_STATUSES.includes(input.final_status)) {
      throw new Error(`无效的质量门禁最终状态: "${input.final_status}"`);
    }
    return modelFactory(qualityGateRunStore, QUALITY_GATE_DEFAULTS, QUALITY_GATE_REQUIRED)(input);
  }

  // ── WorkspaceRecord 工厂 ────────────────────────────────────────

  function createWorkspaceRecord(input = {}) {
    if (input.conflict_status && !WS_CONFLICT_STATUSES.includes(input.conflict_status)) {
      throw new Error(`无效的冲突状态: "${input.conflict_status}"`);
    }
    return modelFactory(workspaceRecordStore, WORKSPACE_DEFAULTS, WORKSPACE_REQUIRED)(input);
  }

  // ── EscalationRecord 工厂 ───────────────────────────────────────

  function createEscalationRecord(input = {}) {
    return modelFactory(escalationRecordStore, ESCALATION_DEFAULTS, ESCALATION_REQUIRED)(input);
  }

  // ── RetrospectiveMemory 工厂 ────────────────────────────────────

  function createRetrospectiveMemory(input = {}) {
    return modelFactory(
      retrospectiveMemoryStore, RETROSPECTIVE_DEFAULTS, RETROSPECTIVE_REQUIRED
    )(input);
  }

  return {
    workItemStore, taskStore, a2aEventStore, reviewRecordStore,
    qualityGateRunStore, workspaceRecordStore, escalationRecordStore,
    retrospectiveMemoryStore,
    createWorkItem, createTask, createA2AEvent, createReviewRecord,
    createQualityGateRun, createWorkspaceRecord, createEscalationRecord,
    createRetrospectiveMemory,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 默认实例（data/ 目录）
// ═══════════════════════════════════════════════════════════════════════

const defaults = createPersistence("data");

// ═══════════════════════════════════════════════════════════════════════
// 导出：默认实例 + createPersistence + 常量
// ═══════════════════════════════════════════════════════════════════════

module.exports = {
  // 默认 Store 实例 + 模型工厂
  ...defaults,

  // 可注入 dataDir 的工厂函数（供测试/验证使用）
  createPersistence,

  // 常量
  WORK_ITEM_TYPES, WORK_ITEM_STATUSES, TASK_STATUSES,
  A2A_PURPOSES, REVIEW_RESULTS, QG_FINAL_STATUSES, WS_CONFLICT_STATUSES,
};
