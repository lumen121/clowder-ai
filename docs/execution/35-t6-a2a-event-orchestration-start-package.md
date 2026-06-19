# T6 任务启动包：A2A 事件编排与记录

> 状态：当前执行启动包
> 所属：执行
> 规则效力：T6 执行上下文、边界、门禁与交付约束
> 维护角色：系统架构师
> 执行身份：Claude
> 任务 ID：T6
> 日期：2026-06-20

本文基于 [15-implementation-plan.md](15-implementation-plan.md)、[task-status-board.md](task-status-board.md)、[AGENTS.md](../../AGENTS.md) 和 [13-task-start-package-template.md](../collaboration/13-task-start-package-template.md) 生成，用于 T6 启动前下发给执行 Agent。

## 1. 基本信息

| 字段 | 值 |
| --- | --- |
| 任务 ID | T6 |
| 任务类型 | 功能需求 / 协作治理能力实现 |
| 当前身份 | Claude（Clowder Claude `<claude@clowder.local>`） |
| 任务来源 | `docs/execution/15-implementation-plan.md` §T6；`docs/execution/task-status-board.md` T6 行 |
| 关联工作项 | 首周最小治理闭环；T7/T9/T13/T14/T16 的 A2A 记录基础 |
| 优先级 | P0 |

## 2. 目标与边界

**任务目标**：
实现 A2A 事件编排与记录的最小可用能力，支持澄清、方案评估、任务拆解反馈、执行同步、Review、验证、复盘等关键 Agent 间协作事件，并确保每类事件能记录发起方、接收方、目的、结论和下一步。

**范围内事项**：
- 定义 A2A 事件创建和记录接口。
- 复用 T3 `A2AEvent` Store 作为事实来源。
- 对接 T4 Agent CLI 适配层的最小调用结果或接口约定。
- 支持关键 A2A 类型：澄清、需求质询、方案问题、风险提示、任务拆解反馈、任务交接、执行同步、Review 请求、修改要求、验证请求、分歧升级、复盘反馈。
- 保证 A2A 记录可被后续页面时间线和 T14 复盘消费。
- 补充 T6 验证和执行结果文档。

**范围外事项**：
- 不实现完整 Harness 护栏；属于 T8。
- 不实现工作项状态机；属于 T5。
- 不实现方案与任务拆解流程；属于 T7。
- 不实现 Review 与质量门禁记录模块；属于 T9。
- 不实现页面主界面或时间线渲染；属于 T13。
- 不新增第二套 A2A 或 WorkItem 持久化事实来源。

**交付物**：
- A2A 事件编排与记录模块。
- 与 T4 Agent 适配层的最小集成或调用约定。
- A2A 事件验证记录。
- T6 执行结果文档。
- 非作者 Review 记录。

**完成标准**：
- 每类关键 A2A 事件可记录发起方、接收方、目的、上下文、请求/主张、响应、结论、下一步、是否需要用户介入。
- A2A 记录写入 T3 `A2AEvent` Store。
- 能接收或包装 T4 Agent 调用结果，但不强绑定未公开的 T4 内部实现。
- 失败、分歧和需要用户介入的 A2A 事件可追踪。
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
- [../collaboration/03-a2a-collaboration-protocol.md](../collaboration/03-a2a-collaboration-protocol.md)
- [../collaboration/04-harness-governance.md](../collaboration/04-harness-governance.md)
- [../collaboration/13-task-start-package-template.md](../collaboration/13-task-start-package-template.md)
- [../architecture/14-system-architecture-design.md](../architecture/14-system-architecture-design.md)
- [../architecture/17-task-start-package-execution-confirmation.md](../architecture/17-task-start-package-execution-confirmation.md)
- [22-t3-persistence-result.md](22-t3-persistence-result.md)
- [29-t4-agent-cli-adapter-start-package.md](29-t4-agent-cli-adapter-start-package.md)

**启动前还必须读取**：
- T4 最终结果文档或等效接口说明。
- T4 Review / 门禁结果。

如果 T4 结果尚未归档到当前工作区，T6 可以先做方案确认，但不得进入开发。

**当前任务上下文**：
- T3 已完成，提供 `A2AEvent` 结构化持久化能力。
- T4 已进入后续步骤；T6 启动前必须确认 T4 的可用接口、失败处理和结果格式。
- T6 是 T7、T13、T14、T16 的关键协作记录基础。

**依赖任务**：
- 硬依赖：T3、T4。
- 参考依赖：T5 可并行；T6 不应直接依赖 T5 的内部实现。

## 3.1 启动前方案确认

执行 Agent 收到本启动包后，不得直接开始修改实现文件。必须先输出简短实施方案，至少说明：

- 拟新增或修改的文件。
- A2A 事件创建接口和调用方式。
- 与 T3 `A2AEvent` Store 的关系。
- 与 T4 Agent CLI 适配层的集成点。
- 如何处理失败、分歧、用户介入和下一步动作。
- 验证方式和质量门禁。
- 主要风险和需要确认的问题。

若 T4 最终接口、结果格式或门禁状态仍不清晰，必须先停在 `方案中`。

## 4. 分工与协作

| 字段 | 值 |
| --- | --- |
| 主执行 Agent | Claude |
| 协作 Agent | Codex 可提供 T4 接口澄清或做 Review |
| Review 方 | Codex |
| A2A 协作要求 | 如 T4 接口、A2A 类型映射或状态回写边界不清晰，必须先发起澄清 |
| MiniMax 参与要求 | 不适用；本任务不涉及 UI、视觉或交互体验判断 |

## 5. 执行约束

| 字段 | 值 |
| --- | --- |
| 允许动作级别 | 文件修改、检查执行、提交准备 |
| 禁止事项 | 不得实现完整 Harness；不得实现页面渲染；不得绕过 T4 结果格式直接臆造 Agent 响应；不得新增第二事实来源；不得部署、合并主干或绕过 Review |
| 文件/模块边界 | 可新增或修改与 A2A 编排直接相关的 `src/` 模块、必要的 `test/`、`scripts/`、`docs/execution/` 文件。若需修改 T3 Store 或 T4 适配层，只允许窄范围集成，并必须记录原因 |
| 维护性注释要求 | 必须为 A2A 类型映射、T4 结果包装、失败/分歧处理、用户介入标记和结构化回写边界补充维护性注释 |
| Git 身份要求 | 任何 Git 写入动作必须使用 `Clowder Claude <claude@clowder.local>` |
| worktree / 分支要求 | 必须在独立 branch/worktree 中执行，并在结果文档中记录任务、branch、worktree、负责人和冲突状态 |
| 高风险动作限制 | 不得创建 PR、不得部署、不得合并到 `main`、不得执行破坏性文件操作 |

## 6. 验收与门禁

| 字段 | 值 |
| --- | --- |
| 验收标准 | 关键 A2A 类型均可记录；记录写入 T3 Store；T4 调用结果可被包装或关联；失败/分歧/用户介入可追踪；后续 T7/T13/T14 可消费 |
| 验证方式 | 至少运行 `npm run check`、`npm test`，并补充 T6 专属验证，覆盖澄清、方案问题、执行同步、Review 请求、验证请求、分歧升级、复盘反馈 |
| Review 通过标准 | Codex 确认：A2A 类型覆盖完整、结构化字段完整、未越界实现 T8/T9/T13、未伪造 T4 结果、验证覆盖关键路径 |
| 质量门禁 | 自动检查和 T6 专属验证必须通过；T4 集成前提必须可追踪 |
| 失败处理 | 任一关键 A2A 类型无法记录、T4 结果无法关联、或记录不可追踪时，T6 保持待修复或阻塞，不得交接给 T7/T13/T14 |

## 7. 人工升级条件

出现以下情况时，必须升级给系统架构师或产品负责人：
- T4 最终接口或结果格式无法确认。
- A2A 类型与产品协议冲突。
- 需要修改 T3 核心模型语义。
- 需要降低 A2A 记录字段完整性。
- 需要绕过 Review、质量门禁或安全限制。
- 与并行任务发生文件或接口冲突。

## 8. 输出记录要求

执行 Agent 完成 T6 后，至少要记录：
- 实际完成内容。
- 未完成内容和原因。
- 修改过的文件。
- A2A 类型覆盖清单。
- 与 T3 Store 的集成证据。
- 与 T4 结果或接口的集成证据。
- 验证结果。
- Review 结论或待 Review 状态。
- 是否解除 T7/T13/T14 对 T6 的依赖阻塞。
- 是否仍阻断后续任务。
- 遗留风险。

状态更新要求：
- T6 启动后，将 [task-status-board.md](task-status-board.md) 中 T6 状态从 `未开始` 更新为 `方案中` 或 `开发中`。
- 完成实现和作者自检后，将 T6 状态更新为 `待 Review`，并链接 T6 主结果文档。
- 只有产生新的补录项、确认项、跨任务阻塞或临时开放事项时，才更新 [current-action-tracker.md](current-action-tracker.md)。

建议输出位置：
- T6 主结果文档：`docs/execution/36-t6-a2a-event-orchestration-result.md`
- T6 非作者 Review 文档：`docs/execution/37-t6-review-by-codex.md`

建议下一状态或交接状态：
- 若 T6 通过：解除 T7/T13/T14 对 T6 的依赖阻塞。
- 若 T6 阻塞：T7/T13/T14 不得按 A2A 记录已可用前提启动。
