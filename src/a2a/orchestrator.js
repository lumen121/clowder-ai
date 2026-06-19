"use strict";

/**
 * src/a2a/orchestrator.js — A2A 事件编排与记录模块（T6）
 *
 * 职责：
 *   - 创建结构化 A2A 事件并写入 T3 A2AEvent Store。
 *   - 包装 T4 Agent CLI 调用结果为 A2A 事件。
 *   - 记录 A2A 响应、结论和下一步。
 *   - 提供按工作项/任务查询、待处理/已升级筛选、摘要能力。
 *
 * 本模块是 T3 Store 的消费者、T4 适配层的调用方。
 * 不实现完整 Harness 护栏（属 T8）、不实现页面渲染（属 T13）。
 *
 * 用法：
 *   const { createPersistence } = require("../storage");
 *   const p = createPersistence("data");
 *   const event = createA2AEvent(p, {
 *     purpose: "clarification_request",
 *     from_agent: "Claude", to_agent: "Codex",
 *     work_item_id: "wi-xxx", claim_or_request: "类型识别依据是什么？"
 *   });
 */

const { A2A_PURPOSES } = require("../storage");
const { invokeAgent, listAgents } = require("../agents/cli-adapter");
const { redactSensitiveText } = require("../agents/response-recording");

// ═══════════════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════════════

/**
 * 系统内已知的 Agent 身份标识。
 * "system" 代表 Harness / 编排器自身发起的系统级 A2A 事件。
 */
const AGENT_IDENTITIES = Object.freeze(["Codex", "Claude", "MiniMax", "system"]);

/**
 * 需要用户介入的 A2A 目的类型。
 * 这些类型在创建时若未显式设置 requires_user_intervention，
 * 会自动设为 true。
 */
const ESCALATION_PURPOSES = Object.freeze([
  "disagreement_escalation",
]);

/**
 * 通常期望有响应的 A2A 目的类型。
 * 用于 getPendingA2A() 判断哪些事件仍在等待对方回复。
 */
const RESPONSE_EXPECTED_PURPOSES = Object.freeze([
  "clarification_request",
  "requirement_challenge",
  "solution_question",
  "risk_alert",
  "task_breakdown_feedback",
  "review_request",
  "fix_request",
  "verification_request",
]);

// ═══════════════════════════════════════════════════════════════════════
// 校验
// ═══════════════════════════════════════════════════════════════════════

/**
 * 校验 agent 身份是否在已知列表中。
 * 不阻断执行，但返回 warning 以便调用方记录。
 */
function validateAgentIdentity(identity, fieldName = "agent") {
  if (!identity || typeof identity !== "string") {
    return { valid: false, error: `${fieldName} 不能为空` };
  }
  if (!AGENT_IDENTITIES.includes(identity)) {
    return {
      valid: false,
      error: `${fieldName} "${identity}" 不在已知身份列表中: ${AGENT_IDENTITIES.join(", ")}`,
    };
  }
  return { valid: true };
}

/**
 * 校验 A2A purpose 是否为合法枚举值。
 */
function validatePurpose(purpose) {
  if (!purpose || !A2A_PURPOSES.includes(purpose)) {
    return {
      valid: false,
      error: `无效的 A2A 目的: "${purpose}"，合法值: ${A2A_PURPOSES.join(", ")}`,
    };
  }
  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════════════
// 核心 API
// ═══════════════════════════════════════════════════════════════════════

/**
 * 创建结构化 A2A 事件并写入 T3 A2AEvent Store。
 *
 * 必填字段（来自 A2A 协议和 T3 模型约束）：
 *   - purpose:       A2A 交互目的（12 种枚举之一）
 *   - from_agent:    发起方 Agent 身份
 *   - to_agent:      接收方 Agent 身份
 *   - work_item_id:  关联工作项 ID
 *   - claim_or_request: 请求/主张内容
 *
 * 可选但建议填写的字段：
 *   - task_id:       关联任务 ID
 *   - context:       背景上下文
 *   - response:      响应内容（创建时通常为空）
 *   - conclusion:    结论
 *   - next_action:   下一步动作
 *   - requires_user_intervention: 是否需要用户介入
 *
 * @param {object} persistence - T3 createPersistence() 返回值
 * @param {object} params - 事件参数
 * @returns {object} 创建的 A2AEvent 完整记录（含 id、created_at、updated_at）
 */
function createA2AEvent(persistence, params = {}) {
  // ── 必填字段校验 ──
  const missing = [];
  if (!params.purpose) missing.push("purpose");
  if (!params.from_agent) missing.push("from_agent");
  if (!params.to_agent) missing.push("to_agent");
  if (!params.work_item_id) missing.push("work_item_id");
  if (!params.claim_or_request) missing.push("claim_or_request");

  if (missing.length > 0) {
    throw new Error(`A2A 事件缺少必填字段: ${missing.join(", ")}`);
  }

  // ── 枚举校验 ──
  const purposeResult = validatePurpose(params.purpose);
  if (!purposeResult.valid) {
    throw new Error(purposeResult.error);
  }

  // ── agent 身份校验（警告但不阻断，因为未来可能新增 agent） ──
  const fromCheck = validateAgentIdentity(params.from_agent, "from_agent");
  const toCheck = validateAgentIdentity(params.to_agent, "to_agent");

  // ── 推断 requires_user_intervention ──
  // 如果是升级类目的，默认需要用户介入；否则尊重显式设置
  let requiresUserIntervention = params.requires_user_intervention;
  if (typeof requiresUserIntervention !== "boolean") {
    requiresUserIntervention = ESCALATION_PURPOSES.includes(params.purpose);
  }

  // ── 构建事件记录 ──
  const eventInput = {
    from_agent: params.from_agent,
    to_agent: params.to_agent,
    work_item_id: params.work_item_id,
    task_id: params.task_id || null,
    purpose: params.purpose,
    context: typeof params.context === "string" ? params.context : "",
    claim_or_request: params.claim_or_request,
    response: typeof params.response === "string" ? params.response : "",
    conclusion: typeof params.conclusion === "string" ? params.conclusion : "",
    next_action: typeof params.next_action === "string" ? params.next_action : "",
    requires_user_intervention: requiresUserIntervention,
  };

  // ── 写入 T3 Store ──
  const record = persistence.createA2AEvent(eventInput);

  // ── 附加校验警告到返回对象（不影响写入） ──
  const warnings = [];
  if (!fromCheck.valid) warnings.push(fromCheck.error);
  if (!toCheck.valid) warnings.push(toCheck.error);
  if (warnings.length > 0) {
    record._warnings = warnings;
  }

  return record;
}

/**
 * 发起 A2A 交互：创建事件，并可选地通过 T4 调用目标 Agent。
 *
 * 如果 to_agent 是已知的 Agent CLI 身份（Codex/Claude/MiniMax），
 * 且 options.invokeTarget === true，则通过 T4 invokeAgent() 调用目标 Agent。
 * 调用结果会作为 A2A 事件的 response 回写。
 *
 * @param {object} persistence - T3 持久化实例
 * @param {object} params - 同 createA2AEvent 的参数
 * @param {object} [options] - 可选配置
 * @param {boolean} [options.invokeTarget=false] - 是否调用目标 Agent
 * @param {object} [options.taskContext] - T4 任务上下文（invokeTarget=true 时必填）
 * @param {number} [options.timeoutMs] - 调用超时
 * @returns {Promise<{event: object, invocation: object|null}>}
 */
async function initiateA2AInteraction(persistence, params, options = {}) {
  // 先创建 A2A 事件记录
  const event = createA2AEvent(persistence, params);

  let invocation = null;

  // 如果要求调用目标 Agent 且目标是已知 CLI agent
  if (options.invokeTarget && listAgents().includes(params.to_agent.toLowerCase())) {
    if (!options.taskContext) {
      throw new Error(
        "initiateA2AInteraction: invokeTarget=true 时必须提供 options.taskContext"
      );
    }

    // 将 A2A 上下文注入 taskContext 的 goal 中，让目标 Agent 知道这是 A2A 交互
    const enrichedContext = {
      ...options.taskContext,
      goal: `[A2A ${params.purpose}] ${options.taskContext.goal || ""}`,
    };

    try {
      invocation = await invokeAgent(
        params.to_agent.toLowerCase(),
        enrichedContext,
        { timeoutMs: options.timeoutMs }
      );

      // 将调用结果回写到 A2A 事件
      const responseText = invocation.success
        ? invocation.stdout
        : `调用失败 (${invocation.error_classification}): ${invocation.stderr}`;

      persistence.a2aEventStore.update(event.id, {
        response: redactSensitiveText(responseText).slice(0, 5000),
        conclusion: invocation.success ? "acknowledged" : "invocation_failed",
        next_action: invocation.success
          ? "awaiting_review_or_next_step"
          : "manual_follow_up_required",
        requires_user_intervention: !invocation.success,
      });

      // 更新本地 event 引用以反映最新状态
      event.response = redactSensitiveText(responseText).slice(0, 5000);
      event.conclusion = invocation.success ? "acknowledged" : "invocation_failed";
      event.next_action = invocation.success
        ? "awaiting_review_or_next_step"
        : "manual_follow_up_required";
      event.requires_user_intervention = !invocation.success;
    } catch (error) {
      // 调用异常不抛出让整个流程崩溃，记录到事件中
      persistence.a2aEventStore.update(event.id, {
        response: `invocation_error: ${error.message}`.slice(0, 5000),
        conclusion: "invocation_error",
        next_action: "manual_follow_up_required",
        requires_user_intervention: true,
      });

      event.response = `invocation_error: ${error.message}`.slice(0, 5000);
      event.conclusion = "invocation_error";
      event.next_action = "manual_follow_up_required";
      event.requires_user_intervention = true;
    }
  }

  return { event, invocation };
}

/**
 * 记录对已有 A2A 事件的响应。
 *
 * 更新事件的 response / conclusion / next_action 字段，
 * 并可切换 requires_user_intervention 状态。
 *
 * @param {object} persistence - T3 持久化实例
 * @param {string} eventId - 要更新的 A2A 事件 ID
 * @param {object} responseParams - 响应参数
 * @param {string} [responseParams.response] - 响应内容
 * @param {string} [responseParams.conclusion] - 结论
 * @param {string} [responseParams.next_action] - 下一步动作
 * @param {boolean} [responseParams.requires_user_intervention] - 是否仍需用户介入
 * @returns {object} 更新后的 A2AEvent 记录
 */
function recordA2AResponse(persistence, eventId, responseParams = {}) {
  const existing = persistence.a2aEventStore.read(eventId);
  if (!existing) {
    throw new Error(`A2A 事件不存在: ${eventId}`);
  }

  const patch = {};

  if (typeof responseParams.response === "string") {
    patch.response = responseParams.response;
  }
  if (typeof responseParams.conclusion === "string") {
    patch.conclusion = responseParams.conclusion;
  }
  if (typeof responseParams.next_action === "string") {
    patch.next_action = responseParams.next_action;
  }
  if (typeof responseParams.requires_user_intervention === "boolean") {
    patch.requires_user_intervention = responseParams.requires_user_intervention;
  }

  if (Object.keys(patch).length === 0) {
    return existing;
  }

  return persistence.a2aEventStore.update(eventId, patch);
}

/**
 * 包装 T4 invokeAgent() 调用，并自动将结果记录为 A2A execution_sync 事件。
 *
 * 这是 T4 → T6 的主要集成点。它：
 *   1. 调用 T4 invokeAgent() 真实执行 Agent CLI
 *   2. 将调用结果脱敏后写入 T3 A2AEvent Store
 *   3. 返回 { result, a2aEvent } 供上游使用
 *
 * 与 T4 的 recordAgentInvocation() 的区别：
 *   - 使用正确的 agent 身份（不再使用 "Clowder"）
 *   - 支持关联真实的 work_item_id 和 task_id
 *   - 提供更完整的 A2A 元数据（context、claim_or_request、conclusion）
 *
 * @param {object} persistence - T3 持久化实例
 * @param {string} agent - Agent 标识（codex/claude/minimax）
 * @param {object} taskContext - T4 任务上下文输入
 * @param {object} [options] - 可选配置
 * @param {string} [options.workItemId] - 关联工作项 ID
 * @param {string} [options.taskId] - 关联任务 ID
 * @param {string} [options.purpose] - A2A 目的（默认 "execution_sync"）
 * @param {number} [options.timeoutMs] - 调用超时
 * @returns {Promise<{result: object, a2aEvent: object}>}
 */
async function invokeAndRecord(persistence, agent, taskContext, options = {}) {
  const purpose = options.purpose || "execution_sync";

  // 调用 T4 真实 Agent CLI
  const result = await invokeAgent(agent, taskContext, {
    timeoutMs: options.timeoutMs,
  });

  // 确定身份显示名
  const identityMap = { codex: "Codex", claude: "Claude", minimax: "MiniMax" };
  const fromIdentity = identityMap[agent] || agent;

  // 构建 A2A 事件
  const workItemId = options.workItemId || taskContext.work_item_id || "unknown";
  const taskId = options.taskId || taskContext.task_id || null;

  const a2aEvent = createA2AEvent(persistence, {
    purpose,
    from_agent: fromIdentity,
    to_agent: "system",
    work_item_id: workItemId,
    task_id: taskId,
    context: JSON.stringify({
      kind: "agent_cli_invocation",
      agent,
      identity: fromIdentity,
      task_id: taskContext.task_id,
    }),
    claim_or_request: `Agent CLI 调用: ${fromIdentity} 执行任务 ${taskContext.task_id || "unknown"}`,
    response: result.success
      ? `调用成功 (exit_code=0, duration_ms=${result.duration_ms})`
      : `调用失败 (${result.error_classification}): ${result.stderr}`.slice(0, 5000),
    conclusion: result.success ? "success" : "failure",
    next_action: result.success
      ? "proceed_to_next_step"
      : "manual_follow_up_required",
    requires_user_intervention: !result.success,
  });

  return { result, a2aEvent };
}

// ═══════════════════════════════════════════════════════════════════════
// 查询 API
// ═══════════════════════════════════════════════════════════════════════

/**
 * 获取指定工作项的所有 A2A 事件（按创建时间升序）。
 *
 * @param {object} persistence - T3 持久化实例
 * @param {string} workItemId - 工作项 ID
 * @returns {object[]} A2AEvent 记录数组
 */
function getA2AByWorkItem(persistence, workItemId) {
  return persistence.a2aEventStore
    .list((event) => event.work_item_id === workItemId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

/**
 * 获取指定任务的所有 A2A 事件（按创建时间升序）。
 *
 * @param {object} persistence - T3 持久化实例
 * @param {string} taskId - 任务 ID
 * @returns {object[]} A2AEvent 记录数组
 */
function getA2AByTask(persistence, taskId) {
  return persistence.a2aEventStore
    .list((event) => event.task_id === taskId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

/**
 * 获取所有等待响应的 A2A 事件。
 *
 * "等待响应"的判断标准：
 *   1. purpose 属于通常期望响应的类型。
 *   2. response 字段为空（尚未收到响应）。
 *
 * @param {object} persistence - T3 持久化实例
 * @returns {object[]} 待处理 A2AEvent 记录数组
 */
function getPendingA2A(persistence) {
  return persistence.a2aEventStore.list(
    (event) =>
      RESPONSE_EXPECTED_PURPOSES.includes(event.purpose) &&
      (!event.response || event.response.trim() === "")
  );
}

/**
 * 获取所有需要用户介入的 A2A 事件。
 *
 * @param {object} persistence - T3 持久化实例
 * @returns {object[]} 需用户介入的 A2AEvent 记录数组
 */
function getEscalatedA2A(persistence) {
  return persistence.a2aEventStore.list(
    (event) => event.requires_user_intervention === true
  );
}

/**
 * 获取指定工作项下仍需用户介入的 A2A 事件。
 *
 * @param {object} persistence - T3 持久化实例
 * @param {string} workItemId - 工作项 ID
 * @returns {object[]} 需用户介入的 A2AEvent 记录数组
 */
function getEscalatedA2AByWorkItem(persistence, workItemId) {
  return persistence.a2aEventStore.list(
    (event) =>
      event.work_item_id === workItemId &&
      event.requires_user_intervention === true
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 摘要 API
// ═══════════════════════════════════════════════════════════════════════

/**
 * 为指定工作项生成 A2A 活动摘要。
 *
 * 摘要包含：
 *   - total: 总事件数
 *   - by_purpose: 按目的分类的计数
 *   - pending_count: 等待响应的事件数
 *   - escalated_count: 需用户介入的事件数
 *   - latest_conclusion: 最近一次 A2A 结论
 *   - agent_involvement: 各 Agent 参与次数
 *
 * 供 T13 时间线视图和 T14 复盘消费。
 *
 * @param {object} persistence - T3 持久化实例
 * @param {string} workItemId - 工作项 ID
 * @returns {object} 摘要对象
 */
function summarizeA2A(persistence, workItemId) {
  const events = getA2AByWorkItem(persistence, workItemId);

  if (events.length === 0) {
    return {
      work_item_id: workItemId,
      total: 0,
      by_purpose: {},
      pending_count: 0,
      escalated_count: 0,
      latest_conclusion: null,
      agent_involvement: {},
    };
  }

  // 按目的分类计数
  const byPurpose = {};
  for (const ev of events) {
    byPurpose[ev.purpose] = (byPurpose[ev.purpose] || 0) + 1;
  }

  // 等待响应和升级计数
  const pendingCount = events.filter(
    (ev) =>
      RESPONSE_EXPECTED_PURPOSES.includes(ev.purpose) &&
      (!ev.response || ev.response.trim() === "")
  ).length;

  const escalatedCount = events.filter(
    (ev) => ev.requires_user_intervention === true
  ).length;

  // 最近一次有结论的事件
  const withConclusion = events.filter(
    (ev) => ev.conclusion && ev.conclusion.trim() !== ""
  );
  const latestConclusion = withConclusion.length > 0
    ? {
        purpose: withConclusion[withConclusion.length - 1].purpose,
        conclusion: withConclusion[withConclusion.length - 1].conclusion,
        at: withConclusion[withConclusion.length - 1].created_at,
      }
    : null;

  // Agent 参与统计
  const agentInvolvement = {};
  for (const ev of events) {
    agentInvolvement[ev.from_agent] =
      (agentInvolvement[ev.from_agent] || 0) + 1;
    // to_agent 也计入，但 "system" 不计入（它是基础设施）
    if (ev.to_agent && ev.to_agent !== "system") {
      agentInvolvement[ev.to_agent] =
        (agentInvolvement[ev.to_agent] || 0) + 1;
    }
  }

  return {
    work_item_id: workItemId,
    total: events.length,
    by_purpose: byPurpose,
    pending_count: pendingCount,
    escalated_count: escalatedCount,
    latest_conclusion: latestConclusion,
    agent_involvement: agentInvolvement,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════════════════════════════════

module.exports = {
  // 常量
  AGENT_IDENTITIES,
  ESCALATION_PURPOSES,
  RESPONSE_EXPECTED_PURPOSES,

  // 校验
  validateAgentIdentity,
  validatePurpose,

  // 核心 API
  createA2AEvent,
  initiateA2AInteraction,
  recordA2AResponse,
  invokeAndRecord,

  // 查询 API
  getA2AByWorkItem,
  getA2AByTask,
  getPendingA2A,
  getEscalatedA2A,
  getEscalatedA2AByWorkItem,

  // 摘要 API
  summarizeA2A,
};
