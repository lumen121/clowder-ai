# 任务启动包执行落地确认

> 状态：当前架构确认
> 所属：架构
> 规则效力：任务启动包与状态机、A2A、Review、门禁、worktree 和 Git 记录的架构落地确认
> 维护角色：系统架构师
> 日期：2026-06-19

## 确认对象

- [../collaboration/13-task-start-package-template.md](../collaboration/13-task-start-package-template.md)
- [../execution/current-action-tracker.md](../execution/current-action-tracker.md)
- T2 页面录入入口与 CLI 内部入口的 WorkItem 创建路径。
- T3 WorkItem Store 和页面查询视角。

## 总体结论

任务启动包模板可以作为零阶段人工任务启动包和未来 Harness 启动上下文的治理基线。

当前不需要引入新的物理数据库 schema。任务启动包在架构上应被视为“执行契约”：它由任务分配方或 Harness 生成，绑定 WorkItem / Task，并作为状态推进、A2A、Review、质量门禁、worktree 和 Git 动作的前置约束。

## 字段落地方式

### 应结构化保存或可结构化提取的字段

以下字段会被 Harness、状态机、Review、门禁或 Git/worktree 治理直接使用，应作为结构化字段保存，或至少保证可以稳定提取：

- 任务 ID。
- 任务类型。
- 关联工作项。
- 当前身份。
- 主执行 Agent。
- 协作 Agent。
- Review 方。
- 优先级。
- 依赖任务。
- 允许动作级别。
- 禁止事项。
- 文件/模块边界。
- 维护性注释要求。
- Git 身份要求。
- worktree / 分支要求。
- 验收标准。
- 验证方式。
- 质量门禁。
- 失败处理。
- 建议下一状态或交接状态。
- 是否解除依赖。
- 是否阻断后续任务。
- 是否触发 Review、质量门禁、人工确认或复盘。

### 可作为文本上下文下发的字段

以下字段主要帮助 Agent 理解任务，不应被过早绑定为数据库字段：

- 任务目标。
- 范围内事项。
- 范围外事项。
- 当前任务上下文。
- 已知变更影响。
- 默认假设。
- A2A 协作要求。
- MiniMax 参与说明。
- 人工升级条件说明。
- 输出记录要求。

如果后续 Harness 发现某个文本字段需要稳定查询或门禁判断，可以再提升为结构化字段。

## 与核心流程的关系

### 状态机

任务启动包是进入开发或 Review 前的前置契约。

状态机不需要把任务启动包变成新的 WorkItem 状态，但在推进到 `ready_for_development`、`in_development`、`pending_review`、`pending_verification` 或交付相关状态前，必须确认对应任务启动包存在且关键字段完整。

### A2A

A2A 事件应引用对应 WorkItem / Task。任务启动包中的 A2A 协作要求决定是否必须产生澄清、方案评估、执行同步、Review 或复盘类 A2A 记录。

A2A 可以补充结论和下一步，但不能静默改写任务启动包边界；如需改变目标、范围、Review 方、允许动作级别或验收标准，必须生成更新记录并按职责确认。

### Review

ReviewRecord 应以任务启动包为 Review 边界。Review 方必须检查实际产出是否符合启动包中的目标、范围、禁止事项、验收标准、质量门禁和输出记录要求。

作者不能作为自己产出的唯一 Review 方。

### 质量门禁

QualityGateRun 应由任务启动包中的验证方式和质量门禁字段生成或引用。门禁失败时，状态机不得静默推进；必须按失败处理和后续阻断关系记录影响。

### Worktree / 分支

WorkspaceRecord 应记录任务启动包中的 worktree / 分支要求，并绑定任务、Agent、分支、worktree、冲突状态和清理状态。

并行开发时，如果启动包未说明隔离策略，Agent 不得自行假设可以共享工作区推进高风险改动。

### Git 记录

Git 写入动作必须受任务启动包中的允许动作级别和 Git 身份要求约束。

提交准备、feature 分支推送、PR 创建、部署和合并主干应分级控制；未被启动包列为允许动作的 Git 行为默认禁止。部署、合并主干、破坏性文件操作、绕过 Review、绕过质量门禁和自动合并 PR 必须人工确认。

## A5 关系检查结论

任务启动包、状态机、A2A、Review 和质量门禁之间没有架构冲突，前提是按以下职责划分实现：

- 任务启动包定义执行契约。
- 状态机控制阶段推进。
- A2A 记录协作过程和结论。
- Review 依据启动包边界检查产出。
- 质量门禁依据启动包验证方式执行检查。
- worktree / Git 记录负责执行隔离与交付归因。

因此，A5 可以作为设计级预检查完成。后续 T5/T8 实现时仍必须按本文约束落地具体护栏。

## A6 WorkItem 事实来源确认

当前 T2/T3 WorkItem 持久化事实来源已统一到 T3 Store：

- CLI 内部入口 [../../bin/clowder-work-item.js](../../bin/clowder-work-item.js) 调用 `createAndSaveWorkItem()`。
- 页面入口 [../../src/server/work-item-page-server.js](../../src/server/work-item-page-server.js) 调用同一个 `createAndSaveWorkItem()`。
- `createAndSaveWorkItem()` 位于 [../../src/work-items/create-work-item.js](../../src/work-items/create-work-item.js)，最终通过 T3 `createPersistence(dataDir)` 写入 `work-items.json`。
- 当前搜索未发现新的生产写入路径继续写入 `data/work-items/<id>.json`。

旧文档中关于 `data/work-items/<id>.json` 的描述应理解为历史事实或已废弃路径。若后续实现重新引入第二个 WorkItem 来源，必须重新打开 A6 并阻断 T5 状态机启动。

## 未完成事项

A7 尚未完成。MiniMax 必须在 T13 页面主界面或 T16 E2E 前参与页面体验 Review；如果届时 MiniMax 不可用，应记录为执行降级或阻塞，不能静默视为已完成。
