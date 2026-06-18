"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const WORK_ITEM_TYPES = Object.freeze({
  feature: {
    value: "feature",
    label: "功能需求",
    aliases: ["feature", "功能需求", "需求", "功能", "feat"],
    keywords: [
      "add",
      "build",
      "create",
      "feature",
      "implement",
      "support",
      "新增",
      "创建",
      "实现",
      "支持",
      "功能",
    ],
  },
  bug_fix: {
    value: "bug_fix",
    label: "Bug 修复",
    aliases: ["bug", "bug_fix", "fix", "bug修复", "Bug 修复", "修复", "缺陷"],
    keywords: [
      "bug",
      "crash",
      "error",
      "fail",
      "fix",
      "issue",
      "broken",
      "报错",
      "错误",
      "失败",
      "崩溃",
      "异常",
      "修复",
      "缺陷",
    ],
  },
});

const INITIAL_STATUS = "needs_clarification";
const DEFAULT_DATA_DIR = path.join(process.cwd(), "data", "work-items");

function normalizeType(type) {
  if (!type) {
    return null;
  }

  const normalized = String(type).trim().toLowerCase();
  for (const definition of Object.values(WORK_ITEM_TYPES)) {
    if (definition.aliases.some((alias) => alias.toLowerCase() === normalized)) {
      return definition.value;
    }
  }

  return null;
}

function detectWorkItemType(rawRequest) {
  const text = String(rawRequest || "").toLowerCase();
  const matched = {};

  for (const definition of Object.values(WORK_ITEM_TYPES)) {
    matched[definition.value] = definition.keywords.filter((keyword) =>
      text.includes(keyword.toLowerCase()),
    );
  }

  const bugScore = matched.bug_fix.length;
  const featureScore = matched.feature.length;

  if (bugScore > featureScore) {
    return {
      type: "bug_fix",
      mode: "detected",
      confidence: bugScore >= 2 ? "medium" : "low",
      matched_keywords: matched.bug_fix,
    };
  }

  if (featureScore > 0) {
    return {
      type: "feature",
      mode: "detected",
      confidence: featureScore >= 2 ? "medium" : "low",
      matched_keywords: matched.feature,
    };
  }

  return {
    type: "feature",
    mode: "defaulted",
    confidence: "low",
    matched_keywords: [],
  };
}

function resolveWorkItemType({ explicitType, rawRequest }) {
  const normalized = normalizeType(explicitType);
  if (explicitType && !normalized) {
    throw new Error(`Unknown work item type: ${explicitType}`);
  }

  if (normalized) {
    return {
      type: normalized,
      mode: "selected",
      confidence: "high",
      matched_keywords: [],
    };
  }

  return detectWorkItemType(rawRequest);
}

function createWorkItem(input) {
  const rawRequest = String(input.rawRequest || "").trim();
  if (!rawRequest) {
    throw new Error("Work item request is required.");
  }

  const now = input.now || new Date().toISOString();
  const typeDetection = resolveWorkItemType({
    explicitType: input.type,
    rawRequest,
  });
  const typeDefinition = WORK_ITEM_TYPES[typeDetection.type];
  const title = String(input.title || "").trim() || rawRequest.split(/\r?\n/)[0].slice(0, 80);
  const id = input.id || buildWorkItemId(now);

  return {
    id,
    type: typeDefinition.value,
    type_label: typeDefinition.label,
    title,
    raw_request: rawRequest,
    status: INITIAL_STATUS,
    assumptions: [],
    ambiguities: [],
    risks: [],
    solution: null,
    tasks: [],
    disagreements: [],
    escalations: [],
    review_status: null,
    quality_status: null,
    delivery_status: null,
    retrospective_status: null,
    created_at: now,
    updated_at: now,
    source: input.source || "cli",
    metadata: {
      schema_version: 1,
      type_detection: typeDetection,
    },
  };
}

function saveWorkItem(workItem, options = {}) {
  const dataDir = options.dataDir || DEFAULT_DATA_DIR;
  fs.mkdirSync(dataDir, { recursive: true });

  const filename = `${safeFilename(workItem.id)}.json`;
  const filePath = path.join(dataDir, filename);
  fs.writeFileSync(filePath, `${JSON.stringify(workItem, null, 2)}\n`, "utf8");

  return filePath;
}

function createAndSaveWorkItem(input, options = {}) {
  const workItem = createWorkItem(input);
  const filePath = saveWorkItem(workItem, options);
  return { workItem, filePath };
}

function buildWorkItemId(isoTimestamp) {
  const stamp = isoTimestamp.replace(/[-:.]/g, "").replace("T", "-").replace("Z", "Z");
  return `wi-${stamp}-${crypto.randomUUID().slice(0, 8)}`;
}

function safeFilename(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, "_");
}

module.exports = {
  DEFAULT_DATA_DIR,
  INITIAL_STATUS,
  WORK_ITEM_TYPES,
  createAndSaveWorkItem,
  createWorkItem,
  detectWorkItemType,
  normalizeType,
  saveWorkItem,
};
