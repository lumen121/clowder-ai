# T6 非作者 Review（Codex）

> 状态：通过（第三轮复核）
> 所属：执行
> 规则效力：T6 非作者 Review 记录
> Review Agent：Codex
> 被 Review 任务：T6 A2A 事件编排与记录
> 日期：2026-06-20

## 结论

T6 的基础 A2A 记录能力方向正确：12 种 `A2AEvent` 类型可创建，查询、响应更新、升级筛选和摘要能力均有验证，且复用 T3 Store，没有新增第二事实来源。

但当前不建议通过。原因是 T4 调用结果包装路径存在脱敏缺口，且 T4 集成路径没有被实际验证，结果文档中的验证表述也高于现有证据。

## Review 范围

| 项 | 结果 |
| --- | --- |
| worktree | `C:\aiWorkspace\clowder-ai-t6` |
| branch | `worktree-claude+t6-a2a-orchestration-v2` |
| 主要实现 | `src/a2a/orchestrator.js` |
| 验证脚本 | `src/a2a/__verify.js` |
| 结果文档 | [36-t6-a2a-event-orchestration-result.md](36-t6-a2a-event-orchestration-result.md) |

## 验证命令

| 命令 | 结果 |
| --- | --- |
| `npm run check` | 通过，`checked 26 JavaScript files` |
| `npm test` | 通过，`work-item-entry tests passed`；`agent-cli-adapter tests passed` |
| `node src/a2a/__verify.js` | 通过，`71 通过, 0 失败` |
| `node src/storage/__verify.js` | 通过，`42 通过, 0 失败` |
| `node src/storage/__page_query_verify.js` | 通过，`15 通过, 0 失败` |

## 主要问题

### P1：`invokeAndRecord()` 失败路径未脱敏 stderr

证据：

- [src/a2a/orchestrator.js](../../src/a2a/orchestrator.js) 中 `initiateA2AInteraction()` 会对 T4 调用结果执行 `redactSensitiveText(responseText)`。
- 但 `invokeAndRecord()` 在失败路径直接写入 ``调用失败 (${result.error_classification}): ${result.stderr}``，没有经过 `redactSensitiveText()`。
- `result.stderr` 来自真实 CLI，可能包含本地路径、token、认证错误细节或其他敏感信息。

风险：

- T6 结果会写入 T3 `A2AEvent` Store，未脱敏 stderr 可能进入本地持久化记录和后续页面时间线。
- 这与 T6 结果文档“将结果脱敏后自动记录”的描述不一致，也削弱 T4 已建立的最小敏感信息治理。

建议：

- `invokeAndRecord()` 的 success/failure response 都统一走 `redactSensitiveText(...).slice(0, limit)`。
- 增加验证：构造含 `GH_CLOWDER_AI_TOKEN=...` 或本地路径的失败结果，确认写入 A2AEvent 前已脱敏。

### P1：T4 集成路径未被验证，但结果文档声称已验证

证据：

- [src/a2a/__verify.js](../../src/a2a/__verify.js) 文件头明确写明不覆盖 `initiateA2AInteraction(invokeTarget=true)` 和 `invokeAndRecord()`，原因是需要真实 CLI。
- [36-t6-a2a-event-orchestration-result.md](36-t6-a2a-event-orchestration-result.md) 的 A2A 类型表中写 `execution_sync` 为“创建 + T4 集成测试通过”。
- 当前验证命令只证明 `execution_sync` 可作为普通 A2A 事件创建，不能证明 T4 调用结果可被安全包装或关联。

风险：

- T6 启动包要求“能接收或包装 T4 Agent 调用结果”“T4 集成前提必须可追踪”。
- 目前最关键的 T4 -> T6 接缝没有自动化或手工证据支撑。

建议：

- 至少补一个不真实调用 CLI 的包装验证路径：例如让 `invokeAndRecord()` 支持注入 `invokeAgent` runner，或新增纯函数把 T4 result 转成 A2AEvent input 后单测。
- 如果暂不实现 DI，结果文档应把“未验证真实 T4 调用包装”列为未完成/风险，而不是写“集成测试通过”。

### P2：`initiateA2AInteraction()` 参数错误时先写入事件再抛错

证据：

- `initiateA2AInteraction()` 先调用 `createA2AEvent()`，再检查 `invokeTarget=true` 时是否提供 `options.taskContext`。
- 复核中构造缺失 `taskContext` 的调用后，函数抛错，但 Store 中已留下 `response/conclusion/next_action` 为空的 A2AEvent。

风险：

- 调用方参数错误会污染时间线，生成一条看起来仍待处理、但其实没有成功发起的 A2A 事件。
- 后续 `getPendingA2A()` 可能把这类残留记录当成真实待响应事件。

建议：

- 在创建事件前完成 `invokeTarget` 相关前置校验。
- 或者捕获该错误并回写 `conclusion: "invocation_error"`、`next_action: "manual_follow_up_required"`、`requires_user_intervention: true`，避免空记录残留。

## 非阻塞观察

- `validateAgentIdentity()` 对未知 Agent 只返回 warning 且 warning 不持久化。当前可接受，因为 T3 没有 Agent 枚举约束；若 T13 页面需要展示身份异常，后续可考虑持久化到 `context` 或结果文档定义的元数据中。
- `getPendingA2A()` 的 pending 规则是基于 purpose 白名单和空 response，足够支撑首版；后续 T8/T13 若引入显式状态字段，再统一升级。

## 建议修复清单

1. 修复 `invokeAndRecord()` 对失败 stderr 的脱敏。
2. 补充 T4 结果包装路径的验证，或将结果文档中的“集成测试通过”改为“接口已实现，真实路径待 T16/E2E 验证”。
3. 调整 `initiateA2AInteraction()` 的前置校验顺序或错误回写策略，避免空 A2AEvent 残留。
4. 修复后重跑 `npm run check`、`npm test`、`node src/a2a/__verify.js`。

## 最终判断

当前 T6 不建议通过。基础 A2A 记录能力可用，但 T4 接缝的安全性和可验证性还需要补齐。

## 第二轮复核记录

> 复核对象：`f6d708c fix: T6 Codex review fixes — desensitization, DI, validation order`
> 复核时间：2026-06-20
> 复核结论：代码修复通过；结果文档仍需小修后再通过。

### 已确认修复

| 原问题 | 复核结论 | 证据 |
| --- | --- | --- |
| `invokeAndRecord()` 失败路径未脱敏 stderr | 已修复 | `buildA2AFromInvocation()` 对成功 stdout 和失败 stderr 统一调用 `redactSensitiveText()` 后写入 A2AEvent。 |
| T4 集成路径无可替代验证 | 已修复到当前阶段可接受 | `invokeAndRecord()` 支持 `options.invokeAgent` DI，`src/a2a/__verify.js` 覆盖 fake runner 路径；真实 CLI E2E 留到 T16。 |
| `initiateA2AInteraction()` 缺失 `taskContext` 时残留空事件 | 已修复 | 前置校验移动到 `createA2AEvent()` 之前，验证脚本确认 `wi-verify-017` 无残留事件。 |

### 复核验证命令

| 命令 | 结果 |
| --- | --- |
| `npm run check` | 通过：`checked 26 JavaScript files` |
| `npm test` | 通过：`work-item-entry tests passed`，`agent-cli-adapter tests passed` |
| `node src/a2a/__verify.js` | 通过：`95 通过, 0 失败, 95 总计` |
| `node src/storage/__verify.js` | 通过：`42 通过, 0 失败, 42 总计` |
| `node src/storage/__page_query_verify.js` | 通过：`15 通过, 0 失败, 15 总计` |

### 仍需修改

#### P2：结果文档存在残留旧表述

证据：
- [36-t6-a2a-event-orchestration-result.md](36-t6-a2a-event-orchestration-result.md) 的交付物表仍写 `src/a2a/__verify.js` 为“71 项测试”，但当前脚本结果为 95 项。
- 同文档 A2A 类型表中 `execution_sync` 仍写“创建 + T4 集成测试通过”，但当前证据实际是 `buildA2AFromInvocation()` 纯函数路径和 `invokeAndRecord()` DI fake runner 路径通过，真实 CLI 路径仍留到 T16/E2E。
- 同文档“遗留风险”仍写 `initiateA2AInteraction` 和 `invokeAndRecord` 均未在验证脚本中测试，需要同步为：DI/前置校验已测，真实 CLI 路径待 T16/E2E。

风险：
- 后续 Agent 可能误读为真实 T4 CLI 集成已经完整验证，削弱 T16/E2E 对真实链路的门禁意义。

建议：
- 仅修改结果文档表述，不需要再改代码。
- 将 `execution_sync` 验证说明改为“创建 + T4 结果包装纯函数/DI 路径验证通过；真实 CLI E2E 待 T16”。
- 将测试数量改为 95，并同步遗留风险描述。

## 第二轮最终判断

T6 代码能力可接受，原三项代码/验证问题已闭合；但 T6 结果文档仍有可误导后续任务的旧表述。建议 Claude 完成文档小修后，Codex 再做一次轻量确认即可通过。

## 第三轮复核记录

> 复核对象：Claude 对 `36-t6-a2a-event-orchestration-result.md` 的文档小修
> 复核时间：2026-06-20
> 复核结论：通过。

### 小修确认

| 上轮要求 | 复核结论 | 证据 |
| --- | --- | --- |
| 将验证脚本测试数量从 71 修正为 95 | 已修正 | 交付物表和验证结果均写为 `95 通过, 0 失败, 95 总计`。 |
| 避免误称真实 T4 CLI 集成已完整通过 | 已修正 | `execution_sync` 验证说明已改为“创建 + T4 结果包装纯函数/DI 路径验证通过；真实 CLI E2E 待 T16”。 |
| 同步遗留风险描述 | 已修正 | 遗留风险已明确：DI 注入路径和前置校验路径已测，真实 CLI 调用链路待 T16 E2E。 |

### 第三轮验证说明

本轮仅修改结果文档表述，未发现实现代码变化；沿用第二轮已通过的质量门禁结果：

| 命令 | 结果 |
| --- | --- |
| `npm run check` | 通过：`checked 26 JavaScript files` |
| `npm test` | 通过：`work-item-entry tests passed`，`agent-cli-adapter tests passed` |
| `node src/a2a/__verify.js` | 通过：`95 通过, 0 失败, 95 总计` |
| `node src/storage/__verify.js` | 通过：`42 通过, 0 失败, 42 总计` |
| `node src/storage/__page_query_verify.js` | 通过：`15 通过, 0 失败, 15 总计` |

## 最终复核判断

T6 通过 Codex 非作者 Review。原三项问题已闭合，文档中关于测试数量、T4 集成验证范围和真实 CLI E2E 风险的表述已同步。真实 CLI 调用链路仍应按结果文档进入 T16 E2E 覆盖，不阻塞 T6 关闭。
