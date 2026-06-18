# 需求 Backlog

> 状态：当前基线
> 所属：产品
> 规则效力：需求清单与优先级基线
> 维护角色：产品负责人


本文档跟踪产品需求，不跟踪具体实现任务。系统架构和研发阶段可以在此基础上进一步拆解。

状态值：

- `proposed`：已提出。
- `approved`：已确认。
- `in_design`：架构设计中。
- `in_development`：开发中。
- `in_review`：Review 中。
- `accepted`：已验收。
- `deferred`：已延期。

## P0 需求

| ID | 需求 | 描述 | 验收引用 | 状态 |
| --- | --- | --- | --- | --- |
| P0-01 | 产品文档基线 | 架构设计前完成产品目标、范围、角色、A2A、Harness、验收、风险控制和假设文档。 | [08](08-acceptance-criteria.md) | approved |
| P0-02 | 统一聊天室 | 用户和三个 Agent 共享一条时间线，展示消息、决策、分歧、工作项状态、Review 结果、门禁结果和复盘。 | [08](08-acceptance-criteria.md) | approved |
| P0-03 | 功能需求识别 | 系统能够识别并处理功能需求工作项。 | [08](08-acceptance-criteria.md) | approved |
| P0-04 | Bug 修复识别 | 系统能够识别并处理 Bug 修复工作项。 | [08](08-acceptance-criteria.md) | approved |
| P0-05 | 完整工作流 A2A | A2A 支持澄清、方案设计、拆解、执行同步、Review、验证和复盘。 | [03](../collaboration/03-a2a-collaboration-protocol.md), [08](08-acceptance-criteria.md) | approved |
| P0-06 | 方案先行门禁 | 在需求和方案充分确认前，Agent 不得开发或修改文件。 | [09](09-risk-controls.md) | approved |
| P0-07 | Agent 角色治理 | Codex、Claude、MiniMax 有明确的角色使命、职责边界、协作规则、升级条件和完成标准。 | [05](../agents/05-agent-codex.md), [06](../agents/06-agent-claude.md), [07](../agents/07-agent-minimax.md) | approved |
| P0-08 | Harness 治理 | 系统治理上下文、记忆、工具、权限、Loop、护栏、安全、状态、观测、评估和反馈。 | [04](../collaboration/04-harness-governance.md) | approved |
| P0-09 | 并行开发治理 | 多 Agent 并行开发必须有清晰边界、依赖控制、工作区隔离、Review 分配和冲突升级机制。 | [03](../collaboration/03-a2a-collaboration-protocol.md), [09](09-risk-controls.md) | approved |
| P0-10 | 交叉 Review | 作者不能成为唯一 Review 方。变更必须通过非作者 Review 后才能提交或推送。 | [08](08-acceptance-criteria.md) | approved |
| P0-11 | 质量门禁 | 变更必须通过合适的检查或验证；失败时必须进入可见、可恢复状态。 | [08](08-acceptance-criteria.md), [09](09-risk-controls.md) | approved |
| P0-12 | Feature 分支交付 | 门禁通过后，系统可以准备提交并推送 feature 分支到远程仓库。 | [08](08-acceptance-criteria.md) | approved |
| P0-13 | 人工升级 | 需求歧义、Agent 分歧、高风险动作、失败门禁和不安全操作必须升级给用户。 | [09](09-risk-controls.md) | approved |

## P1 需求

| ID | 需求 | 描述 | 验收引用 | 状态 |
| --- | --- | --- | --- | --- |
| P1-01 | GitHub PR 归档 | 配置 GitHub CLI 登录态或 token 后，系统可创建 GitHub PR。 | [08](08-acceptance-criteria.md) | approved |
| P1-02 | 本地复盘记忆 | 系统为每个完成的工作项记录复盘记忆，并在后续任务中引用。 | [10](../collaboration/10-dogfooding-plan.md) | approved |
| P1-03 | 效率与质量指标 | 系统记录耗时、Review 发现、人工介入次数、返工次数、门禁结果和失败原因。 | [10](../collaboration/10-dogfooding-plan.md) | approved |
| P1-04 | Dogfooding 流程 | 在具备基本工作流后，使用 Clowder AI 开发 Clowder AI 自身。 | [10](../collaboration/10-dogfooding-plan.md) | approved |
| P1-05 | 架构覆盖性审查 | 系统架构输出进入实现计划前，必须经过产品需求覆盖性审查。 | [11](../architecture/11-architecture-brief.md) | approved |

## 明确延期

| ID | 延期项 | 原因 |
| --- | --- | --- |
| D-01 | 多人在线协作 | 首版聚焦本机单用户工作流和 A2A 治理。 |
| D-02 | 云端部署 | 首版只做本机运行。 |
| D-03 | 自动合并到 main | 首版风险过高。 |
| D-04 | 功能和 Bug 之外的工作项类型 | 首版需要聚焦。 |
| D-05 | 面向最终用户的工作流自定义 | 固定首版流程更容易治理和验证。 |

