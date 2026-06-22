# 当前执行状态看板

> 状态：当前基线
> 所属：执行
> 规则效力：开放事项、阻塞和完成证据的当前跟踪入口
> 维护角色：任务 Owner；执行计划维护由系统架构师负责；产品边界由产品负责人 Review

## 目的

本文件用于跟踪当前开放事项、Owner、状态、阻塞、完成证据和下一步动作。

复盘文档只记录历史事实和改进输入，不维护实时进度。后续 Agent 或人类执行任务时，应优先查看本看板确认当前还需要谁做什么。

## 维护规则

- 谁是 Owner，谁负责更新自己事项的状态和完成证据。
- 状态变化必须附可追踪证据，不能只写“已完成”。
- 执行 Agent 可以更新自己负责事项的状态，但不能修改产品规则或降低验收标准。
- 涉及产品范围、P0 验收、用户确认或 MiniMax 延后介入口径变化时，必须提交产品负责人确认。
- 涉及架构落地、模块边界、持久化、状态机、A2A、Review、门禁、worktree 或 Git 交付机制时，必须提交系统架构师确认。
- 已完成事项可以保留在本看板，阶段复盘时再归档；不要反复修改历史复盘文档来维护实时进度。

## 状态枚举

- `待执行`：尚未开始。
- `进行中`：Owner 已开始处理。
- `待 Review`：已产出结果，等待指定 Review 方确认。
- `待确认`：需要用户、产品负责人或系统架构师确认。
- `已完成`：完成证据已归档，且满足完成口径。
- `阻塞`：存在明确阻塞，需要升级处理。
- `已取消`：经确认不再执行。

## 当前开放事项

| ID | 事项 | Owner | 状态 | 阻塞 | 完成证据 | 下一步 |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | T2 主执行 Agent 补录任务启动上下文，并重新确认页面变更影响。 | T2 主执行 Agent | 已完成 | 无 | 已补录到 [21-t2-work-item-entry-result.md#任务启动包补充](21-t2-work-item-entry-result.md#任务启动包补充)；Claude 逐项确认通过（[28-t2-page-entry-review-by-claude.md#a1-补录轻量确认](28-t2-page-entry-review-by-claude.md#a1-补录轻量确认)） | 已关闭。 |
| A2 | T3 主执行 Agent 补录任务启动上下文，并证明页面查询视角。 | T3 主执行 Agent | 已完成 | 无 | 已补录到 [22-t3-persistence-result.md#任务启动包补充](22-t3-persistence-result.md#任务启动包补充)；页面查询证明见 [27-t3-page-query-verification.md](27-t3-page-query-verification.md)；Codex 轻量确认通过：[24-t3-review-by-codex.md#九a2-轻量确认](24-t3-review-by-codex.md#九a2-轻量确认) | 已关闭。后续仅需作者同步 27 号文档中的历史验证摘录，避免误读；不阻塞 A2。 |
| A3 | 原 Review 方对 T2/T3 补录内容做轻量确认。 | T2/T3 原 Review 方 | 已完成 | 无 | A1（T2 补录）：Claude 确认通过；A2（T3 补录）：Codex 确认通过（[24-t3-review-by-codex.md#九a2-轻量确认](24-t3-review-by-codex.md#九a2-轻量确认)）。22/27 号文档同步瑕疵已修正。 | 已关闭。 |
| A4 | 系统架构师确认任务启动包执行落地方式。 | 系统架构师 | 已完成 | 无 | 架构落地确认已归档：[../architecture/17-task-start-package-execution-confirmation.md](../architecture/17-task-start-package-execution-confirmation.md)；模板轻量复核通过：[../collaboration/13-task-start-package-template.md](../collaboration/13-task-start-package-template.md) | 已关闭。后续 T5/T8 实现按架构确认落地。 |
| A5 | T5/T8 前确认任务启动包、状态机、A2A、Review 和门禁关系不会冲突。 | 系统架构师 / 对应执行 Agent | 已完成 | 无 | 设计级预检查已归档：[../architecture/17-task-start-package-execution-confirmation.md#A5-关系检查结论](../architecture/17-task-start-package-execution-confirmation.md#A5-关系检查结论) | 已关闭。T5/T8 实现时仍需按确认文档执行具体护栏。 |
| A6 | T5 启动前确认 WorkItem 持久化事实来源已统一。 | 系统架构师 / T2 / T3 执行 Agent | 已完成 | 无 | T2 侧：[21-t2-work-item-entry-result.md#任务启动包补充](21-t2-work-item-entry-result.md#任务启动包补充)；T3 侧：[22-t3-persistence-result.md#任务启动包补充](22-t3-persistence-result.md#任务启动包补充)；架构确认：[../architecture/17-task-start-package-execution-confirmation.md#A6-WorkItem-事实来源确认](../architecture/17-task-start-package-execution-confirmation.md#A6-WorkItem-事实来源确认)。CLI 和页面入口均调用 `createAndSaveWorkItem()` 并写入 T3 `work-items.json` Store。 | 已关闭。若后续重新引入第二个 WorkItem 来源，必须重新打开并阻断 T5。 |
| A7 | MiniMax 在 T13 或 T16 前参与页面体验 Review。 | MiniMax / T13 或 T16 主执行 Agent | 开发冲刺降级 | MiniMax 当前不可用，用户明确要求开发期间先不考虑 MiniMax | [66-t13-functional-fallback-start-package.md](66-t13-functional-fallback-start-package.md) 与 [71-t16-e2e-validation-start-package.md](71-t16-e2e-validation-start-package.md) 已要求记录该风险；T13F/T16 已在 [67-t13-functional-fallback-result.md](67-t13-functional-fallback-result.md) 和 [72-t16-e2e-validation-result.md](72-t16-e2e-validation-result.md) 中记录降级边界 | 开发冲刺已关闭；MiniMax 恢复后补页面体验 Review，或在阶段复盘中确认该降级影响。 |
| A8 | Codex 参与 T13F/T16 提交推送与 T15 复核。 | Codex → Claude 接管 | 已完成（降级关闭） | Codex 不可用 | T13F/T16：Claude 已代提交到 `codex/t13f-t16-e2e`（commit `b6d0ab0`），已推送 origin；T15：修复已提交 `claude/t15-dogfooding`（commit `2e38609`），Codex 复核降级（Claude 不能自审，P1 修复已通过自动化验证 150/150） | 开发冲刺关闭。T15 Codex 复核降级风险记录，后续 MiniMax/Codex 恢复后补充。 |
| A9 | T13F/T16 后发现页面缺少真正 Agent 聊天室交互闭环。 | 系统架构师 / Codex | 待执行 | 当前页面是工作项治理控制台，用户不能直接向指定 Agent 对话，Agent 间消息和页面发起 Review 请求也未形成可操作闭环 | 已归档 T17 纠偏启动包：[73-t17-agent-chatroom-start-package.md](73-t17-agent-chatroom-start-package.md)；T13F/T16 历史结果不回滚，但不能用其替代聊天室验收 | 启动 T17，由 Codex 实现，Claude Review；T17 通过后关闭 A9。 |

## 已完成事项

| ID | 事项 | Owner | 完成证据 | 备注 |
| --- | --- | --- | --- | --- |
| D1 | 系统架构师对阶段 0.5 复盘做架构执行视角 Review。 | 系统架构师 | 用户转述 Review 结论；复盘已修订：[../retrospectives/19-phase-zero-point-five-retrospective.md](../retrospectives/19-phase-zero-point-five-retrospective.md) | 结论通过，仅有低优先级表述风险，已吸收。 |
| D2 | 产品负责人输出并修订任务启动包模板。 | 产品负责人 | [../collaboration/13-task-start-package-template.md](../collaboration/13-task-start-package-template.md) | 已按系统架构师 Review 补充允许动作级别、状态去向/阻断关系和完整 T2 示例；系统架构师轻量复核通过。 |

## 与复盘的关系

- 阶段 0.5 复盘见 [../retrospectives/19-phase-zero-point-five-retrospective.md](../retrospectives/19-phase-zero-point-five-retrospective.md)。
- 本看板只维护当前进度，不改写复盘历史事实。
- 阶段结束时，可以将本看板的完成情况吸收到下一次复盘。
