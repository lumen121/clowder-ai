# T16 任务启动包：首个端到端样例验证

> 状态：当前执行启动包
> 所属：执行
> 规则效力：T16 执行上下文、边界、门禁与交付约束
> 维护角色：系统架构师
> 执行身份：Codex
> 任务 ID：T16
> 日期：2026-06-22

## 1. 基本信息

| 字段 | 值 |
| --- | --- |
| 任务 ID | T16 |
| 任务类型 | 端到端验证 / 集成收口 |
| 当前身份 | Codex（Clowder Codex `<codex@clowder.local>`） |
| 任务来源 | `docs/execution/15-implementation-plan.md` §T16；`docs/execution/task-status-board.md` T16 行 |
| 优先级 | P0 |
| 依赖 | T1-T14；开发冲刺期间 MiniMax 参与不阻塞启动；T15 可选 |
| Review 方 | Claude |

## 2. 目标与边界

**任务目标**：
用一个模拟功能需求或 Bug 修复跑通 Clowder AI 首版最小治理闭环，覆盖页面录入、页面状态查看、页面阻塞或风险确认、Agent 协作、方案先行、任务拆解、Review、质量门禁、交付检查和复盘查看。

**范围内事项**：
- 构造至少一个成功路径样例。
- 构造至少一个被门禁阻断的失败路径样例。
- 通过页面或页面 API 验证工作项录入、状态可见、时间线、Agent 协作、阻塞确认、Review / 门禁 / 复盘查看。
- 验证 T4/T6/T7/T8/T9/T11/T12/T14 的核心记录可以串起来。
- 若 T13F 已完成，优先使用 T13F 页面功能骨架；若 T13F 尚未完成，可先用当前页面能力与 API 完成集成验证，并记录页面能力缺口。
- 若 T15 已完成，纳入 Dogfooding 指标验证；若未完成，不阻塞 T16。

**范围外事项**：
- 不实现新产品能力。
- 不自动部署。
- 不自动合并 PR。
- 不把 MiniMax 未参与体验 Review 伪装成已完成。
- 不把 T16 的测试样例当作真实用户交付项目。

**完成标准**：
- 一条成功路径可完整跑通并归档证据。
- 一条失败路径能被质量门禁或 Harness 阻断，并在页面/API/记录中可见。
- 端到端结果能说明哪些 P0 能力已闭环、哪些只是在开发冲刺中临时降级。
- 非作者 Review 通过。

## 3. 必读材料

- [AGENTS.md](../../AGENTS.md)
- [15-implementation-plan.md](15-implementation-plan.md)
- [task-status-board.md](task-status-board.md)
- [current-action-tracker.md](current-action-tracker.md)
- [../product/14-page-user-participation-proposal.md](../product/14-page-user-participation-proposal.md)
- [../product/15-page-change-implementation-clarifications.md](../product/15-page-change-implementation-clarifications.md)
- [../architecture/14-system-architecture-design.md](../architecture/14-system-architecture-design.md)
- [../architecture/16-page-change-architecture-clarifications.md](../architecture/16-page-change-architecture-clarifications.md)
- [30-t4-agent-cli-adapter-result.md](30-t4-agent-cli-adapter-result.md)
- [36-t6-a2a-event-orchestration-result.md](36-t6-a2a-event-orchestration-result.md)
- [40-t7-solution-task-breakdown-result.md](40-t7-solution-task-breakdown-result.md)
- [46-t8-harness-core-rails-result.md](46-t8-harness-core-rails-result.md)
- [52-t9-review-quality-gate-result.md](52-t9-review-quality-gate-result.md)
- [59-t11-git-delivery-safety-result.md](59-t11-git-delivery-safety-result.md)
- [54-t12-escalation-page-confirmation-result.md](54-t12-escalation-page-confirmation-result.md)
- [63-t14-retrospective-loop-result.md](63-t14-retrospective-loop-result.md)
- [66-t13-functional-fallback-start-package.md](66-t13-functional-fallback-start-package.md)
- [65-t15-dogfooding-evaluation-start-package.md](65-t15-dogfooding-evaluation-start-package.md)

## 4. 启动前方案确认

执行 Agent 收到本启动包后，不得直接开始修改实现文件。必须先输出简短实施方案，至少说明：

- 拟新增或修改的文件。
- 成功路径样例如何构造。
- 被门禁阻断的失败路径如何构造。
- 页面/API 验证步骤。
- 如何串联 WorkItem、Task、A2AEvent、ReviewRecord、QualityGateRun、EscalationRecord、DeliveryRecord、RetrospectiveMemory。
- 如果 T13F 或 T15 尚未完成，如何记录缺口而不阻塞开发冲刺。
- MiniMax 暂不参与带来的体验验收风险如何记录。
- 验证命令和质量门禁。

## 5. 分工与协作

| 字段 | 值 |
| --- | --- |
| 主执行 Agent | Codex |
| Review 方 | Claude |
| 协作 Agent | Claude 可从端到端路径完整性、失败路径真实性和验证证据角度质询 |
| MiniMax 参与 | 开发冲刺期间暂不分配 MiniMax；该降级不代表体验 Review 已完成，必须在结果文档中记录 |

## 6. 执行约束

| 字段 | 值 |
| --- | --- |
| 允许动作级别 | 文件修改、检查执行、提交准备；本轮人工确认后可按项目当前协作方式推送到 `origin/master` |
| 禁止事项 | 不得伪造 Agent 调用、Review、门禁或复盘结果；不得自动部署、自动合并 PR、force push |
| 文件/模块边界 | 与 E2E 样例、集成验证、页面/API 验证、执行结果文档直接相关的 `src/`、`test/`、`scripts/`、`docs/execution/` 文件 |
| 维护性注释要求 | 对 E2E 样例构造、失败路径触发、记录串联和临时降级判断补充必要注释 |
| Git 身份要求 | 任何 Git 写入动作必须使用 `Clowder Codex <codex@clowder.local>` |
| worktree / 分支要求 | 独立 branch/worktree；结果文档记录 task、branch、worktree、负责人和冲突状态 |

## 7. 验收与门禁

| 字段 | 值 |
| --- | --- |
| 验收标准 | 成功路径与失败路径均有证据；页面/API 能查看关键状态；Review/门禁/交付检查/复盘记录可追踪；MiniMax 缺席风险被记录 |
| 验证方式 | `npm run check`、`npm test`、现有专项 verify 命令，并补充 T16 E2E 验证脚本或手工验证记录 |
| Review 通过标准 | Claude 确认 E2E 证据真实、失败路径不是伪造、临时降级边界清楚、未绕过 P0 治理门禁 |
| 失败处理 | 任一核心记录无法串联、失败路径无法阻断、页面/API 关键状态不可见或降级风险被隐藏时，T16 不得通过 |

## 8. 输出记录

建议输出：
- T16 主结果文档：`docs/execution/72-t16-e2e-validation-result.md`
- T16 Review 文档：`docs/execution/73-t16-review-by-claude.md`

完成后更新 [task-status-board.md](task-status-board.md) 和 [current-action-tracker.md](current-action-tracker.md)。若 MiniMax 仍不可用，结果文档必须把页面体验 Review 标为开发冲刺降级项。
