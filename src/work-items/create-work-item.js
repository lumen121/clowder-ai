"use strict";

const path = require("path");

const storage = require("../storage");

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
const DEFAULT_DATA_DIR = path.join(process.cwd(), "data");

function normalizeType(type) {
  if (!type || type === "auto") {
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
  if (explicitType && explicitType !== "auto" && !normalized) {
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

function buildWorkItemInput(input = {}) {
  const rawRequest = String(input.rawRequest || input.raw_request || "").trim();
  if (!rawRequest) {
    throw new Error("Work item request is required.");
  }

  const typeDetection = resolveWorkItemType({
    explicitType: input.type,
    rawRequest,
  });
  const typeDefinition = WORK_ITEM_TYPES[typeDetection.type];
  const title = String(input.title || "").trim() || rawRequest.split(/\r?\n/)[0].slice(0, 80);
  const source = input.source || "internal";

  return {
    type: typeDefinition.value,
    status: INITIAL_STATUS,
    goal: rawRequest,
    title,
    metadata: {
      schema_version: 1,
      source,
      type_detection: typeDetection,
    },
  };
}

function createWorkItem(input = {}, options = {}) {
  const persistence = resolvePersistence(options);
  const workItemInput = buildWorkItemInput(input);
  return persistence.createWorkItem(workItemInput);
}

function createAndSaveWorkItem(input = {}, options = {}) {
  const workItem = createWorkItem(input, options);
  return {
    workItem,
    storage: {
      kind: "t3_work_item_store",
      path: path.join(options.dataDir || DEFAULT_DATA_DIR, "work-items.json"),
    },
  };
}

function resolvePersistence(options = {}) {
  if (options.persistence) {
    return options.persistence;
  }

  if (options.dataDir) {
    return storage.createPersistence(options.dataDir);
  }

  return storage;
}

module.exports = {
  DEFAULT_DATA_DIR,
  INITIAL_STATUS,
  WORK_ITEM_TYPES,
  buildWorkItemInput,
  createAndSaveWorkItem,
  createWorkItem,
  detectWorkItemType,
  normalizeType,
};
