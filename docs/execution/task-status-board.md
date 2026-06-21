# 任务级状态看板

> 状态：当前基线
> 所属：执行
> 规则效力：T1-T16 任务级状态、证据和下一步的当前跟踪入口
> 维护角色：执行 Agent 更新任务状态；系统架构师维护任务结构；产品负责人维护状态口径和验收规则

## 目的

本文件用于跟踪实现计划中 T1-T16 的任务级状态。它不替代 [15-implementation-plan.md](15-implementation-plan.md)，也不改写任务范围、依赖或验收标准。

- [15-implementation-plan.md](15-implementation-plan.md)：执行计划基线，说明任务拆解、依赖、Owner 建议、验收和 Review 方。
- [task-status-board.md](task-status-board.md)：T1-T16 当前状态、证据和下一步。
- [current-action-tracker.md](current-action-tracker.md)：临时开放事项、阻塞、补录、确认项。

## 维护规则

- 执行 Agent 负责更新自己任务的状态和完成证据。
- Review Agent 负责补充 Review 记录或要求执行 Agent 补证据。
- 系统架构师负责维护任务结构、依赖关系、并行策略和执行节奏。
- 产品负责人负责维护状态口径、产品边界、验收口径和人工确认规则。
- 状态变化必须附证据链接，不能只写“已完成”。
- 执行 Agent 不得通过更新本表降低 P0 验收标准、扩大任务范围或绕过 Review / 质量门禁。
- 若任务遇到产品范围、P0 验收、页面主入口、MiniMax 参与、用户确认相关问题，必须升级给产品负责人。
- 若任务遇到架构落地、状态机、A2A、持久化、Review/门禁机制、worktree、Git 交付相关问题，必须升级给系统架构师。

## 标准任务闭环

后续执行任务默认按以下闭环推进：

1. 生成或确认任务启动包。
2. 检查依赖、允许动作级别、文件/模块边界、Git 身份、worktree/分支要求。
3. 分析方案，并在需要时进行 A2A 方案评估。
4. 方案无歧义后进入开发；存在歧义、分歧、产品或架构冲突时升级确认。
5. 执行开发或文档变更。
6. 作者自检，包括测试、lint、运行验证、页面验证和文档同步。
7. 输出执行结果，说明完成内容、验证结果、风险、状态去向和后续阻断关系。
8. 提交非作者 Review。
9. 根据 Review 反馈修复，必要时多轮 Review。
10. 通过质量门禁。
11. 更新本任务状态板；只有当任务产生新的补录项、确认项、跨任务阻塞或临时开放事项时，才更新 [current-action-tracker.md](current-action-tracker.md)。
12. 若任务涉及隔离执行或 Git 写入，必须同步记录 branch/worktree 绑定、Git 身份归因、交付检查结果和推送状态证据。若启动包允许，进入提交准备或 feature 分支推送；PR、部署、合并主干仍需按启动包和人工确认规则执行。
13. 记录复盘输入，包括返工、阻塞、Review 发现和改进建议。

## 状态枚举

- `未开始`：任务尚未启动。
- `待启动包`：任务准备启动，但缺少启动包或启动上下文。
- `方案中`：正在分析方案、拆解执行路径或进行 A2A 方案评估。
- `开发中`：正在执行实现或文档变更。
- `自检中`：作者已完成主要变更，正在做测试、检查或文档核对。
- `待 Review`：已产出结果，等待非作者 Review。
- `修复中`：Review 后需要修改。
- `待门禁`：Review 已通过，等待质量门禁或交付前检查。
- `已完成`：完成证据、Review 和必要门禁均已归档。
- `阻塞`：存在明确阻塞，需升级处理。
- `已取消`：经确认不再执行。

## 任务状态总览

| 任务 | 状态 | Owner | 依赖 | 启动包/上下文 | 实现结果 | Review | 门禁/验证 | 阻塞 | 下一步 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T1 实现基线确认 | 已完成 | Codex | 无 | 见 [19-t1-baseline-confirmation-result.md](19-t1-baseline-confirmation-result.md) | [19-t1-baseline-confirmation-result.md](19-t1-baseline-confirmation-result.md) | [20-t1-review-by-claude.md](20-t1-review-by-claude.md) | 见 T1 Review 文档最终状态 | 无 | 已关闭。 |
| T2 页面工作项录入与类型选择/识别最小入口 | 已完成 | Codex | T1 | 已补录：[21-t2-work-item-entry-result.md#任务启动包补充](21-t2-work-item-entry-result.md#任务启动包补充) | [21-t2-work-item-entry-result.md](21-t2-work-item-entry-result.md) | [28-t2-page-entry-review-by-claude.md](28-t2-page-entry-review-by-claude.md) | `npm run check`、`npm test` 通过；A1 已关闭 | 无 | 已关闭。 |
| T3 逻辑模型、本地持久化与页面查询视角 | 已完成 | Claude | T1 | 已补录：[22-t3-persistence-result.md#任务启动包补充](22-t3-persistence-result.md#任务启动包补充) | [22-t3-persistence-result.md](22-t3-persistence-result.md)、[27-t3-page-query-verification.md](27-t3-page-query-verification.md) | [24-t3-review-by-codex.md](24-t3-review-by-codex.md) | `npm run check`、`npm test`、`src/storage/__verify.js`、`src/storage/__page_query_verify.js` 通过；A2/A6 已关闭 | 无 | 已关闭。 |
| T4 Agent CLI 适配与最小调用闭环 | 已完成 | Codex | T1 | [29-t4-agent-cli-adapter-start-package.md](29-t4-agent-cli-adapter-start-package.md) | [30-t4-agent-cli-adapter-result.md](30-t4-agent-cli-adapter-result.md) | [31-t4-review-by-claude.md](31-t4-review-by-claude.md) | `npm run check`、`npm test`、`npm run verify:agents` 通过；三 CLI 真实调用结果已写入本地 T3 A2AEvent 验证记录；Claude Review 通过 | 无 | 已关闭；T6 对 T4 的依赖可解除。 |
| T5 工作项状态机 | 已完成 | Claude | T3；A6 已关闭 | [32-t5-work-item-state-machine-start-package.md](32-t5-work-item-state-machine-start-package.md) | [33-t5-work-item-state-machine-result.md](33-t5-work-item-state-machine-result.md) | Codex | `npm run check`、`npm test`、`node src/work-items/state-machine.verify.js`（46 通过）；Codex Review 通过（[34-t5-review-by-codex.md](34-t5-review-by-codex.md)） | 无 | 已关闭。后续 T7/T8/T12 可直接依赖 `transitionWorkItem()`。 |
| T6 A2A 事件编排与记录 | 已完成 | Claude | T3，T4 | [35-t6-a2a-event-orchestration-start-package.md](35-t6-a2a-event-orchestration-start-package.md) | [36-t6-a2a-event-orchestration-result.md](36-t6-a2a-event-orchestration-result.md) | [37-t6-review-by-codex.md](37-t6-review-by-codex.md)（三轮复核，通过） | `npm run check`、`npm test`、`node src/a2a/__verify.js`（95 通过） | 无 | 已关闭。T7/T13/T14 对 T6 的依赖可解除。 |
| T7 方案与任务拆解流程 | 已完成 | Codex | T3，T5，T6 | [38-t7-solution-task-breakdown-start-package.md](38-t7-solution-task-breakdown-start-package.md) | [40-t7-solution-task-breakdown-result.md](40-t7-solution-task-breakdown-result.md) | [41-t7-review-by-claude.md](41-t7-review-by-claude.md) | `npm run check`、`npm test`、`node src/work-items/solution-breakdown.verify.js`、`node src/work-items/state-machine.verify.js`、`node src/storage/__verify.js`、`node src/storage/__page_query_verify.js` 通过 | 无 | Claude Review 已归档，T7 可关闭。 |
| T8 Harness 核心护栏 | 已完成 | Codex | T5，T7 | [44-t8-harness-core-rails-start-package.md](44-t8-harness-core-rails-start-package.md) | [46-t8-harness-core-rails-result.md](46-t8-harness-core-rails-result.md) | [47-t8-review-by-claude.md](47-t8-review-by-claude.md) | `npm run check`、`npm test`、`npm run verify:harness`（22 passed）、`node src/work-items/state-machine.verify.js`（46 通过）、`node src/work-items/solution-breakdown.verify.js`（19 通过） | 无 | 已关闭；T9/T11/T12 对 T8 的依赖可解除。 |
| T9 Review 与质量门禁记录 | 已完成 | Claude | T3，T8 | [50-t9-review-quality-gate-start-package.md](50-t9-review-quality-gate-start-package.md) | [52-t9-review-quality-gate-result.md](52-t9-review-quality-gate-result.md) | [54-t9-review-by-codex.md](54-t9-review-by-codex.md)（修复后复核，通过） | `npm run check`（35 files）、`npm test`、`node src/review-quality/index.verify.js`（132/132 通过）、`npm run verify:harness`（22/22）、`node src/storage/__verify.js`（42/42）、`node src/storage/__page_query_verify.js`（15/15） | 无 | 已关闭；T11/T13/T14 对 T9 的依赖可解除。 |
| T10 Worktree 与任务隔离最小治理 | 已完成 | Claude | T3，T7 | [45-t10-worktree-isolation-start-package.md](45-t10-worktree-isolation-start-package.md) | [48-t10-worktree-isolation-result.md](48-t10-worktree-isolation-result.md) | [49-t10-review-by-codex.md](49-t10-review-by-codex.md)（修复后复核，通过） | `npm run check`、`npm test`、`node src/worktree/isolation-governance.verify.js`（44/44 通过） | 无 | 已关闭；T11 对 T10 的依赖可解除。 |
| T11 Git feature 分支交付安全流程 | 已完成 | Codex | T8，T9，T10 | [56-t11-git-delivery-safety-start-package.md](56-t11-git-delivery-safety-start-package.md) | [59-t11-git-delivery-safety-result.md](59-t11-git-delivery-safety-result.md) | [60-t11-review-by-claude.md](60-t11-review-by-claude.md)（通过） | `npm run verify:delivery`（17/17）、`npm run check`（39 files）、`npm test`、`npm run verify:harness`（22/22）、`node src/storage/__verify.js`（42/42）、`node src/worktree/isolation-governance.verify.js`（44/44）零回归 | 无 | 已关闭；T16 对 T11 的依赖可解除。 |
| T12 人工升级与页面确认流程 | 已完成 | Codex | T5，T8 | [51-t12-escalation-page-confirmation-start-package.md](51-t12-escalation-page-confirmation-start-package.md) | [54-t12-escalation-page-confirmation-result.md](54-t12-escalation-page-confirmation-result.md) | [55-t12-review-by-claude.md](55-t12-review-by-claude.md)（通过） | `npm run check`、`npm test`、`npm run verify:escalations`、`npm run verify:harness`、`node src/work-items/state-machine.verify.js`、`node src/work-items/solution-breakdown.verify.js`、`node src/storage/__verify.js`、`node src/storage/__page_query_verify.js` 通过 | 无 | 已关闭；T13/T16 对 T12 的依赖可解除。 |
| T13 页面级用户参与主界面最小实现 | 未开始 | MiniMax | T2，T3，T5，T6，T9，T12 | [57-t13-user-participation-main-ui-start-package.md](57-t13-user-participation-main-ui-start-package.md) | 待补充 | 暂无完整产物可 Review；见 [62-t13-review-by-codex.md](62-t13-review-by-codex.md) | 待补充 | 无 | 等待 MiniMax 按启动包产出完整 T13；不得用 T13A Lite 替代。 |
| T13A Lite 用户操作台最小入口 | 已完成 | Claude | T2，T3，T5，T6 | [39-t13a-lite-user-console-start-package.md](39-t13a-lite-user-console-start-package.md) | [42-t13a-lite-user-console-result.md](42-t13a-lite-user-console-result.md) | [43-t13a-lite-review-by-codex.md](43-t13a-lite-review-by-codex.md)（修复后复核，通过） | `npm run check`、`npm test`、手动 API 验证（docs route 200） | 无 | 已关闭。 |
| T14 复盘记录最小闭环 | 已完成 | Claude | T3，T6，T9 | [58-t14-retrospective-loop-start-package.md](58-t14-retrospective-loop-start-package.md) | [63-t14-retrospective-loop-result.md](63-t14-retrospective-loop-result.md) | [64-t14-review-by-codex.md](64-t14-review-by-codex.md)（修复后复核通过） | `node src/retrospective/index.verify.js`（133/133）、`npm run check`（40 files）、`npm test`、`npm run verify:harness`（22/22）、`node src/storage/__verify.js`（42/42）、`node src/storage/__page_query_verify.js`（15/15）、`node src/review-quality/index.verify.js`（132/132）零回归 | 无 | 已关闭；T15/T16 对 T14 的依赖可解除。 |
| T15 Dogfooding 评估增强 | 未开始 | Claude | T14 | 待补充 | 待补充 | Codex | 待补充 | 等待 T14 | P1，T14 后视时间箱启动。 |
| T16 首个端到端样例验证 | 未开始 | Codex | T1-T14；T15 可选 | 待补充 | 待补充 | 非作者双 Review | 待补充 | 等待 T1-T14；A7 必须在 T16 前关闭或记录降级/阻塞 | T1-T14 完成后启动，覆盖成功路径和被门禁阻断的失败路径。 |

## Agent 同步规则

后续给任何执行 Agent 下发任务时，任务启动包必须包含以下必读材料：

- [task-status-board.md](task-status-board.md)
- [current-action-tracker.md](current-action-tracker.md)
- [15-implementation-plan.md](15-implementation-plan.md)
- [../collaboration/13-task-start-package-template.md](../collaboration/13-task-start-package-template.md)
- 当前任务相关的产品、架构、Agent 角色和执行文档。

执行 Agent 启动前必须先确认：

- 当前任务状态是否允许启动。
- 依赖是否满足。
- 是否存在当前开放事项阻断。
- Review 方是否明确。
- 允许动作级别是否足够。
- 完成后应更新哪些状态和证据。

如果任务状态板、当前执行状态看板、启动包或执行计划之间出现冲突，Agent 必须暂停并升级给系统架构师或产品负责人确认。
