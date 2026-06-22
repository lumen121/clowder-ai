# T13F + T16 非作者 Review 报告（Claude）

> 状态：Review 完成
> 所属：执行
> 规则效力：Review 结论与发现记录
> Review 方：Claude
> 被 Review 对象：T13F 功能骨架（Codex） + T16 端到端验证（Codex）
> 日期：2026-06-22

## 1. Review 范围

| 维度 | 覆盖内容 |
| --- | --- |
| T13F | `src/server/user-participation-view.js`、`user-participation-view.verify.js`、`public/console.html`、`console.js`、`styles.css`、`work-item-page-server.js`（修改部分） |
| T16 | `src/e2e/t16-e2e-validation.verify.js`、E2E 成功/失败路径构造与页面 API 验证 |
| 回归 | 所有已有 verify 套件、npm check、npm test |

## 2. 验证执行

| 命令 | 结果 |
| --- | --- |
| `npm run verify:e2e` | 15 passed, 0 failed |
| `npm run verify:page` | 10 passed, 0 failed |
| `npm run check` | checked 44 JavaScript files |
| `npm test` | work-item-entry + agent-cli-adapter passed |
| `npm run verify:harness` | 22/22 |
| `npm run verify:delivery` | 17/17 |
| `npm run verify:escalations` | 10/10 |

**零回归。** 全部已有验证套件通过。

## 3. T13F 逐项评估

### 3.1 正确性

| 检查项 | 结论 |
| --- | --- |
| 页面投影聚合 8 类 Store（WorkItem/Task/A2A/Review/Gate/Escalation/Delivery/Retrospective） | ✓ 通过 |
| 委托 T9 `summarizeReviews`/`summarizeQualityGates` 和 T14 `summarizeRetrospective` | ✓ 通过 |
| 统一时间线覆盖 8 类事件（work_item/task/a2a/review/quality_gate/escalation/delivery/retrospective） | ✓ 通过 |
| 待确认升级项分离（pending_confirmations vs confirmations） | ✓ 通过 |
| MiniMax 降级标记显式注入 `product_baseline` 和每个 WorkItem 视图 | ✓ 通过 |
| `safeRetrospectiveSummary` 防御性 try/catch | ✓ 通过 |
| Review findings string/object 双形态兼容（`summarizeFindings`） | ✓ 通过 |

### 3.2 架构边界

| 检查项 | 结论 |
| --- | --- |
| 页面投影层只读不写 | ✓ 通过 |
| 未新增 Store 类型 | ✓ 通过 |
| 未修改 T9/T12/T14 模块 | ✓ 通过 |
| 未把 T13F 声明为完整 T13 | ✓ 通过 — `product_baseline` 明确标注 `minimax_experience_review: "not_completed"` 和 `downgrade_notice: "A7 remains open"` |
| 未关闭 A7 | ✓ 通过 |

### 3.3 可读性与维护性

| 检查项 | 结论 |
| --- | --- |
| 函数命名清晰（buildTimeline/findLatestKeyConclusion/safeRetrospectiveSummary） | ✓ |
| 中英文注释合理 | ✓ |
| 视图格式化函数（formatTask/formatEscalation/summarizeFindings）职责单一 | ✓ |
| HTML 语义化标签（nav/main/section/aside/article/dl） | ✓ |

### 3.4 页面交互

| 检查项 | 结论 |
| --- | --- |
| 工作项创建 → 自动选中 → 刷新列表 | ✓（见 console.js submitCreateWorkItem） |
| 工作项列表点击切换 → URL 参数更新 | ✓（data-work-item-id 委托点击事件） |
| 升级确认表单 → T12 API 写回 | ✓（submitDecision） |
| 补充信息表单 → A2AEvent 记录 | ✓（submitUserInput） |
| 移动端 390px 无横向溢出 | ✓（结果文档声明，styles.css 响应式规则确认） |

## 4. T16 逐项评估

### 4.1 成功路径（15 条验证中的 8 条）

| 步骤 | 验证点 | 结论 |
| --- | --- | --- |
| 页面 API 创建 WorkItem | `source: "page"`、statusCode 201 | ✓ |
| T7 方案与任务拆解 | Task 创建、A2A 事件关联 | ✓ |
| T5 状态推进 → `in_development` → `pending_review` | transitionWorkItem 成功 | ✓ |
| T6 A2A 执行同步 | `execution_sync` 事件写入 | ✓ |
| T9 Review 通过 | `result: "approved"` | ✓ |
| T9 质量门禁通过 | `final_status: "passed"` | ✓ |
| T11 交付检查通过 → push succeeded | `delivery.decision.allowed: true` | ✓ |
| T5 → `completed` → T14 复盘生成 | retrospective 结论包含"成功路径" | ✓ |
| 页面 API 可见 | `review_summary.approved: 1`、`quality_gate_summary.passed: 1`、timeline kinds 完整 | ✓ |

### 4.2 失败路径（15 条验证中的 7 条）

| 步骤 | 验证点 | 结论 |
| --- | --- | --- |
| 页面 API 创建 Bug Fix WorkItem | `type: "bug_fix"` | ✓ |
| T9 Review 通过 | 正确 — 失败在门禁而非 Review | ✓ |
| QualityGateRun 失败 | `final_status: "failed"` | ✓ |
| T11 交付检查被 `QUALITY_GATE_NOT_PASSED` 阻断 | `delivery.decision.allowed: false`、blocker code 匹配 | ✓ |
| T12 升级记录创建 | escalation 写入 | ✓ |
| 用户写回 `request_info` | `user_decision` 正确 | ✓ |
| T5 → `blocked` | status 正确 | ✓ |
| T14 复盘生成 | 失败路径 conclusion 正确 | ✓ |
| 页面 API 可见阻断 | `quality_gate_summary.failed: 1`、`confirmations[0].user_decision: "request_info"` | ✓ |

### 4.3 E2E 测试设计质量

| 检查项 | 结论 |
| --- | --- |
| 真实 HTTP 服务器（动态端口） | ✓ |
| 页面 API 创建 → 内存操作 → 页面 API 读取（真正端到端） | ✓ |
| 临时数据目录隔离（`fs.mkdtempSync`） | ✓ |
| 成功路径和失败路径在同一个测试中串联 | ✓ |
| 未伪造 Agent 调用、Review、门禁或复盘结果 | ✓ |
| MiniMax 降级风险显式验证（`minimax_experience_review: "not_completed"`） | ✓ |

## 5. 发现与建议

### 观察 1（P2）：`task.metadata?.title` 依赖 T7 特定字段

`formatTask()` 使用 `task.metadata && task.metadata.title ? task.metadata.title : task.id` 作为标题。`metadata` 不在 T3 Task 默认字段中，仅由 T7 `recordSolutionAndTaskBreakdown` 写入。通过 `createTask` 直接创建的任务将显示 ID。

**影响**：非 T7 创建的任务在页面显示 ID 而非可读标题。对功能骨架可接受，后续可统一 Task 标题字段。

**建议**：未来迭代考虑在 Task 默认字段中加入 `title`，或在 `formatTask` 中增加 fallback 到 `task.boundary`。

### 观察 2（P2）：`buildWorkItemSummary` 对每个工作项调用完整 `buildWorkItemView`

工作项列表渲染时，每个工作项触发一次完整的 8 类 Store 扫描和页面投影构建。

**影响**：当前数据量下无实际影响。未来工作项数量增长时，列表加载延迟会增加。

**建议**：后续可考虑轻量级 `buildWorkItemSummary`（仅读取 WorkItem 本身 + `findLatestKeyConclusion`），或引入内存缓存。

### 观察 3（P2）：`findLatestKeyConclusion` 使用时间排序

同 T13 早期 Review 中的观察（[62-t13-review-by-claude.md]）：最新关键结论按时间戳而非来源优先级选择。这意味着较早的复盘结论可能被更晚的其他事件覆盖。

**影响**：在复盘结论已形成后，后续的 A2A 事件可能覆盖复盘结论作为"最新关键结论"。对大多数场景影响不大，因为复盘通常是最后一个事件。

**建议**：可考虑复盘来源（`retrospective`）具有最高优先级，在时间相同时优先选择。

### 观察 4（P3）：E2E 测试中 `createEscalationForHarnessBlock` 的 harnessContext 使用 camelCase

E2E 测试传递 `{ workItemId, taskId, targetStatus }`（camelCase）给 `createEscalationForHarnessBlock`。T12 函数内部可能进行字段映射或同时支持两种命名风格。当前测试通过，说明兼容性无问题。

**建议**：为一致性，建议使用 `work_item_id`（snake_case）与 T12 定义对齐。

## 6. 降级边界验证

| 检查项 | 状态 |
| --- | --- |
| 页面显式标注 "T13F 功能骨架" | ✓ — console.html hero 区 `<p class="eyebrow">T13F 功能骨架</p>` |
| 页面显式标注 "MiniMax 体验 Review 未完成" | ✓ — hero-flags `<span class="flag flag-warning">` |
| API 响应包含 `product_baseline.minimax_experience_review: "not_completed"` | ✓ |
| A7 保持开放 | ✓ — 未在任何文件中关闭 |
| T13F 未被声明为完整 T13 | ✓ — 结果文档 §总体结论 明确标注 |
| MiniMax CLI smoke 成功 ≠ 页面体验 Review | ✓ — 结果文档明确区分 |

## 7. 总体结论

**T13F: 通过** — 页面功能骨架覆盖工作项录入、详情、统一时间线（8 类事件）、阻塞确认、Review/门禁/交付/复盘摘要和 MiniMax 降级标记。数据投影正确，架构边界清晰，零回归。

**T16: 通过** — E2E 验证成功覆盖一条成功路径和一条失败路径，通过真实 HTTP 请求验证页面 API 可见性。状态串联正确，阻断逻辑真实，降级风险显式标记。

**联合结论：通过。** 两项交付物均为非阻塞通过，4 项观察（3 P2 + 1 P3）不阻塞合并或 T16 关闭。

T16 关闭后，首版治理闭环（T1-T16）的开发冲刺阶段完成。剩余事项：
- A7：MiniMax 页面体验 Review（降级风险，不阻塞关闭）
- T15：Dogfooding 评估增强 Review（P1，不阻塞 T16）
- T13F → 完整 T13：需 MiniMax 恢复后补齐
