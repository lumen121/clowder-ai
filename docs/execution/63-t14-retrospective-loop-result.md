# T14 复盘记录最小闭环结果

> 状态：待 Codex 复核（已修复 Review 发现的 2 P1 + 1 P2）
> 所属：执行
> 规则效力：T14 交付记录
> 维护角色：系统架构师
> 执行 Agent：Claude
> 任务 ID：T14
> 日期：2026-06-22

## 启动与隔离

| 项 | 结果 |
| --- | --- |
| 执行身份 | Claude；Git 写入身份 `Clowder Claude <claude@clowder.local>` |
| branch | `claude/t14-retrospective-loop` |
| worktree | 未使用独立 worktree（原因同 T9：纯逻辑模块，无多 Agent 并行冲突风险） |
| 实际工作区 | `C:\aiWorkspace\clowder-ai`（主仓库，从 master 分支） |
| 基线 | `a682261`（master，含 T11/T13/T14 启动包） |
| Review 方 | Codex |

## 总体结论

T14 在 T3 RetrospectiveMemory Store 之上实现了复盘记录最小闭环：自动聚合 WorkItem / A2AEvent / ReviewRecord / QualityGateRun / EscalationRecord 的关键事实，区分事实、结论、改进建议和技术执行建议，并提供页面/T13/T16 可消费的摘要查询。

## 交付物

| 文件 | 操作 | 说明 |
| --- | --- | --- |
| `src/storage/index.js` | 修改 | RETROSPECTIVE_DEFAULTS 扩展 5 个字段 |
| `src/retrospective/index.js` | **新增** | 核心模块：aggregateFacts / generateRetrospective / updateRetrospective / queryRetrospectives / summarizeRetrospective |
| `src/retrospective/index.verify.js` | **新增** | 120 项验证 |
| `src/index.js` | 修改 | 新增 T14 导出（5 个函数 + retrospective 引用） |

## API 设计

### 事实聚合

| 函数 | 说明 |
| --- | --- |
| `aggregateFacts(persistence, workItemId)` | 从 WorkItem / A2AEvent / ReviewRecord / QualityGateRun / EscalationRecord 自动聚合关键事实，只读不写 |

返回结构：
```js
{
  participating_agents: ["Claude", "Codex"],
  rework_count: 1,
  review_findings: ["变量命名不规范", "缺少错误处理"],
  quality_gate_results: [{ gate_name, final_status, failure_reason, failure_summary }],
  failure_causes: ["3/40 tests failed", "状态机 blocked 出口校验断言失败"],
  user_intervention_reasons: ["QUALITY_GATE_NOT_PASSED", "HIGH_RISK_ACTION_REQUIRES_CONFIRMATION"],
  escalation_results: [{ escalation_id, trigger_rule, user_decision }],
  aggregated_facts: {
    work_item_type, work_item_goal, final_status,
    a2a_interaction_count, manual_intervention_count,
    review_count, quality_gate_count, escalation_count, task_count
  }
}
```

### 复盘记录管理

| 函数 | 说明 |
| --- | --- |
| `generateRetrospective(p, workItemId, input?)` | 自动聚合事实 + 合并结论/建议，创建 RetrospectiveMemory |
| `updateRetrospective(p, id, patch)` | 白名单更新（结论/建议/有效做法/基线标记），保护事实字段不可变 |
| `queryRetrospectives(p, filters?)` | 按 work_item_id / confirmed_as_baseline 过滤查询 |
| `summarizeRetrospective(p, workItemId)` | 生成页面可消费的结构化摘要 |

### 事实/结论/建议三分法

| 分类 | 字段 | 来源 |
| --- | --- | --- |
| **事实** | `participating_agents`, `rework_count`, `review_findings`, `quality_gate_results`, `failure_causes`, `user_intervention_reasons`, `escalation_results`, `aggregated_facts` | `aggregateFacts()` 自动聚合，不可通过 `generateRetrospective` input 或 `updateRetrospective` 覆写 |
| **结论** | `retrospective_conclusion` | 复盘者通过 `generateRetrospective` input 或 `updateRetrospective` 撰写 |
| **改进建议** | `process_improvement_suggestions` | 同上（流程层面） |
| **技术执行建议** | `technical_execution_suggestions` | 同上（代码/技术层面） |
| **有效做法** | `effective_patterns` | 同上（可复用模式） |

## 字段扩展

在 T3 RETROSPECTIVE_DEFAULTS 基础上新增 5 个字段：

| 字段 | 类型 | 默认值 | 分类 |
| --- | --- | --- | --- |
| `participating_agents` | `string[]` | `[]` | 事实 |
| `rework_count` | `number` | `0` | 事实（统计 result=changes_requested 的 Review） |
| `retrospective_conclusion` | `string` | `""` | 结论 |
| `escalation_results` | `Array<{escalation_id, trigger_rule, user_decision}>` | `[]` | 事实 |
| `aggregated_facts` | `object` | `{}` | 事实（类型/状态/A2A次数/交付结果等） |

所有新字段向后兼容：老代码直接调用 `createRetrospectiveMemory()` 不受影响，T14 新字段使用默认值。

## 页面消费路径

`summarizeRetrospective()` 返回结构：

```js
{
  work_item_id, retrospective_id, created_at, confirmed_as_baseline,
  facts: {
    participating_agents, rework_count, review_findings,
    quality_gate_results, failure_causes, user_intervention_reasons,
    escalation_results, aggregated_facts
  },
  conclusion: "...",
  suggestions: { process: [...], technical: [...] },
  effective_patterns: [...]
}
```

T13/T16 可通过此结构直接渲染"复盘视图"（P0-16），无需自行聚合底层记录。

## 验证结果

```
node src/retrospective/index.verify.js  → 133/133 通过（修复后新增 13 项）
npm run check                             → 40 JavaScript files OK
npm test                                  → work-item-entry + agent-cli-adapter 通过
npm run verify:harness                    → 22/22 通过（零回归）
node src/storage/__verify.js              → 42/42 通过（零回归，含 RetrospectiveMemory 新字段兼容）
node src/review-quality/index.verify.js   → 132/132 通过（零回归）
```

### 验证覆盖

- **aggregateFacts**：基本聚合（参与Agent/返工/Review发现/门禁结果/失败原因/升级结果/聚合对象）/ 错误处理 / 无关联记录的工作项 / 纯空白拒绝
- **generateRetrospective**：基本生成 / input 不可覆写事实 / 默认值 / 错误处理
- **updateRetrospective**：正常更新（结论/建议/有效做法/基线标记）/ 白名单拒绝（9 个事实字段 + work_item_id）/ 类型校验 / 不存在记录
- **queryRetrospectives**：全量 / 按 work_item_id / 按 confirmed_as_baseline / 组合过滤 / 无匹配
- **summarizeRetrospective**：摘要结构完整性（facts/conclusion/suggestions/effective_patterns）/ 无复盘返回 null / 错误处理
- **数据隔离**：generateRetrospective / updateRetrospective / queryRetrospectives 均返回深拷贝
- **Store 兼容**：T3 直接创建仍正常工作，T14 新字段默认值兼容

## Codex Review 后修复

Codex 非作者 Review（[64-t14-review-by-codex.md](64-t14-review-by-codex.md)）发现 2 项 P1 + 2 项 P2，已修复 3 项（P2 worktree 为过程建议，非代码级修复）：

### P1-1：结构化 Review findings 被静默丢弃

- **问题**：`aggregateFacts()` 只收集 `typeof f === "string"` 的 findings，T9 已支持的对象形态 `{ severity, description }` 被丢弃
- **修复**：扩展 findings 收集逻辑，支持 `string` 和 `object` 两种形态；对象形态保留 `{ severity, description }`
- **验证**：新增 `aggregateFacts` 测试（1.6a/1.6b/1.6c），验证结构化 finding 的 severity 和 description 均被保留

### P1-2：任意未完成状态都能生成复盘

- **问题**：`generateRetrospective()` 不检查 WorkItem 状态，`needs_clarification` / `in_development` / `pending_review` 等中间态也能生成复盘
- **修复**：新增 `RETROSPECTIVE_ALLOWED_STATUSES = ["completed", "blocked"]` 常量，默认只允许终态/失败态；增加 `allow_non_final: true` 显式选项供中途复盘场景
- **验证**：新增 7a.1-7a.9 共 9 项测试，覆盖中间态拒绝、allow_non_final 放行、终态放行、错误消息等

### P2-1：参与 Agent 聚合漏掉 ReviewRecord

- **问题**：Agent 聚合只从 A2A（from_agent/to_agent）和 Task（owner_agent）收集，漏掉 ReviewRecord（author_agent/reviewer_agent）和 Task（reviewer_agent/collaborators）
- **修复**：Agent 聚合扩展为三个来源：A2A + Task（owner_agent/reviewer_agent/collaborators）+ ReviewRecord（author_agent/reviewer_agent）
- **验证**：新增测试数据（ReviewRecord 含 MiniMax author，Task 含 MiniMax collaborator），验证 `participating_agents` 包含 MiniMax

### P2-2：未使用独立 worktree（非代码修复）

- 过程建议，与 T9 相同。T14 提交仅包含自身文件，无跨任务混入。

## 与 T15 的边界

| T14 范围 | T15 范围（不实现） |
| --- | --- |
| 聚合参与 Agent、Review 发现、门禁结果、返工次数 | 统计耗时指标（录入→方案、方案→Review、Review→交付） |
| 记录失败原因、结论、建议 | A2A 交互阶段分布 |
| 区分事实/结论/建议 | Review 发现类型统计 |
| 页面可见摘要 | Dogfooding 基础指标面板 |

## 范围外确认

| 事项 | 归属 |
| --- | --- |
| Dogfooding 指标增强（耗时/A2A分布/Review类型） | T15 |
| 页面主界面复盘视图渲染 | T13 |
| E2E 验证复盘记录进入时间线 | T16 |
| 复盘结论自动生效为产品规则 | 不自动生效；需产品负责人确认（Dogfooding 治理规则） |

## 未完成内容

无。T14 范围内全部完成。

## 是否解除依赖

是。T14 通过后解除 T15、T16 对复盘记录能力的依赖。

## 是否阻断后续任务

否。

## 遗留风险

无。
