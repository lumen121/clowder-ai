# T13 任务启动包：页面级用户参与主界面最小实现

> 状态：当前执行启动包
> 所属：执行
> 规则效力：T13 执行上下文、边界、门禁与交付约束
> 维护角色：系统架构师
> 执行身份：MiniMax
> 任务 ID：T13
> 日期：2026-06-20

## 1. 基本信息

| 字段 | 值 |
| --- | --- |
| 任务 ID | T13 |
| 任务类型 | 功能需求 / 页面级用户参与主界面 |
| 当前身份 | MiniMax（Clowder MiniMax `<minimax@clowder.local>`） |
| 任务来源 | `docs/execution/15-implementation-plan.md` §T13；`docs/execution/task-status-board.md` T13 行 |
| 关联工作项 | P0-14 / P0-15 / P0-16；首周页面参与闭环；T16 前置能力 |
| 优先级 | P0 |
| 依赖 | T2、T3、T5、T6、T9、T12，均已完成 |
| Review 方 | Codex |

## 2. 目标与边界

**任务目标**：
实现页面级用户参与主界面的最小可用版本，让用户能在页面中录入工作项、查看统一聊天室/时间线、理解工作项详情、处理阻塞确认，并查看 Review、门禁和复盘入口。

**范围内事项**：
- 复用 T2 页面录入入口，不重新建立第二个 WorkItem 来源。
- 展示工作项详情：目标、范围、当前状态、负责人、依赖、Review 方、验收标准、最近一次关键结论。
- 展示统一聊天室/时间线：用户消息、Agent 消息、A2A、状态变化、Review、门禁、升级确认、交付和复盘事件。
- 展示阻塞与人工确认入口，消费 T12 的待确认项和确认回写结果。
- 展示 Review / 质量门禁摘要，消费 T9 查询能力。
- 预留或展示复盘入口；如 T14 尚未完成，明确显示“待复盘记录形成”，不得伪造复盘结果。
- 提升当前 T13A Lite 控制台的信息架构，但不追求高保真视觉设计。

**范围外事项**：
- 不实现 T14 复盘记录生成逻辑。
- 不实现 T11 Git 交付检查逻辑。
- 不实现复杂多页面路由、完整设计系统或高保真视觉。
- 不新增第二套持久化事实来源。
- 不以 CLI 输出包装替代页面查询与结构化视图。

**完成标准**：
- 用户能通过页面查看工作项当前状态、最近一次关键结论、负责人、依赖、阻塞项、Review 结果、门禁结果和复盘入口。
- 用户能在页面中理解哪些 Agent 在做什么、干了什么，以及 Review/门禁是否阻塞。
- 页面不误导用户认为尚未完成的 T14/T16 能力已完成。
- 非作者 Review 通过，MiniMax 体验职责已履行。

## 3. 必读材料

- [AGENTS.md](../../AGENTS.md)
- [15-implementation-plan.md](15-implementation-plan.md)
- [task-status-board.md](task-status-board.md)
- [current-action-tracker.md](current-action-tracker.md)
- [../agents/07-agent-minimax.md](../agents/07-agent-minimax.md)
- [../product/14-page-user-participation-proposal.md](../product/14-page-user-participation-proposal.md)
- [../product/15-page-change-implementation-clarifications.md](../product/15-page-change-implementation-clarifications.md)
- [../architecture/14-system-architecture-design.md](../architecture/14-system-architecture-design.md)
- [../architecture/16-page-change-architecture-clarifications.md](../architecture/16-page-change-architecture-clarifications.md)
- [21-t2-work-item-entry-result.md](21-t2-work-item-entry-result.md)
- [22-t3-persistence-result.md](22-t3-persistence-result.md)
- [27-t3-page-query-verification.md](27-t3-page-query-verification.md)
- [36-t6-a2a-event-orchestration-result.md](36-t6-a2a-event-orchestration-result.md)
- [42-t13a-lite-user-console-result.md](42-t13a-lite-user-console-result.md)
- [52-t9-review-quality-gate-result.md](52-t9-review-quality-gate-result.md)
- [54-t12-escalation-page-confirmation-result.md](54-t12-escalation-page-confirmation-result.md)

## 4. 启动前方案确认

执行 Agent 收到本启动包后，不得直接开始修改实现文件。必须先输出简短实施方案，至少说明：

- 拟新增或修改的页面、服务端和查询文件。
- 页面信息架构：录入、时间线、详情、阻塞确认、Review/门禁、复盘入口如何组织。
- 如何展示“哪些 Agent 在做什么、干了什么、谁需要 Review”。
- 如何消费 T6 A2A、T9 Review/门禁、T12 升级确认和 T3 页面查询视角。
- T14 尚未完成时复盘入口如何处理。
- 如何避免把 T13A Lite 直接冒充完整主界面。
- 验证方式、页面手工检查方式和质量门禁。
- 主要体验风险和需要确认的问题。

若方案与本启动包、产品基线、架构基线或执行计划无冲突，且无待确认歧义，方可进入开发。

## 5. 分工与协作

| 字段 | 值 |
| --- | --- |
| 主执行 Agent | MiniMax |
| Review 方 | Codex |
| 协作 Agent | Codex 可从架构边界、数据来源和 P0 验收角度质询；Claude 可按需从实现可测性角度协助 |
| MiniMax 参与 | 本任务由 MiniMax 主执行，满足 A7 页面体验参与要求；若 MiniMax 客户端限制导致不能完整执行，应记录为阻塞或降级，不能静默改由其他 Agent 代替体验判断 |

## 6. 执行约束

| 字段 | 值 |
| --- | --- |
| 允许动作级别 | 文件修改、检查执行、提交准备；本轮人工确认后可按项目当前协作方式推送到 `origin/master` |
| 禁止事项 | 不得实现 T14 复盘生成、T11 Git 交付逻辑或 T16 E2E；不得新增第二套事实来源；不得 force push、自动部署或自动合并 PR |
| 文件/模块边界 | 与页面主界面、页面查询聚合、T13A Lite 扩展、服务端页面 API、样式和验证直接相关的 `public/`、`src/server/`、必要 `src/` 查询聚合、`test/`、`docs/execution/` 文件 |
| 维护性注释要求 | 对页面查询聚合、时间线事件归一化、最近关键结论、待确认项和未完成复盘占位逻辑补充必要注释 |
| Git 身份要求 | 任何 Git 写入动作必须使用 `Clowder MiniMax <minimax@clowder.local>` |
| worktree / 分支要求 | 独立 branch/worktree；结果文档记录 task、branch、worktree、负责人和冲突状态 |
| 推送要求 | 完成实现、自检、非作者 Review 和门禁后，可从任务分支快进推送到 `origin/master`；如非快进、冲突或门禁缺失，必须暂停升级 |

## 7. 验收与门禁

| 字段 | 值 |
| --- | --- |
| 验收标准 | 页面覆盖录入、统一聊天室/时间线、详情、阻塞确认、Review/门禁和复盘入口；能解释 Agent 进度、动作、Review 请求和阻塞；不伪造未完成能力 |
| 验证方式 | `npm run check`、`npm test`，并补充页面手工或自动验证，覆盖至少一个工作项的状态、A2A、Review、门禁、升级确认和复盘入口 |
| Review 通过标准 | Codex 确认页面数据来源正确、P0 页面范围覆盖、未越界实现 T11/T14/T16，且 MiniMax 体验判断已记录 |
| 失败处理 | 页面仍只能展示工作项局部信息、无法解释 Agent 协作进度、无法展示 Review/门禁/阻塞确认或误导用户时，T13 不得通过 |

## 8. 输出记录

建议输出：
- T13 主结果文档：`docs/execution/61-t13-user-participation-main-ui-result.md`
- T13 Review 文档：`docs/execution/62-t13-review-by-codex.md`

完成后更新 [task-status-board.md](task-status-board.md)。T13 通过后可解除 T16 对页面参与主界面的依赖，并关闭 A7。
