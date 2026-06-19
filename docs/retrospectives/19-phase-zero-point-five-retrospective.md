# 阶段 0.5 复盘记录：页面入口变更与任务启动治理

> 状态：历史记录
> 所属：复盘
> 规则效力：历史事实、产品侧复盘与改进输入
> 维护角色：产品负责人
> 日期：2026-06-19

## 复盘对象

本复盘覆盖零阶段复盘之后、T2/T3 早期开发过程中发生的一组关键变更和治理补强。

本次复盘重点不是重新评估整个项目，而是记录：

- 页面级用户参与入口如何进入 P0 基线。
- T2/T3 如何受到页面变更影响。
- MiniMax 参与节奏如何临时调整。
- `README.md`、`AGENTS.md` 和任务启动包模板如何补强项目治理。
- 后续文档治理应如何渐进演进，而不是在开发中大规模重构。

## 工作项类型

功能需求与协作治理改进：补齐首版页面用户参与能力，并建立任务启动上下文的产品侧规则。

## 参与角色

- 用户：发现页面入口缺失，提出变更影响、任务同步、文档治理、任务启动包和复盘问题。
- 产品负责人：确认产品缺口，批准 P0 页面能力，输出产品侧变更包、澄清和任务启动包模板。
- 系统架构师：输出页面变更架构影响评估，修订架构设计和执行计划，维护项目级 Agent 固定规则。
- Codex / Claude：已在 T2/T3 中进行开发与 Review，需要按新规则补录任务启动上下文和页面变更影响。
- MiniMax：因客户端操作不友好，允许在 T2 最小页面入口搭建后再引入，但不得取消 T13 或 T16 前的页面体验 Review。

## 关键过程

1. 用户发现产品文档和执行计划缺少明确页面入口，指出没有页面会导致用户难以参与系统。
2. 产品负责人确认这是产品侧重大遗漏，并输出页面级用户参与入口变更提案。
3. 产品负责人批准新增 `P0-14`、`P0-15`、`P0-16`，明确页面是首版主入口，CLI 仅作为零阶段或内部入口。
4. 系统架构师输出页面变更架构影响评估，并修订架构侧澄清文档。
5. 产品负责人对架构变更进行 Review，确认页面查询视角、T2/T3 持久化出口、T13/T16 验收边界。
6. 系统架构师同步修订系统架构设计和实现计划。
7. 用户提出 T2/T3 已按旧要求开发和 Review，要求明确如何向执行 Agent 同步变更影响。
8. 产品负责人确认 T1 不回溯，T2 需要部分回溯补齐页面录入入口，T3 不强制改代码但必须证明页面查询视角成立。
9. 用户说明 MiniMax 客户端操作不友好，计划在初版页面入口搭建后再引入 MiniMax。
10. 产品负责人接受该零阶段临时安排，并明确 MiniMax 必须在 T13 页面主界面或 T16 E2E 前参与页面体验 Review。
11. 项目补充 `README.md`，用于提供项目入口摘要、首版范围、Agent 角色、页面能力、执行约束和文档入口。
12. 系统架构师输出 `AGENTS.md`，用于维护项目级固定 Agent 工作规则。
13. 产品负责人 Review `AGENTS.md`，要求补强任务启动上下文字段、MiniMax 强制参与口径、页面任务阅读路径、E2E 门禁和文档可发现性。
14. 系统架构师修订 `AGENTS.md` 后，产品负责人确认通过。
15. 用户提出标准化任务启动包模板的归属问题。
16. 产品负责人确认任务启动包属于产品侧协作治理规则，由产品负责人先定义，系统架构师负责落成可执行机制。
17. 产品负责人新增 [../collaboration/13-task-start-package-template.md](../collaboration/13-task-start-package-template.md)，定义任务启动包模板、必填字段、阻断规则和按任务类型的补充要求。
18. 用户询问成熟开源项目的文档治理做法。
19. 产品负责人建议当前不做大规模文档治理重构，只在后续逐步补充 ADR、任务运行记录、模板和 GitHub 协作文件。

## 已进入当前基线的规则

本节只记录已被其他基线文档吸收的规则来源，不由本复盘单独定义新规则。

| 规则 | 权威来源 |
| --- | --- |
| 页面级用户参与入口是首版 P0 能力。 | 产品基线：[../product/14-page-user-participation-proposal.md](../product/14-page-user-participation-proposal.md) |
| `P0-14`：页面级用户参与入口。 | 产品基线：[../product/14-page-user-participation-proposal.md](../product/14-page-user-participation-proposal.md) |
| `P0-15`：页面级工作项详情与状态可见。 | 产品基线：[../product/14-page-user-participation-proposal.md](../product/14-page-user-participation-proposal.md) |
| `P0-16`：页面级 Review / 门禁 / 复盘查看。 | 产品基线：[../product/14-page-user-participation-proposal.md](../product/14-page-user-participation-proposal.md) |
| CLI 可以保留为零阶段或内部入口，但不能成为首版用户参与的唯一入口。 | 产品基线：[../product/14-page-user-participation-proposal.md](../product/14-page-user-participation-proposal.md)；执行计划：[../execution/15-implementation-plan.md](../execution/15-implementation-plan.md) |
| T1 不回溯。 | 产品变更提案 / 对现有任务影响：[../product/14-page-user-participation-proposal.md](../product/14-page-user-participation-proposal.md) |
| T2 必须补齐最小页面工作项录入入口，不能把页面录入全部推迟到 T13。 | 产品澄清：[../product/15-page-change-implementation-clarifications.md](../product/15-page-change-implementation-clarifications.md)；执行计划：[../execution/15-implementation-plan.md](../execution/15-implementation-plan.md) |
| T3 不强制改代码，但必须证明能支撑页面读取、详情、时间线、阻塞/待确认、Review、门禁和复盘摘要。 | 产品澄清：[../product/15-page-change-implementation-clarifications.md](../product/15-page-change-implementation-clarifications.md)；架构/执行澄清：[../architecture/16-page-change-architecture-clarifications.md](../architecture/16-page-change-architecture-clarifications.md) |
| T2/T3 持久化出口必须统一，并应在 T5 状态机启动前完成。 | 产品澄清：[../product/15-page-change-implementation-clarifications.md](../product/15-page-change-implementation-clarifications.md)；架构/执行澄清：[../architecture/16-page-change-architecture-clarifications.md](../architecture/16-page-change-architecture-clarifications.md) |
| T13 是完整页面级用户参与主界面的最小实现，不把完整 T13 范围塞进 T2。 | 产品澄清：[../product/15-page-change-implementation-clarifications.md](../product/15-page-change-implementation-clarifications.md)；执行计划：[../execution/15-implementation-plan.md](../execution/15-implementation-plan.md) |
| T16 端到端验证必须覆盖页面参与，而不能只验证 CLI 闭环。 | 产品基线：[../product/14-page-user-participation-proposal.md](../product/14-page-user-participation-proposal.md)；执行计划：[../execution/15-implementation-plan.md](../execution/15-implementation-plan.md) |
| MiniMax 可在 T2 最小页面录入入口搭建后再引入，但必须在 T13 页面主界面或 T16 E2E 前参与页面体验 Review。 | 产品澄清：[../product/15-page-change-implementation-clarifications.md](../product/15-page-change-implementation-clarifications.md)；架构/执行澄清：[../architecture/16-page-change-architecture-clarifications.md](../architecture/16-page-change-architecture-clarifications.md) |
| Agent 不得自行选择身份并开始执行，必须获得明确任务启动上下文。 | AGENTS 固定规则：[../../AGENTS.md](../../AGENTS.md)；协作治理草案：[../collaboration/13-task-start-package-template.md](../collaboration/13-task-start-package-template.md) |
| 作者不能作为自己产出的唯一 Review 方。 | 产品/协作基线：[../collaboration/03-a2a-collaboration-protocol.md](../collaboration/03-a2a-collaboration-protocol.md)；AGENTS 固定规则：[../../AGENTS.md](../../AGENTS.md) |
| 内部 A2A Review 不能被 GitHub PR Review 替代。 | 产品/协作基线：[../collaboration/03-a2a-collaboration-protocol.md](../collaboration/03-a2a-collaboration-protocol.md)；AGENTS 固定规则：[../../AGENTS.md](../../AGENTS.md) |

## 草案或待架构 Review 的内容

- [../collaboration/13-task-start-package-template.md](../collaboration/13-task-start-package-template.md) 是产品侧任务启动包模板草案，仍需系统架构师 Review。
- 任务启动包的技术承载形态尚未确认，可以是文档、表单、结构化记录、页面输入或 Harness 内部对象。
- 任务启动包如何与状态机、A2A 事件、Review、质量门禁、worktree 和 Git 记录关联，需由系统架构师设计。
- 后续是否建立 `docs/architecture/decisions/` ADR 目录，建议在 T13/T16 或首个完整闭环后再做，不建议当前大规模重构。
- 后续是否建立 `docs/execution/work-items/` 运行记录结构，建议从后续新任务或 T4-T8 期间试点，不强制回填所有历史记录。

## 对当前 T2/T3 的影响

### T2

T2 需要部分回溯，但不要求推翻已有工作。

T2 必须补齐：

- 最小页面录入入口。
- 功能需求 / Bug 修复类型选择或识别。
- 页面入口真实创建 WorkItem。
- 创建后展示最小初始状态：ID、类型、当前状态、标题或目标、低置信度或待确认提示。
- 页面入口和 CLI 内部入口最终统一到同一 WorkItem 持久化出口。
- 原 Review 结论如果只覆盖 CLI，应视为历史事实，不能直接代表页面入口通过。

T2 不应扩大到：

- 完整统一聊天室。
- 完整工作项详情。
- 完整阻塞确认流程。
- 完整 Review / 门禁 / 复盘视图。
- 高保真视觉设计或完整设计系统。

### T3

T3 不强制改代码，但必须补充证明。

T3 必须说明：

- 工作项详情如何读取。
- 时间线如何读取。
- 阻塞和待确认项如何读取。
- Review、门禁、复盘摘要如何读取。
- 最近一次关键结论如何得到。
- 当前 Store 或应用服务是否能支撑页面查询视角。

如果存在两个 WorkItem 来源，T3 必须参与统一事实来源判断，并在 T5 前消除风险。

## T2/T3 任务启动包补录要求

对 T2/T3 已经进行中的任务，不要求重做完整任务启动包，但必须由主执行 Agent 补录最小启动上下文。

补录内容需要满足开发任务适用字段，不能低于 [../collaboration/13-task-start-package-template.md](../collaboration/13-task-start-package-template.md) 中的开发任务约束。若补录字段因历史执行状态无法完整回填，必须明确缺口、影响和下一步处理。

补录责任：

- T2 由 T2 主执行 Agent 补录。
- T3 由 T3 主执行 Agent 补录。
- 原 Review 方做轻量确认。
- 系统架构师确认是否与架构执行计划、持久化出口和页面查询视角冲突。
- 产品负责人确认是否满足页面主入口、T2/T3 边界、验收标准和 MiniMax 延后介入口径。

补录内容至少包括：

- 当前身份。
- 任务 ID。
- 任务目标。
- 范围内事项。
- 范围外事项。
- 依赖。
- 必读文档。
- Review 方。
- 验收标准。
- 禁止事项。
- 文件/模块边界。
- 维护性注释要求。
- Git 身份要求。
- worktree / 分支要求，若本任务涉及隔离执行或并行开发。
- 页面变更影响。
- MiniMax 是否需要参与及参与节点。
- 已完成内容是否偏离启动包，如有偏离说明原因。
- 是否需要产品负责人或系统架构师确认。

补录必须进入可追踪执行记录，可以补到现有任务结果/验证文档末尾，也可以新增独立执行记录。补录是为了补齐治理记录，不得借补录扩大 T2/T3 范围。

## 有效做法

- 用户及时指出页面入口缺失，避免系统首版退化为只能靠 CLI 或文档参与。
- 产品负责人承认页面入口遗漏，并将其提升为 P0 产品能力，而不是把它包装为后续优化。
- 产品侧先明确 WHAT、边界和验收，再让系统架构师输出架构侧影响评估。
- 对已经启动的 T2/T3 采用部分回溯，而不是全量推翻，降低开发中断成本。
- MiniMax 参与节奏采用临时降级，但保留强制体验 Review 门禁。
- `AGENTS.md` 固化项目级 Agent 执行规则，减少不同 Agent 反复解释规则的成本。
- 任务启动包模板将用户自然输入和 Agent 可控执行之间的转换层显性化。
- 文档治理讨论明确“不在开发中大重构”，避免治理工作吞噬 P0 交付。

## 发现的问题

- 早期产品基线遗漏了首版用户参与页面入口，这是严重产品缺口。
- T2/T3 已经按旧要求推进后才补入页面能力，造成变更影响评估和部分回溯。
- 当前 Agent 启动仍依赖人工分发上下文，容易遗漏身份、边界、Review 方、验收标准或禁止事项。
- T2/T3 原始 Review 可能只覆盖旧范围，需要重新确认页面变更后的 Review 适用范围。
- MiniMax 因客户端操作不友好暂缓介入，会带来页面体验问题后置暴露的风险。
- 执行文档、结果文档、变更评估和复盘文档数量快速增长，后续需要更清晰的运行记录结构。
- 当前任务启动包模板仍是产品侧草案，尚未完成架构侧可执行性 Review。

## 返工与调整记录

- 新增页面级用户参与入口产品变更提案。
- 批准并纳入 `P0-14`、`P0-15`、`P0-16`。
- 新增产品侧页面变更执行澄清。
- 系统架构师新增页面变更架构澄清并更新架构设计、执行计划。
- README 增加项目入口摘要、首版范围、核心能力、当前产品基线、架构执行要点和文档入口。
- `AGENTS.md` 增加任务启动要求、阅读路径、MiniMax 参与规则、E2E 门禁、Git 规则和文档记忆规则。
- 新增任务启动包模板。
- 更新协作治理索引和根文档索引，使任务启动包进入 Agent 必读路径。

## 风险控制

- T2 不允许把页面录入全部推迟到 T13。
- T2 不允许把 CLI 输出包装成页面主入口。
- T3 不允许只证明写入能力而不说明页面读取视角。
- T5 状态机启动前必须确认 WorkItem 单一事实来源。
- MiniMax 延后介入只能作为零阶段临时安排，不能取消 T13 或 T16 前体验 Review。
- 任务启动包字段缺失、互相冲突或越权时，Agent 不得直接执行。
- 复盘建议不自动成为当前规则，必须吸收到产品、协作、架构或执行基线后才具备效力。
- 当前不做大规模文档治理重构，避免干扰 T2/T3 和 P0 闭环交付。

## Dogfooding 观察

这轮变更本身就是一次 Dogfooding 早期样例：

- 用户发现产品缺口。
- 产品负责人承认并定义变更。
- 系统架构师做影响评估。
- 执行 Agent 需要补录变更影响和启动上下文。
- 项目规则通过 README、AGENTS 和任务启动包模板被固化。
- 最后通过复盘沉淀经验。

该过程说明系统未来必须支持：

- 用户从页面发起变更或质疑。
- Harness 自动识别受影响任务。
- Agent 输出影响评估。
- 产品负责人或系统架构师按职责裁决。
- 执行计划和任务启动包随裁决更新。
- 任务与 branch/worktree 的绑定关系可追踪。
- Git 写入动作能按执行 Agent 身份归因。
- 交付前检查通过但推送受阻时，阻塞原因和当前交付状态对用户可见。
- 复盘记录被结构化沉淀。

## 产品侧改进建议

- 后续页面输入工作项后，应由 Harness 自动生成任务启动包草案，而不是要求用户手写。
- 用户只需表达“开始某个任务”或“修复某个 Bug”，系统负责把自然语言转换成可控执行契约。
- 任务启动包应该成为 Harness 管住 Agent 的执行契约，而不是给用户增加负担的表格。
- T4-T8 期间应验证任务启动包字段是否足够支撑 Agent 调用、状态推进、Review 和门禁。
- T13/T16 后再考虑建立 ADR 和标准任务运行记录目录，不建议现在进行大规模文档迁移。
- 每次重大产品变更应明确：影响哪些任务、不影响哪些任务、哪些要回溯、回溯到什么程度。

## 技术执行建议

以下建议供系统架构师和执行 Agent 参考，不自动成为产品规则：

- 任务启动包可以先以 Markdown 形式运行，待 Harness 成熟后再结构化。
- T2/T3 的启动包补录可以先写入现有任务结果或验证文档末尾，不必立即建立完整 `work-items/` 目录。
- 后续可从 T4 或 T5 起试点 `start-package.md`、`result.md`、`review.md`、`gate.md` 的最小运行记录结构。
- ADR 适合记录重大架构决策，但应在首个完整闭环后再引入，避免当前重构过度。
- 如果 MiniMax 客户端继续影响效率，应在 T13 前明确其 Review 输入/输出格式，降低人工操作成本。

## 质量门禁结果

- 页面级用户参与入口已经进入产品基线。
- 页面变更架构影响已完成并归档。
- 执行计划已同步页面主入口、T2/T3/T13/T16 的职责变化。
- README 已补充项目入口信息。
- `AGENTS.md` 已通过产品侧 Review。
- 任务启动包模板已输出为产品侧草案，已完成系统架构师 Review；执行落地方式仍待架构侧后续设计确认。
- 当前复盘不阻塞 T2/T3 继续推进，但 T2/T3 必须补录最小任务启动上下文。

## 后续状态跟踪

当前开放事项和实时进度不再维护在本复盘中，统一迁移到 [../execution/current-action-tracker.md](../execution/current-action-tracker.md)。

本复盘只保留历史事实、原因解释和改进输入；后续状态变化由事项 Owner 在当前执行状态看板中更新。

## 下一步执行口径

后续不再把已完成事项保留为开放待办，也不通过反复修改复盘文档维护实时进度。执行方应按 [../execution/current-action-tracker.md](../execution/current-action-tracker.md) 推进未完成项，并在对应执行记录中补充完成证据。

当前最近动作是：

1. 要求 T2/T3 主执行 Agent 补录任务启动上下文。
2. 原 Review 方对补录内容做轻量确认。
3. 在 T5 启动前确认 WorkItem 单一事实来源。
