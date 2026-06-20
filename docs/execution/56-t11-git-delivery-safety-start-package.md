# T11 任务启动包：Git feature 分支交付安全流程

> 状态：当前执行启动包
> 所属：执行
> 规则效力：T11 执行上下文、边界、门禁与交付约束
> 维护角色：系统架构师
> 执行身份：Codex
> 任务 ID：T11
> 日期：2026-06-20

## 1. 基本信息

| 字段 | 值 |
| --- | --- |
| 任务 ID | T11 |
| 任务类型 | 功能需求 / Git 交付安全治理 |
| 当前身份 | Codex（Clowder Codex `<codex@clowder.local>`） |
| 任务来源 | `docs/execution/15-implementation-plan.md` §T11；`docs/execution/task-status-board.md` T11 行 |
| 关联工作项 | 首周最小治理闭环；T16 前置能力 |
| 优先级 | P0 |
| 依赖 | T8、T9、T10，均已完成 |
| Review 方 | Claude |

## 2. 目标与边界

**任务目标**：
实现交付前检查、禁止未授权主干交付、feature 分支推送能力和 Git 身份归因记录，确保交付动作只能在 Review、质量门禁和 worktree 绑定满足后推进。

**范围内事项**：
- 实现交付前检查，校验 T8 Harness、T9 Review / 门禁、T10 worktree 绑定状态。
- 校验 Git 写入动作使用当前执行 Agent 对应的 `user.name` 和占位 `user.email`。
- 支持 feature 分支推送前的最小检查和结果记录。
- 对主干交付、高风险动作、缺少 Review / 门禁 / worktree 绑定等情况返回明确阻断原因。
- 记录交付检查结果、分支、commit、推送状态、执行 Agent 和阻断原因。

**范围外事项**：
- 不自动创建 GitHub PR；PR 创建保持可选。
- 不自动合并 PR。
- 不自动部署。
- 不实现复杂语义冲突自动判定。
- 不绕过项目当前人工确认口径直接降低主干保护。

**完成标准**：
- 未满足 Review、质量门禁、worktree 绑定或 Git 身份归因时，不能进入 ready_to_commit / ready_to_push。
- 默认禁止未授权主干交付和高风险动作；如需直接推送 `master`，必须以启动包或用户明确授权为准，并保留检查记录。
- 门禁通过后具备 feature 分支推送能力。
- 非作者 Review 通过。

## 3. 必读材料

- [AGENTS.md](../../AGENTS.md)
- [15-implementation-plan.md](15-implementation-plan.md)
- [task-status-board.md](task-status-board.md)
- [current-action-tracker.md](current-action-tracker.md)
- [../collaboration/04-harness-governance.md](../collaboration/04-harness-governance.md)
- [../collaboration/13-task-start-package-template.md](../collaboration/13-task-start-package-template.md)
- [../architecture/14-system-architecture-design.md](../architecture/14-system-architecture-design.md)
- [46-t8-harness-core-rails-result.md](46-t8-harness-core-rails-result.md)
- [52-t9-review-quality-gate-result.md](52-t9-review-quality-gate-result.md)
- [54-t9-review-by-codex.md](54-t9-review-by-codex.md)
- [48-t10-worktree-isolation-result.md](48-t10-worktree-isolation-result.md)
- [49-t10-review-by-codex.md](49-t10-review-by-codex.md)

## 4. 启动前方案确认

执行 Agent 收到本启动包后，不得直接开始修改实现文件。必须先输出简短实施方案，至少说明：

- 拟新增或修改的文件。
- 交付前检查的输入、输出和失败原因。
- 如何消费 T8/T9/T10 的结果。
- 如何校验 Git 身份、当前分支、目标分支、worktree 绑定和门禁状态。
- 如何记录 feature 分支推送状态。
- 直接推送 `master` 与 feature 分支推送的风险边界。
- 验证方式和质量门禁。
- 主要风险和需要确认的问题。

若方案与本启动包、产品基线、架构基线或执行计划无冲突，且无待确认歧义，方可进入开发。

## 5. 分工与协作

| 字段 | 值 |
| --- | --- |
| 主执行 Agent | Codex |
| Review 方 | Claude |
| 协作 Agent | Claude 可从 Git 风险、门禁遗漏和误触主干角度质询 |
| MiniMax 参与 | 不适用，本任务不涉及 UI/视觉/体验判断 |

## 6. 执行约束

| 字段 | 值 |
| --- | --- |
| 允许动作级别 | 文件修改、检查执行、提交准备；本轮人工确认后可按项目当前协作方式推送到 `origin/master` |
| 禁止事项 | 不得自动创建 PR、自动合并 PR、自动部署、force push、绕过 Review 或绕过质量门禁 |
| 文件/模块边界 | 与 Git 交付检查、feature 分支推送检查、Git 身份归因、交付记录和验证直接相关的 `src/`、`test/`、`scripts/`、`docs/execution/` 文件 |
| 维护性注释要求 | 对主干风险判断、feature 分支推送检查、Git 身份归因和门禁依赖补充必要注释 |
| Git 身份要求 | 任何 Git 写入动作必须使用 `Clowder Codex <codex@clowder.local>` |
| worktree / 分支要求 | 独立 branch/worktree；结果文档记录 task、branch、worktree、负责人和冲突状态 |
| 推送要求 | 完成实现、自检、非作者 Review 和门禁后，可从任务分支快进推送到 `origin/master`；如非快进、冲突或门禁缺失，必须暂停升级 |

## 7. 验收与门禁

| 字段 | 值 |
| --- | --- |
| 验收标准 | 未满足 T8/T9/T10 条件不能 ready_to_commit / ready_to_push；Git 身份可归因；主干/高风险动作可拦截；feature 分支推送检查可记录 |
| 验证方式 | `npm run check`、`npm test`，并补充 T11 专属验证，覆盖门禁通过、缺 Review、门禁失败、worktree 未绑定、Git 身份错误、主干风险和 feature 分支推送检查 |
| Review 通过标准 | Claude 确认交付检查不绕过内部 Review/门禁，且未把 PR 创建、部署或自动合并纳入 T11 |
| 失败处理 | 任一交付前置条件不可检查、Git 身份不可追踪或主干风险不可拦截时，T11 不得通过 |

## 8. 输出记录

建议输出：
- T11 主结果文档：`docs/execution/59-t11-git-delivery-safety-result.md`
- T11 Review 文档：`docs/execution/60-t11-review-by-claude.md`

完成后更新 [task-status-board.md](task-status-board.md)。T11 通过后可解除 T16 对交付检查能力的依赖。
