# Clowder AI

Clowder AI 是一个本机运行、单用户、单项目的三 Agent 敏捷协作系统。用户、Codex、Claude 和 MiniMax 在同一个工作空间内，围绕功能需求和 Bug 修复完成需求澄清、方案设计、任务拆解、并行开发、交叉 Review、质量门禁、交付和复盘学习。

本 README 是项目入口摘要，详细产品、架构和执行基线以 [docs/00-index.md](docs/00-index.md) 为准。README 不替代产品规则、架构设计或执行计划。

## 当前状态

项目处于文档基线闭合与早期实现阶段。页面级用户参与入口已经进入产品和架构基线，但首版可用页面仍在实现推进中。

当前可执行范围、阶段门禁和任务状态以 [docs/execution/00-index.md](docs/execution/00-index.md) 与 [docs/execution/15-implementation-plan.md](docs/execution/15-implementation-plan.md) 为准。

## 产品目标

首版目标是让 AI 协作开发过程可见、可追踪、可治理、可复用。

系统不应退化成多个 Agent 分别回答同一个用户问题，而应通过 A2A 协作、Harness 护栏、交叉 Review、质量门禁和复盘记忆，形成可持续改进的开发闭环。

## 首版范围

首版支持：

- 功能需求工作项。
- Bug 修复工作项。
- 本机、单用户、单项目工作流。
- 页面级用户参与入口。
- 统一聊天室与时间线。
- Agent 间完整 A2A 协作。
- 方案先行和任务拆解。
- 并行开发治理和 worktree 或等效隔离。
- 非作者交叉 Review。
- 质量门禁和人工升级。
- Feature 分支交付。
- Dogfooding 复盘和本地记忆。

首版不做：

- 多人在线协作。
- 云端部署。
- 自动合并到 `main`。
- 自动合并 PR。
- 跳过内部 Review。
- 功能需求和 Bug 修复之外的工作项类型。
- 面向最终用户的复杂工作流自定义。

## 核心能力

### 页面级用户参与

页面是首版主入口，CLI 仅作为零阶段或内部入口保留。首版页面必须支持：

- 工作项录入。
- 工作项状态和关键结论查看。
- 统一聊天室与时间线。
- 工作项详情查看。
- 阻塞、分歧和风险确认。
- Review、门禁和复盘结果查看。

### A2A 协作

A2A 不只发生在 Review 阶段，而是覆盖完整工作流：

- 类型识别。
- 需求澄清。
- 方案设计。
- 任务拆解。
- 执行同步。
- 交叉 Review。
- 验证。
- 复盘。

Agent 必须评估彼此的计划，不得无脑执行。

### Harness 治理

Harness 负责上下文、记忆、权限、工具沙箱、Agent Loop、校验护栏、安全约束、状态推进、人工升级、观测评估和反馈回路。

在需求和方案确认前，Agent 不得开始开发或修改文件。

### Review 与交付

作者不能成为自己产出的唯一 Review 方。内部 A2A Review 是必选门禁，不能被 GitHub PR Review 替代。

门禁通过后，系统可以准备本地提交并推送 feature 分支。系统不得默认直接推送到 `main`，不得默认合并 PR，不能自动部署。

## Agent 角色

| Agent | 产品职责 |
| --- | --- |
| Codex | 需求统筹、意图识别、方案设计、任务拆解、整体推进；也可以作为核心开发，但不能自审。 |
| Claude | 核心实施、代码修改、Bug 修复、运行检查和修复验证；不能自审。 |
| MiniMax | UI、视觉、多模态、语音、视频、图片和交互体验相关设计或 Review。 |

涉及 UI、视觉、多模态或交互体验的任务，MiniMax 必须参与方案或 Review。零阶段允许在 T2 最小页面录入入口搭建完成后再引入 MiniMax，但 MiniMax 必须在 T13 页面主界面或 T16 E2E 前参与页面体验 Review。

## 当前产品基线

当前已批准的 P0 页面能力包括：

- `P0-14`：页面级用户参与入口。
- `P0-15`：页面级工作项详情与状态可见。
- `P0-16`：页面级 Review / 门禁 / 复盘查看。

对当前执行的关键澄清：

- T2 必须补齐最小页面录入入口，不能只保留 CLI。
- T3 不强制改代码，但必须证明能支撑页面查询视角。
- T2/T3 持久化出口必须在 T5 状态机启动前统一。
- T13 负责完整页面级用户参与主界面，不把完整 T13 范围塞进 T2。

详细产品裁决见 [docs/product/15-page-change-implementation-clarifications.md](docs/product/15-page-change-implementation-clarifications.md)。架构侧执行澄清见 [docs/architecture/16-page-change-architecture-clarifications.md](docs/architecture/16-page-change-architecture-clarifications.md)。

## 架构执行要点

- 页面是首版主入口，CLI 仅作为零阶段或内部入口。
- T2 页面入口、CLI 内部入口和后续页面能力必须统一到 T3 的 WorkItem 持久化事实来源。
- 页面查询视角应放在页面层、应用服务层或查询投影中，不应把页面专用逻辑塞进底层 Store。
- T13 可以是本地单页或单页多区域界面，不要求高保真设计、完整设计系统或复杂路由。
- MiniMax 可以在 T2 最小页面录入入口搭建完成后再引入，但必须在 T13 页面主界面验收前，或最迟 T16 E2E 前参与页面体验 Review。

## 开发执行约束

- Agent 不得自行选择身份；任务启动前必须明确身份、目标、边界、依赖、必读文档、Review 方、验收标准和禁止事项。
- 开发型变更必须包含必要的维护性注释，用于解释非显而易见的逻辑、状态流转、外部假设、边界条件和风险分支。
- Git 写入动作必须使用执行身份对应的独立 `user.name` 和占位 `user.email`。
- 作者不能作为自己产出的唯一 Review 方。
- 未通过内部 A2A Review 和质量门禁前，不得进入交付状态。
- 默认不得直接推送到 `main`、自动合并 PR、自动部署或绕过失败门禁。

## 术语简表

- `WorkItem`：用户提交的一项功能需求或 Bug 修复，是系统推进协作的基本单位。
- `A2A`：Agent to Agent，指 Codex、Claude、MiniMax 之间围绕澄清、方案、拆解、执行、Review、验证和复盘发生的结构化协作。
- `Harness`：Agent 外围的治理层，负责上下文、权限、状态、工具、门禁、升级、观测和反馈回路。
- `Quality Gate`：交付前必须通过的检查或验证，例如测试、构建、lint、回归验证或手动验证。
- `Dogfooding`：用 Clowder AI 开发和改进 Clowder AI 自身，并把真实协作结果沉淀为复盘记忆。
- `worktree`：用于并行开发的隔离工作区，降低多个 Agent 同时修改同一仓库时互相覆盖的风险。

## 文档入口

- [docs/00-index.md](docs/00-index.md)：文档总入口和阅读路由。
- [docs/product/00-index.md](docs/product/00-index.md)：产品目标、需求、验收、风险和决策。
- [docs/architecture/00-index.md](docs/architecture/00-index.md)：架构输入、系统架构设计和架构变更。
- [docs/execution/00-index.md](docs/execution/00-index.md)：当前执行计划、阶段门禁和执行状态。
- [docs/agents/00-index.md](docs/agents/00-index.md)：Codex、Claude、MiniMax 的角色定义。
- [docs/collaboration/00-index.md](docs/collaboration/00-index.md)：A2A、Harness、Dogfooding 和零阶段协作治理。
- [docs/retrospectives/00-index.md](docs/retrospectives/00-index.md)：复盘、Review 和历史改进记录。

## 工作原则

- 方案先行，不清楚就澄清，不允许收到需求立刻开发。
- 产品规则、架构设计、执行计划和历史复盘要分层管理。
- 架构文档不能静默改写产品规则。
- 复盘建议不能自动变成产品基线，必须经过产品负责人确认。
- Agent 执行任务前必须有明确身份、任务目标、边界、依赖、Review 方、验收标准和禁止事项。
