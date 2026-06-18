# 架构设计输入说明

> 状态：当前基线
> 所属：架构
> 规则效力：架构输入要求
> 维护角色：产品负责人


## 目的

本文档说明系统架构师应基于产品文档包输出什么。

系统架构师应进行系统设计。在产品需求覆盖性审查完成前，不应开始实现、写代码、修改文件或执行开发任务。

## 必读文档

系统架构师必须阅读：

- [00-index.md](../00-index.md)
- [01-prd.md](../product/01-prd.md)
- [03-a2a-collaboration-protocol.md](../collaboration/03-a2a-collaboration-protocol.md)
- [04-harness-governance.md](../collaboration/04-harness-governance.md)
- [08-acceptance-criteria.md](../product/08-acceptance-criteria.md)
- [09-risk-controls.md](../product/09-risk-controls.md)
- [10-dogfooding-plan.md](../collaboration/10-dogfooding-plan.md)
- [11-architecture-brief.md](11-architecture-brief.md)
- [13-decisions-and-assumptions.md](../product/13-decisions-and-assumptions.md)

## 必须输出的架构内容

架构设计必须包含：

- 系统模块划分。
- 工作项状态机。
- A2A 交互模型。
- Harness 设计。
- Agent 角色与权限模型。
- 上下文与记忆设计。
- 工具沙箱与安全模型。
- 并行开发与 worktree 隔离方案。
- Review 与质量门禁方案。
- 人工升级设计。
- 观测、指标和评估模型。
- 失败恢复策略。
- Git 提交、分支推送和可选 PR 流程。
- Dogfooding 支撑设计。
- 产品验收标准到系统能力的映射。

## 必须覆盖的内容

架构必须明确覆盖：

- 方案先行门禁。
- 覆盖澄清、设计、拆解、执行同步、Review、验证和复盘的 A2A。
- 非作者 Review。
- UI、视觉、多模态、语音、视频、图片和交互体验类任务中 MiniMax 的强制参与。
- 并行开发约束。
- worktree 或等效工作区隔离。
- 冲突检测与升级。
- 高风险动作的人工确认。
- 本地复盘记忆。
- Dogfooding 反馈回路。

## 输出格式

架构输出应包含：

- 摘要。
- 架构目标。
- 主要组件。
- 数据与状态模型。
- 核心流程。
- 失败流程。
- 安全与权限模型。
- 观测与指标。
- 产品需求覆盖表。
- 未决问题和假设。

## 产品覆盖性审查

架构产出后，必须由产品负责人进行需求覆盖性审查，再进入实现计划。

审查重点：

- 是否覆盖所有 P0 需求。
- 是否保留 A2A 的完整工作流能力。
- 是否强制方案先行。
- 是否防止自审。
- 是否控制并行开发。
- 是否把 Harness 设计成治理系统，而不仅是工具调用器。
- 是否支持 Dogfooding 和反馈回路。
- 是否明确人工确认点。

