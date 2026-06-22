# 执行文档索引

> 状态：当前基线
> 所属：执行
> 规则效力：执行计划、阶段门禁与执行节奏
> 维护角色：系统架构师

本目录放当前怎么执行、按什么顺序执行、哪些门禁必须先过，以及阶段性执行状态。这里不放构建产物、发布包或最终交付物。

## 当前文档

- [task-status-board.md](task-status-board.md)：T1-T16 任务级状态、证据、阻塞和下一步的跟踪入口。
- [current-action-tracker.md](current-action-tracker.md)：当前开放事项、Owner、状态、阻塞、完成证据和下一步动作的跟踪入口。
- [15-implementation-plan.md](15-implementation-plan.md)：基于系统架构设计的一周实现任务拆解与开发计划。
- [19-t1-baseline-confirmation-result.md](19-t1-baseline-confirmation-result.md)：T1 实现基线确认结果，供非作者 Agent Review 使用。
- [20-t1-review-by-claude.md](20-t1-review-by-claude.md)：T1 非作者 Review 报告（Claude），初始结论为需要修改，后续补充完成后已放行。
- [21-t2-work-item-entry-result.md](21-t2-work-item-entry-result.md)：T2 工作项录入与类型选择/识别最小入口结果，供非作者 Agent Review 使用。
- [22-t3-persistence-result.md](22-t3-persistence-result.md)：T3 逻辑模型与本地持久化结果，供非作者 Agent Review 使用。
- [23-t2-review-by-claude.md](23-t2-review-by-claude.md)：T2 非作者 Review 报告（Claude），结论为需要修改。
- [24-t3-review-by-codex.md](24-t3-review-by-codex.md)：T3 非作者 Review 报告（Codex），结论为通过。
- [25-change-impact-assessment-p0-14-16.md](25-change-impact-assessment-p0-14-16.md)：P0-14/15/16 变更影响评估（Claude），结论为 T3 无修改、补齐在 T13。
- [26-t2-change-impact-assessment-p0-14-16-by-codex.md](26-t2-change-impact-assessment-p0-14-16-by-codex.md)：T2 对 P0-14/15/16 的变更影响评估（Codex），结论为当前 T2 不满足新页面主入口基线，需补齐最小页面录入入口。
- [27-t3-page-query-verification.md](27-t3-page-query-verification.md)：T3 页面查询视角验证（Claude），15 项通过，证明持久化模块零修改支撑 5 个页面视图。
- [29-t4-agent-cli-adapter-start-package.md](29-t4-agent-cli-adapter-start-package.md)：T4 任务启动包，定义 Agent CLI 适配与最小调用闭环的执行上下文、边界、门禁和交付约束。
- [30-t4-agent-cli-adapter-result.md](30-t4-agent-cli-adapter-result.md)：T4 Agent CLI 适配与最小调用闭环结果，Claude 非作者 Review 已通过。
- [31-t4-review-by-claude.md](31-t4-review-by-claude.md)：T4 非作者 Review 报告（Claude），结论为通过。
- [32-t5-work-item-state-machine-start-package.md](32-t5-work-item-state-machine-start-package.md)：T5 任务启动包，定义工作项状态机的执行上下文、边界、门禁和交付约束。
- [33-t5-work-item-state-machine-result.md](33-t5-work-item-state-machine-result.md)：T5 工作项状态机结果，Codex 非作者 Review 已通过。
- [34-t5-review-by-codex.md](34-t5-review-by-codex.md)：T5 非作者 Review 报告（Codex），结论为通过。
- [35-t6-a2a-event-orchestration-start-package.md](35-t6-a2a-event-orchestration-start-package.md)：T6 任务启动包，定义 A2A 事件编排与记录的执行上下文、边界、门禁和交付约束。
- [36-t6-a2a-event-orchestration-result.md](36-t6-a2a-event-orchestration-result.md)：T6 A2A 事件编排与记录结果，Codex 非作者 Review 已通过。
- [37-t6-review-by-codex.md](37-t6-review-by-codex.md)：T6 非作者 Review 报告（Codex），三轮复核通过。
- [38-t7-solution-task-breakdown-start-package.md](38-t7-solution-task-breakdown-start-package.md)：T7 任务启动包，定义方案与任务拆解流程的执行上下文、边界、门禁和交付约束。
- [39-t13a-lite-user-console-start-package.md](39-t13a-lite-user-console-start-package.md)：T13A Lite 任务启动包，定义用户操作台最小入口的执行上下文、边界、门禁和交付约束。
- [40-t7-solution-task-breakdown-result.md](40-t7-solution-task-breakdown-result.md)：T7 方案与任务拆解流程结果，Claude 非作者 Review 已通过。
- [41-t7-review-by-claude.md](41-t7-review-by-claude.md)：T7 非作者 Review 报告（Claude），结论为通过。
- [42-t13a-lite-user-console-result.md](42-t13a-lite-user-console-result.md)：T13A Lite 用户操作台最小入口结果，Codex 非作者 Review 修复已完成。
- [43-t13a-lite-review-by-codex.md](43-t13a-lite-review-by-codex.md)：T13A Lite 非作者 Review 报告（Codex），结论为需修改后复核。
- [44-t8-harness-core-rails-start-package.md](44-t8-harness-core-rails-start-package.md)：T8 任务启动包，定义 Harness 核心护栏的执行上下文、边界、门禁和交付约束。
- [45-t10-worktree-isolation-start-package.md](45-t10-worktree-isolation-start-package.md)：T10 任务启动包，定义 worktree 与任务隔离最小治理的执行上下文、边界、门禁和交付约束。
- [46-t8-harness-core-rails-result.md](46-t8-harness-core-rails-result.md)：T8 Harness 核心护栏结果，Claude 非作者 Review 已通过。
- [47-t8-review-by-claude.md](47-t8-review-by-claude.md)：T8 非作者 Review 报告（Claude），结论为通过。
- [48-t10-worktree-isolation-result.md](48-t10-worktree-isolation-result.md)：T10 Worktree 与任务隔离最小治理结果，Codex 非作者 Review 已通过。
- [49-t10-review-by-codex.md](49-t10-review-by-codex.md)：T10 非作者 Review 报告（Codex），修复后复核通过。
- [50-t9-review-quality-gate-start-package.md](50-t9-review-quality-gate-start-package.md)：T9 任务启动包，定义 Review 与质量门禁记录的执行上下文、边界、门禁和交付约束。
- [51-t12-escalation-page-confirmation-start-package.md](51-t12-escalation-page-confirmation-start-package.md)：T12 任务启动包，定义人工升级与页面确认流程的执行上下文、边界、门禁和交付约束。
- [52-t9-review-quality-gate-result.md](52-t9-review-quality-gate-result.md)：T9 Review 与质量门禁记录结果，Codex 非作者 Review 已通过。
- [53-t12-start-package-review-by-claude.md](53-t12-start-package-review-by-claude.md)：T12 启动包 Claude 前置审查，结论为需补充后启动。
- [54-t9-review-by-codex.md](54-t9-review-by-codex.md)：T9 非作者 Review 报告（Codex），两轮复核通过。
- [54-t12-escalation-page-confirmation-result.md](54-t12-escalation-page-confirmation-result.md)：T12 人工升级与页面确认流程结果，Claude 非作者 Review 已通过。
- [55-t12-review-by-claude.md](55-t12-review-by-claude.md)：T12 非作者 Review 报告（Claude），结论为通过。
- [56-t11-git-delivery-safety-start-package.md](56-t11-git-delivery-safety-start-package.md)：T11 任务启动包，定义 Git feature 分支交付安全流程的执行上下文、边界、门禁和交付约束。
- [57-t13-user-participation-main-ui-start-package.md](57-t13-user-participation-main-ui-start-package.md)：T13 任务启动包，定义页面级用户参与主界面最小实现的执行上下文、边界、门禁和交付约束。
- [58-t14-retrospective-loop-start-package.md](58-t14-retrospective-loop-start-package.md)：T14 任务启动包，定义复盘记录最小闭环的执行上下文、边界、门禁和交付约束。
- [59-t11-git-delivery-safety-result.md](59-t11-git-delivery-safety-result.md)：T11 Git feature 分支交付安全流程结果，Claude 非作者 Review 已通过。
- [60-t11-review-by-claude.md](60-t11-review-by-claude.md)：T11 非作者 Review 报告（Claude），结论为通过。
- [62-t13-review-by-codex.md](62-t13-review-by-codex.md)：T13 Codex 可审性记录，结论为完整 T13 尚无可 Review 产物。
- [63-t14-retrospective-loop-result.md](63-t14-retrospective-loop-result.md)：T14 复盘记录最小闭环结果，Codex 修复后复核通过。
- [64-t14-review-by-codex.md](64-t14-review-by-codex.md)：T14 Codex 非作者 Review，修复后复核通过。
- [65-t15-dogfooding-evaluation-start-package.md](65-t15-dogfooding-evaluation-start-package.md)：T15 任务启动包，定义 Dogfooding 评估增强的执行上下文、边界、门禁和交付约束。
- [66-t13-functional-fallback-start-package.md](66-t13-functional-fallback-start-package.md)：T13F 任务启动包，定义 MiniMax 不可用期间页面级用户参与主界面功能骨架的降级执行上下文。
- [67-t13-functional-fallback-result.md](67-t13-functional-fallback-result.md)：T13F 页面级用户参与主界面功能骨架降级实现结果，待 Claude 非作者 Review。
- [71-t16-e2e-validation-start-package.md](71-t16-e2e-validation-start-package.md)：T16 任务启动包，定义首个端到端样例验证的执行上下文、边界、门禁和交付约束。
- [72-t16-e2e-validation-result.md](72-t16-e2e-validation-result.md)：T16 首个端到端样例验证结果，覆盖成功路径和质量门禁阻断失败路径，待 Claude 非作者 Review。

## 产品澄清引用

- [../product/15-page-change-implementation-clarifications.md](../product/15-page-change-implementation-clarifications.md)：产品负责人对 T2/T3 变更影响评估待确认项的裁决。后续 T2、T3、T13、T16 执行必须遵守。
- [../architecture/16-page-change-architecture-clarifications.md](../architecture/16-page-change-architecture-clarifications.md)：系统架构师对 T2/T3 持久化出口、页面查询视角、T13 边界和 MiniMax 参与节奏的执行澄清。后续页面相关任务启动上下文应引用。

## 使用规则

- T1-T16 的任务级进度优先查看 [task-status-board.md](task-status-board.md)。
- 当前开放事项和执行状态优先查看 [current-action-tracker.md](current-action-tracker.md)；复盘文档只记录历史事实，不维护实时进度。
- 后续执行 Agent 启动任务前必须读取任务状态板、当前执行状态看板、执行计划和任务启动包模板。
- 进入实现阶段后，必须从 `T1 实现基线确认` 开始。
- 不得跳过 Git/worktree、Agent CLI、持久化、检查命令和编码策略验证。
- 执行计划可以随阶段更新，但更新必须保留门禁原因和产品/架构确认记录。
