# T5 任务启动包：工作项状态机

> 状态：当前执行启动包
> 所属：执行
> 规则效力：T5 执行上下文、边界、门禁与交付约束
> 维护角色：系统架构师
> 执行身份：Claude
> 任务 ID：T5
> 日期：2026-06-19

本文基于 [15-implementation-plan.md](15-implementation-plan.md)、[task-status-board.md](task-status-board.md)、[AGENTS.md](../../AGENTS.md) 和 [13-task-start-package-template.md](../collaboration/13-task-start-package-template.md) 生成，用于 T5 启动前下发给执行 Agent。

## 1. 基本信息

| 字段 | 值 |
| --- | --- |
| 任务 ID | T5 |
| 任务类型 | 功能需求 / 核心治理能力实现 |
| 当前身份 | Claude（Clowder Claude `<claude@clowder.local>`） |
| 任务来源 | `docs/execution/15-implementation-plan.md` §T5；`docs/execution/task-status-board.md` T5 行 |
| 关联工作项 | 首周最小治理闭环；T7/T8/T12/T13/T16 的状态基础 |
| 优先级 | P0 |

## 2. 目标与边界

**任务目标**：
实现工作项状态机的最小可用能力，集中定义 WorkItem 状态流转规则、`blocked` 入口、非法状态推进拦截和失败原因记录，避免状态规则散落在页面、CLI、Agent 调用或后续 Harness 逻辑中。

**范围内事项**：
- 定义 WorkItem 状态流转规则。
- 实现合法状态推进。
- 支持从任意阶段进入 `blocked`。
- 拦截非法状态推进，并返回或记录明确原因。
- 复用 T3 的 WorkItem Store 作为状态事实来源。
- 为后续 T7/T8/T12/T13/T16 提供可复用的状态机接口或调用约定。
- 补充 T5 相关验证和执行结果文档。

**范围外事项**：
- 不实现 T4 Agent CLI 适配。
- 不实现 T6 A2A 事件编排。
- 不实现 T7 方案与任务拆解流程。
- 不实现 T8 Harness 完整护栏。
- 不实现页面主界面、阻塞确认页面或复盘页面。
- 不新增第二套 WorkItem 事实来源。
- 不改写产品、架构或固定 Agent 规则基线。

**交付物**：
- 状态机模块与状态规则。
- 状态推进接口或调用约定。
- 非法推进和 `blocked` 入口验证。
- T5 执行结果文档。
- 非作者 Review 记录。

**完成标准**：
- 状态只能按架构允许路径变化。
- `blocked` 可由任意状态进入，并记录原因。
- 非法推进被拒绝，且原因可追踪。
- 状态更新复用 T3 WorkItem Store。
- 不依赖 T4 的 Agent CLI 适配实现细节。
- 状态推进、拒绝和 `blocked` 结果必须支持页面可解释，至少能说明当前状态、目标状态、原因、下一步动作或解除条件，不得只返回技术错误码。
- 非作者 Review 通过。

## 3. 上下文与必读材料

**必读文档**：
- [AGENTS.md](../../AGENTS.md)
- [docs/00-index.md](../00-index.md)
- [docs/agents/06-agent-claude.md](../agents/06-agent-claude.md)
- [docs/agents/05-agent-codex.md](../agents/05-agent-codex.md)
- [15-implementation-plan.md](15-implementation-plan.md)
- [task-status-board.md](task-status-board.md)
- [current-action-tracker.md](current-action-tracker.md)
- [../collaboration/04-harness-governance.md](../collaboration/04-harness-governance.md)
- [../collaboration/13-task-start-package-template.md](../collaboration/13-task-start-package-template.md)
- [../architecture/14-system-architecture-design.md](../architecture/14-system-architecture-design.md)
- [../architecture/17-task-start-package-execution-confirmation.md](../architecture/17-task-start-package-execution-confirmation.md)
- [22-t3-persistence-result.md](22-t3-persistence-result.md)
- [27-t3-page-query-verification.md](27-t3-page-query-verification.md)

**当前任务上下文**：
- T3 已完成，可作为 WorkItem 状态读写事实来源。
- A6 已关闭，T2 页面入口和 CLI 内部入口已统一写入 T3 `work-items.json` Store。
- T4 正由 Codex 并行推进；T5 不依赖 T4，不能强绑定 T4 的未完成接口。
- T5 是 T7、T8、T12、T13、T16 的前置基础之一。

**依赖任务**：
- 硬依赖：T3 已完成。
- 前置确认：A5、A6 已完成。

**默认假设**：
- WorkItem 当前状态字段以 T3 `WORK_ITEM_STATUSES` 和架构状态机为基线。
- 首版状态机保持简单、集中、可测试，不引入复杂工作流自定义。

## 3.1 启动前方案确认

执行 Agent 收到本启动包后，不得直接开始修改实现文件。必须先输出简短实施方案，至少说明：

- 拟新增或修改的文件。
- 状态流转规则如何集中定义。
- 如何复用 T3 WorkItem Store。
- 非法推进和 `blocked` 原因如何返回或记录。
- 与 T4/T6/T8 的边界。
- 验证方式和质量门禁。
- 主要风险和需要确认的问题。

若方案与本启动包、产品基线、架构基线或执行计划无冲突，且无待确认歧义，方可进入开发。

## 4. 分工与协作

| 字段 | 值 |
| --- | --- |
| 主执行 Agent | Claude |
| 协作 Agent | 无固定协作执行 Agent；如与 T4/T6/T8 边界出现冲突，升级系统架构师 |
| Review 方 | Codex |
| A2A 协作要求 | 如状态流转规则、持久化字段或后续 Harness 边界有歧义，应先发起澄清，不得自行扩大范围 |
| MiniMax 参与要求 | 不适用；本任务不涉及 UI、视觉或交互体验判断 |

## 5. 执行约束

| 字段 | 值 |
| --- | --- |
| 允许动作级别 | 文件修改、检查执行、提交准备 |
| 禁止事项 | 不得实现完整 Harness 护栏；不得实现 A2A 编排；不得新增第二套 WorkItem 存储；不得部署；不得合并主干；不得绕过非作者 Review 或质量门禁 |
| 文件/模块边界 | 可新增或修改与状态机直接相关的 `src/` 模块、必要的 `test/`、`scripts/`、`docs/execution/` 文件。若需修改 `src/storage/` 或 `src/index.js`，必须保持窄范围导出或集成，不得改写 T3 Store 语义 |
| 维护性注释要求 | 必须为非显而易见的状态流转规则、`blocked` 入口、非法推进原因和后续 Harness 边界补充维护性注释 |
| Git 身份要求 | 任何 Git 写入动作必须使用 `Clowder Claude <claude@clowder.local>` |
| worktree / 分支要求 | 必须在独立 branch/worktree 中执行，并在结果文档中记录任务、branch、worktree、负责人和冲突状态 |
| 高风险动作限制 | 不得创建 PR、不得部署、不得合并到 `main`、不得执行破坏性文件操作 |

## 6. 验收与门禁

| 字段 | 值 |
| --- | --- |
| 验收标准 | 合法状态推进通过；非法推进被拒绝；`blocked` 可从任意状态进入；状态更新写回 T3 WorkItem Store；原因可追踪且页面可解释；T7/T8/T12 可复用 |
| 验证方式 | 至少运行 `npm run check`、`npm test`，并补充 T5 状态机专属验证，覆盖主路径、`needs_fix -> in_development`、`blocked` 入口、非法跳转拒绝 |
| Review 通过标准 | Codex 确认：状态规则集中、与架构状态机一致、未越界实现 T6/T8、未新增第二事实来源、验证覆盖关键路径 |
| 质量门禁 | 自动检查和 T5 专属验证必须通过；失败原因必须记录，不能静默推进 |
| 失败处理 | 任一状态规则不一致、非法推进未拦截或写回事实来源不统一时，T5 保持待修复或阻塞，不得交接给 T7/T8/T12 |

## 7. 人工升级条件

出现以下情况时，必须升级给系统架构师或产品负责人：
- 架构状态机与现有 T3 状态枚举冲突。
- 需要新增产品状态或改变 P0 验收口径。
- 需要修改 T3 Store 核心语义。
- 与 T4 并行实现发生文件或接口冲突。
- 无法建立独立 branch/worktree。
- 需要绕过 Review、质量门禁或安全限制。

## 8. 输出记录要求

执行 Agent 完成 T5 后，至少要记录：
- 实际完成内容。
- 未完成内容和原因。
- 修改过的文件。
- 状态流转规则摘要。
- 非法推进和 `blocked` 验证证据。
- 状态推进、拒绝或 `blocked` 场景下的页面可解释信息示例。
- 与 T3 Store 的集成证据。
- 启动前实施方案及是否存在冲突或歧义。
- Review 结论或待 Review 状态。
- 建议下一状态或交接状态。
- 是否解除 T7/T8/T12 对 T5 的依赖阻塞。
- 是否仍阻断后续任务。
- 遗留风险。

状态更新要求：
- T5 启动后，将 [task-status-board.md](task-status-board.md) 中 T5 状态从 `未开始` 更新为 `方案中` 或 `开发中`。
- 完成实现和作者自检后，将 T5 状态更新为 `待 Review`，并链接 T5 主结果文档。
- 只有产生新的补录项、确认项、跨任务阻塞或临时开放事项时，才更新 [current-action-tracker.md](current-action-tracker.md)。

建议输出位置：
- T5 主结果文档：`docs/execution/33-t5-work-item-state-machine-result.md`
- T5 非作者 Review 文档：`docs/execution/34-t5-review-by-codex.md`

建议下一状态或交接状态：
- 若 T5 通过：解除 T7/T8/T12 对 T5 的依赖阻塞。
- 若 T5 阻塞：T7/T8/T12 不得按状态机已可用前提启动。
