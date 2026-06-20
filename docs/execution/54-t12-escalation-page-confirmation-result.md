# T12 人工升级与页面确认流程结果

> 状态：已完成
> 所属：执行
> 规则效力：T12 交付记录
> 维护角色：系统架构师
> 执行 Agent：Codex
> 任务 ID：T12
> 日期：2026-06-20

本文记录 T12 的实现结果。Claude 非作者 Review 已完成，结论为通过。

## 启动与隔离

| 项 | 结果 |
| --- | --- |
| 执行身份 | Codex；Git 写入身份要求为 `Clowder Codex <codex@clowder.local>` |
| branch | `codex/t12-escalation-page-confirmation` |
| worktree | `C:\aiWorkspace\clowder-ai-t12` |
| 基线 | `2f13f92`（包含 T9/T12 启动包） |
| Review 方 | Claude |
| 状态 | 已完成实现、自检和 Claude 非作者 Review |

## 启动前方案确认

T12 采用应用服务层实现，不改写 T3 Store，不绕过 T8/T5：

- 新增 `src/escalations/escalation-flow.js`，在 T3 `EscalationRecord` Store 之上提供创建、查询、确认回写能力。
- EscalationRecord 最小字段覆盖：`work_item_id`、`task_id`、`status`、`trigger_type`、`trigger_rule`、`what_happened`、`blocked_gate`、`options`、`risks`、`recommended_next_step`、`affected_tasks`、`target_status`、`action`、`blockers`、`user_decision`、`decision_detail`、`decided_by`、`decided_at`、`next_action_after_decision`。
- T8 护栏阻断和高风险动作可生成升级记录；T12 只记录并等待用户决策，不直接放行护栏。
- 页面/API 通过 T13A Lite 控制台展示待确认项，并支持确认、拒绝、补充信息回写。
- 回写结果同时写入 `EscalationRecord`，追加 A2AEvent，并在 WorkItem `metadata.latest_escalation_decision` 留摘要，便于后续状态推进和页面读取。
- 不实现 T9 Review/门禁记录模块、不实现 T11 Git 交付流程、不扩展完整 T13/T14。

未发现与启动包、产品基线、架构基线或执行计划冲突的待确认项。

## 完成内容

| 文件 | 内容 |
| --- | --- |
| `src/escalations/escalation-flow.js` | T12 应用服务：升级创建、待确认查询、用户决策回写、页面格式化 |
| `src/escalations/escalation-flow.verify.js` | T12 专属验证，覆盖重大歧义、Review 阻断、门禁失败、高风险动作、确认/拒绝/补充和页面查询 |
| `src/server/work-item-page-server.js` | 新增 `/api/console/escalations` 和 `/api/console/escalations/:id/decision` |
| `public/console.html` | T13A Lite 控制台新增“阻塞与人工确认”最小入口 |
| `public/console.js` | 加载待确认项、渲染风险/建议/选项、写回用户决策 |
| `public/styles.css` | 待确认项最小可读布局 |
| `test/work-item-entry.test.js` | 增加 T12 页面 API 读取和写回测试 |
| `package.json` | 新增 `verify:escalations` |
| `src/index.js` | 导出 T12 公共 API |

## API

### 应用服务

```js
createEscalationFromHarnessDecision(persistence, decision, input)
createEscalationForHarnessBlock(persistence, params, input)
createEscalationForHighRiskAction(persistence, action, input)
listPendingEscalations(persistence, filter)
recordUserEscalationDecision(persistence, escalationId, input)
formatForPage(record)
```

### 页面 API

```text
GET  /api/console/escalations
POST /api/console/escalations/:id/decision
```

决策请求体：

```json
{
  "decision": "confirm | reject | request_info",
  "decided_by": "user",
  "detail": "确认理由、拒绝原因或补充信息"
}
```

## 边界说明

- T12 不创建 ReviewRecord 或 QualityGateRun；T9 负责。
- T12 不执行 Git push、PR、合并或交付检查；T11 负责。
- T12 只在 T13A Lite 控制台补最小确认入口，不声明完整 T13 完成。
- T12 不生成复盘记录；T14 负责。
- 页面交互只按功能骨架验收；MiniMax 体验 Review 仍按 A7 在 T13 或 T16 前安排。

## 验证结果

```text
npm run check                              -> checked 35 JavaScript files
npm test                                   -> work-item-entry tests passed; agent-cli-adapter tests passed
npm run verify:escalations                -> 10 passed, 0 failed
npm run verify:harness                    -> 22 passed, 0 failed
node src/work-items/state-machine.verify.js       -> 46 passed, 0 failed
node src/work-items/solution-breakdown.verify.js  -> 19 passed, 0 failed
node src/storage/__verify.js                      -> 42 passed, 0 failed
node src/storage/__page_query_verify.js           -> 15 passed, 0 failed
```

## Review 结论

Claude 已完成 T12 非作者 Review，结论为通过。当前已确认：

- 升级记录可从 T8 阻断决策和高风险动作生成。
- 页面可展示待确认项并回写确认 / 拒绝 / 补充信息。
- 决策结果同步写入 `EscalationRecord`、`A2AEvent` 和 `WorkItem.metadata.latest_escalation_decision`。
- 边界保持清晰，未越界到 T9 / T11 / T13 / T14。

Claude 还给出 3 项非阻塞观察，当前不影响 T12 通过：

- EscalationRecord 扩展字段由 T12 应用层统一保证，而非下沉到 T3 默认模型。
- `createEscalationForHarnessBlock()` 会重新评估一次 T8 护栏。
- T12 专属验证当前为 10 项，主路径已覆盖，额外边界可在 T16 补强。

说明：Claude 的 Review 文档已归档为 [55-t12-review-by-claude.md](55-t12-review-by-claude.md)。

## 是否解除依赖

是。T12 已解除：

- T13 对 T12 的依赖。
- T16 对 T12 的依赖。

## 遗留风险

| 风险 | 影响 | 处理 |
| --- | --- | --- |
| MiniMax 未参与本次最小确认入口体验 Review | 页面文案和交互效率可能后续还需调整 | 按 A7 延后到 T13 或 T16 前完成，不阻断 T12 功能骨架 |
| 用户确认后不自动推进 WorkItem 状态 | 避免确认记录绕过 T5/T8 | 后续状态推进方读取回写结果后显式调用状态机 |

## 建议下一状态

已完成。后续可继续推进 T13、T14、T16；MiniMax 页面体验 Review 仍按 A7 在 T13 或 T16 前安排。
