# Clowder AI 实现任务拆解与一周开发计划

> 状态：当前基线
> 所属：执行
> 规则效力：执行计划、阶段门禁与执行节奏
> 维护角色：系统架构师


## 计划目标

本计划基于 [14-system-architecture-design.md](../architecture/14-system-architecture-design.md) 拆解首周实现任务。

第一周目标不是一次性完成完整产品，而是交付一个最小可用治理闭环：

```text
用户录入工作项
  -> 状态机推进
  -> A2A 记录
  -> 方案先行门禁
  -> 任务拆解
  -> Review 记录
  -> 质量门禁记录
  -> feature 分支交付前检查
  -> 复盘记录
```

第一周不建议实现自动合并 PR、自动部署、完整 GitHub PR 创建、复杂语义冲突自动判定、多项目、多用户或复杂工作流自定义。

## 实现任务拆解

| ID | 任务 | 目标 | 优先级 | 依赖 | 建议执行 Agent | 是否可并行 | 验收标准 | Review 方 | 风险 | 交付物 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | 实现基线确认 | 确认现有项目结构、运行方式、测试/检查命令、可落地的最小技术路径。 | P0 | 无 | Codex | 否 | 明确首周实现范围、运行入口、检查命令和不可做项。 | Claude | 低估现有代码约束。 | 实现基线说明 |
| T2 | 工作项录入与类型选择/识别最小入口 | 支持用户录入功能需求或 Bug 修复，并创建工作项初始记录。 | P0 | T1 | Codex 主导，MiniMax 协作 | 是，可与 T3 并行 | 用户可以录入工作项；系统能记录原始请求、工作项类型和初始状态。 | Claude | 只做展示入口，未真正创建 WorkItem。 | 工作项录入入口 |
| T3 | 逻辑模型与本地持久化 | 支持 WorkItem、Task、A2AEvent、ReviewRecord、QualityGateRun、WorkspaceRecord、EscalationRecord、RetrospectiveMemory 的本地读写。 | P0 | T1 | Claude | 是，可与 T2、T4 并行 | 能创建、读取、更新核心记录；数据可重启后保留。 | Codex | 过早设计成复杂数据库 schema。 | 本地持久化模块 |
| T4 | Agent CLI 适配与最小调用闭环 | 让 Harness 能以任务上下文调用 Codex、Claude、MiniMax，并记录 Agent 响应。 | P0 | T1 | Codex | 是，可与 T3 并行 | 至少能对三个 Agent 发起最小任务调用，响应能回写为 Agent 消息或 A2A 事件。 | Claude | CLI 环境差异导致调用不可用；只模拟 Agent 导致失去三 Agent 协作目标。 | Agent 适配层 |
| T5 | 工作项状态机 | 实现工作项状态流转、blocked 入口、非法状态拦截。 | P0 | T3 | Codex | 是，可与 T6 并行 | 状态只能按允许路径变化；非法推进被拒绝并记录原因。 | Claude | 状态规则散落导致后续难维护。 | 状态机模块与状态规则 |
| T6 | A2A 事件编排与记录 | 支持澄清、方案评估、任务拆解反馈、执行同步、Review、验证、复盘等 A2A 事件。 | P0 | T3, T4 | Claude | 是，可与 T5 并行 | 每类关键 A2A 事件可记录发起方、接收方、目的、结论、下一步。 | Codex | 只记录聊天文本，缺少结构化结论。 | A2A 事件模块 |
| T7 | 方案与任务拆解流程 | 支持方案记录、任务生成、负责人指定、依赖/边界写入、Review 方和验收标准指定。 | P0 | T3, T5, T6 | Codex | 否 | 进入开发前，每个任务都有负责人、边界、依赖、产物、Review 方和验收标准。 | Claude | 任务拆解停留在自由文本，Harness 无法校验。 | 任务拆解与分配流程 |
| T8 | Harness 核心护栏 | 实现方案先行、非作者 Review、质量门禁前置检查、高风险动作拦截。 | P0 | T5, T7 | Codex | 否 | 未完成方案、任务拆解、Review 或门禁时不能进入开发或交付状态。 | Claude | 护栏过硬导致正常流程无法推进。 | Harness 决策模块 |
| T9 | Review 与质量门禁记录 | 支持非作者 Review 结论、修改要求、质量门禁结果和失败可见。 | P0 | T3, T8 | Claude | 是，可与 T10 并行 | Review 结果只能是四类；失败门禁不能被静默跳过。 | Codex | 只做记录不做拦截。 | Review 与门禁模块 |
| T10 | Worktree 与任务隔离最小治理 | 记录任务到 branch/worktree 的绑定、合并顺序、冲突状态，并做合并前最小检查。 | P0 | T3, T7 | Claude | 是，可与 T9 并行 | 能登记每个任务的隔离工作区和冲突状态；合并前能检查分支/worktree 绑定和冲突状态；不做完整自动合并。 | Codex | Git 操作复杂化，误触外部状态。 | WorkspaceRecord 管理 |
| T11 | Git feature 分支交付安全流程 | 实现交付前检查、禁止 main、feature 分支推送能力；PR 创建保持可选。 | P0 | T8, T9, T10 | Codex | 否 | 未满足条件不能进入 ready_to_commit；main 相关动作被拦截；门禁通过后具备 feature 分支推送能力。 | Claude | 误把 PR 创建当必选，或绕过内部 Review 直接交付。 | Git 交付检查与 feature 分支推送流程 |
| T12 | 人工升级流程 | 对重大歧义、分歧、门禁失败、高风险动作生成升级记录。 | P0 | T5, T8 | Codex | 是，可与 T13 并行 | 升级记录包含发生了什么、阻塞规则、选项、风险、推荐动作。 | Claude | 升级信息太泛，无法帮助用户决策。 | EscalationRecord 流程 |
| T13 | 统一时间线最小 UI | 展示工作项录入、用户消息、Agent 消息、状态变化、A2A、Review、门禁、交付和复盘记录。 | P0 | T2, T5, T6, T9 | MiniMax | 是，可与 T12、T14 并行 | 一个工作项的关键事件能按时间顺序可见，用户能看出当前阻塞点和下一步。 | Codex | UI 先行导致治理逻辑被弱化。 | 时间线页面或组件 |
| T14 | 复盘记录最小闭环 | 支持工作项结束后记录参与 Agent、返工、门禁、失败原因、复盘结论和改进建议。 | P0 | T3, T6, T9 | Claude | 是，可与 T12、T13 并行 | 完成或失败工作项能生成结构化复盘记录；T16 可验证复盘记录已进入时间线或本地记忆。 | Codex | 复盘变成自由文本，无法支撑后续 Dogfooding。 | 复盘记录模块 |
| T15 | Dogfooding 评估增强 | 在复盘记录基础上统计耗时、A2A 次数、Review 发现、返工次数和流程改进建议。 | P1 | T14 | Claude | 是，可与集成修复并行 | Dogfooding 工作项可生成基础指标和改进建议；产品规则变更仍需产品负责人确认。 | Codex | 过早追求完整分析，挤压 P0 闭环。 | Dogfooding 评估增强 |
| T16 | 首个端到端样例验证 | 用一个模拟功能需求或 Bug 修复跑完整闭环。 | P0 | T1-T14，T15 可选 | Codex 主导，Claude 和 MiniMax 参与 | 否 | 能覆盖用户录入、Agent 协作、方案先行、任务拆解、Review、质量门禁、feature 分支交付或交付检查、复盘记录。 | 非作者双 Review | 集成问题集中暴露。 | E2E 验证记录 |

## T1 实现基线确认子检查项

`T1` 是进入实现阶段的硬门禁，不得压缩或跳过。完成 `T1` 前，不应开始 `T2` 之后的功能开发。

`T1` 必须确认：

- 当前项目结构和运行入口。
- 当前目录是否为 Git 仓库。
- 远程仓库是否配置为 `git@github-lumen:lumen121/clowder-ai.git`。
- 本地 Git 账号和 SSH key 是否可用。
- 是否能创建 feature 分支。
- 是否能创建和管理 git worktree。
- 当前工作区是否存在未归属变更。
- Codex、Claude、MiniMax CLI 是否可调用。
- 三个 Agent 的最小输入、输出捕获、错误处理和超时风险。
- 本地持久化路径和读写权限。
- 测试、构建、lint 或其他检查命令。
- 中文 Markdown 和 CLI 输出的 UTF-8 读写策略。

若任一关键项不满足，应记录为阻塞或执行风险，并升级给用户确认是否继续采用零阶段人工接力。

## 一周开发计划

| 时间 | 重点 | 主 Agent | 并行安排 | 当日验收 |
| --- | --- | --- | --- | --- |
| Day 1 | 实现基线确认、确定最小闭环边界、确认测试/检查命令和 Agent CLI 可调用性。 | Codex | Claude 辅助检查持久化选项；MiniMax 查看现有 UI 结构。 | T1 完成，并明确 Agent CLI 适配风险。 |
| Day 2 | 工作项录入入口、逻辑模型、本地持久化、Agent CLI 最小调用闭环。 | Codex / Claude | T2、T3、T4 并行；MiniMax 协助录入入口交互。 | 用户可录入工作项；核心记录可保存；至少能触发最小 Agent 调用。 |
| Day 3 | 工作项状态机、A2A 事件、方案与任务拆解流程。 | Codex / Claude | T5、T6 并行，随后串接 T7。 | 可记录 Agent 协作；任务可生成负责人、依赖、边界、Review 方和验收标准。 |
| Day 4 | Harness 护栏、Review、质量门禁、人工升级。 | Codex / Claude | T8、T9、T12 分段并行。 | 方案先行、非作者 Review、门禁失败和人工升级都能阻断流程。 |
| Day 5 | Worktree 最小治理、Git feature 分支交付安全流程、统一时间线 UI。 | Claude / Codex / MiniMax | T10、T11、T13 并行。 | 时间线能展示完整工作项轨迹；交付前检查和 feature 分支推送能力具备。 |
| Day 6 | 复盘记录最小闭环、Dogfooding 基础指标、失败恢复路径、跨模块集成。 | Claude / Codex | MiniMax 做 UI 可读性 Review。 | T14 最小版本完成；工作项可生成复盘记录，主要阻塞路径可见；T15 尽量完成基础指标。 |
| Day 7 | 端到端样例、交叉 Review、修复集成问题。 | Codex | Claude Review 核心逻辑；MiniMax Review 用户可见流程。 | T16 通过，覆盖用户录入、Agent 协作、门禁、Review、feature 分支交付或交付检查、复盘。 |

## 首周不做范围

- 自动合并 PR。
- 自动部署。
- 完整 GitHub PR 创建流程。
- 复杂语义冲突自动判定。
- 多项目。
- 多用户。
- 复杂工作流自定义。
- 完整 Agent 自治调度。

这些能力应在最小治理闭环稳定后再逐步纳入。
