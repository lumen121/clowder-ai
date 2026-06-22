# T15 Dogfooding 评估增强结果

> 状态：已完成实现，待 Review
> 所属：执行
> 规则效力：T15 交付记录
> 执行 Agent：Claude
> 任务 ID：T15
> 日期：2026-06-22

## 启动与隔离

| 项 | 结果 |
| --- | --- |
| branch | `claude/t15-dogfooding` |
| worktree | 主仓库 `C:\aiWorkspace\clowder-ai`（未使用独立 worktree；偏离原因：T15 为纯计算模块，无文件冲突风险；变更范围仅 `src/dogfooding/` + `src/index.js` + `package.json` + 执行文档） |
| 基线 | `origin/master`，已包含 T1-T14 |
| 冲突状态 | clean（无未归属变更） |
| Git 身份 | `Clowder Claude <claude@clowder.local>` |
| Review 方 | Codex |

## 总体结论

T15 在 T14 复盘记录基础上实现了 Dogfooding 基础评估增强。核心思路是**纯计算模块**——不新增 Store 类型，从八类已有结构化记录中读取并推导指标，与 T14 复盘记录的事实字段保持一致。

## 交付物

| 文件 | 操作 | 说明 |
| --- | --- | --- |
| `src/dogfooding/index.js` | 新增 | Dogfooding 评估核心模块（~340 行） |
| `src/dogfooding/index.verify.js` | 新增 | 专项验证（148 项通过） |
| `src/index.js` | 修改 | 新增 dogfooding 函数导出 |
| `package.json` | 修改 | 新增 `npm run verify:dogfooding` |

## 模块 API

### `evaluateMetrics(persistence, workItemId)`

从八类 Store 读取数据，纯计算返回结构化指标：

| 维度 | 字段 | 来源 |
| --- | --- | --- |
| 耗时 | `timing` — 录入→首次任务/A2A/Review/交付 | WorkItem.created_at + 各类记录 created_at |
| A2A | `a2a` — 总次数、按目的分布、人工介入、Agent 参与 | A2AEvent |
| Review | `review` — 发现数、返工轮次、通过/争议/未解决 | ReviewRecord |
| 门禁 | `quality_gate` — 通过/失败/阻塞/用户确认 | QualityGateRun |
| 交付 | `delivery` — 检查次数、准备/推送、成功/失败 | DeliveryRecord |
| 升级 | `escalation` — 总数、待处理/已解决、按触发规则 | EscalationRecord |
| 任务 | `task` — 总数、完成/阻塞/进行中/待开始 | Task |
| 记忆 | `memory_usage` — 是否生成复盘、是否确认基线 | RetrospectiveMemory |

### `summarizeEvaluation(persistence, workItemId)`

页面/T16 可消费的评估摘要：

- `key_metrics`：页面快速展示（总耗时、A2A 次数、Review 发现、返工轮次、门禁失败、升级次数、交付结果）
- `detail`：完整 `evaluateMetrics()` 输出
- `improvement_suggestions`：来自 T14 复盘记录的结论和建议（只读消费）
- `_notice`：标记"事实指标不自动成为产品规则"

### `queryEvaluations(persistence, filters)`

支持按 `work_item_id` / `status` / `type` 过滤，返回匹配工作项的评估摘要列表。

## 事实/建议分离

| 层级 | 来源 | 是否可自动成为规则 |
| --- | --- | --- |
| 事实指标 | `evaluateMetrics()` 自动计算 | 否，仅追踪用 |
| 复盘结论 | T14 `retrospective_conclusion` | 否，需产品负责人确认 |
| 流程改进建议 | T14 `process_improvement_suggestions` | 否，需产品负责人确认 |
| 技术执行建议 | T14 `technical_execution_suggestions` | 否，需产品负责人确认 |
| 有效做法 | T14 `effective_patterns` | 否，需产品负责人确认 |

T15 本身不产生新的建议或结论，只消费和转发 T14 复盘中的已有内容。

## 边界确认

- 未新增 Store 类型。
- 未修改 T14 复盘记录的事实字段。
- 未自动修改产品/架构/AGENTS 规则。
- 未实现 T16 E2E。
- 未实现完整分析报表或复杂可视化。
- 改进回路问题（A2A 是否减少歧义、交叉 Review 是否发现价值等）保留为定性问题框架，留给 T16 或后续人工复盘填写。

## 已验证

| 命令 | 结果 |
| --- | --- |
| `npm run verify:dogfooding` | 148 passed, 0 failed |
| `npm run check` | checked 43 JavaScript files |
| `npm test` | work-item-entry + agent-cli-adapter passed |
| `npm run verify:harness` | 22 passed, 0 failed |
| `npm run verify:delivery` | 17 passed, 0 failed |
| `npm run verify:escalations` | 10 passed, 0 failed |
| `node src/retrospective/index.verify.js` | 133 passed, 0 failed |
| `node src/storage/__verify.js` | 42 passed, 0 failed |

**零回归**：所有已有验证套件通过。

## T14 兼容

T15 `evaluateMetrics()` 与 T14 `aggregateFacts()` 从相同数据源计算，关键字段值一致：

- `rework_count` ↔ `review.rework_rounds` ✓
- `a2a_interaction_count` ↔ `a2a.total_count` ✓
- `review_count` ↔ `review.total_count` ✓
- `quality_gate_count` ↔ `quality_gate.total_count` ✓
- `escalation_count` ↔ `escalation.total_count` ✓
- `task_count` ↔ `task.total_count` ✓
- `manual_intervention_count` ↔ `a2a.manual_intervention_count` ✓

T15 在 T14 基础上额外提供：耗时统计、按目的分布、交付结果细分、升级状态分布、任务状态分布。

## 风险与后续

| 项 | 状态 |
| --- | --- |
| 非作者 Review | 待 Codex 执行 |
| T16 依赖 | T15 评估摘要可供 T16 消费；T15 是 P1，不阻塞 T16 |
| 改进回路问题 | 定性问题（A2A 是否减少歧义等）保留框架，不在此次实现 |

## 建议下一状态

T15 建议状态为 `待 Review`。Review 通过后进入 `已完成`。T16 可选择消费 T15 评估摘要增强 E2E 验证质量。
