# Clowder AI PRD

> 状态：当前基线
> 所属：产品
> 规则效力：产品目标、范围与核心能力规则
> 维护角色：产品负责人


## 产品目标

Clowder AI 是一个本机运行、单用户、三 Agent 敏捷协作聊天室。用户、Codex、Claude 和 MiniMax 在同一个工作空间内，围绕工作项完成需求澄清、方案设计、任务拆解、并行开发、交叉 Review、质量门禁、交付和复盘学习。

首版目标是让团队协作过程可见、可追踪、可治理、可复用。系统不应退化成三个 Agent 分别回答同一个用户问题。

## 首版范围

首版包含：

- 工作项类型：功能需求。
- 工作项类型：Bug 修复。
- 单用户。
- 单项目：当前 `clowder-ai` 项目。
- 本机运行。
- 覆盖完整工作流的 A2A 协作。
- 交付前的内部交叉 Review。
- 推送 feature 分支到 `git@github-lumen:lumen121/clowder-ai.git`。
- 使用 Clowder AI 开发 Clowder AI 自身的 Dogfooding 流程。

首版不包含：

- 多人在线协作。
- 云端部署。
- 自动合并到 `main`。
- 自动合并 PR。
- 跳过内部 Review。
- 功能需求和 Bug 修复之外的其他工作项类型。
- 面向最终用户的复杂工作流自定义。

## 核心产品能力

### 统一聊天室与时间线

系统必须提供一个共享空间，展示用户消息、Agent 消息、A2A 交互、决策、分歧、工作项状态、Review 结果、质量门禁结果、交付结果和复盘记录。

### 覆盖完整工作流的 A2A

A2A 必须覆盖完整生命周期：

- 类型识别。
- 需求澄清。
- 方案设计。
- 任务拆解。
- 责任分配。
- 执行同步。
- 交叉 Review。
- 验证。
- 复盘反馈。

A2A 不只发生在 Review 阶段。

### 方案先行

在以下条件满足前，任何 Agent 不得开始开发或修改文件：

- 工作项类型清晰。
- 需求歧义已经解决，或已明确升级给用户。
- 已形成方案。
- Agent 已评估方案。
- 没有未解决的内部分歧。
- 已明确任务负责人、任务边界、依赖、产物、Review 方和验收标准。

### 并行 Agent 开发

Codex、Claude 和 MiniMax 都可以在任务边界清晰、冲突风险较低时并行开发。并行工作必须由 Harness 管控，包括独立工作区或等效隔离、Review 分配、合并顺序、冲突检测和升级机制。

### 交叉 Review

作者不能成为自己产出的唯一审核者。代码、设计或用户可见变更在交付前必须由非作者 Agent Review。

### Harness 治理

系统必须包含 Harness 能力，用于管理：

- 上下文。
- 记忆。
- 工具沙箱。
- 权限。
- Agent Loop。
- 校验护栏。
- 安全约束。
- 任务路由与编排。
- 共享状态。
- 人工升级。
- 工作区与产物治理。
- 观测、评估和反馈回路。

### 本地复盘记忆

每个完成的工作项都应生成复盘记录。后续任务应能引用相关历史经验、失败模式、Review 发现和流程改进建议。

## 工作项生命周期

1. 用户提交工作项。
2. 系统识别工作项类型：功能需求或 Bug 修复。
3. Agent 进行 A2A 澄清。
4. Codex 主导方案设计和任务拆解。
5. Claude 和 MiniMax 评估方案，并提出问题、风险或反对意见。
6. Agent 达成内部一致，或升级给用户。
7. 任务按边界串行或并行执行。
8. 非作者 Agent 进行交叉 Review。
9. 运行质量门禁。
10. 系统准备本地提交。
11. 系统推送 feature 分支。
12. 如果凭证和配置允许，系统可选创建 GitHub PR。
13. 系统记录复盘记忆。

## 工作项状态

- `needs_clarification`
- `solution_review`
- `ready_for_development`
- `in_development`
- `pending_review`
- `needs_fix`
- `pending_verification`
- `ready_to_commit`
- `pushed`
- `blocked`
- `completed`

## 角色摘要

Codex 负责需求统筹、意图识别、需求分析、方案设计、任务拆解和整体推进。Codex 也可以作为核心开发 Agent，但不能自审。

Claude 负责核心实施、代码修改、Bug 修复、运行检查和修复验证。Claude 可以与 Codex、MiniMax 并行开发，但不能自审。

MiniMax 负责 UI 视觉质量、多模态任务、语音、视频、图片和交互体验相关的设计或 Review。涉及 UI、视觉、多模态、语音、视频、图片或交互体验的任务，MiniMax 必须参与方案或 Review。

## GitHub 与交付策略

系统可以推送 feature 分支到：

```text
git@github-lumen:lumen121/clowder-ai.git
```

系统不得直接推送到 `main`，不得合并到 `main`，不得自动合并 PR。

创建 GitHub PR 是可选能力。推送分支可以使用本地已配置的 Git 和 SSH key。自动创建 PR 需要 GitHub CLI 登录态或 GitHub token。PR 是外部协作和合并记录，不替代内部 A2A Review。

