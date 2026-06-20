#!/usr/bin/env node
/**
 * src/index.js — Clowder AI 持久化模块公共入口
 *
 * 用法:
 *   const {
 *     createWorkItem, workItemStore,
 *     createTask,     taskStore,
 *     createA2AEvent, a2aEventStore,
 *     // ...
 *   } = require("./src");
 */

const storage = require("./storage");
const agents = require("./agents/cli-adapter");
const agentRecording = require("./agents/response-recording");
const taskContext = require("./agents/task-context");
const stateMachine = require("./work-items/state-machine");
const solutionBreakdown = require("./work-items/solution-breakdown");
const a2aOrchestrator = require("./a2a/orchestrator");
const isolationGovernance = require("./worktree/isolation-governance");

module.exports = {
  // ── Store 实例（底层 CRUD：read / update / delete / list / count）──
  workItemStore:            storage.workItemStore,
  taskStore:                storage.taskStore,
  a2aEventStore:            storage.a2aEventStore,
  reviewRecordStore:        storage.reviewRecordStore,
  qualityGateRunStore:      storage.qualityGateRunStore,
  workspaceRecordStore:     storage.workspaceRecordStore,
  escalationRecordStore:    storage.escalationRecordStore,
  retrospectiveMemoryStore: storage.retrospectiveMemoryStore,

  // ── 模型工厂（校验 + 默认值 + 创建）──────────────────────────────
  createWorkItem:            storage.createWorkItem,
  createTask:                storage.createTask,
  createA2AEvent:            storage.createA2AEvent,
  createReviewRecord:        storage.createReviewRecord,
  createQualityGateRun:      storage.createQualityGateRun,
  createWorkspaceRecord:     storage.createWorkspaceRecord,
  createEscalationRecord:    storage.createEscalationRecord,
  createRetrospectiveMemory: storage.createRetrospectiveMemory,

  // ── 常量 ──────────────────────────────────────────────────────────
  WORK_ITEM_TYPES:           storage.WORK_ITEM_TYPES,
  WORK_ITEM_STATUSES:        storage.WORK_ITEM_STATUSES,
  TASK_STATUSES:             storage.TASK_STATUSES,
  A2A_PURPOSES:              storage.A2A_PURPOSES,
  REVIEW_RESULTS:            storage.REVIEW_RESULTS,
  QG_FINAL_STATUSES:         storage.QG_FINAL_STATUSES,
  WS_CONFLICT_STATUSES:      storage.WS_CONFLICT_STATUSES,

  // ── 可注入 dataDir 的工厂（测试/验证用）─────────────────────────
  createPersistence:         storage.createPersistence,

  // T4 Agent CLI adapter
  invokeAgent:               agents.invokeAgent,
  listAgents:                agents.listAgents,
  buildTaskContext:          taskContext.buildTaskContext,
  formatTaskContextPrompt:   taskContext.formatTaskContextPrompt,
  validateTaskContext:       taskContext.validateTaskContext,
  recordAgentInvocation:     agentRecording.recordAgentInvocation,
  redactSensitiveText:       agentRecording.redactSensitiveText,

  // ── 状态机（T5）───────────────────────────────────────────────────
  WORK_ITEM_TRANSITIONS:     stateMachine.TRANSITIONS,
  transitionWorkItem:        stateMachine.transitionWorkItem,
  validateTransition:        stateMachine.transition,
  canTransitionWorkItem:     stateMachine.canTransition,
  isWorkItemTerminal:        stateMachine.isTerminal,
  isWorkItemBlocked:         stateMachine.isBlocked,

  // ── 底层模块引用（高级用法）─────────────────────────────────────
  stateMachine,

  // ── 方案与任务拆解（T7）──────────────────────────────────────────
  recordSolutionAndTaskBreakdown: solutionBreakdown.recordSolutionAndTaskBreakdown,
  validateSolutionBreakdown:      solutionBreakdown.validateSolutionBreakdown,
  normalizeBreakdownInput:        solutionBreakdown.normalizeBreakdownInput,
  solutionBreakdown,

  // ── A2A 事件编排（T6）───────────────────────────────────────────────
  // 核心
  createA2AEventOrchestrated: a2aOrchestrator.createA2AEvent,
  initiateA2AInteraction:     a2aOrchestrator.initiateA2AInteraction,
  recordA2AResponse:          a2aOrchestrator.recordA2AResponse,
  invokeAndRecord:            a2aOrchestrator.invokeAndRecord,
  buildA2AFromInvocation:     a2aOrchestrator.buildA2AFromInvocation,
  // 查询
  getA2AByWorkItem:           a2aOrchestrator.getA2AByWorkItem,
  getA2AByTask:               a2aOrchestrator.getA2AByTask,
  getPendingA2A:              a2aOrchestrator.getPendingA2A,
  getEscalatedA2A:            a2aOrchestrator.getEscalatedA2A,
  getEscalatedA2AByWorkItem:  a2aOrchestrator.getEscalatedA2AByWorkItem,
  // 摘要
  summarizeA2A:               a2aOrchestrator.summarizeA2A,
  // 常量
  A2A_AGENT_IDENTITIES:       a2aOrchestrator.AGENT_IDENTITIES,
  A2A_ESCALATION_PURPOSES:    a2aOrchestrator.ESCALATION_PURPOSES,
  A2A_RESPONSE_EXPECTED:      a2aOrchestrator.RESPONSE_EXPECTED_PURPOSES,

  // ── Worktree 隔离治理（T10）────────────────────────────────────────
  registerWorkspace:          isolationGovernance.registerWorkspace,
  updateWorkspaceStatus:      isolationGovernance.updateWorkspaceStatus,
  getWorkspaceByTask:         isolationGovernance.getWorkspaceByTask,
  getWorkspaceByBranch:       isolationGovernance.getWorkspaceByBranch,
  getActiveWorkspaces:        isolationGovernance.getActiveWorkspaces,
  getConflictingWorkspaces:   isolationGovernance.getConflictingWorkspaces,
  preMergeCheck:              isolationGovernance.preMergeCheck,
  WS_CLEANUP_STATUSES:        isolationGovernance.WS_CLEANUP_STATUSES,
  isolationGovernance,
};
