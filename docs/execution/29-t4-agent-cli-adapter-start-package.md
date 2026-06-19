# T4 任务启动包：Agent CLI 适配与最小调用闭环

> 状态：当前执行启动包
> 所属：执行
> 规则效力：T4 执行上下文、边界、门禁与交付约束
> 维护角色：系统架构师
> 执行身份：Codex
> 任务 ID：T4
> 日期：2026-06-19

本文基于 [15-implementation-plan.md](15-implementation-plan.md)、[task-status-board.md](task-status-board.md)、[AGENTS.md](../../AGENTS.md) 和 [13-task-start-package-template.md](../collaboration/13-task-start-package-template.md) 生成，用于 T4 启动前下发给执行 Agent。

## 1. 基本信息

| 字段 | 值 |
| --- | --- |
| 任务 ID | T4 |
| 任务类型 | 功能需求 / 基础能力实现 |
| 当前身份 | Codex（Clowder Codex `<codex@clowder.local>`） |
| 任务来源 | `docs/execution/15-implementation-plan.md` §T4；`docs/execution/task-status-board.md` T4 行 |
| 关联工作项 | 首周最小治理闭环；T6 的前置适配能力 |
| 优先级 | P0 |

## 2. 目标与边界

**任务目标**：
实现 Agent CLI 适配层的最小可用闭环，让系统能够以结构化任务上下文真实调用 Codex、Claude、MiniMax 三个本地 CLI，并把响应结果以可追踪形式回写为持久化记录，供后续 T6 A2A 事件编排和 T8 Harness 护栏复用。

**范围内事项**：
- 定义 T4 使用的最小任务上下文输入格式。
- 封装 Codex、Claude、MiniMax 三类 CLI 的最小调用适配。
- 统一 stdout、stderr、退出码、超时和调用失败的结果结构。
- 将最小调用结果回写为可追踪记录；优先复用 T3 已存在的结构化存储能力。
- 为开发类任务上下文下发维护性注释要求和 Git 身份要求。
- 为后续 T6/T8 提供可复用的适配接口或调用约定。
- 补充与 T4 直接相关的检查、验证和执行记录。

**范围外事项**：
- 不实现完整 A2A 编排、A2A 路由或多轮协作流程；这些属于 T6。
- 不实现完整 Harness 护栏、权限决策或状态机推进；这些属于 T5/T8。
- 不实现页面级用户参与主界面、Review 页面、门禁页面或复盘页面。
- 不把 Agent 适配结果伪装成完整三 Agent 自动协作系统通过。
- 不通过模拟结果替代真实不可用 CLI。
- 不改写产品、架构或固定 Agent 规则基线。

**交付物**：
- Agent CLI 适配层实现。
- 最小任务上下文输入与结果输出约定。
- 最小调用闭环验证记录。
- 非作者 Review 记录。
- 必要的执行结果文档。

**完成标准**：
- 三个 Agent CLI 都能被真实调用，不能以 mock 或静态样例替代。
- 调用输入至少包含任务身份、任务 ID、目标、边界、依赖、Review 方、验收标准、禁止事项、允许动作级别、文件/模块边界、验证方式、质量门禁、失败处理、维护性注释要求、Git 身份要求。
- 调用结果至少包含 success/failure、stdout、stderr、退出码、超时/错误分类、Agent 身份。
- 响应结果能回写为结构化记录，且后续 T6 可复用。
- 任一 CLI 不可用时，T4 不能判定通过，必须记录阻塞或降级原因。
- 非作者 Review 通过。

## 3. 上下文与必读材料

**必读文档**：
- [AGENTS.md](../../AGENTS.md)
- [docs/00-index.md](../00-index.md)
- [docs/agents/05-agent-codex.md](../agents/05-agent-codex.md)
- [docs/agents/06-agent-claude.md](../agents/06-agent-claude.md)
- [docs/agents/07-agent-minimax.md](../agents/07-agent-minimax.md)
- [15-implementation-plan.md](15-implementation-plan.md)
- [task-status-board.md](task-status-board.md)
- [current-action-tracker.md](current-action-tracker.md)
- [../collaboration/03-a2a-collaboration-protocol.md](../collaboration/03-a2a-collaboration-protocol.md)
- [../collaboration/04-harness-governance.md](../collaboration/04-harness-governance.md)
- [../collaboration/13-task-start-package-template.md](../collaboration/13-task-start-package-template.md)
- [../architecture/14-system-architecture-design.md](../architecture/14-system-architecture-design.md)
- [../architecture/17-task-start-package-execution-confirmation.md](../architecture/17-task-start-package-execution-confirmation.md)
- [19-t1-baseline-confirmation-result.md](19-t1-baseline-confirmation-result.md)
- [20-t1-review-by-claude.md](20-t1-review-by-claude.md)
- [22-t3-persistence-result.md](22-t3-persistence-result.md)

**当前任务上下文**：
- T1 已确认三个 CLI 在本机环境里具备最小可调用性，但现有脚本仅是测试参考，不是正式适配层实现。
- T3 已提供 WorkItem、A2AEvent 等结构化持久化能力；T4 可以复用，但不得把自己扩展成 T6 的完整 A2A 编排。
- 当前仓库存在其他 Agent 的并行变更和未归档文档更新，T4 启动时应优先使用独立 branch/worktree，避免在共享脏工作区直接实施。
- 用户对 MiniMax 的“延后引入”仅适用于页面体验参与节奏，不适用于 T4 的 MiniMax CLI 适配要求。T4 仍需覆盖 MiniMax 的真实 CLI 调用闭环。

**依赖任务**：
- 硬依赖：T1 已完成。
- 参考依赖：T3 已完成，可作为结构化回写的当前基线。

**已知变更影响**：
- A7 只约束 T13/T16 前的页面体验 Review，不减轻 T4 对 MiniMax CLI 真实可调用性的要求。
- T2/T3 已将页面入口和 CLI 内部入口统一到 T3 WorkItem 事实来源；T4 不得重新引入第二条事实来源。

**默认假设**：
- 本地 Codex、Claude、MiniMax CLI 当前仍在 PATH 且可触发最小调用。
- 当前阶段允许通过本地脚本或本地模块对 CLI 进行薄封装。
- 如需把调用结果回写为结构化记录，优先复用 T3 Store；若发现缺口，应先升级确认，再决定是否扩展模型。

## 3.1 启动前方案确认

执行 Agent 收到本启动包后，不得直接开始修改实现文件。必须先输出简短实施方案，至少说明：

- 拟新增或修改的文件。
- CLI 调用流程和输入上下文映射方式。
- stdout、stderr、退出码、超时和错误分类的归一化方式。
- 结果回写位置和与 T3 Store 的关系。
- 验证方式和质量门禁。
- 主要风险和需要确认的问题。

若方案与本启动包、产品基线、架构基线或执行计划无冲突，且无待确认歧义，方可进入开发。若存在冲突或歧义，必须先升级给系统架构师或产品负责人确认。

## 4. 分工与协作

| 字段 | 值 |
| --- | --- |
| 主执行 Agent | Codex |
| 协作 Agent | 无固定协作执行 Agent；如出现实现风险或边界争议，可发起 A2A 质询 |
| Review 方 | Claude |
| A2A 协作要求 | 如需确认调用协议、错误分类、持久化边界或结果回写方式，可向 Claude 发起实现风险质询；如发现规则冲突，升级系统架构师 |
| MiniMax 参与要求 | 本任务不属于 UI/视觉/交互体验任务，不要求 MiniMax 做方案或 Review；但 T4 产物必须覆盖 MiniMax CLI 作为被适配目标的真实调用 |

## 5. 执行约束

| 字段 | 值 |
| --- | --- |
| 允许动作级别 | 文件修改、检查执行、提交准备 |
| 禁止事项 | 不得使用模拟结果替代真实 CLI；不得把 T4 扩展为完整 T6/T8/T11；不得修改产品/架构基线文档来放宽验收；不得部署、不得合并主干、不得绕过非作者 Review、不得绕过质量门禁 |
| 文件/模块边界 | 可修改或新增与 Agent CLI 适配直接相关的 `src/` 模块、必要的 `bin/`/`scripts/`/`test/` 文件、必要的执行文档。若需触碰 `src/storage/`，仅允许窄范围集成，不得改写 T3 的核心模型语义或新增第二事实来源 |
| 维护性注释要求 | 必须为非显而易见逻辑补充注释，至少覆盖任务上下文映射、CLI 响应归一化、超时/错误分类、stderr 处理、结构化回写边界 |
| Git 身份要求 | 任何 Git 写入动作必须使用 `Clowder Codex <codex@clowder.local>` |
| worktree / 分支要求 | 启动前应使用独立 branch/worktree 执行，并在结果文档中记录任务、branch、worktree、负责人和冲突状态；如果无法隔离，必须先暂停并升级确认 |
| 高风险动作限制 | 不得创建 PR、不得部署、不得合并到 `main`、不得执行破坏性文件操作、不得引入需要隐式注入秘密的新外部依赖 |

CLI 调用日志和持久化记录必须遵守最小披露原则。不得将 API key、token、凭证、用户本地敏感路径或其他敏感信息原样写入结构化记录、执行文档或 Review 文档。若 CLI 输出包含敏感信息，必须脱敏或仅记录摘要、错误类别和必要定位信息。

## 6. 验收与门禁

| 字段 | 值 |
| --- | --- |
| 验收标准 | 三个 CLI 的真实最小调用均有证据；结果结构统一；至少一条结果能回写为结构化记录；任务上下文字段能下发维护性注释要求和 Git 身份要求；T6 可复用 T4 输出 |
| 验证方式 | 至少运行项目现有检查命令（当前为 `npm run check`、`npm test`，如适用）；补充 T4 专属最小调用验证；记录每个 CLI 的输入摘要、结果摘要、失败分类、脱敏情况和回写证据 |
| Review 通过标准 | Claude 确认：未使用 mock 替代真实 CLI；输入上下文字段完整，包含允许动作级别、文件/模块边界、验证方式、质量门禁和失败处理；错误处理和超时治理可见；结果回写边界清晰；敏感信息未原样入库或入文档；实现没有越界吞并 T6/T8 职责 |
| 质量门禁 | 与 T4 直接相关的自动检查和手工验证记录必须归档；任何 CLI 不可用、超时失控或结果不可追踪都不能静默放行 |
| 失败处理 | 任一 CLI 不可用、结果不可解析或无法回写时，T4 保持阻塞或待修复；不得声称“三 Agent 最小调用闭环通过”；必须记录影响范围、恢复条件和是否继续零阶段人工接力 |

## 7. 人工升级条件

出现以下情况时，必须升级给用户、产品负责人或系统架构师：
- 任一 Agent CLI 不可用，且会影响“三 Agent 最小调用闭环”成立。
- 需要用 mock、静态响应或人工伪造结果替代真实 CLI。
- 需要新增或修改核心持久化模型，才能存储 T4 结果。
- 当前任务上下文与 AGENTS / Harness / 架构基线冲突。
- 无法建立独立 branch/worktree，且共享工作区存在明显变更归属风险。
- 需要引入新的外部依赖、凭证注入或高风险仓库写入动作。

## 8. 输出记录要求

执行 Agent 完成 T4 后，至少要记录：
- 实际完成内容。
- 未完成内容和原因。
- 修改过的文件。
- 每个 CLI 的最小调用证据摘要。
- stdout/stderr/退出码/超时分类的处理结果。
- 结构化回写证据。
- 启动前实施方案及是否存在冲突或歧义。
- 日志/输出脱敏处理说明。
- Review 结论或待 Review 状态。
- 建议下一状态或交接状态。
- 是否解除 T6 对 T4 的依赖阻塞。
- 是否仍阻断 T6。
- 是否触发 Review、质量门禁、人工确认或复盘。
- 遗留风险。

状态更新要求：
- T4 启动后，将 [task-status-board.md](task-status-board.md) 中 T4 状态从 `未开始` 更新为 `方案中` 或 `开发中`。
- 完成实现和作者自检后，将 T4 状态更新为 `待 Review`，并链接 T4 主结果文档。
- 只有产生新的补录项、确认项、跨任务阻塞或临时开放事项时，才更新 [current-action-tracker.md](current-action-tracker.md)。

建议输出位置：
- T4 主结果文档：`docs/execution/30-t4-agent-cli-adapter-result.md`
- T4 非作者 Review 文档：`docs/execution/31-t4-review-by-claude.md`

建议下一状态或交接状态：
- 若 T4 通过：交接给 T6，允许进入 A2A 事件编排实现。
- 若 T4 阻塞：T6 不得按“自动三 Agent 已可用”前提启动，只能记录为阻塞或人工降级路径。

后续阻断关系：
- T4 未通过时，T6 不能按自动化 Agent 适配层前提推进。
- T4 即使通过，也不代表 T8/T11 自动通过；Harness 护栏和 Git 交付安全仍需后续任务实现。
