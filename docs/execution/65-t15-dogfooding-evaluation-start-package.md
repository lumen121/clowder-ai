# T15 任务启动包：Dogfooding 评估增强

> 状态：当前执行启动包
> 所属：执行
> 规则效力：T15 执行上下文、边界、门禁与交付约束
> 维护角色：系统架构师
> 执行身份：Claude
> 任务 ID：T15
> 日期：2026-06-22

## 1. 基本信息

| 字段 | 值 |
| --- | --- |
| 任务 ID | T15 |
| 任务类型 | 功能需求 / Dogfooding 评估增强 |
| 当前身份 | Claude（Clowder Claude `<claude@clowder.local>`） |
| 任务来源 | `docs/execution/15-implementation-plan.md` §T15；`docs/execution/task-status-board.md` T15 行 |
| 优先级 | P1 |
| 依赖 | T14，已完成 |
| Review 方 | Codex |

## 2. 目标与边界

**任务目标**：
在 T14 复盘记录基础上补充 Dogfooding 基础评估，统计耗时、A2A 次数、Review 发现、返工次数、门禁结果和流程改进建议，为后续产品和架构优化提供可追踪事实。

**范围内事项**：
- 基于 T14 `RetrospectiveMemory` 和相关 WorkItem / A2A / Review / Gate / Escalation 记录生成评估摘要。
- 统计 A2A 次数、Review 发现数量、返工次数、门禁失败次数、人工升级次数和关键耗时字段。
- 区分事实指标、解释、流程改进建议、技术执行建议。
- 提供页面或 T16 可消费的 Dogfooding 摘要查询。
- 补充 T15 专属验证和执行结果文档。

**范围外事项**：
- 不自动修改产品规则、架构规则或 AGENTS 固定规则。
- 不替代产品负责人对规则变更的确认。
- 不实现完整分析报表或复杂可视化。
- 不实现 T16 端到端样例。

**完成标准**：
- Dogfooding 工作项可生成基础指标和改进建议。
- 评估结果可追溯到底层结构化记录。
- 产品规则变更仍需产品负责人确认，不因 T15 自动生效。
- 非作者 Review 通过。

## 3. 必读材料

- [AGENTS.md](../../AGENTS.md)
- [15-implementation-plan.md](15-implementation-plan.md)
- [task-status-board.md](task-status-board.md)
- [current-action-tracker.md](current-action-tracker.md)
- [../collaboration/10-dogfooding-plan.md](../collaboration/10-dogfooding-plan.md)
- [../collaboration/04-harness-governance.md](../collaboration/04-harness-governance.md)
- [../architecture/14-system-architecture-design.md](../architecture/14-system-architecture-design.md)
- [63-t14-retrospective-loop-result.md](63-t14-retrospective-loop-result.md)
- [64-t14-review-by-codex.md](64-t14-review-by-codex.md)

## 4. 启动前方案确认

执行 Agent 收到本启动包后，不得直接开始修改实现文件。必须先输出简短实施方案，至少说明：

- 拟新增或修改的文件。
- Dogfooding 指标来源和字段定义。
- 如何消费 T14 复盘记录而不改写复盘事实。
- 如何区分事实、解释、流程建议和技术建议。
- 如何保证建议不会自动变成产品规则。
- 验证方式和质量门禁。
- 主要风险和需要确认的问题。

## 5. 分工与协作

| 字段 | 值 |
| --- | --- |
| 主执行 Agent | Claude |
| Review 方 | Codex |
| 协作 Agent | Codex 可从规则效力、数据来源和 T16 可消费性角度质询 |
| MiniMax 参与 | 不适用，本任务不涉及 UI/视觉/体验判断 |

## 6. 执行约束

| 字段 | 值 |
| --- | --- |
| 允许动作级别 | 文件修改、检查执行、提交准备；本轮人工确认后可按项目当前协作方式推送到 `origin/master` |
| 禁止事项 | 不得自动修改产品/架构/AGENTS 规则；不得实现 T16；不得 force push、自动部署或自动合并 PR |
| 文件/模块边界 | 与 Dogfooding 评估、复盘摘要消费、指标查询和验证直接相关的 `src/`、`test/`、`scripts/`、`docs/execution/` 文件 |
| 维护性注释要求 | 对指标来源、统计口径、建议分类和规则不自动生效逻辑补充必要注释 |
| Git 身份要求 | 任何 Git 写入动作必须使用 `Clowder Claude <claude@clowder.local>` |
| worktree / 分支要求 | 独立 branch/worktree；结果文档记录 task、branch、worktree、负责人和冲突状态 |

## 7. 验收与门禁

| 字段 | 值 |
| --- | --- |
| 验收标准 | 可生成基础 Dogfooding 指标；结果可追溯；建议分类清晰；不自动改变规则 |
| 验证方式 | `npm run check`、`npm test`，并补充 T15 专属验证，覆盖成功工作项、失败工作项、Review 返工、门禁失败和人工升级 |
| Review 通过标准 | Codex 确认指标来源可靠、未越界修改规则、可供 T16 或页面消费 |
| 失败处理 | 指标不可追溯、建议混同规则或复盘事实被覆盖时，T15 不得通过 |

## 8. 输出记录

建议输出：
- T15 主结果文档：`docs/execution/69-t15-dogfooding-evaluation-result.md`
- T15 Review 文档：`docs/execution/70-t15-review-by-codex.md`

完成后更新 [task-status-board.md](task-status-board.md)。T15 是 P1，不阻塞 T16，但可增强 T16 复盘验证质量。
