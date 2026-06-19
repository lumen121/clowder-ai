#!/usr/bin/env node
/**
 * __verify.js — T3 持久化模块验证脚本
 *
 * 使用 createPersistence() 注入测试 dataDir，所有模型创建均通过
 * 与生产环境完全相同的工厂函数，避免内联重复逻辑。
 *
 * 验证:
 *  1. Store 基础 CRUD（原子写入、重启持久化、过滤、计数）
 *  2. 8 个模型工厂（默认值填充、必填校验、枚举校验）
 *  3. 业务规则（防自审、非法类型拦截）
 *  4. UTF-8 中文读写
 *  5. 文件落盘
 *
 * 用法: node src/storage/__verify.js
 */

const fs = require("fs");
const path = require("path");
const { createPersistence } = require("./index");

const TEST_DIR = path.join(__dirname, "..", "..", "data", "__verify_test__");

let passed = 0;
let failed = 0;

function check(desc, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error(`  FAIL [${desc}]: ${err.message}`);
  }
}

function cleanup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

// ── 准备 ──────────────────────────────────────────────────────────────
cleanup();

const {
  workItemStore, taskStore, a2aEventStore, reviewRecordStore,
  qualityGateRunStore, workspaceRecordStore, escalationRecordStore,
  retrospectiveMemoryStore,
  createWorkItem, createTask, createA2AEvent, createReviewRecord,
  createQualityGateRun, createWorkspaceRecord, createEscalationRecord,
  createRetrospectiveMemory,
} = createPersistence(TEST_DIR);

console.log("T3 持久化模块验证（生产工厂）\n");

// ═══════════════════════════════════════════════════════════════════════
// 1. Store 基础 CRUD
// ═══════════════════════════════════════════════════════════════════════
console.log("── Store 基础 CRUD ──");

const testStore = workItemStore;

const created = testStore.create({ name: "alpha", value: 1 });
check("create 返回含 id 的记录", () => {
  if (!created.id || !created.id.startsWith("wi-")) throw new Error("id 缺失或格式错误");
  if (!created.created_at) throw new Error("created_at 缺失");
});

check("read 可读取已创建记录", () => {
  const r = testStore.read(created.id);
  if (!r || r.name !== "alpha") throw new Error("读取失败");
});

check("update 部分更新", () => {
  const u = testStore.update(created.id, { value: 99 });
  if (u.value !== 99) throw new Error("更新失败");
  if (u.name !== "alpha") throw new Error("未更新字段被覆盖");
});

check("update 不改变 id 和 created_at", () => {
  const u = testStore.update(created.id, { value: 100 });
  if (u.id !== created.id) throw new Error("id 被修改");
  if (u.created_at !== created.created_at) throw new Error("created_at 被修改");
});

check("list 返回全部记录", () => {
  testStore.create({ name: "beta", value: 2 });
  if (testStore.list().length !== 2) throw new Error("数量错误");
});

check("list 支持过滤", () => {
  const filtered = testStore.list((r) => r.value >= 100);
  if (filtered.length !== 1) throw new Error("过滤结果错误");
});

check("count 返回正确数量", () => {
  if (testStore.count() !== 2) throw new Error("数量错误");
});

check("delete 删除记录", () => {
  const beta = testStore.list((r) => r.name === "beta")[0];
  testStore.delete(beta.id);
  if (testStore.count() !== 1) throw new Error("删除失败");
});

// ── 可变引用隔离回归测试（Codex Review 阻塞项）────────────────────
check("read() 返回深拷贝，外部修改不污染缓存", () => {
  const record = testStore.create({ name: "mutable-test", value: 1 });
  const copy1 = testStore.read(record.id);
  copy1.value = 999;
  copy1.name = "mutated";
  const copy2 = testStore.read(record.id);
  if (copy2.value !== 1) throw new Error(`value 被外部修改污染: ${copy2.value}`);
  if (copy2.name !== "mutable-test") throw new Error(`name 被外部修改污染: "${copy2.name}"`);
});

check("read() 修改后触发 save 不持久化外部变更", () => {
  const record = testStore.create({ name: "save-isolation", status: "clean" });
  const leaked = testStore.read(record.id);
  leaked.status = "hacked";
  // 触发一次无关的 save
  testStore.update(testStore.list()[0].id, { _touch: Date.now() });
  const reRead = testStore.read(record.id);
  if (reRead.status !== "clean") throw new Error(`外部修改被意外持久化: status=${reRead.status}`);
});

check("list() 返回深拷贝，外部修改不污染缓存", () => {
  const results = testStore.list((r) => r.name === "save-isolation");
  results[0].status = "hacked-via-list";
  const reRead = testStore.read(results[0].id);
  if (reRead.status !== "clean") throw new Error(`list 返回引用被外部修改污染: status=${reRead.status}`);
});

check("list(filterFn) 回调入参为深拷贝，回调内修改不污染缓存", () => {
  const record = testStore.create({ name: "filter-isolation", status: "clean" });
  testStore.list((item) => {
    if (item.name === "filter-isolation") item.status = "hacked-in-filter";
    return false;  // 不选入结果，但修改仍不应留在缓存
  });
  testStore.update(testStore.list()[0].id, { _touch: Date.now() });
  const reRead = testStore.read(record.id);
  if (reRead.status !== "clean") throw new Error(`filter 回调修改被持久化: status=${reRead.status}`);
});

check("create() 输入为深拷贝，创建后修改原始 input 不污染缓存", () => {
  const nested = { tags: ["original"] };
  const input = { name: "input-isolation", nested };
  const record = testStore.create(input);
  input.name = "mutated-input";
  nested.tags.push("hacked");
  testStore.update(testStore.list()[0].id, { _touch: Date.now() });
  const reRead = testStore.read(record.id);
  if (reRead.name !== "input-isolation") throw new Error(`input 顶层被污染: name=${reRead.name}`);
  if (reRead.nested.tags.includes("hacked")) throw new Error(`input 嵌套被污染: tags=${JSON.stringify(reRead.nested.tags)}`);
});

check("update() patch 为深拷贝，更新后修改原始 patch 不污染缓存", () => {
  const record = testStore.create({ name: "patch-isolation", items: ["a"] });
  const patch = { items: ["b"] };
  testStore.update(record.id, patch);
  patch.items.push("hacked-after-update");
  testStore.update(testStore.list()[0].id, { _touch: Date.now() });
  const reRead = testStore.read(record.id);
  if (reRead.items.includes("hacked-after-update")) throw new Error(`patch 修改被持久化: items=${JSON.stringify(reRead.items)}`);
});

check("update 不存在的 id 返回 null", () => {
  if (testStore.update("nonexistent", {}) !== null) throw new Error("应返回 null");
});

check("read 不存在返回 undefined", () => {
  if (testStore.read("nonexistent") !== undefined) throw new Error("应返回 undefined");
});

// ═══════════════════════════════════════════════════════════════════════
// 2. 重启持久化
// ═══════════════════════════════════════════════════════════════════════
console.log("\n── 重启持久化 ──");

const alpha = testStore.list((r) => r.name === "alpha")[0];
testStore._invalidate();
check("缓存失效后仍可读取（磁盘持久化）", () => {
  const r = testStore.read(alpha.id);
  if (!r || r.name !== "alpha") throw new Error("持久化失败");
});

// ═══════════════════════════════════════════════════════════════════════
// 3. WorkItem（生产工厂）
// ═══════════════════════════════════════════════════════════════════════
console.log("\n── WorkItem ──");

const wi1 = createWorkItem({ goal: "实现用户登录功能", type: "feature" });
check("WorkItem 创建成功并填充默认值", () => {
  if (wi1.status !== "needs_clarification") throw new Error("默认状态错误");
  if (wi1.type !== "feature") throw new Error("类型错误");
  if (!Array.isArray(wi1.tasks)) throw new Error("tasks 应为数组");
  if (wi1.review_status !== null) throw new Error("review_status 应为 null");
});

check("WorkItem 支持 bug_fix 类型（与 T2 对齐）", () => {
  const bugWi = createWorkItem({ goal: "修复登录超时", type: "bug_fix" });
  if (bugWi.type !== "bug_fix") throw new Error("bug_fix 类型未生效");
});

check("WorkItem 拒绝旧值 bug（T2/T3 对齐后废弃）", () => {
  try { createWorkItem({ goal: "x", type: "bug" }); throw new Error("未抛出"); }
  catch (e) { if (!e.message.includes("无效")) throw e; }
});

check("WorkItem 缺少 goal 抛出错误", () => {
  try { createWorkItem({ type: "feature" }); throw new Error("未抛出"); }
  catch (e) { if (!e.message.includes("goal")) throw e; }
});

check("WorkItem 非法类型抛出错误", () => {
  try { createWorkItem({ goal: "x", type: "invalid" }); throw new Error("未抛出"); }
  catch (e) { if (!e.message.includes("无效")) throw e; }
});

// ═══════════════════════════════════════════════════════════════════════
// 4. Task（生产工厂）
// ═══════════════════════════════════════════════════════════════════════
console.log("\n── Task ──");

const task1 = createTask({
  work_item_id: wi1.id, owner_agent: "claude",
  boundary: "仅 auth 模块",
});
check("Task 创建成功", () => {
  if (task1.owner_agent !== "claude") throw new Error("owner 错误");
  if (task1.status !== "pending") throw new Error("默认状态错误");
});

check("Task 缺少必填字段抛出错误", () => {
  try { createTask({}); throw new Error("未抛出"); }
  catch (e) { if (!e.message.includes("缺少")) throw e; }
});

// ═══════════════════════════════════════════════════════════════════════
// 5. A2AEvent（生产工厂）
// ═══════════════════════════════════════════════════════════════════════
console.log("\n── A2AEvent ──");

const a2a1 = createA2AEvent({
  from_agent: "claude", to_agent: "codex", work_item_id: wi1.id,
  purpose: "solution_question",
  claim_or_request: "auth 方案是否考虑了 token 刷新？",
});
check("A2AEvent 创建成功", () => {
  if (a2a1.from_agent !== "claude") throw new Error("from 错误");
  if (a2a1.purpose !== "solution_question") throw new Error("purpose 错误");
});

// ═══════════════════════════════════════════════════════════════════════
// 6. ReviewRecord + 防自审（生产工厂）
// ═══════════════════════════════════════════════════════════════════════
console.log("\n── ReviewRecord ──");

const rev1 = createReviewRecord({
  work_item_id: wi1.id, author_agent: "codex", reviewer_agent: "claude",
  scope: "auth 模块实现", result: "approved",
});
check("ReviewRecord 创建成功", () => {
  if (rev1.result !== "approved") throw new Error("result 错误");
});

check("ReviewRecord 拦截作者自审", () => {
  try {
    createReviewRecord({
      work_item_id: wi1.id, author_agent: "codex", reviewer_agent: "codex",
    });
    throw new Error("未抛出");
  } catch (e) {
    if (!e.message.includes("作者不能自审")) throw e;
  }
});

check("ReviewRecord 缺少必填字段抛出错误", () => {
  try { createReviewRecord({ work_item_id: "x" }); throw new Error("未抛出"); }
  catch (e) { if (!e.message.includes("缺少")) throw e; }
});

// ═══════════════════════════════════════════════════════════════════════
// 7. QualityGateRun（生产工厂）
// ═══════════════════════════════════════════════════════════════════════
console.log("\n── QualityGateRun ──");

const qg1 = createQualityGateRun({
  work_item_id: wi1.id, gate_name: "node-check",
  validation_method: "node --check", result: "ok", final_status: "passed",
});
check("QualityGateRun 创建成功", () => {
  if (qg1.final_status !== "passed") throw new Error("final_status 错误");
});

// ═══════════════════════════════════════════════════════════════════════
// 8. WorkspaceRecord（生产工厂）
// ═══════════════════════════════════════════════════════════════════════
console.log("\n── WorkspaceRecord ──");

const ws1 = createWorkspaceRecord({
  agent: "claude", task_id: task1.id,
  branch: "feature/wi-001/task-001-claude",
  worktree_path: "/tmp/clowder-ai-wi-001-task-001-claude",
});
check("WorkspaceRecord 创建成功", () => {
  if (ws1.agent !== "claude") throw new Error("agent 错误");
  if (ws1.conflict_status !== "clean") throw new Error("conflict_status 错误");
});

// ═══════════════════════════════════════════════════════════════════════
// 9. EscalationRecord（生产工厂）
// ═══════════════════════════════════════════════════════════════════════
console.log("\n── EscalationRecord ──");

const esc1 = createEscalationRecord({
  work_item_id: wi1.id, what_happened: "node --check 连续 3 次失败",
  trigger_rule: "质量门禁持续失败", blocked_gate: "quality_gate",
  options: ["人工修复", "跳过门禁"],
  risks: "跳过门禁可能导致语法错误进入交付",
  recommended_next_step: "人工修复后重新运行检查",
});
check("EscalationRecord 创建成功", () => {
  if (!esc1.options.includes("人工修复")) throw new Error("options 错误");
});

// ═══════════════════════════════════════════════════════════════════════
// 10. RetrospectiveMemory（生产工厂）
// ═══════════════════════════════════════════════════════════════════════
console.log("\n── RetrospectiveMemory ──");

const retro1 = createRetrospectiveMemory({
  work_item_id: wi1.id,
  effective_patterns: ["方案先行避免了返工"],
  review_findings: ["auth token 刷新逻辑需要补充测试"],
  process_improvement_suggestions: ["Review 前先运行 node --check"],
});
check("RetrospectiveMemory 创建成功", () => {
  if (!retro1.effective_patterns.includes("方案先行避免了返工")) throw new Error("patterns 错误");
});

// ═══════════════════════════════════════════════════════════════════════
// 11. UTF-8 中文读写（生产工厂）
// ═══════════════════════════════════════════════════════════════════════
console.log("\n── UTF-8 中文读写 ──");

const zhWi = createWorkItem({
  goal: "Clowder AI 是一个本机运行、单用户、三 Agent 敏捷协作聊天室",
  type: "feature",
});
workItemStore._invalidate();
check("中文内容持久化后重读一致", () => {
  const r = workItemStore.read(zhWi.id);
  if (!r.goal.includes("Clowder AI")) throw new Error("中文内容损坏");
});

// ═══════════════════════════════════════════════════════════════════════
// 12. 文件落盘验证
// ═══════════════════════════════════════════════════════════════════════
console.log("\n── 文件落盘验证 ──");

check("测试 data 目录存在", () => {
  if (!fs.existsSync(TEST_DIR)) throw new Error("测试目录不存在");
});

const jsonFiles = [
  "work-items", "tasks", "a2a-events", "review-records",
  "quality-gate-runs", "workspace-records", "escalation-records",
  "retrospective-memories",
];
for (const name of jsonFiles) {
  check(`${name}.json 已生成`, () => {
    const fp = path.join(TEST_DIR, `${name}.json`);
    if (!fs.existsSync(fp)) throw new Error("文件不存在");
    const raw = fs.readFileSync(fp, "utf-8");
    JSON.parse(raw);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// 清理与结果
// ═══════════════════════════════════════════════════════════════════════
cleanup();

console.log(`\n${"═".repeat(50)}`);
console.log(`结果: ${passed} 通过, ${failed} 失败, ${passed + failed} 总计`);
console.log(`${"═".repeat(50)}`);

if (failed > 0) {
  process.exit(1);
}
