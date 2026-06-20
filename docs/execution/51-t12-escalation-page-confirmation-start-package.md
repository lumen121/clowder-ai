# T12 任务启动包：人工升级与页面确认流程

> 状态：当前执行启动包
> 所属：执行
> 规则效力：T12 执行上下文、边界、门禁与交付约束
> 维护角色：系统架构师
> 执行身份：Codex
> 任务 ID：T12
> 日期：2026-06-20

## 1. 基本信息

| 字段 | 值 |
| --- | --- |
| 任务 ID | T12 |
| 任务类型 | 功能需求 / 人工升级与页面确认 |
| 当前身份 | Codex（Clowder Codex `<codex@clowder.local>`） |
| 任务来源 | `docs/execution/15-implementation-plan.md` §T12；`docs/execution/task-status-board.md` T12 行 |
| 关联工作项 | 首周最小治理闭环；T13/T16 前置能力 |
| 优先级 | P0 |
| 依赖 | T5、T8，均已完成 |
| Review 方 | Claude |

## 2. 目标与边界

**任务目标**：
对重大歧义、Agent 分歧、门禁失败、高风险动作生成升级记录，并支持页面展示和用户确认结果回写，让阻塞不只停留在聊天文本里。

**范围内事项**：
- 定义并实现 EscalationRecord 的最小创建、更新、查询能力。
- 支持升级原因、触发规则、可选动作、风险说明、推荐动作、影响任务和当前状态。
- 支持页面或页面 API 展示待确认项。
- 支持用户确认、拒绝或补充信息回写，并记录确认人、时间、结论和后续动作。
- 复用 T5 状态机和 T8 Harness 阻断原因。
- 可在 T13A Lite 控制台基础上补最小确认入口，但不得宣称完整 T13 完成。

**范围外事项**：
- 不实现完整 Review / 质量门禁记录模块；属于 T9。
- 不实现完整页面主界面；属于 T13。
- 不实现 Git feature 分支交付；属于 T11。
- 不实现复盘记录模块；属于 T14。
- 不用聊天文本替代结构化确认记录。

**完成标准**：
- 升级记录包含发生了什么、阻塞规则、选项、风险、推荐动作、影响范围和下一步。
- 页面层可以展示阻塞并回写用户确认、拒绝或补充信息。
- 回写结果可被后续状态推进、页面和 T16 验收消费。
- 非作者 Review 通过。

## 3. 必读材料

- [AGENTS.md](../../AGENTS.md)
- [15-implementation-plan.md](15-implementation-plan.md)
- [task-status-board.md](task-status-board.md)
- [current-action-tracker.md](current-action-tracker.md)
- [../product/14-page-user-participation-proposal.md](../product/14-page-user-participation-proposal.md)
- [../product/15-page-change-implementation-clarifications.md](../product/15-page-change-implementation-clarifications.md)
- [../architecture/14-system-architecture-design.md](../architecture/14-system-architecture-design.md)
- [../architecture/16-page-change-architecture-clarifications.md](../architecture/16-page-change-architecture-clarifications.md)
- [../collaboration/04-harness-governance.md](../collaboration/04-harness-governance.md)
- [../collaboration/13-task-start-package-template.md](../collaboration/13-task-start-package-template.md)
- [33-t5-work-item-state-machine-result.md](33-t5-work-item-state-machine-result.md)
- [42-t13a-lite-user-console-result.md](42-t13a-lite-user-console-result.md)
- [46-t8-harness-core-rails-result.md](46-t8-harness-core-rails-result.md)
- [47-t8-review-by-claude.md](47-t8-review-by-claude.md)

## 4. 启动前方案确认

执行 Agent 收到本启动包后，不得直接开始修改实现文件。必须先输出简短实施方案，至少说明：

- 拟新增或修改的文件。
- EscalationRecord 的最小字段和与 T3 Store 的关系。
- 哪些 T8 阻断或高风险动作会生成升级记录。
- 页面/API 如何展示待确认项。
- 用户确认、拒绝或补充信息如何回写。
- 与 T9、T11、T13、T14 的边界。
- 是否涉及页面交互改动，以及 MiniMax 参与或补 Review 安排。
- 验证方式和质量门禁。

若方案与本启动包、产品基线、架构基线或执行计划无冲突，且无待确认歧义，方可进入开发。

## 5. 分工与协作

| 字段 | 值 |
| --- | --- |
| 主执行 Agent | Codex |
| Review 方 | Claude |
| 协作 Agent | Claude 可从确认记录完整性、状态回写和页面边界角度质询 |
| MiniMax 参与 | 若修改页面交互或确认体验，MiniMax 必须参与方案或 Review；如客户端限制导致不能即时参与，必须记录为 T13/T16 前补 Review 的待办，不得静默视为完成 |

## 6. 执行约束

| 字段 | 值 |
| --- | --- |
| 允许动作级别 | 文件修改、检查执行、提交准备；本轮人工确认后可按项目当前协作方式推送到 `origin/master` |
| 禁止事项 | 不得绕过用户确认记录；不得把 T12 扩展成完整 T13/T14/T11；不得 force push、自动部署或自动合并 PR |
| 文件/模块边界 | 与 EscalationRecord、用户确认回写、T8 阻断集成、页面最小确认入口和验证直接相关的 `src/`、`public/`、`test/`、`scripts/`、`docs/execution/` 文件 |
| 维护性注释要求 | 对升级触发条件、确认状态、回写边界、风险动作解释和页面/API 聚合逻辑补充必要注释 |
| Git 身份要求 | 任何 Git 写入动作必须使用 `Clowder Codex <codex@clowder.local>` |
| worktree / 分支要求 | 独立 branch/worktree；结果文档记录 task、branch、worktree、负责人和冲突状态 |
| 推送要求 | 完成实现、自检、非作者 Review 和门禁后，可从任务分支快进推送到 `origin/master`；如非快进、冲突或门禁缺失，必须暂停升级 |

## 7. 验收与门禁

| 字段 | 值 |
| --- | --- |
| 验收标准 | 能生成升级记录；页面/API 可展示待确认项；用户可确认、拒绝或补充；回写结果可追踪并支撑后续状态推进 |
| 验证方式 | `npm run check`、`npm test`，并补充 T12 专属验证，覆盖重大歧义、门禁失败、高风险动作、确认、拒绝、补充信息和页面/API 查询 |
| Review 通过标准 | Claude 确认升级记录可解释、确认回写真实落库、未越界实现 T9/T11/T13/T14 |
| 失败处理 | 升级原因不可解释、确认结果不可追踪或页面/API 不能读取待确认项时，T12 不得通过 |

## 8. 输出记录

建议输出：
- T12 主结果文档：`docs/execution/54-t12-escalation-page-confirmation-result.md`
- T12 Review 文档：`docs/execution/55-t12-review-by-claude.md`

完成后更新 [task-status-board.md](task-status-board.md)。T12 通过后可解除 T13、T16 对 T12 的依赖。
