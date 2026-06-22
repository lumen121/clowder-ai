# T17 任务启动包：Agent 聊天室交互闭环纠偏

> 状态：当前执行启动包
> 所属：执行
> 规则效力：T17 执行上下文、边界、门禁与交付约束
> 维护角色：系统架构师
> 执行身份：Codex
> 任务 ID：T17
> 日期：2026-06-22

## 1. 基本信息

| 字段 | 值 |
| --- | --- |
| 任务 ID | T17 |
| 任务类型 | P0 纠偏 / Agent 聊天室交互闭环 |
| 当前身份 | Codex（Clowder Codex `<codex@clowder.local>`） |
| 任务来源 | 用户发现当前页面只能展示工作项状态，不能在页面中与 Agent 对话或让 Agent 互相沟通；产品基线 P0-02 与 T13 原启动包要求统一聊天室 |
| 关联工作项 | P0-02、P0-14、P0-15、P0-16；T13/T16 后续纠偏 |
| 优先级 | P0 |
| 依赖 | T3、T4、T6、T9、T12、T13F、T16，均已完成或降级关闭 |
| Review 方 | Claude |

## 2. 问题判断

当前 `T13F` 页面已经支持工作项录入、详情、统一时间线、阻塞确认、Review/门禁/交付/复盘摘要，但它仍是“工作项治理控制台”，不是完整聊天室。

缺口如下：

- 用户不能在页面中选择 Codex、Claude 或全体 Agent 发送对话消息。
- 页面不能展示 Agent 对用户消息的真实回复闭环。
- Agent 之间不能通过页面可见的聊天室交换进度、疑问、分歧或 Review 请求。
- 用户不能在页面中要求某个 Agent Review 另一个 Agent 的任务或结果。
- 现有“补充信息”只写入 `user -> system` 的 A2AEvent，不能等同于用户与 Agent 的直接沟通。

结论：这是 P0 交互模型缺口，不是普通 UI 优化。`T16` 已关闭为治理闭环验证结果，但首版要满足“三 Agent 协作聊天室”产品目标，必须补 T17。

## 3. 目标与边界

**任务目标**：
在现有页面级用户参与入口中补齐最小可用 Agent 聊天室，让用户可以围绕当前工作项直接和指定 Agent 沟通，并让 Agent 间 A2A 信息、Review 请求和回复在同一个聊天室中可见、可追踪、可持久化。

**范围内事项**：

- 在现有 `public/console.html` / `public/console.js` 中增加聊天室输入区。
- 支持选择消息目标：Codex、Claude、所有 Agent 或系统/Harness。
- 支持用户发送消息并持久化为结构化 A2AEvent 或等价的 A2A 投影。
- 支持调用 T4/T6 能力向目标 Agent 发起真实请求；CLI 不可用时必须显示 pending/failed，不得伪造 Agent 回复。
- 支持展示用户消息、Agent 回复、Agent 间消息、Review 请求、系统/治理事件，并按时间排序。
- 支持页面发起 Review 请求：用户选择 Review 方、被 Review 对象或任务、请求内容，系统写入可追踪事件。
- 支持 Agent 对 Agent 的最小消息记录：例如 Codex 请求 Claude Review，Claude 回复结论。
- 复用 T3/T6/T9/T12 已有事实来源和查询能力，不新建第二套不可追踪聊天事实来源。
- 补充验证脚本，证明聊天室消息写入、读取、排序、失败状态和 Review 请求记录可用。

**范围外事项**：

- 不实现多人在线实时协作、WebSocket 或复杂消息同步。
- 不要求高保真聊天 UI，不实现完整设计系统。
- 不恢复 MiniMax 分配；开发冲刺期间 MiniMax 继续按 A7 降级处理。
- 不把模拟回复冒充真实 Agent 回复。
- 不绕过 T4 Agent CLI 适配层、T6 A2A 编排、T9 Review 记录或 T12 人工升级机制。
- 不自动合并 PR、不自动部署。

## 4. 必读材料

- [AGENTS.md](../../AGENTS.md)
- [15-implementation-plan.md](15-implementation-plan.md)
- [task-status-board.md](task-status-board.md)
- [current-action-tracker.md](current-action-tracker.md)
- [../agents/05-agent-codex.md](../agents/05-agent-codex.md)
- [../product/01-prd.md](../product/01-prd.md)
- [../product/02-requirements-backlog.md](../product/02-requirements-backlog.md)
- [../product/14-page-user-participation-proposal.md](../product/14-page-user-participation-proposal.md)
- [../product/15-page-change-implementation-clarifications.md](../product/15-page-change-implementation-clarifications.md)
- [../architecture/14-system-architecture-design.md](../architecture/14-system-architecture-design.md)
- [../architecture/16-page-change-architecture-clarifications.md](../architecture/16-page-change-architecture-clarifications.md)
- [30-t4-agent-cli-adapter-result.md](30-t4-agent-cli-adapter-result.md)
- [36-t6-a2a-event-orchestration-result.md](36-t6-a2a-event-orchestration-result.md)
- [52-t9-review-quality-gate-result.md](52-t9-review-quality-gate-result.md)
- [54-t12-escalation-page-confirmation-result.md](54-t12-escalation-page-confirmation-result.md)
- [67-t13-functional-fallback-result.md](67-t13-functional-fallback-result.md)
- [72-t16-e2e-validation-result.md](72-t16-e2e-validation-result.md)

## 5. 启动前方案确认

执行 Agent 收到本启动包后，不得直接开发。必须先输出简短实施方案，至少说明：

- 拟修改的页面、服务端 API、查询投影、A2A 编排或验证文件。
- 聊天消息如何映射到 A2AEvent，是否需要新增字段或投影，为什么。
- 用户到 Agent、Agent 到用户、Agent 到 Agent、Review 请求四类消息的状态流。
- 真实 Agent 调用如何复用 T4/T6；CLI 不可用、超时或失败时如何回写可见状态。
- 如何避免把普通时间线事件误当作可对话消息。
- 如何避免伪造 Agent 回复。
- 验证方式、页面手工检查方式、质量门禁和回归范围。
- 主要风险和需要产品或架构确认的问题。

若方案与产品基线、架构基线、执行计划或本启动包存在冲突，必须暂停并升级确认。

## 6. 分工与协作

| 字段 | 值 |
| --- | --- |
| 主执行 Agent | Codex |
| Review 方 | Claude |
| 协作 Agent | Claude 可从实现可测性、A2A 事件语义和非作者 Review 角度质询 |
| MiniMax 参与 | 开发冲刺期间不分配 MiniMax；必须在结果文档记录 UI/交互体验未由 MiniMax Review 的降级风险 |

## 7. 执行约束

| 字段 | 值 |
| --- | --- |
| 允许动作级别 | 文件修改、检查执行、提交准备；用户人工确认后可按当前协作方式推送到 `origin/master` |
| 禁止事项 | 不得伪造 Agent 回复；不得新增第二套不可追踪聊天事实来源；不得绕过 T4/T6/T9/T12；不得 force push、自动部署或自动合并 PR |
| 文件/模块边界 | 与聊天室页面、页面 API、A2A 查询/投影、Agent 调用闭环、Review 请求记录、验证脚本和执行文档直接相关的 `public/`、`src/server/`、`src/a2a/`、必要 `src/` 查询聚合、`package.json`、`docs/execution/` |
| 维护性注释要求 | 对消息类型归一化、A2AEvent 映射、真实调用失败处理、Review 请求状态、去重/排序逻辑补充必要注释 |
| Git 身份要求 | 任何 Git 写入动作必须使用 `Clowder Codex <codex@clowder.local>` |
| worktree / 分支要求 | 独立 branch/worktree；结果文档记录 task、branch、worktree、负责人、冲突状态和推送状态 |

## 8. 验收与门禁

| 字段 | 值 |
| --- | --- |
| 验收标准 | 页面支持围绕当前 WorkItem 与指定 Agent 对话；能看到用户消息、Agent 真实回复或失败/待处理状态、Agent 间消息、Review 请求和 Review 回复；消息进入同一聊天室/时间线并可重启后读取 |
| 必测成功路径 | 用户在页面向 Codex 或 Claude 发送消息；系统调用 Agent 或记录明确 pending/failed；页面刷新后仍能看到消息状态和响应 |
| 必测 Agent 间路径 | 页面或编排层记录 Codex -> Claude 的 Review 请求，并能展示 Claude 回复或失败状态 |
| 必测失败路径 | Agent CLI 不可用、超时或返回错误时，页面展示失败类别和下一步，不生成假回复 |
| 验证方式 | `npm run check`、`npm test`、`npm run verify:page`、`node src/a2a/__verify.js`，并新增或扩展聊天室专项验证脚本 |
| Review 通过标准 | Claude 确认聊天室不是仅时间线包装；真实调用/失败状态可追踪；Review 请求可见；未新增第二事实来源；MiniMax 降级风险已记录 |
| 失败处理 | 若页面仍不能直接向 Agent 发消息、不能展示 Agent 回复/失败状态、不能发起 Review 请求，T17 不得通过 |

## 9. 输出记录

建议输出：

- T17 主结果文档：`docs/execution/74-t17-agent-chatroom-result.md`
- T17 Review 文档：`docs/execution/75-t17-review-by-claude.md`

完成后更新：

- [task-status-board.md](task-status-board.md)：T17 状态、结果、Review 和门禁。
- [current-action-tracker.md](current-action-tracker.md)：A9 是否关闭。
- [00-index.md](00-index.md)：T17 结果和 Review 文档入口。

## 10. 状态去向

- 启动后：T17 进入 `方案中` 或 `开发中`。
- 实现与作者自检完成后：T17 进入 `待 Review`。
- Claude Review 和质量门禁通过后：T17 进入 `已完成`，A9 可关闭。
- 若 Agent CLI 不可用导致无法完成真实对话闭环：记录为阻塞或降级风险，不得用模拟回复关闭 T17。
