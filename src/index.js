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
const harnessCoreRails = require("./harness/core-rails");
const escalationFlow = require("./escalations/escalation-flow");
const isolationGovernance = require("./worktree/isolation-governance");
const reviewQuality = require("./review-quality");
const gitDelivery = require("./git-delivery/delivery-safety");
const retrospective = require("./retrospective");

module.exports = {
  // ── Store 实例（底层 CRUD：read / update / delete / list / count）──
  workItemStore:            storage.workItemStore,
  taskStore:                storage.taskStore,
  a2aEventStore:            storage.a2aEventStore,
  reviewRecordStore:        storage.reviewRecordStore,
  qualityGateRunStore:      storage.qualityGateRunStore,
  workspaceRecordStore:     storage.workspaceRecordStore,
  deliveryRecordStore:      storage.deliveryRecordStore,
  escalationRecordStore:    storage.escalationRecordStore,
  retrospectiveMemoryStore: storage.retrospectiveMemoryStore,

  // ── 模型工厂（校验 + 默认值 + 创建）──────────────────────────────
  createWorkItem:            storage.createWorkItem,
  createTask:                storage.createTask,
  createA2AEvent:            storage.createA2AEvent,
  createReviewRecord:        storage.createReviewRecord,
  createQualityGateRun:      storage.createQualityGateRun,
  createWorkspaceRecord:     storage.createWorkspaceRecord,
  createDeliveryRecord:      storage.createDeliveryRecord,
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
  DELIVERY_ACTIONS:          storage.DELIVERY_ACTIONS,
  DELIVERY_RESULTS:          storage.DELIVERY_RESULTS,
  PUSH_STATUSES:             storage.PUSH_STATUSES,

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

  // ── Harness 核心护栏（T8）────────────────────────────────────────
  evaluateHarnessRails:       harnessCoreRails.evaluateHarnessRails,
  evaluateHighRiskAction:     harnessCoreRails.evaluateHighRiskAction,
  guardedTransitionWorkItem:  harnessCoreRails.guardedTransitionWorkItem,
  harnessCoreRails,

  // ── 人工升级与页面确认（T12）─────────────────────────────────────────
  createEscalationFromHarnessDecision: escalationFlow.createEscalationFromHarnessDecision,
  createEscalationForHarnessBlock:     escalationFlow.createEscalationForHarnessBlock,
  createEscalationForHighRiskAction:   escalationFlow.createEscalationForHighRiskAction,
  listPendingEscalations:              escalationFlow.listPendingEscalations,
  getEscalation:                       escalationFlow.getEscalation,
  recordUserEscalationDecision:        escalationFlow.recordUserEscalationDecision,
  formatEscalationForPage:             escalationFlow.formatForPage,
  ESCALATION_STATUSES:                 escalationFlow.ESCALATION_STATUSES,
  USER_ESCALATION_DECISIONS:           escalationFlow.USER_DECISIONS,
  escalationFlow,

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

  // ── Review 与质量门禁记录（T9）────────────────────────────────────
  validateReviewResult:       reviewQuality.validateReviewResult,
  validateFinalStatus:        reviewQuality.validateFinalStatus,
  validateNoSelfReview:       reviewQuality.validateNoSelfReview,
  createReview:               reviewQuality.createReview,
  updateReview:               reviewQuality.updateReview,
  resolveReview:              reviewQuality.resolveReview,
  queryReviews:               reviewQuality.queryReviews,
  summarizeReviews:           reviewQuality.summarizeReviews,
  createQualityGate:          reviewQuality.createQualityGate,
  updateQualityGate:          reviewQuality.updateQualityGate,
  recordGateFailure:          reviewQuality.recordGateFailure,
  queryQualityGates:          reviewQuality.queryQualityGates,
  summarizeQualityGates:      reviewQuality.summarizeQualityGates,
  reviewQuality,

  // ── Git 交付安全流程（T11）──────────────────────────────────────
  evaluateDeliveryReadiness: gitDelivery.evaluateDeliveryReadiness,
  recordDeliveryCheck:       gitDelivery.recordDeliveryCheck,
  recordFeaturePushResult:   gitDelivery.recordFeaturePushResult,
  getDeliveryRecords:        gitDelivery.getDeliveryRecords,
  summarizeDelivery:         gitDelivery.summarizeDelivery,
  expectedGitIdentity:       gitDelivery.expectedGitIdentity,
  isMainBranch:              gitDelivery.isMainBranch,
  gitDelivery,

  // ── 复盘记录（T14）────────────────────────────────────────────────
  aggregateFacts:            retrospective.aggregateFacts,
  generateRetrospective:     retrospective.generateRetrospective,
  updateRetrospective:       retrospective.updateRetrospective,
  queryRetrospectives:       retrospective.queryRetrospectives,
  summarizeRetrospective:    retrospective.summarizeRetrospective,
  retrospective,
};
