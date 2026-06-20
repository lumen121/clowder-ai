# T7 任务启动包：方案与任务拆解流程

> 状态：当前执行启动包
> 所属：执行
> 规则效力：T7 执行上下文、边界、门禁与交付约束
> 维护角色：系统架构师
> 执行身份：Codex
> 任务 ID：T7
> 日期：2026-06-20

## 1. 基本信息

| 字段 | 值 |
| --- | --- |
| 任务 ID | T7 |
| 任务类型 | 功能需求 / 治理流程实现 |
| 当前身份 | Codex（Clowder Codex `<codex@clowder.local>`） |
| 任务来源 | `docs/execution/15-implementation-plan.md` §T7；`docs/execution/task-status-board.md` T7 行 |
| 关联工作项 | 首周最小治理闭环；T8/T10/T13/T16 前置能力 |
| 优先级 | P0 |

## 2. 目标与边界

**任务目标**：
实现方案记录与任务拆解流程，使进入开发前每个任务都有负责人、边界、依赖、产物、Review 方和验收标准，并能被后续 Harness 校验。

**范围内事项**：
- 定义方案记录和任务拆解的最小结构。
- 创建或更新 Task 记录，写入 owner、dependencies、boundary、expected_artifacts、reviewer_agent、acceptance_criteria。
- 复用 T3 Store、T5 状态机、T6 A2A 记录能力。
- 对任务拆解缺字段、Review 方缺失、依赖不满足等情况给出明确错误或阻断原因。
- 补充验证和执行结果文档。

**范围外事项**：
- 不实现完整 Harness 护栏；属于 T8。
- 不实现 Git/worktree 治理；属于 T10。
- 不实现 Review/门禁记录模块；属于 T9。
- 不实现页面主界面；属于 T13。

**完成标准**：
- 可为 WorkItem 生成或更新可执行 Task。
- Task 必须包含负责人、边界、依赖、产物、Review 方、验收标准。
- 缺失关键字段时不得进入可开发状态。
- 能记录任务拆解相关 A2A 事件。
- 非作者 Review 通过。

## 3. 必读材料

- [AGENTS.md](../../AGENTS.md)
- [15-implementation-plan.md](15-implementation-plan.md)
- [task-status-board.md](task-status-board.md)
- [current-action-tracker.md](current-action-tracker.md)
- [../collaboration/03-a2a-collaboration-protocol.md](../collaboration/03-a2a-collaboration-protocol.md)
- [../collaboration/04-harness-governance.md](../collaboration/04-harness-governance.md)
- [../collaboration/13-task-start-package-template.md](../collaboration/13-task-start-package-template.md)
- [../architecture/14-system-architecture-design.md](../architecture/14-system-architecture-design.md)
- [22-t3-persistence-result.md](22-t3-persistence-result.md)
- [30-t4-agent-cli-adapter-result.md](30-t4-agent-cli-adapter-result.md)
- [33-t5-work-item-state-machine-result.md](33-t5-work-item-state-machine-result.md)
- [36-t6-a2a-event-orchestration-result.md](36-t6-a2a-event-orchestration-result.md)

## 4. 分工与协作

| 字段 | 值 |
| --- | --- |
| 主执行 Agent | Codex |
| Review 方 | Claude |
| 协作 Agent | Claude 可从可测试性和实现风险角度质询任务拆解结构 |
| MiniMax 参与 | 不适用，本任务不涉及 UI/视觉/体验判断 |

## 5. 执行约束

| 字段 | 值 |
| --- | --- |
| 允许动作级别 | 文件修改、检查执行、提交准备 |
| 禁止事项 | 不得实现 T8 护栏、T9 门禁、T10 worktree、T13 页面；不得绕过 Review |
| 文件/模块边界 | 与任务拆解、Task 记录、A2A 记录直接相关的 `src/`、`test/`、`docs/execution/` 文件 |
| 维护性注释要求 | 对任务字段校验、状态推进边界、A2A 记录关联补充必要注释 |
| Git 身份要求 | `Clowder Codex <codex@clowder.local>` |
| worktree / 分支要求 | 独立 branch/worktree |

## 6. 验收与门禁

| 字段 | 值 |
| --- | --- |
| 验收标准 | 任务拆解结构完整；缺字段会阻断；Task 写入 T3 Store；必要 A2A 记录可追踪 |
| 验证方式 | `npm run check`、`npm test`，并补充 T7 专属验证 |
| Review 通过标准 | Claude 确认边界清晰、字段完整、未越界实现后续任务 |
| 失败处理 | 缺少关键字段、状态推进不一致或 Store 写入失败时，T7 不得通过 |

## 7. 输出记录

建议输出：
- T7 主结果文档：`docs/execution/40-t7-solution-task-breakdown-result.md`
- T7 Review 文档：`docs/execution/41-t7-review-by-claude.md`

完成后更新 [task-status-board.md](task-status-board.md)。T7 通过后可解除 T8/T10 对 T7 的依赖。
