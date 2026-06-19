# Clowder AI 文档总入口

> 状态：当前基线
> 所属：文档治理
> 规则效力：阅读路由与文档权重规则
> 维护角色：产品负责人

本目录是 Clowder AI 的产品、协作、Agent、架构、执行和复盘文档入口。根索引用于说明文档权重和阅读路径，不承载所有细节。

除非某项约束本身就是产品需求，否则产品文档不规定具体技术实现。架构文档不能静默改写产品规则；如果发现产品规则不可实现、成本过高或风险过大，必须升级给产品负责人确认。

## 文档分区

- [product/](product/00-index.md)：产品目标、需求、验收、风险、决策和假设。
- [collaboration/](collaboration/00-index.md)：A2A、Harness、Dogfooding 和零阶段协作治理。
- [agents/](agents/00-index.md)：Codex、Claude、MiniMax 的角色使命、职责边界和完成标准。
- [architecture/](architecture/00-index.md)：架构输入说明和系统架构设计。
- [execution/](execution/00-index.md)：当前执行计划、阶段门禁和执行节奏，不放构建产物或发布包。
- [retrospectives/](retrospectives/00-index.md)：复盘、Review 和历史改进记录。

## 当前变更提案

- [product/14-page-user-participation-proposal.md](product/14-page-user-participation-proposal.md)
- [product/15-page-change-implementation-clarifications.md](product/15-page-change-implementation-clarifications.md)
- [architecture/15-page-user-participation-architecture-change.md](architecture/15-page-user-participation-architecture-change.md)
- [architecture/16-page-change-architecture-clarifications.md](architecture/16-page-change-architecture-clarifications.md)

## 文档权重

1. `product/`、`collaboration/`、`agents/` 是当前产品与协作基线，Agent 执行时必须遵守。
2. `architecture/` 是产品基线的系统设计解释和架构约束，不反向覆盖产品规则。
3. `execution/` 是当前阶段执行计划，进入实现阶段后以这里的门禁和任务顺序为准。
4. `retrospectives/` 是历史记录和改进输入，不自动成为当前规则；只有被吸收进产品、协作、架构或执行基线后才具备对应效力。

## 系统架构师阅读路径

必读：

- [product/01-prd.md](product/01-prd.md)
- [product/08-acceptance-criteria.md](product/08-acceptance-criteria.md)
- [product/09-risk-controls.md](product/09-risk-controls.md)
- [product/13-decisions-and-assumptions.md](product/13-decisions-and-assumptions.md)
- [collaboration/03-a2a-collaboration-protocol.md](collaboration/03-a2a-collaboration-protocol.md)
- [collaboration/04-harness-governance.md](collaboration/04-harness-governance.md)
- [collaboration/10-dogfooding-plan.md](collaboration/10-dogfooding-plan.md)
- [architecture/11-architecture-brief.md](architecture/11-architecture-brief.md)
- [architecture/14-system-architecture-design.md](architecture/14-system-architecture-design.md)
- [execution/15-implementation-plan.md](execution/15-implementation-plan.md)
- [product/14-page-user-participation-proposal.md](product/14-page-user-participation-proposal.md)
- [product/15-page-change-implementation-clarifications.md](product/15-page-change-implementation-clarifications.md)
- [architecture/16-page-change-architecture-clarifications.md](architecture/16-page-change-architecture-clarifications.md)

选读：

- [product/02-requirements-backlog.md](product/02-requirements-backlog.md)
- [agents/05-agent-codex.md](agents/05-agent-codex.md)
- [agents/06-agent-claude.md](agents/06-agent-claude.md)
- [agents/07-agent-minimax.md](agents/07-agent-minimax.md)
- [collaboration/12-phase-zero-manual-workflow.md](collaboration/12-phase-zero-manual-workflow.md)
- [retrospectives/](retrospectives/00-index.md)

## Agent 执行阅读路径

Agent 不得自行选择身份并开始执行。零阶段人工调度或未来 Harness 自动调度都必须在启动 Agent 前指定执行身份，并生成任务启动上下文。

任务启动上下文至少包含：

- 当前身份。
- 任务 ID。
- 任务目标。
- 任务边界。
- 依赖。
- 必读文档。
- Review 方。
- 验收标准。
- 禁止事项。
- 开发类任务的维护性注释要求。
- Git 写入动作的 Agent 身份要求。

被分配的 Agent 执行任务前必读：

- [product/01-prd.md](product/01-prd.md)
- [product/08-acceptance-criteria.md](product/08-acceptance-criteria.md)
- [product/09-risk-controls.md](product/09-risk-controls.md)
- [collaboration/03-a2a-collaboration-protocol.md](collaboration/03-a2a-collaboration-protocol.md)
- [collaboration/04-harness-governance.md](collaboration/04-harness-governance.md)
- 由任务启动上下文指定的角色文档：
  - [agents/05-agent-codex.md](agents/05-agent-codex.md)
  - [agents/06-agent-claude.md](agents/06-agent-claude.md)
  - [agents/07-agent-minimax.md](agents/07-agent-minimax.md)
- [execution/15-implementation-plan.md](execution/15-implementation-plan.md)
- 当前任务上下文。

按场景选读：

- 需求统筹、方案设计或任务拆解：补读 [product/02-requirements-backlog.md](product/02-requirements-backlog.md)、[product/13-decisions-and-assumptions.md](product/13-decisions-and-assumptions.md)、[architecture/14-system-architecture-design.md](architecture/14-system-architecture-design.md)。
- 代码实现或 Bug 修复：补读 [architecture/14-system-architecture-design.md](architecture/14-system-architecture-design.md) 和当前任务上下文。
- UI、视觉、多模态、语音、视频、图片或交互体验任务：补读 [agents/07-agent-minimax.md](agents/07-agent-minimax.md) 和相关体验任务上下文。
- 页面级用户参与、T2/T3 页面变更补齐、T13 或 T16：补读 [product/14-page-user-participation-proposal.md](product/14-page-user-participation-proposal.md)、[product/15-page-change-implementation-clarifications.md](product/15-page-change-implementation-clarifications.md) 和 [architecture/16-page-change-architecture-clarifications.md](architecture/16-page-change-architecture-clarifications.md)。
- 零阶段人工协作：补读 [collaboration/12-phase-zero-manual-workflow.md](collaboration/12-phase-zero-manual-workflow.md)。
- Dogfooding 或复盘：补读 [collaboration/10-dogfooding-plan.md](collaboration/10-dogfooding-plan.md) 和 [retrospectives/](retrospectives/00-index.md)。

## 产品验收阅读路径

- [product/01-prd.md](product/01-prd.md)
- [product/02-requirements-backlog.md](product/02-requirements-backlog.md)
- [product/08-acceptance-criteria.md](product/08-acceptance-criteria.md)
- [product/09-risk-controls.md](product/09-risk-controls.md)
- [product/13-decisions-and-assumptions.md](product/13-decisions-and-assumptions.md)
- [collaboration/10-dogfooding-plan.md](collaboration/10-dogfooding-plan.md)
- [execution/15-implementation-plan.md](execution/15-implementation-plan.md)
- 必要时查阅 [retrospectives/](retrospectives/00-index.md) 了解历史决策来源。

## 迁移原则

- 本次重组只调整文档治理结构，不改变已确认的产品需求、架构结论和执行计划。
- 保留原文件名和编号，降低历史引用与链接迁移风险。
- 暂不创建 `templates/` 目录；模板应在 T2、T8、T14 等闭环实际运行后再沉淀。
