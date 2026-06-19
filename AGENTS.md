# Clowder AI Agent Working Rules

> 状态：当前项目级固定规则
> 规则效力：Agent 执行约束与仓库协作规则
> 主维护角色：系统架构师
> Review 角色：产品负责人负责产品边界 Review；非作者 Agent 可做执行可读性 Review

本文件定义所有 Agent 在本仓库内工作的固定规则。它不替代产品需求、架构设计或执行计划。

## 规则边界

- 产品范围、需求、验收和风险边界以 `docs/product/` 为准。
- A2A、Harness、Dogfooding 和零阶段协作治理以 `docs/collaboration/` 为准。
- Agent 角色职责以 `docs/agents/` 为准。
- 架构设计和技术约束以 `docs/architecture/` 为准。
- 当前任务顺序、阶段门禁和执行状态以 `docs/execution/` 为准。
- 复盘文档是历史记录和改进输入，不会自动成为当前规则；只有被吸收进当前基线后才具备对应效力。
- 如果本文件与当前任务启动上下文、产品基线、架构基线或执行计划冲突，不得静默自行解释，必须暂停并升级确认。

## 任务启动要求

Agent 不得自行选择身份并开始执行。每个任务启动前必须获得明确的任务启动上下文，至少包含：

- 当前身份。
- 任务 ID。
- 任务目标。
- 任务边界。
- 依赖关系。
- 必读文档。
- Review 方。
- 验收标准。
- 禁止事项。
- 开发类任务的维护性注释要求。
- Git 写入动作的身份要求。

如果任一必要字段缺失，Agent 必须先请求补齐，不能直接执行。

## 阅读路径

所有 Agent 开始任务前必须先读 `docs/00-index.md`，再按任务启动上下文读取指定文档。

默认还必须读取：

- 自己的角色文档：`docs/agents/05-agent-codex.md`、`docs/agents/06-agent-claude.md` 或 `docs/agents/07-agent-minimax.md` 中与当前身份对应的一份。
- 当前执行计划：`docs/execution/15-implementation-plan.md`。
- 与当前任务直接相关的产品、架构、协作或执行文档。

T2、T3、T12、T13、T14、T16 或其他页面相关任务，还必须读取 `docs/product/14-page-user-participation-proposal.md` 和 `docs/product/15-page-change-implementation-clarifications.md`。具体执行仍以 `docs/00-index.md` 和任务启动上下文为准。

不得把三个角色文档都理解为同一 Agent 的身份来源。被分配的身份才是当前执行身份。

## 执行原则

- 需求和方案未确认前，不得开始开发或修改实现文件。
- 不得修改与当前任务无关的文件。
- 遇到已有未归属变更时，必须保留并绕开；不得回滚、覆盖或清理他人改动。
- 发现产品规则不可实现、成本明显过高或风险过大时，必须升级给产品负责人确认。
- 架构不能静默改写产品规则；执行计划不能静默降低产品 P0 要求。
- CLI 可以作为零阶段或内部入口，但页面级用户参与入口是首版主入口。
- 涉及 UI、视觉、多模态、语音、视频、图片或交互体验的任务，MiniMax 必须参与方案或 Review。零阶段 T2 最小页面录入可先由 Codex/Claude 完成和 Review，但 MiniMax 必须在 T13 页面主界面或 T16 E2E 前参与页面体验 Review。

## 代码与注释

- 开发类变更必须包含必要的维护性注释。
- 注释应解释非显而易见的逻辑、状态流转、外部假设、边界条件和风险分支。
- 不要求逐行注释，也不得用显而易见的注释堆数量。
- 代码风格、依赖选择、测试方式应优先遵循现有项目结构和已确认执行计划。

## Review 与门禁

- 作者不能作为自己产出的唯一 Review 方。
- 内部 A2A Review 是必选门禁，不能被 GitHub PR Review 替代。
- 质量门禁失败不能静默跳过；必须记录失败原因、影响范围和下一步处理。
- 高风险动作、部署、合并主干、绕过门禁和破坏性操作必须人工确认。
- 端到端验证必须覆盖页面录入、Agent 协作、页面阻塞或风险确认、Review、质量门禁、交付检查和复盘查看，并至少覆盖一条成功路径和一条被门禁阻断的失败路径。

## Git 规则

- Git 写入动作必须使用当前执行 Agent 对应的 `user.name` 和占位 `user.email`。
- 默认身份映射如下，除非任务启动上下文明确覆盖：
  - 系统架构师：`Clowder Architect <architect@clowder.local>`
  - Codex：`Clowder Codex <codex@clowder.local>`
  - Claude：`Clowder Claude <claude@clowder.local>`
  - MiniMax：`Clowder MiniMax <minimax@clowder.local>`
- 不得使用共享、匿名或与当前执行身份不一致的 Git 身份。
- 默认不得直接推送到 `main`，不得自动合并 PR，不得自动部署。
- 并行开发应使用独立分支或 git worktree，并记录任务、分支、worktree、负责人和冲突状态的绑定关系。

## 文档与记忆

- 关键决策、阻塞、澄清、Review 结论和复盘结果必须进入仓库文档或执行记录，不能只留在对话上下文里。
- 内置记忆只能作为辅助召回，不能作为产品规则、架构约束或交付状态的唯一事实来源。
- 新增或修改长期规则时，必须说明变更原因、影响范围和 Review 要求。
- 执行 Agent 可以提出修改本文件的建议，但不得在普通开发任务中自行改写固定规则。

## 本文件维护

- 初版和结构性更新由系统架构师维护。
- 涉及产品规则边界的修改必须交由产品负责人 Review。
- 涉及执行可读性或 Agent 操作风险的修改，可交由非作者 Agent 做轻量 Review。
- 修改后应确认 `docs/00-index.md`、相关子索引和任务启动上下文没有产生冲突。
