# T10 任务启动包：Worktree 与任务隔离最小治理

> 状态：当前执行启动包
> 所属：执行
> 规则效力：T10 执行上下文、边界、门禁与交付约束
> 维护角色：系统架构师
> 执行身份：Claude
> 任务 ID：T10
> 日期：2026-06-20

## 1. 基本信息

| 字段 | 值 |
| --- | --- |
| 任务 ID | T10 |
| 任务类型 | 功能需求 / 并行开发治理 |
| 当前身份 | Claude（Clowder Claude `<claude@clowder.local>`） |
| 任务来源 | `docs/execution/15-implementation-plan.md` §T10；`docs/execution/task-status-board.md` T10 行 |
| 关联工作项 | 首周最小治理闭环；T11/T16 前置能力 |
| 优先级 | P0 |
| 依赖 | T3、T7，均已完成 |
| Review 方 | Codex |

## 2. 目标与边界

**任务目标**：
实现任务到 branch/worktree 的最小治理，记录绑定关系、冲突状态和合并前最小检查，为后续并行开发提供可追踪隔离。

**范围内事项**：
- 记录 task、agent、branch、worktree、base_ref、changed_files、merge_order、conflict_status、cleanup_status。
- 提供最小创建/更新/查询接口或约定。
- 提供合并前最小检查，确认任务、分支/worktree 绑定和冲突状态。
- 复用 T3 `WorkspaceRecord` 和 T7 任务拆解结果。
- 补充 T10 专属验证和执行结果文档。

**范围外事项**：
- 不实现完整自动合并。
- 不实现 Git feature 分支交付策略；属于 T11。
- 不实现 Harness 核心护栏；属于 T8。
- 不实现页面视图；可保持记录可被后续页面消费。
- 不修改产品、架构或固定 Agent 规则基线来放宽隔离要求。

**完成标准**：
- 能登记每个任务的隔离工作区和分支绑定。
- 能查询冲突状态、清理状态和合并顺序。
- 合并前能检查分支/worktree 绑定和冲突状态。
- 不做完整自动合并。
- 非作者 Review 通过。

## 3. 必读材料

- [AGENTS.md](../../AGENTS.md)
- [15-implementation-plan.md](15-implementation-plan.md)
- [task-status-board.md](task-status-board.md)
- [current-action-tracker.md](current-action-tracker.md)
- [../collaboration/04-harness-governance.md](../collaboration/04-harness-governance.md)
- [../collaboration/13-task-start-package-template.md](../collaboration/13-task-start-package-template.md)
- [../architecture/14-system-architecture-design.md](../architecture/14-system-architecture-design.md)
- [22-t3-persistence-result.md](22-t3-persistence-result.md)
- [40-t7-solution-task-breakdown-result.md](40-t7-solution-task-breakdown-result.md)
- [41-t7-review-by-claude.md](41-t7-review-by-claude.md)

## 4. 启动前方案确认

执行 Agent 收到本启动包后，不得直接开始修改实现文件。必须先输出简短实施方案，至少说明：

- 拟新增或修改的文件。
- WorkspaceRecord 的最小字段和与 T3 Store 的关系。
- 如何绑定 task / agent / branch / worktree。
- 如何记录 changed_files、merge_order、conflict_status、cleanup_status。
- 合并前最小检查的输入、输出和失败原因。
- 与 T8、T11 的边界。
- 验证方式和质量门禁。
- 主要风险和需要确认的问题。

若方案与本启动包、产品基线、架构基线或执行计划无冲突，且无待确认歧义，方可进入开发。

## 5. 分工与协作

| 字段 | 值 |
| --- | --- |
| 主执行 Agent | Claude |
| Review 方 | Codex |
| 协作 Agent | Codex 可从 T11 边界、Git 风险和可测试性角度质询 |
| MiniMax 参与 | 不适用，本任务不涉及 UI/视觉/体验判断 |

## 6. 执行约束

| 字段 | 值 |
| --- | --- |
| 允许动作级别 | 文件修改、检查执行、提交准备；本轮人工确认后可按项目当前协作方式推送到 `origin/master` |
| 禁止事项 | 不得实现完整自动合并；不得实现 T11 Git 交付策略；不得 force push、自动部署或自动合并 PR；不得绕过 Review/门禁 |
| 文件/模块边界 | 与 WorkspaceRecord、任务隔离、分支/worktree 绑定、合并前最小检查直接相关的 `src/`、`test/`、`scripts/`、`docs/execution/` 文件 |
| 维护性注释要求 | 对 branch/worktree 绑定、冲突状态语义、合并前检查边界和失败原因补充必要注释 |
| Git 身份要求 | 任何 Git 写入动作必须使用 `Clowder Claude <claude@clowder.local>` |
| worktree / 分支要求 | 独立 branch/worktree；结果文档记录 task、branch、worktree、负责人和冲突状态 |
| 推送要求 | 完成实现、自检、非作者 Review 和门禁后，可从任务分支快进推送到 `origin/master`；如非快进、冲突或门禁缺失，必须暂停升级 |

## 7. 验收与门禁

| 字段 | 值 |
| --- | --- |
| 验收标准 | 能登记任务隔离信息；能查询冲突状态；能做合并前最小检查；不做自动合并；记录可被后续 T11/T16 消费 |
| 验证方式 | `npm run check`、`npm test`，并补充 T10 专属验证，覆盖绑定登记、状态查询、冲突状态、合并前失败和通过场景 |
| Review 通过标准 | Codex 确认 T10 与 T11 边界清晰，且能支撑并行治理 |
| 失败处理 | 任务与分支/worktree 无法绑定、冲突状态不可追踪或合并前检查不可解释时，T10 不得通过 |

## 8. 输出记录

建议输出：
- T10 主结果文档：`docs/execution/48-t10-worktree-isolation-result.md`
- T10 Review 文档：`docs/execution/49-t10-review-by-codex.md`

完成后更新 [task-status-board.md](task-status-board.md)。T10 通过后可解除 T11 对 T10 的依赖。
