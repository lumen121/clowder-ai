# T14 任务启动包：复盘记录最小闭环

> 状态：当前执行启动包
> 所属：执行
> 规则效力：T14 执行上下文、边界、门禁与交付约束
> 维护角色：系统架构师
> 执行身份：Claude
> 任务 ID：T14
> 日期：2026-06-20

## 1. 基本信息

| 字段 | 值 |
| --- | --- |
| 任务 ID | T14 |
| 任务类型 | 功能需求 / 复盘记录与 Dogfooding 基础 |
| 当前身份 | Claude（Clowder Claude `<claude@clowder.local>`） |
| 任务来源 | `docs/execution/15-implementation-plan.md` §T14；`docs/execution/task-status-board.md` T14 行 |
| 关联工作项 | 首周最小治理闭环；T15/T16 前置能力 |
| 优先级 | P0 |
| 依赖 | T3、T6、T9，均已完成 |
| Review 方 | Codex |

## 2. 目标与边界

**任务目标**：
支持工作项完成或失败后生成结构化复盘记录，记录参与 Agent、返工、门禁、失败原因、复盘结论和改进建议，并让结果可被页面层和 Dogfooding 消费。

**范围内事项**：
- 定义并实现 RetrospectiveMemory 的最小创建、更新、查询能力。
- 聚合 WorkItem、A2AEvent、ReviewRecord、QualityGateRun、EscalationRecord 的关键事实。
- 记录参与 Agent、Review 发现、质量门禁结果、返工次数、失败原因、复盘结论、改进建议和技术执行建议。
- 让复盘记录能进入时间线或页面查询视角，供 T13/T16 展示。
- 补充 T14 专属验证和执行结果文档。

**范围外事项**：
- 不实现 T15 Dogfooding 指标增强。
- 不实现完整页面主界面；属于 T13。
- 不自动修改产品规则、架构规则或 AGENTS 固定规则。
- 不把自由文本复盘当作唯一结构化记录。

**完成标准**：
- 完成或失败工作项能生成结构化复盘记录。
- 复盘记录区分事实、结论、改进建议和技术执行建议。
- T16 可验证复盘记录已进入时间线、本地记忆和页面复盘视图。
- 非作者 Review 通过。

## 3. 必读材料

- [AGENTS.md](../../AGENTS.md)
- [15-implementation-plan.md](15-implementation-plan.md)
- [task-status-board.md](task-status-board.md)
- [current-action-tracker.md](current-action-tracker.md)
- [../collaboration/04-harness-governance.md](../collaboration/04-harness-governance.md)
- [../collaboration/10-dogfooding-plan.md](../collaboration/10-dogfooding-plan.md)
- [../collaboration/13-task-start-package-template.md](../collaboration/13-task-start-package-template.md)
- [../architecture/14-system-architecture-design.md](../architecture/14-system-architecture-design.md)
- [22-t3-persistence-result.md](22-t3-persistence-result.md)
- [36-t6-a2a-event-orchestration-result.md](36-t6-a2a-event-orchestration-result.md)
- [52-t9-review-quality-gate-result.md](52-t9-review-quality-gate-result.md)
- [54-t12-escalation-page-confirmation-result.md](54-t12-escalation-page-confirmation-result.md)

## 4. 启动前方案确认

执行 Agent 收到本启动包后，不得直接开始修改实现文件。必须先输出简短实施方案，至少说明：

- 拟新增或修改的文件。
- RetrospectiveMemory 的最小字段和与 T3 Store 的关系。
- 如何聚合 A2A、Review、门禁、升级确认和工作项状态。
- 如何区分复盘事实、结论、改进建议和技术执行建议。
- 如何供 T13/T16 页面或查询视角消费。
- 与 T15 Dogfooding 指标增强的边界。
- 验证方式和质量门禁。
- 主要风险和需要确认的问题。

若方案与本启动包、产品基线、架构基线或执行计划无冲突，且无待确认歧义，方可进入开发。

## 5. 分工与协作

| 字段 | 值 |
| --- | --- |
| 主执行 Agent | Claude |
| Review 方 | Codex |
| 协作 Agent | Codex 可从复盘规则边界、产品规则误吸收和 T16 可验证性角度质询 |
| MiniMax 参与 | 不适用，除非实现直接改动页面体验；若改动页面展示体验，应请求 MiniMax Review 或记录 T13/T16 前补 Review |

## 6. 执行约束

| 字段 | 值 |
| --- | --- |
| 允许动作级别 | 文件修改、检查执行、提交准备；本轮人工确认后可按项目当前协作方式推送到 `origin/master` |
| 禁止事项 | 不得自动修改产品/架构/AGENTS 规则；不得实现 T15 指标增强；不得 force push、自动部署或自动合并 PR |
| 文件/模块边界 | 与 RetrospectiveMemory、复盘生成、复盘查询、页面可消费摘要和验证直接相关的 `src/`、`test/`、`scripts/`、`docs/execution/` 文件 |
| 维护性注释要求 | 对复盘事实聚合、结论生成边界、技术建议分类和规则不自动生效逻辑补充必要注释 |
| Git 身份要求 | 任何 Git 写入动作必须使用 `Clowder Claude <claude@clowder.local>` |
| worktree / 分支要求 | 独立 branch/worktree；结果文档记录 task、branch、worktree、负责人和冲突状态 |
| 推送要求 | 完成实现、自检、非作者 Review 和门禁后，可从任务分支快进推送到 `origin/master`；如非快进、冲突或门禁缺失，必须暂停升级 |

## 7. 验收与门禁

| 字段 | 值 |
| --- | --- |
| 验收标准 | 完成/失败工作项可生成结构化复盘；记录参与 Agent、返工、Review、门禁、失败原因、结论和建议；页面/T16 可消费 |
| 验证方式 | `npm run check`、`npm test`，并补充 T14 专属验证，覆盖成功工作项、失败工作项、门禁失败、Review 修改、升级确认和技术建议分类 |
| Review 通过标准 | Codex 确认复盘结构化、不会自动变成产品规则、未越界实现 T15/T13/T16 |
| 失败处理 | 复盘只能自由文本、无法聚合关键事实、无法被页面/T16 查询或混淆规则效力时，T14 不得通过 |

## 8. 输出记录

建议输出：
- T14 主结果文档：`docs/execution/63-t14-retrospective-loop-result.md`
- T14 Review 文档：`docs/execution/64-t14-review-by-codex.md`

完成后更新 [task-status-board.md](task-status-board.md)。T14 通过后可解除 T15、T16 对复盘记录能力的依赖。
