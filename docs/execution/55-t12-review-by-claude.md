# T12 Review by Claude

> 状态：通过
> 所属：执行
> 规则效力：T12 非作者 Review 记录
> Review Agent：Claude
> 被 Review Agent：Codex
> 任务 ID：T12
> 日期：2026-06-20

## 结论

**通过。** T12 已实现人工升级与页面确认流程的最小可用版本。升级记录可从 T8 阻断决策和高风险动作生成，页面可展示待确认项并回写用户确认/拒绝/补充信息，决策结果同步写入 A2AEvent 和 WorkItem 元数据。边界清晰，未越界 T9/T11/T13/T14。

## Review 范围

- 启动包：[51-t12-escalation-page-confirmation-start-package.md](51-t12-escalation-page-confirmation-start-package.md)
- 执行结果：[54-t12-escalation-page-confirmation-result.md](54-t12-escalation-page-confirmation-result.md)
- 核心实现：`src/escalations/escalation-flow.js`（394 行）
- 验证脚本：`src/escalations/escalation-flow.verify.js`（10 项）
- 服务端：`src/server/work-item-page-server.js`（新增 2 个 API 路由）
- 页面：`public/console.html`、`public/console.js`、`public/styles.css`
- 入口：`src/index.js`（T12 导出）
- 测试：`test/work-item-entry.test.js`

## 验证结果

```
npm run verify:escalations    → 10 passed, 0 failed
npm run check                 → 35 JavaScript files
npm test                      → 通过（零回归）
npm run verify:harness        → 22 passed, 0 failed
node src/storage/__verify.js  → 42 passed, 0 failed
```

## 功能覆盖确认

| 场景 | 验证 | 说明 |
|---|---|---|
| 重大歧义升级 | ✅ verify#1 | 从 blocked Harness decision 创建，含 trigger_rule/blocked_gate/risks |
| 缺少非作者 Review | ✅ verify#2 | 通过 `createEscalationForHarnessBlock` 调用 T8，正确捕获 `MISSING_APPROVED_REVIEW` |
| 门禁失败升级 | ✅ verify#3 | 创建 approved review + failed gate，T8 返回 `QUALITY_GATE_NOT_PASSED`，正确进入升级记录 |
| 高风险动作升级 | ✅ verify#4 | push to master 触发 `HIGH_RISK_ACTION_REQUIRES_CONFIRMATION` |
| 已放行决策不升级 | ✅ verify#5 | allowed=true 的 decision 被拒绝 |
| 用户确认回写 | ✅ verify#6 | decision=confirm → status=confirmed，A2A 事件创建，WorkItem metadata 更新 |
| 用户拒绝回写 | ✅ verify#7 | decision=reject → status=rejected，next_action=stop_or_rework |
| 补充信息 | ✅ verify#8 | request_info 无 detail 拒绝，有 detail 后 status=needs_more_info 且仍在 pending 列表 |
| 待确认列表过滤 | ✅ verify#9 | 只返回 pending_user_confirmation + needs_more_info，已确认的不出现 |
| 页面格式化 | ✅ verify#10 | formatForPage 暴露确认字段，不含 Store 内部细节 |

## 架构与边界确认

| 模块 | T12 行为 | 符合启动包 |
|---|---|---|
| T3（持久化） | 消费 `escalationRecordStore`，未修改 T3 源码 | ✅ |
| T5（状态机） | 不在确认回写后自动推进 WorkItem 状态，由后续调用方显式调用 | ✅ |
| T8（护栏） | 通过 `evaluateHarnessRails` / `evaluateHighRiskAction` 获取阻断决策，不修改 T8 源码 | ✅ |
| T9（Review/门禁记录） | 不创建 ReviewRecord 或 QualityGateRun | ✅ |
| T11（Git 交付） | 不执行 Git 操作 | ✅ |
| T13（页面主界面） | 仅在 T13A Lite 控制台补最小确认入口，不声明完整 T13 | ✅ |
| T14（复盘） | 不创建 RetrospectiveMemory | ✅ |

## 发现

### 观察 1（非阻塞）：EscalationRecord 模型未扩展，字段由应用层保证

启动包审查时我指出 EscalationRecord 缺少 `status`、`affected_tasks`、`decision_history` 等字段。Codex 选择在应用层通过 `createEscalationFromHarnessDecision` 统一设置这些字段，而非扩展 T3 `ESCALATION_DEFAULTS`。

- **现状**：`createEscalationFromHarnessDecision` 是唯一创建入口（`createEscalationForHarnessBlock` 和 `createEscalationForHighRiskAction` 均委托给它），字段设置一致且完整。
- **风险**：如果后续有其他代码绕过 T12 入口直接调用 `createEscalationRecord`，这些字段将缺失。
- **建议**：后续 T13 或 T16 如果需要直接创建升级记录，建议届时将字段补入 T3 模型默认值。当前 T12 范围内可接受。

### 观察 2（非阻塞）：`createEscalationForHarnessBlock` 内部重评估 T8

该函数内部调用 `evaluateHarnessRails`，而非接收外部已评估的 decision。这意味着：
- 调用方如果在 `guardedTransitionWorkItem` 捕获异常后再调用此函数，T8 会重新评估。
- 如果两次评估之间 Store 状态发生变化（如其他代码写入了 Review 记录），结果可能不同。

这不是 bug——当前场景下 Store 状态在短时间内不变——但值得在注释中说明"此函数会重新评估 Harness 护栏，调用方应确保 Store 状态与触发升级时一致"。

### 观察 3（非阻塞）：验证仅 10 项

10 项验证覆盖了主要路径（升级创建 5 项 + 决策回写 3 项 + 页面查询 2 项），功能骨架完整。但与 T9（132 项）或 T10（44 项）相比偏少。以下边界场景可后续补充：
- `listPendingEscalations` 空结果
- 非法 decision 枚举拒绝
- 同一升级记录多次决策（decision_history 累积）
- `createEscalationForHarnessBlock` 在 Harness 放行时拒绝

建议：T13 或 T16 端到端验证时补充上述场景。

## 未发现问题

- 无逻辑错误或死代码。
- 决策回写三向同步（EscalationRecord + A2AEvent + WorkItem metadata）正确，失败不传播异常。
- `formatForPage` 正确过滤了 Store 内部字段，只暴露页面需要的结构化数据。
- `listPendingEscalations` 包含 `needs_more_info`（补充信息后仍需等待），语义正确。
- 页面交互仅做功能骨架（文案和样式未做体验优化），符合 MiniMax 延后参与的 A7 约定。
- `recordUserEscalationDecision` 中 `request_info` 无 detail 时正确拒绝。
- 不自动推进 WorkItem 状态——由后续调用方读取回写结果后显式调用，这是正确的边界保持。

## 建议状态

通过。三项观察均为非阻塞，Codex 可自行决定是否在提交前处理。T12 通过后解除 T13、T16 对 T12 的依赖。
