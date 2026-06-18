"use strict";

const assert = require("assert");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  createAndSaveWorkItem,
  createWorkItem,
  detectWorkItemType,
  normalizeType,
} = require("../src/work-items/create-work-item");

function run() {
  testExplicitFeatureCreation();
  testBugDetection();
  testPersistence();
  testInvalidType();
  testStatusDefaults();
  testCliLowConfidenceHint();
  process.stdout.write("work-item-entry tests passed\n");
}

function testExplicitFeatureCreation() {
  const workItem = createWorkItem({
    id: "wi-test-feature",
    now: "2026-06-18T00:00:00.000Z",
    rawRequest: "支持用户录入功能需求",
    type: "feature",
  });

  assert.strictEqual(workItem.id, "wi-test-feature");
  assert.strictEqual(workItem.type, "feature");
  assert.strictEqual(workItem.type_label, "功能需求");
  assert.strictEqual(workItem.status, "needs_clarification");
  assert.strictEqual(workItem.raw_request, "支持用户录入功能需求");
  assert.deepStrictEqual(workItem.tasks, []);
  assert.strictEqual(workItem.review_status, null);
  assert.strictEqual(workItem.quality_status, null);
  assert.strictEqual(workItem.delivery_status, null);
  assert.strictEqual(workItem.retrospective_status, null);
}

function testBugDetection() {
  const detection = detectWorkItemType("保存时出现报错，需要修复");
  assert.strictEqual(detection.type, "bug_fix");
  assert.ok(detection.matched_keywords.includes("报错"));
  assert.strictEqual(normalizeType("Bug 修复"), "bug_fix");
}

function testPersistence() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clowder-t2-"));
  const { workItem, filePath } = createAndSaveWorkItem(
    {
      id: "wi-test-persist",
      now: "2026-06-18T00:00:00.000Z",
      rawRequest: "新增时间线入口",
      type: "功能需求",
    },
    { dataDir: tempDir },
  );

  const saved = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assert.strictEqual(saved.id, workItem.id);
  assert.strictEqual(saved.type, "feature");
  assert.strictEqual(saved.status, "needs_clarification");
}

function testInvalidType() {
  assert.throws(
    () =>
      createWorkItem({
        rawRequest: "some request",
        type: "unknown",
      }),
    /Unknown work item type/,
  );
}

function testStatusDefaults() {
  const workItem = createWorkItem({
    rawRequest: "新增工作项录入入口",
    type: "feature",
  });

  assert.strictEqual(workItem.status, "needs_clarification");
  assert.strictEqual(workItem.review_status, null);
  assert.strictEqual(workItem.quality_status, null);
  assert.strictEqual(workItem.delivery_status, null);
  assert.strictEqual(workItem.retrospective_status, null);
}

function testCliLowConfidenceHint() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clowder-t2-cli-"));
  const result = spawnSync(
    process.execPath,
    [
      path.join(__dirname, "..", "bin", "clowder-work-item.js"),
      "create",
      "--request",
      "请处理这个事项",
      "--data-dir",
      tempDir,
    ],
    {
      encoding: "utf8",
    },
  );

  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /defaulted, low confidence/);
}

run();
