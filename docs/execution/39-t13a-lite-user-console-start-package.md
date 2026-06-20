# T13A Lite 任务启动包：用户操作台最小入口

> 状态：当前执行启动包
> 所属：执行
> 规则效力：T13A Lite 执行上下文、边界、门禁与交付约束
> 维护角色：系统架构师
> 执行身份：Claude
> 任务 ID：T13A Lite
> 日期：2026-06-20

## 1. 基本信息

| 字段 | 值 |
| --- | --- |
| 任务 ID | T13A Lite |
| 任务类型 | 功能需求 / 页面辅助入口 |
| 当前身份 | Claude（Clowder Claude `<claude@clowder.local>`） |
| 任务来源 | 用户要求提前用户输入页面；不替代完整 T13 |
| 关联工作项 | 降低零阶段人工协调成本 |
| 优先级 | P0 辅助任务 |

## 2. 目标与边界

**任务目标**：
提前交付一个极简用户操作台，帮助用户查看当前任务状态、打开启动包、录入补充信息或确认意见，减少手工在多个 Agent 之间传话的成本。

**范围内事项**：
- 页面查看 T1-T16 状态板摘要。
- 页面查看当前已存在启动包链接。
- 页面查看当前 Owner、Review 方、阻塞、下一步。
- 页面录入用户补充信息或确认意见，并保存为结构化或可追踪记录。
- 复用 T2 页面入口、T3 Store、T5 状态机、T6 A2A 记录能力。
- 保持本地单页或轻量页面，不做高保真设计。

**范围外事项**：
- 不替代完整 T13 页面主界面。
- 不实现完整 Review/门禁/复盘视图。
- 不实现完整阻塞确认流程；属于 T12/T13。
- 不实现 MiniMax 体验 Review 的最终闭环。
- 不把 CLI 输出包装成最终用户参与入口。

**完成标准**：
- 用户能通过页面看到当前任务状态和下一步。
- 用户能打开或复制当前任务启动包。
- 用户能录入补充信息/确认意见，且结果可追踪。
- 页面不误导用户认为完整 T13 已完成。
- 非作者 Review 通过。

## 3. 必读材料

- [AGENTS.md](../../AGENTS.md)
- [15-implementation-plan.md](15-implementation-plan.md)
- [task-status-board.md](task-status-board.md)
- [current-action-tracker.md](current-action-tracker.md)
- [../product/14-page-user-participation-proposal.md](../product/14-page-user-participation-proposal.md)
- [../product/15-page-change-implementation-clarifications.md](../product/15-page-change-implementation-clarifications.md)
- [../architecture/16-page-change-architecture-clarifications.md](../architecture/16-page-change-architecture-clarifications.md)
- [22-t3-persistence-result.md](22-t3-persistence-result.md)
- [33-t5-work-item-state-machine-result.md](33-t5-work-item-state-machine-result.md)
- [36-t6-a2a-event-orchestration-result.md](36-t6-a2a-event-orchestration-result.md)

## 4. 分工与协作

| 字段 | 值 |
| --- | --- |
| 主执行 Agent | Claude |
| Review 方 | Codex |
| 协作 Agent | MiniMax 后续补做页面体验 Review；当前可先不阻塞 |
| MiniMax 参与 | 因客户端限制可延后，但必须在完整 T13 或 T16 前补体验 Review |

## 5. 执行约束

| 字段 | 值 |
| --- | --- |
| 允许动作级别 | 文件修改、检查执行、提交准备 |
| 禁止事项 | 不得宣称完整 T13 完成；不得实现完整 Review/门禁/复盘；不得绕过非作者 Review |
| 文件/模块边界 | 可修改 `public/`、`src/server/`、与页面查询/用户补充记录直接相关的 `src/`、`test/`、`docs/execution/` 文件 |
| 维护性注释要求 | 对页面查询聚合、用户补充记录写入、状态板读取边界补充必要注释 |
| Git 身份要求 | `Clowder Claude <claude@clowder.local>` |
| worktree / 分支要求 | 独立 branch/worktree，避免与 T7 并行冲突 |

## 6. 验收与门禁

| 字段 | 值 |
| --- | --- |
| 验收标准 | 页面可查看状态摘要、启动包入口、Owner/Review/阻塞/下一步；可录入补充或确认意见并可追踪 |
| 验证方式 | `npm run check`、`npm test`，并补充页面手工或自动验证记录 |
| Review 通过标准 | Codex 确认页面只做 Lite 辅助入口，未吞并完整 T13/T12/T9/T14 |
| 失败处理 | 页面无法真实读取状态或录入结果不可追踪时，不得通过 |

## 7. 输出记录

建议输出：
- T13A Lite 主结果文档：`docs/execution/42-t13a-lite-user-console-result.md`
- T13A Lite Review 文档：`docs/execution/43-t13a-lite-review-by-codex.md`

完成后更新 [task-status-board.md](task-status-board.md)。本任务通过后只降低人工协调成本，不解除完整 T13 对 T9/T12 等任务的依赖。
