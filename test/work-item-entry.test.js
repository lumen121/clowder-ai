"use strict";

const assert = require("assert");
const { spawnSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const { createPersistence } = require("../src/storage");
const {
  createAndSaveWorkItem,
  createWorkItem,
  detectWorkItemType,
  normalizeType,
} = require("../src/work-items/create-work-item");
const { isPathInside, startServer } = require("../src/server/work-item-page-server");

async function run() {
  testExplicitFeatureCreation();
  testBugDetection();
  testPersistence();
  testInvalidType();
  testStatusDefaults();
  testCliLowConfidenceHint();
  testPageCliHelpDoesNotStartServer();
  testPathBoundaryCheck();
  await testPageApiCreatesWorkItem();
  await testPageApiRejectsEmptyRequest();
  await testConsoleEscalationsApiListsPendingItems();
  await testConsoleEscalationDecisionApiWritesBack();
  process.stdout.write("work-item-entry tests passed\n");
}

function testExplicitFeatureCreation() {
  const workItem = createWorkItem({
    rawRequest: "支持用户录入功能需求",
    type: "feature",
    source: "page",
  }, {
    dataDir: fs.mkdtempSync(path.join(os.tmpdir(), "clowder-t2-service-")),
  });

  assert.match(workItem.id, /^wi-/);
  assert.strictEqual(workItem.type, "feature");
  assert.strictEqual(workItem.status, "needs_clarification");
  assert.strictEqual(workItem.goal, "支持用户录入功能需求");
  assert.strictEqual(workItem.metadata.source, "page");
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
  const { workItem, storage } = createAndSaveWorkItem(
    {
      rawRequest: "新增时间线入口",
      type: "功能需求",
    },
    { dataDir: tempDir },
  );

  const saved = JSON.parse(fs.readFileSync(storage.path, "utf8"));
  assert.strictEqual(saved.length, 1);
  assert.strictEqual(saved[0].id, workItem.id);
  assert.strictEqual(saved[0].type, "feature");
  assert.strictEqual(saved[0].status, "needs_clarification");
  assert.ok(!Object.prototype.hasOwnProperty.call(saved[0], "type_label"));
  assert.strictEqual(path.basename(storage.path), "work-items.json");
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
  }, {
    dataDir: fs.mkdtempSync(path.join(os.tmpdir(), "clowder-t2-status-")),
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
  assert.ok(fs.existsSync(path.join(tempDir, "work-items.json")));
  assert.ok(!fs.existsSync(path.join(tempDir, "work-items")));
}

async function testPageApiCreatesWorkItem() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clowder-t2-page-"));
  const server = startServer({ host: "127.0.0.1", port: 0, dataDir: tempDir });

  try {
    const payload = {
      raw_request: "保存时报错，需要修复",
      type: "auto",
      title: "保存报错",
    };
    const { response, body } = await postJson(server, "/api/work-items", payload);
    assert.strictEqual(response.statusCode, 201);
    const parsed = JSON.parse(body);
    assert.strictEqual(parsed.work_item.type, "bug_fix");
    assert.strictEqual(parsed.work_item.status, "needs_clarification");
    assert.strictEqual(parsed.work_item.metadata.source, "page");
    assert.strictEqual(parsed.work_item.metadata.type_detection.mode, "detected");
    assert.strictEqual(path.basename(parsed.storage.path), "work-items.json");
  } finally {
    server.close();
  }
}

async function testPageApiRejectsEmptyRequest() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clowder-t2-page-invalid-"));
  const server = startServer({ host: "127.0.0.1", port: 0, dataDir: tempDir });

  try {
    const { response, body } = await postJson(server, "/api/work-items", {
      raw_request: "",
      type: "feature",
    });
    assert.strictEqual(response.statusCode, 400);
    const parsed = JSON.parse(body);
    assert.match(parsed.error, /request is required/);
    assert.ok(!fs.existsSync(path.join(tempDir, "work-items.json")));
  } finally {
    server.close();
  }
}

async function testConsoleEscalationsApiListsPendingItems() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clowder-t12-page-list-"));
  const persistence = createPersistence(tempDir);
  const workItem = persistence.createWorkItem({ goal: "Need confirmation", status: "blocked" });
  persistence.createEscalationRecord({
    work_item_id: workItem.id,
    status: "pending_user_confirmation",
    trigger_type: "high_risk_action",
    trigger_rule: "HIGH_RISK_ACTION_REQUIRES_CONFIRMATION",
    what_happened: "Push to master needs confirmation.",
    blocked_gate: "permission",
    options: ["confirm", "reject"],
    risks: "Direct push to master is high-risk.",
    recommended_next_step: "Wait for user decision.",
  });

  const server = startServer({ host: "127.0.0.1", port: 0, dataDir: tempDir });
  try {
    const { response, body } = await requestJson(server, "/api/console/escalations");
    assert.strictEqual(response.statusCode, 200);
    const parsed = JSON.parse(body);
    assert.strictEqual(parsed.escalations.length, 1);
    assert.strictEqual(parsed.escalations[0].work_item_id, workItem.id);
    assert.strictEqual(parsed.escalations[0].status, "pending_user_confirmation");
  } finally {
    server.close();
  }
}

async function testConsoleEscalationDecisionApiWritesBack() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clowder-t12-page-decision-"));
  const persistence = createPersistence(tempDir);
  const workItem = persistence.createWorkItem({ goal: "Need confirmation", status: "blocked" });
  const escalation = persistence.createEscalationRecord({
    work_item_id: workItem.id,
    status: "pending_user_confirmation",
    trigger_type: "high_risk_action",
    trigger_rule: "HIGH_RISK_ACTION_REQUIRES_CONFIRMATION",
    what_happened: "Deploy needs confirmation.",
    blocked_gate: "permission",
    options: ["confirm", "reject"],
    risks: "Deploy is high-risk.",
    recommended_next_step: "Wait for user decision.",
    user_decision: "",
    decision_detail: "",
    decided_by: "",
    decided_at: "",
    next_action_after_decision: "",
  });

  const server = startServer({ host: "127.0.0.1", port: 0, dataDir: tempDir });
  try {
    const { response, body } = await postJson(
      server,
      `/api/console/escalations/${encodeURIComponent(escalation.id)}/decision`,
      {
        decision: "confirm",
        decided_by: "user",
        detail: "可以继续。",
      },
    );
    assert.strictEqual(response.statusCode, 200);
    const parsed = JSON.parse(body);
    assert.strictEqual(parsed.escalation.status, "confirmed");
    assert.strictEqual(parsed.escalation.user_decision, "confirm");

    const savedEscalations = JSON.parse(
      fs.readFileSync(path.join(tempDir, "escalation-records.json"), "utf8")
    );
    const saved = savedEscalations.find((item) => item.id === escalation.id);
    assert.strictEqual(saved.user_decision, "confirm");

    const savedA2AEvents = JSON.parse(
      fs.readFileSync(path.join(tempDir, "a2a-events.json"), "utf8")
    );
    assert.ok(savedA2AEvents.some((item) =>
      item.work_item_id === workItem.id &&
      item.context.includes("escalation_user_decision")
    ));
  } finally {
    server.close();
  }
}

function testPageCliHelpDoesNotStartServer() {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "..", "bin", "clowder-page.js"), "--help"],
    { encoding: "utf8", timeout: 2000 },
  );

  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /Usage:/);
}

function testPathBoundaryCheck() {
  assert.strictEqual(isPathInside("C:\\repo\\public", "C:\\repo\\public\\app.js"), true);
  assert.strictEqual(isPathInside("C:\\repo\\public", "C:\\repo\\public\\..\\secret.txt"), false);

  if (process.platform === "win32") {
    assert.strictEqual(isPathInside("C:\\Repo\\Public", "c:\\repo\\public\\app.js"), true);
  }
}

function postJson(server, requestPath, payload) {
  return new Promise((resolve, reject) => {
    const send = () => {
      const { port } = server.address();
      const json = JSON.stringify(payload);
      const request = http.request(
        {
          host: "127.0.0.1",
          port,
          path: requestPath,
          method: "POST",
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(json),
          },
        },
        (response) => {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            body += chunk;
          });
          response.on("end", () => {
            resolve({ response, body });
          });
        },
      );
      request.on("error", reject);
      request.end(json);
    };
    if (server.listening) {
      send();
    } else {
      server.once("listening", send);
    }
    server.on("error", reject);
  });
}

function requestJson(server, requestPath) {
  return new Promise((resolve, reject) => {
    const send = () => {
      const { port } = server.address();
      const request = http.request(
        {
          host: "127.0.0.1",
          port,
          path: requestPath,
          method: "GET",
        },
        (response) => {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            body += chunk;
          });
          response.on("end", () => {
            resolve({ response, body });
          });
        },
      );
      request.on("error", reject);
      request.end();
    };
    if (server.listening) {
      send();
    } else {
      server.once("listening", send);
    }
    server.on("error", reject);
  });
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
