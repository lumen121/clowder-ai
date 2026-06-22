# T13F 任务启动包：页面级用户参与主界面功能骨架降级实现

> 状态：当前执行启动包
> 所属：执行
> 规则效力：T13 在 MiniMax 不可用期间的功能骨架执行上下文
> 维护角色：系统架构师
> 执行身份：Codex
> 任务 ID：T13F
> 日期：2026-06-22

## 1. 基本信息

| 字段 | 值 |
| --- | --- |
| 任务 ID | T13F |
| 关联任务 | T13 页面级用户参与主界面最小实现 |
| 任务类型 | 功能需求 / 页面功能骨架降级实现 |
| 当前身份 | Codex（Clowder Codex `<codex@clowder.local>`） |
| 启动原因 | MiniMax 当前不可用，用户明确要求暂不分配 MiniMax |
| 优先级 | P0 辅助执行 |
| 依赖 | T2、T3、T5、T6、T9、T12、T14，均已完成 |
| Review 方 | Claude |

## 2. 目标与边界

**任务目标**：
在不分配 MiniMax 的前提下，先由 Codex 补齐 T13 的功能骨架：页面能展示工作项、Agent 协作进度、时间线、阻塞确认、Review、门禁和复盘入口，降低用户继续靠人工传话协调的成本。

**范围内事项**：
- 扩展现有 T13A Lite 控制台，形成完整页面功能骨架。
- 展示工作项详情、负责人、依赖、Review 方、当前状态和最近关键结论。
- 展示 Agent 动作与 A2A 时间线，让用户看见“谁在做什么、干了什么、谁需要 Review”。
- 展示 T9 Review / 门禁摘要。
- 展示 T12 待确认项和确认结果。
- 展示 T14 复盘摘要和 T15 评估入口占位。
- 明确标注该产物是功能骨架，不包含 MiniMax 体验验收。

**范围外事项**：
- 不关闭 A7。
- 不声明完整 T13 已通过。
- 不替代 MiniMax 页面体验 Review。
- 不做高保真视觉、完整设计系统或复杂路由。
- 不实现 T16 端到端验收。

**完成标准**：
- 用户可在页面看到工作项状态、Agent 协作过程、Review/门禁/确认/复盘入口。
- 页面能减少人工在 Agent 之间传话的成本。
- 结果文档明确剩余缺口：MiniMax 体验 Review 未完成，完整 T13 仍待最终验收。
- 非作者 Review 通过。

## 3. 必读材料

- [AGENTS.md](../../AGENTS.md)
- [15-implementation-plan.md](15-implementation-plan.md)
- [task-status-board.md](task-status-board.md)
- [current-action-tracker.md](current-action-tracker.md)
- [../product/14-page-user-participation-proposal.md](../product/14-page-user-participation-proposal.md)
- [../product/15-page-change-implementation-clarifications.md](../product/15-page-change-implementation-clarifications.md)
- [../architecture/16-page-change-architecture-clarifications.md](../architecture/16-page-change-architecture-clarifications.md)
- [42-t13a-lite-user-console-result.md](42-t13a-lite-user-console-result.md)
- [52-t9-review-quality-gate-result.md](52-t9-review-quality-gate-result.md)
- [54-t12-escalation-page-confirmation-result.md](54-t12-escalation-page-confirmation-result.md)
- [63-t14-retrospective-loop-result.md](63-t14-retrospective-loop-result.md)
- [62-t13-review-by-codex.md](62-t13-review-by-codex.md)

## 4. 启动前方案确认

执行 Agent 收到本启动包后，不得直接开始修改实现文件。必须先输出简短实施方案，至少说明：

- 拟新增或修改的页面、服务端和查询文件。
- 如何展示 Agent 进度、A2A、Review 请求和执行结果。
- 如何消费 T9、T12、T14 数据。
- 哪些能力属于功能骨架，哪些仍等待 MiniMax 体验 Review。
- 如何避免将 T13F 误标为完整 T13 通过。
- 验证方式和页面检查方式。
- 主要风险和需要确认的问题。

## 5. 分工与协作

| 字段 | 值 |
| --- | --- |
| 主执行 Agent | Codex |
| Review 方 | Claude |
| 协作 Agent | Claude 可从页面数据正确性、可测试性和降级边界角度质询 |
| MiniMax 参与 | 本任务不分配 MiniMax；原因是 MiniMax 当前不可用。该降级只允许推进功能骨架，不允许关闭 A7 或完整 T13 验收 |

## 6. 执行约束

| 字段 | 值 |
| --- | --- |
| 允许动作级别 | 文件修改、检查执行、提交准备；本轮人工确认后可按项目当前协作方式推送到 `origin/master` |
| 禁止事项 | 不得关闭 A7；不得宣称完整 T13 通过；不得实现 T16；不得 force push、自动部署或自动合并 PR |
| 文件/模块边界 | 与页面功能骨架、服务端页面 API、页面查询聚合、样式和验证直接相关的 `public/`、`src/server/`、必要 `src/` 查询聚合、`test/`、`docs/execution/` 文件 |
| 维护性注释要求 | 对页面查询聚合、Agent 时间线、Review/门禁/复盘摘要和降级提示逻辑补充必要注释 |
| Git 身份要求 | 任何 Git 写入动作必须使用 `Clowder Codex <codex@clowder.local>` |
| worktree / 分支要求 | 独立 branch/worktree；结果文档记录 task、branch、worktree、负责人和冲突状态 |

## 7. 验收与门禁

| 字段 | 值 |
| --- | --- |
| 验收标准 | 页面功能骨架覆盖工作项、Agent 进度、时间线、阻塞确认、Review、门禁和复盘摘要；明确 MiniMax 未参与，完整 T13 未关闭 |
| 验证方式 | `npm run check`、`npm test`，并补充页面手工或自动验证，覆盖至少一个工作项的 A2A、Review、门禁、升级确认和复盘摘要 |
| Review 通过标准 | Claude 确认功能骨架可用、数据来源正确、降级边界清晰、未冒充完整 T13 |
| 失败处理 | 页面仍无法解释 Agent 协作进度，或文档把 T13F 当完整 T13 通过时，T13F 不得通过 |

## 8. 输出记录

建议输出：
- T13F 主结果文档：`docs/execution/67-t13-functional-fallback-result.md`
- T13F Review 文档：`docs/execution/68-t13-functional-fallback-review-by-claude.md`

完成后更新 [task-status-board.md](task-status-board.md) 和 [current-action-tracker.md](current-action-tracker.md)。T13F 通过后只能解除“页面功能骨架不足”的执行风险，不能解除 A7，也不能单独解锁完整 T16 验收。
