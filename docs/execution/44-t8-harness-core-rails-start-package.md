# T8 任务启动包：Harness 核心护栏

> 状态：当前执行启动包
> 所属：执行
> 规则效力：T8 执行上下文、边界、门禁与交付约束
> 维护角色：系统架构师
> 执行身份：Codex
> 任务 ID：T8
> 日期：2026-06-20

## 1. 基本信息

| 字段 | 值 |
| --- | --- |
| 任务 ID | T8 |
| 任务类型 | 功能需求 / Harness 治理能力 |
| 当前身份 | Codex（Clowder Codex `<codex@clowder.local>`） |
| 任务来源 | `docs/execution/15-implementation-plan.md` §T8；`docs/execution/task-status-board.md` T8 行 |
| 关联工作项 | 首周最小治理闭环；T9/T11/T12/T16 前置能力 |
| 优先级 | P0 |
| 依赖 | T5、T7，均已完成 |
| Review 方 | Claude |

## 2. 目标与边界

**任务目标**：
实现 Harness 核心护栏，强制执行方案先行、任务拆解完整、非作者 Review、质量门禁前置检查和高风险动作拦截。

**范围内事项**：
- 校验任务是否具备方案、任务拆解、负责人、依赖、边界、产物、Review 方和验收标准。
- 校验非作者 Review 和质量门禁结果是否满足状态推进要求。
- 拦截缺少维护性注释要求、Git 身份归因或高风险动作确认的交付推进。
- 复用 T5 状态机和 T7 任务拆解能力，产出可追踪阻断原因。
- 补充 T8 专属验证和执行结果文档。

**范围外事项**：
- 不实现 Review 与质量门禁记录模块；属于 T9。
- 不实现 Worktree / 分支隔离治理；属于 T10。
- 不实现 Git feature 分支交付安全流程；属于 T11。
- 不实现页面确认界面；属于 T12/T13。
- 不修改产品、架构或固定 Agent 规则基线来降低门禁。

**完成标准**：
- 未完成方案、任务拆解、Review 或质量门禁时，不能进入开发完成、交付准备或交付状态。
- 缺少必要维护性注释要求或 Git 身份不可归因时，不得放行交付。
- 高风险动作必须被拦截并返回明确原因。
- 阻断原因可被页面或执行记录消费。
- 非作者 Review 通过。

## 3. 必读材料

- [AGENTS.md](../../AGENTS.md)
- [15-implementation-plan.md](15-implementation-plan.md)
- [task-status-board.md](task-status-board.md)
- [current-action-tracker.md](current-action-tracker.md)
- [../collaboration/04-harness-governance.md](../collaboration/04-harness-governance.md)
- [../collaboration/13-task-start-package-template.md](../collaboration/13-task-start-package-template.md)
- [../architecture/14-system-architecture-design.md](../architecture/14-system-architecture-design.md)
- [../architecture/17-task-start-package-execution-confirmation.md](../architecture/17-task-start-package-execution-confirmation.md)
- [33-t5-work-item-state-machine-result.md](33-t5-work-item-state-machine-result.md)
- [40-t7-solution-task-breakdown-result.md](40-t7-solution-task-breakdown-result.md)
- [41-t7-review-by-claude.md](41-t7-review-by-claude.md)

## 4. 启动前方案确认

执行 Agent 收到本启动包后，不得直接开始修改实现文件。必须先输出简短实施方案，至少说明：

- 拟新增或修改的文件。
- Harness 护栏判定入口和调用方式。
- 如何复用 T5 状态机与 T7 任务拆解结果。
- 如何表达阻断原因、下一步动作和高风险动作拦截。
- 与 T9、T10、T11、T12 的边界。
- 验证方式和质量门禁。
- 主要风险和需要确认的问题。

若方案与本启动包、产品基线、架构基线或执行计划无冲突，且无待确认歧义，方可进入开发。

## 5. 分工与协作

| 字段 | 值 |
| --- | --- |
| 主执行 Agent | Codex |
| Review 方 | Claude |
| 协作 Agent | Claude 可从护栏过硬、边界越界和可测试性角度质询 |
| MiniMax 参与 | 不适用，本任务不涉及 UI/视觉/体验判断 |

## 6. 执行约束

| 字段 | 值 |
| --- | --- |
| 允许动作级别 | 文件修改、检查执行、提交准备；本轮人工确认后可按项目当前协作方式推送到 `origin/master` |
| 禁止事项 | 不得绕过 Review、质量门禁或高风险动作确认；不得实现 T9/T10/T11/T12；不得 force push、自动部署或自动合并 PR |
| 文件/模块边界 | 与 Harness 护栏、状态推进判定、任务拆解校验直接相关的 `src/`、`test/`、`scripts/`、`docs/execution/` 文件 |
| 维护性注释要求 | 对护栏判定逻辑、阻断原因、高风险动作分类和状态推进边界补充必要注释 |
| Git 身份要求 | 任何 Git 写入动作必须使用 `Clowder Codex <codex@clowder.local>` |
| worktree / 分支要求 | 独立 branch/worktree；结果文档记录 task、branch、worktree、负责人和冲突状态 |
| 推送要求 | 完成实现、自检、非作者 Review 和门禁后，可从任务分支快进推送到 `origin/master`；如非快进、冲突或门禁缺失，必须暂停升级 |

## 7. 验收与门禁

| 字段 | 值 |
| --- | --- |
| 验收标准 | 缺少方案/拆解/Review/门禁时不能推进；维护性注释和 Git 身份缺失可拦截；高风险动作被拦截；阻断原因可追踪 |
| 验证方式 | `npm run check`、`npm test`，并补充 T8 专属验证，覆盖成功推进、缺字段阻断、缺 Review 阻断、门禁失败阻断和高风险动作阻断 |
| Review 通过标准 | Claude 确认护栏覆盖关键门禁，且未越界实现 T9/T10/T11/T12 |
| 失败处理 | 任一关键门禁不可拦截、阻断原因不可追踪或状态推进绕过护栏时，T8 不得通过 |

## 8. 输出记录

建议输出：
- T8 主结果文档：`docs/execution/46-t8-harness-core-rails-result.md`
- T8 Review 文档：`docs/execution/47-t8-review-by-claude.md`

完成后更新 [task-status-board.md](task-status-board.md)。T8 通过后可解除 T9、T11、T12 对 T8 的依赖。
