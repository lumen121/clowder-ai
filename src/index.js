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
const stateMachine = require("./work-items/state-machine");

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

  // ── 状态机（T5）───────────────────────────────────────────────────
  WORK_ITEM_TRANSITIONS:     stateMachine.TRANSITIONS,
  WORK_ITEM_STATUSES:        stateMachine.WORK_ITEM_STATUSES,
  transitionWorkItem:        stateMachine.transitionWorkItem,
  validateTransition:        stateMachine.transition,
  canTransitionWorkItem:     stateMachine.canTransition,
  isWorkItemTerminal:        stateMachine.isTerminal,
  isWorkItemBlocked:         stateMachine.isBlocked,

  // ── 底层模块引用（高级用法）─────────────────────────────────────
  stateMachine,
};
