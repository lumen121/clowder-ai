# T6 A2A 事件编排与记录结果

> 状态：通过（Codex 非作者 Review 已通过）
> 所属：执行
> 规则效力：T6 交付记录
> 维护角色：系统架构师
> 执行 Agent：Claude
> 任务 ID：T6
> 日期：2026-06-20

本文记录 T6 的实现结果，供 Codex 非作者 Review。

## 启动与隔离

| 项 | 结果 |
| --- | --- |
| 执行身份 | Claude；Git 写入身份 `Clowder Claude <claude@clowder.local>` |
| branch | `worktree-claude+t6-a2a-orchestration-v2` |
| worktree | `C:\aiWorkspace\clowder-ai-t6` |
| 基线 | `27cd8c2`（master，含 T4+T5） |
| Review 方 | Codex |
| 状态 | 已完成实现和自检，待 Codex Review |

## 总体结论

T6 已实现 A2A 事件编排与记录的最小可用能力。核心模块 `src/a2a/orchestrator.js` 提供：

- 结构化 A2A 事件创建（覆盖全部 12 种 A2A 目的类型）。
- T4 Agent CLI 调用包装（`invokeAndRecord` 自动记录为 A2A 事件）。
- A2A 响应记录（`recordA2AResponse` 更新结论和下一步）。
- 查询能力（按工作项/任务/待处理/已升级筛选）。
- 摘要能力（供 T13 时间线和 T14 复盘消费）。

## 交付物

| 文件 | 说明 |
| --- | --- |
| `src/a2a/orchestrator.js` | A2A 编排核心模块：事件创建、T4 集成、响应记录、查询、摘要 |
| `src/a2a/__verify.js` | T6 自动化验证脚本：95 项测试，覆盖全部 12 种类型、脱敏、DI 和前置校验 |
| `src/index.js` | 修改：新增 T6 导出（16 个符号） |
| `docs/execution/36-t6-a2a-event-orchestration-result.md` | 本文档 |

## API 设计

### 核心 API

```js
// 创建结构化 A2A 事件（校验 + 写入 T3 Store）
createA2AEvent(persistence, {
  purpose, from_agent, to_agent, work_item_id,
  task_id?, context?, claim_or_request, response?,
  conclusion?, next_action?, requires_user_intervention?
})

// 发起 A2A 交互（创建事件 + 可选调用目标 Agent）
await initiateA2AInteraction(persistence, params, {
  invokeTarget?, taskContext?, timeoutMs?
})

// 记录对已有 A2A 事件的响应
recordA2AResponse(persistence, eventId, {
  response?, conclusion?, next_action?, requires_user_intervention?
})

// 包装 T4 invokeAgent() → 自动记录为 execution_sync A2A 事件
await invokeAndRecord(persistence, agent, taskContext, {
  workItemId?, taskId?, purpose?, timeoutMs?
})
```

### 查询 API

```js
getA2AByWorkItem(persistence, workItemId)    // 按工作项，时间升序
getA2AByTask(persistence, taskId)            // 按任务，时间升序
getPendingA2A(persistence)                    // 等待响应的事件
getEscalatedA2A(persistence)                  // 需用户介入的事件
getEscalatedA2AByWorkItem(persistence, wiId) // 某工作项的升级事件
```

### 摘要 API

```js
summarizeA2A(persistence, workItemId)
// → { total, by_purpose, pending_count, escalated_count,
//      latest_conclusion, agent_involvement }
```

## A2A 类型覆盖清单

全部 12 种 A2A 目的类型均可结构化记录：

| 类型 | 状态 | 验证 |
| --- | --- | --- |
| `clarification_request` | ✅ | 创建 + 响应记录测试通过 |
| `requirement_challenge` | ✅ | 创建测试通过 |
| `solution_question` | ✅ | 创建 + 查询测试通过 |
| `risk_alert` | ✅ | 创建 + 手动升级测试通过 |
| `task_breakdown_feedback` | ✅ | 创建测试通过 |
| `task_handover` | ✅ | 创建测试通过 |
| `execution_sync` | ✅ | 创建 + T4 结果包装纯函数/DI 路径验证通过；真实 CLI E2E 待 T16 |
| `review_request` | ✅ | 创建 + 响应记录测试通过 |
| `fix_request` | ✅ | 创建 + 按任务查询测试通过 |
| `verification_request` | ✅ | 创建测试通过 |
| `disagreement_escalation` | ✅ | 自动标记需用户介入测试通过 |
| `retrospective_feedback` | ✅ | 创建 + null task_id 测试通过 |

## 与 T3 Store 的集成

纯消费者模式，通过 `persistence.createA2AEvent()` 写入，通过 `persistence.a2aEventStore.list/read/update` 查询和更新：

- 写入时复用 T3 的工厂校验（必填字段、purpose 枚举、agent 身份格式）。
- 查询时复用 T3 的 `list(filterFn)` 接口。
- 不修改 T3 核心模型语义，不新增第二事实来源。
- Store 深拷贝隔离验证通过（修改返回值不影响 Store 内数据）。

## 与 T4 Agent CLI 适配层的集成

两个集成点：

1. **`invokeAndRecord()`**：包装 T4 公开 API `invokeAgent()`，真实调用 Agent CLI，将结果脱敏后自动记录为 `execution_sync` A2A 事件。
2. **`initiateA2AInteraction()`**：可选的 `invokeTarget=true` 路径，将 A2A 上下文注入 T4 taskContext 后调用目标 Agent，并将响应回写到事件。

均使用 T4 已导出到 `src/index.js` 的公开接口，不依赖 T4 内部实现细节。

## 失败、分歧与用户介入处理

| 场景 | 处理方式 |
| --- | --- |
| A2A 调用失败 | `initiateA2AInteraction` 捕获异常，回写 `conclusion: "invocation_error"` + `requires_user_intervention: true` |
| 分歧升级 | `disagreement_escalation` 类型自动设置 `requires_user_intervention: true` |
| 显式升级 | 任意类型可通过 `requires_user_intervention: true` 手动标记 |
| 查询升级 | `getEscalatedA2A()` / `getEscalatedA2AByWorkItem()` 筛选所有待用户处理事件 |
| 等待响应 | `getPendingA2A()` 筛选期望响应但尚未收到的事件（基于 `RESPONSE_EXPECTED_PURPOSES` 判断） |

## 验证结果

```
npm run check     → checked 26 JavaScript files
npm test          → work-item-entry tests passed
                     agent-cli-adapter tests passed
node src/a2a/__verify.js → 95 通过, 0 失败, 95 总计
```

验证覆盖：
- 12 种 A2A 类型创建（含 purpose 正确性校验）
- 5 项必填字段校验
- purpose 枚举非法值拦截
- recordA2AResponse 响应更新（全量 + 部分 + 不存在事件报错）
- 按工作项查询（含排序、空结果）
- 按任务查询（含过滤、空结果）
- 待处理事件查询（含已响应排除、非期望响应类型排除）
- 升级事件查询（含自动标记、手动标记、按工作项筛选、空结果）
- summarizeA2A 摘要（含 12 类型统计、agent 参与统计、结论追踪、空工作项）
- 边界条件（空 response、长文本 context、显式覆盖升级标记、agent 身份警告、null task_id）
- 数据隔离（Store 深拷贝防护）
- **新增（Codex Review 修复）**：buildA2AFromInvocation 成功/失败路径脱敏验证（含 token 值、GitHub token、本地路径、脱敏标记）
- **新增（Codex Review 修复）**：invokeAndRecord DI 注入验证（fake runner 替换真实 CLI）
- **新增（Codex Review 修复）**：initiateA2AInteraction 前置校验（缺失 taskContext 时不残留空事件）

## 非作者 Review 后修正

Codex 已完成 T6 非作者 Review，结论为"需要修改"（[37-t6-review-by-codex.md](37-t6-review-by-codex.md)）。以下 3 项均已修复：

### P1：invokeAndRecord() 失败路径脱敏缺口

- **问题**：`invokeAndRecord()` 失败路径直接拼接 `result.stderr`，未经过 `redactSensitiveText()`。
- **修复**：提取纯函数 `buildA2AFromInvocation()`，成功和失败路径统一对 stdout/stderr 调用 `redactSensitiveText()` 后再写入 response。
- **验证**：新增 10 项脱敏测试（成功路径脱敏 token/key/路径 + 失败路径脱敏 GitHub token/AWS key/路径）。
- **额外收益**：`invokeAndRecord()` 支持 `options.invokeAgent` DI 注入 fake runner，无需真实 CLI 即可测试。

### P1：T4 集成路径被验证脚本跳过但结果文档称已通过

- **问题**：验证脚本头部声明不覆盖 `invokeAndRecord` 和 `initiateA2AInteraction(invokeTarget=true)`。
- **修复**：
  - `buildA2AFromInvocation()` 纯函数可独立测试 T4 结果→A2A 事件转换。
  - `invokeAndRecord()` 支持 DI 注入 fake runner，验证脚本新增 DI 路径测试。
  - 结果文档将"T4 集成测试通过"改为具体描述：纯函数路径已验证，真实 CLI 路径待 T16/E2E。
- **验证**：`invokeAndRecord` DI 注入测试通过（fake runner + 脱敏），`buildA2AFromInvocation` 成功/失败路径均通过。

### P2：initiateA2AInteraction() 参数错误时残留空事件

- **问题**：`invokeTarget=true` 但缺失 `taskContext` 时，`createA2AEvent()` 已先执行，抛错后 Store 中残留空 A2AEvent。
- **修复**：将 `taskContext` 必填校验移到 `createA2AEvent()` 之前，前置校验不通过不创建事件。
- **验证**：新增测试确认抛错后 `getA2AByWorkItem` 返回 0 条记录。

## 未完成内容

无。T6 范围内全部完成。

明确范围外的内容（非 T6 职责）：
- 完整 Harness 护栏（属 T8）
- A2A 路由和多轮协作流程（T6 提供基础事件记录，编排逻辑属 T8）
- 页面时间线渲染（属 T13）
- T4 recordAgentInvocation() 的 "Clowder" 身份修正（属于 T4 实现细节，T6 的 `invokeAndRecord` 使用正确的 agent 身份）

## 是否解除依赖

是。T6 已完成并通过自检，A2A 事件编排与记录能力已就绪：
- T7（方案与任务拆解）：可消费 A2A 事件作为方案评估和任务拆解反馈的记录基础。
- T13（页面主界面）：可通过 `getA2AByWorkItem()` 和 `summarizeA2A()` 获取时间线数据。
- T14（复盘记录）：可通过 `summarizeA2A()` 获取 A2A 统计摘要。

## 是否阻断后续任务

否。T6 不阻断任何后续任务。

## 遗留风险

| 风险 | 影响 | 处理 |
| --- | --- | --- |
| `initiateA2AInteraction(invokeTarget=true)` 和 `invokeAndRecord()` 的真实 CLI 路径未在验证脚本中测试（需要真实 CLI 环境） | DI 注入路径和前置校验路径已测；真实 CLI 调用链路待验证 | T16 E2E 必须覆盖真实 A2A 调用路径；`buildA2AFromInvocation()` 纯函数和 `invokeAndRecord()` DI 注入已通过自检 |
| T4 `recordAgentInvocation()` 使用 `to_agent: "Clowder"` | T4 写入的 A2A 事件不在标准 agent 身份列表中 | T6 的 `invokeAndRecord` 使用正确身份；建议 Codex 后续统一 T4 身份 |
| A2A 事件无分页/时间范围查询 | 首版数据量小可接受 | 后续如数据量增长，可在 Store 层增加分页支持 |

## 偏离项

无。实现严格按启动包范围执行，未越界 T8/T9/T13。

## 建议下一状态

提交 Codex 非作者 Review → 通过后更新任务状态板为已完成 → 关闭 T6。

## 是否触发 Review / 质量门禁 / 人工确认 / 复盘

- 非作者 Review：是，需 Codex Review。
- 质量门禁：`npm run check` + `npm test` + `node src/a2a/__verify.js` 全部通过。
- 人工确认：否。
- 复盘：T6 闭环后按标准流程记录。
