# T9 任务启动包：Review 与质量门禁记录

> 状态：当前执行启动包
> 所属：执行
> 规则效力：T9 执行上下文、边界、门禁与交付约束
> 维护角色：系统架构师
> 执行身份：Claude
> 任务 ID：T9
> 日期：2026-06-20

## 1. 基本信息

| 字段 | 值 |
| --- | --- |
| 任务 ID | T9 |
| 任务类型 | 功能需求 / Review 与质量治理记录 |
| 当前身份 | Claude（Clowder Claude `<claude@clowder.local>`） |
| 任务来源 | `docs/execution/15-implementation-plan.md` §T9；`docs/execution/task-status-board.md` T9 行 |
| 关联工作项 | 首周最小治理闭环；T11/T13/T14/T16 前置能力 |
| 优先级 | P0 |
| 依赖 | T3、T8，均已完成 |
| Review 方 | Codex |

## 2. 目标与边界

**任务目标**：
实现非作者 Review 记录与质量门禁运行记录的最小可用能力，让 Review 结论、修改要求、质量门禁结果和失败原因可追踪、可查询、可被后续 Harness / 页面 / 复盘消费。

**范围内事项**：
- 定义并实现 ReviewRecord 的最小创建、更新、查询能力。
- 定义并实现 QualityGateRun 的最小创建、更新、查询能力。
- Review 结论只能使用已确认枚举：通过、需要修改、存在争议、需用户确认。
- 质量门禁失败必须记录失败命令、失败摘要、影响范围和下一步动作。
- 将 Review / 门禁记录与 work_item、task、agent、reviewer、关联 A2A 事件或 Harness 阻断原因绑定。
- 提供 T9 专属验证和执行结果文档。

**范围外事项**：
- 不实现 Harness 核心拦截规则；属于 T8。
- 不实现 Git feature 分支交付安全流程；属于 T11。
- 不实现页面主界面；属于 T13。
- 不实现复盘记录模块；属于 T14。
- 不把 GitHub PR Review 当作内部 A2A Review 的替代。

**完成标准**：
- Review 结果只能落入四类允许结论。
- 失败门禁不能被静默跳过，必须可查询失败原因和下一步。
- Review / 门禁记录可被后续 T11、T13、T14、T16 消费。
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
- [36-t6-a2a-event-orchestration-result.md](36-t6-a2a-event-orchestration-result.md)
- [46-t8-harness-core-rails-result.md](46-t8-harness-core-rails-result.md)
- [47-t8-review-by-claude.md](47-t8-review-by-claude.md)

## 4. 启动前方案确认

执行 Agent 收到本启动包后，不得直接开始修改实现文件。必须先输出简短实施方案，至少说明：

- 拟新增或修改的文件。
- ReviewRecord 与 QualityGateRun 的最小字段和与 T3 Store 的关系。
- Review 结论枚举如何校验。
- 质量门禁失败如何记录命令、摘要、影响范围和下一步。
- 如何与 T8 Harness 护栏对接但不重复实现 T8。
- 如何供后续 T11/T13/T14 查询。
- 验证方式和质量门禁。
- 主要风险和需要确认的问题。

若方案与本启动包、产品基线、架构基线或执行计划无冲突，且无待确认歧义，方可进入开发。

## 5. 分工与协作

| 字段 | 值 |
| --- | --- |
| 主执行 Agent | Claude |
| Review 方 | Codex |
| 协作 Agent | Codex 可从 Harness 边界、记录可查询性和交付安全前置条件角度质询 |
| MiniMax 参与 | 不适用，本任务不涉及 UI/视觉/体验判断 |

## 6. 执行约束

| 字段 | 值 |
| --- | --- |
| 允许动作级别 | 文件修改、检查执行、提交准备；本轮人工确认后可按项目当前协作方式推送到 `origin/master` |
| 禁止事项 | 不得绕过非作者 Review；不得把 T9 扩展成 T11/T13/T14；不得 force push、自动部署或自动合并 PR |
| 文件/模块边界 | 与 ReviewRecord、QualityGateRun、门禁结果记录、查询和验证直接相关的 `src/`、`test/`、`scripts/`、`docs/execution/` 文件 |
| 维护性注释要求 | 对 Review 结论枚举、门禁失败归一化、记录绑定关系和不可跳过规则补充必要注释 |
| Git 身份要求 | 任何 Git 写入动作必须使用 `Clowder Claude <claude@clowder.local>` |
| worktree / 分支要求 | 独立 branch/worktree；结果文档记录 task、branch、worktree、负责人和冲突状态 |
| 推送要求 | 完成实现、自检、非作者 Review 和门禁后，可从任务分支快进推送到 `origin/master`；如非快进、冲突或门禁缺失，必须暂停升级 |

## 7. 验收与门禁

| 字段 | 值 |
| --- | --- |
| 验收标准 | Review 结果枚举受限；失败门禁可见且不可静默跳过；记录可按 work_item/task/agent 查询；T11/T13/T14 可消费 |
| 验证方式 | `npm run check`、`npm test`，并补充 T9 专属验证，覆盖 Review 通过、需要修改、争议、需用户确认、门禁成功、门禁失败和非法结论拒绝 |
| Review 通过标准 | Codex 确认记录结构清晰、失败门禁不可被忽略、未越界实现 T11/T13/T14 |
| 失败处理 | Review 结论不可控、门禁失败不可追踪或记录不能查询时，T9 不得通过 |

## 8. 输出记录

建议输出：
- T9 主结果文档：`docs/execution/52-t9-review-quality-gate-result.md`
- T9 Review 文档：`docs/execution/53-t9-review-by-codex.md`

完成后更新 [task-status-board.md](task-status-board.md)。T9 通过后可解除 T11、T13、T14 对 T9 的依赖。
