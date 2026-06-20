# T12 启动包审查 — Claude Review

> 状态：需补充后启动
> 所属：执行
> 规则效力：T12 启动包前置审查
> Review 角色：Claude（T12 指定 Review 方）
> Review 对象：`docs/execution/51-t12-escalation-page-confirmation-start-package.md`
> 日期：2026-06-20

## 结论

**需要补充。** 启动包整体结构完整，边界清晰，但在 EscalationRecord 字段缺口、T8 阻断映射、页面确认 API 和 T9 完成后的边界更新四个方面需要补充后方可让 Codex 启动。

## 总体评价

启动包符合模板要求，8 个章节完整。目标（生成升级记录 + 页面确认回写）与 T12 在执行计划中的定位一致。与 T9/T11/T13/T14 的边界表述清楚。

但以下问题需要先解决：

## 发现

### P1-1：EscalationRecord 字段不足以支撑"确认回写"

当前 T3 EscalationRecord 模型字段：

| 现有字段 | 对应需求 |
|---|---|
| `work_item_id` | ✅ 关联工作项 |
| `trigger_rule` | ✅ 触发规则 |
| `what_happened` | ✅ 发生了什么 |
| `blocked_gate` | ✅ 阻塞的门禁 |
| `options` | ✅ 可选动作 |
| `risks` | ✅ 风险说明 |
| `recommended_next_step` | ✅ 推荐动作 |
| `user_decision` | ✅ 用户决定 |

**缺失字段**（启动包 §2 明确要求但模型不支持）：

| 需求 | 现有支持 | 缺口 |
|---|---|---|
| "影响任务和当前状态" | 无 | 缺少 `affected_tasks`、`current_status` |
| "确认人、时间、结论和后续动作" | 仅 `user_decision` 一个字段 | 缺少 `confirmed_by`、`confirmed_at`、`confirmation_conclusion`、`follow_up_action` |
| "影响范围"（§2 完成标准） | 无 | 缺少 `impact_scope` |

**建议**：在 T3 `ESCALATION_DEFAULTS` 中补充以下字段，或由 T12 实现时扩展：

```
affected_tasks: [],
current_status: "",
confirmed_by: "",
confirmed_at: "",
confirmation_conclusion: "",
follow_up_action: "",
impact_scope: "",
```

不补齐会导致：确认结果无法记录"谁在什么时间确认了什么"，只能写入单一 `user_decision` 字符串，无法被页面/T16 结构化消费。

### P1-2：T8 阻断到 EscalationRecord 的映射关系未定义

启动包 §2 说"复用 T5 状态机和 T8 Harness 阻断原因"，§4 要求说明"哪些 T8 阻断或高风险动作会生成升级记录"。

当前 T8 的阻断码包括：
- `MISSING_SOLUTION`、`INCOMPLETE_TASK_CONTRACT`、`AUTHOR_SELF_REVIEW`
- `MISSING_APPROVED_REVIEW`、`QUALITY_GATE_NOT_PASSED`
- `ILLEGAL_STATUS_TRANSITION`、`MISSING_WORK_ITEM`
- `HIGH_RISK_ACTION_REQUIRES_CONFIRMATION`
- `MISSING_MAINTAINABILITY_COMMENTS_REQUIREMENT`
- `GIT_IDENTITY_NOT_ATTRIBUTABLE`

并非所有阻断都应该升级——例如 `MISSING_WORK_ITEM` 是上下文缺失，应直接修复而非升级确认。而 `QUALITY_GATE_NOT_PASSED`（持续失败）和 `HIGH_RISK_ACTION_REQUIRES_CONFIRMATION` 明确需要用户介入。

**建议**：启动包 §4 的方案确认应要求 Codex 明确列出"哪些 T8 阻断 code 触发升级记录生成，哪些不触发"，避免所有阻断无差别升级。

### P2-1：T9 已完成，边界描述需要更新

启动包 §2 范围外写"不实现完整 Review / 质量门禁记录模块；属于 T9"。T9 现已完成（`src/review-quality/index.js`），提供：
- `queryReviews(p, filters)` / `summarizeReviews(p, wiId)`
- `queryQualityGates(p, filters)` / `summarizeQualityGates(p, wiId)`

T12 的升级记录可能需要关联 Review 结论或门禁失败详情。建议补充一句：T12 可以消费 T9 的查询/摘要 API，但不修改 T9 模块。

### P2-2：页面确认 API 设计与 T13A Lite 的关系

启动包 §2 说"可在 T13A Lite 控制台基础上补最小确认入口"。T13A Lite 当前只有一个通用的 `POST /api/console/user-input`（写入 A2AEvent）。

T12 需要的是结构化确认 API，至少：
- `GET /api/console/pending-escalations` — 列出待确认的升级项
- `POST /api/console/confirm-escalation` — 回写确认/拒绝/补充信息

但启动包未说明是否需要新增 API 路由，还是复用现有路由。§4 的方案确认应要求 Codex 说明 API 设计。

### P2-3：MiniMax 参与节奏

启动包 §5 正确标注了 MiniMax 参与条件："若修改页面交互或确认体验，MiniMax 必须参与方案或 Review"。但缺少具体操作指引：

- 如果 T12 只新增 API（无页面 UI 改动），MiniMax 是否仍需参与？
- 如果 T12 在 `console.html` 中新增确认面板（有 UI 改动），MiniMax 是方案阶段参与还是 Review 阶段？

**建议**：要求 Codex 在方案中明确判断是否触发 MiniMax 参与条件，并给出处理方式。

## 未发现问题

- 启动包 8 个章节完整，符合模板。
- 依赖 T5（状态机）、T8（护栏）准确，均已完成。
- 执行约束清晰：Git 身份 `Clowder Codex`、独立 branch/worktree、禁止 force push。
- 验收标准可验证：生成升级记录、页面可展示、用户可确认/拒绝/补充、回写可追踪。
- 边界明确：不越界 T9/T11/T13/T14。

## 建议状态

**需补充后启动。** Codex 在启动前应：

1. 明确 EscalationRecord 需扩展的字段（P1-1）。
2. 列出 T8 阻断 code → 升级记录的映射规则（P1-2）。
3. 说明页面确认 API 设计（P2-2）。
4. 更新 T9 完成后的边界描述（P2-1）。
5. 判断 MiniMax 参与需求（P2-3）。

以上补充可放在 Codex 的方案确认文档中（启动包 §4 要求的方案输出），不必重新发布启动包。补充完成后即可进入开发。
