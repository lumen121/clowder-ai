# T8 Harness 核心护栏 — Claude Review

> 状态：通过
> 所属：执行
> 规则效力：T8 Review 记录
> Review 角色：Claude
> Review 对象：`docs/execution/46-t8-harness-core-rails-result.md` + `src/harness/core-rails.js` + `src/harness/core-rails.verify.js`
> 日期：2026-06-20

## 结论

**通过。** T8 已实现 Harness 核心护栏的最小可用版本。护栏覆盖方案先行、任务拆解完整性、非作者 Review、质量门禁、维护性注释要求和 Git 身份归因六项核心检查，以及高风险动作拦截。边界清晰，不改写 T5/T9/T10/T11/T12。

## 验证结果

```
npm run verify:harness                    → 20/20 通过
npm run check                             → 31 JS files OK
npm test                                  → 通过（零回归）
node src/work-items/state-machine.verify.js       → 46/46
node src/work-items/solution-breakdown.verify.js  → 19/19
```

## 护栏覆盖确认

| 护栏 | 阻断条件 | 验证 |
|------|---------|------|
| 方案先行 | 缺少 `solution.summary` 或 `solution.approach` → `MISSING_SOLUTION` | ✅ verify#1 |
| 任务拆解完整性 | 缺 Task / owner / boundary / deps / artifacts / reviewer / acceptance_criteria → `MISSING_TASK_BREAKDOWN` / `INCOMPLETE_TASK_CONTRACT` | ✅ verify#2-3 |
| 自审拦截 | `owner_agent === reviewer_agent` → `AUTHOR_SELF_REVIEW` | ✅ verify#4 |
| 非法状态转移 | T5 transition() 抛错 → `ILLEGAL_STATUS_TRANSITION` | ✅ verify#5 |
| 非作者 Review | 无 approved ReviewRecord 或存在 changes_requested/未解决 → `MISSING_APPROVED_REVIEW` | ✅ verify#6-7 |
| Review 通过放行 | approved + resolved + 非自审 → allowed=true | ✅ verify#8 |
| 质量门禁 | 无 QualityGateRun 或 latest final_status≠passed → `QUALITY_GATE_NOT_PASSED` | ✅ verify#9-10 |
| Git 身份缺失 | 无 gitIdentity → `GIT_IDENTITY_NOT_ATTRIBUTABLE` | ✅ verify#11 |
| Git 身份错配 | Codex 用 Claude 身份 → `GIT_IDENTITY_NOT_ATTRIBUTABLE` | ✅ verify#12 |
| 维护性注释 | 无 maintainabilityComments 且无显式满足标记 → `MISSING_MAINTAINABILITY_COMMENTS_REQUIREMENT` | ✅ verify#13 |
| 交付全通 | review + gate + git + comments → allowed=true | ✅ verify#14 |
| 高风险动作（deploy） | 未确认 → blocked | ✅ verify#15 |
| push to main | 高风险 → blocked | ✅ verify#16 |
| 高风险确认放行 | confirmed=true → allowed | ✅ verify#17 |
| feature push | 非 main/master → 非高风险 | ✅ verify#18 |
| guardedTransitionWorkItem 通过 | rails 全过 → 推进状态 | ✅ verify#19 |
| guardedTransitionWorkItem 阻断 | rails 不过 → throw with decision | ✅ verify#20 |

## 边界确认

| 模块 | T8 行为 | 符合启动包 |
|------|--------|-----------|
| T5（状态机） | 包装 `transition()`，不修改 T5 源码 | ✅ |
| T7（方案拆解） | 消费 WorkItem.solution 和 Task 字段 | ✅ |
| T9（Review/门禁记录） | 只消费已有 ReviewRecord/QualityGateRun，不生成 | ✅ |
| T10（Worktree 治理） | 不涉及 | ✅ |
| T11（Git 交付） | 不做 push/PR，仅检查 git identity | ✅ |
| T12（人工升级） | 不生成 EscalationRecord | ✅ |

## 发现

### 观察 1（非阻塞）：`maintainabilityCommentsSatisfied` 缺少 snake_case 别名

`validateDeliveryReadiness` 中 `maintainabilityCommentsSatisfied` 只识别 camelCase，而 `gitIdentity` 和 `actorAgent` 同时识别 camelCase 和 snake_case。不一致，但不影响功能——调用方只需传 camelCase。

建议：后续统一参数命名约定，或为 `maintainabilityCommentsSatisfied` 补充 `maintainability_comments_satisfied` 别名。

### 观察 2（非阻塞）：质量门禁 null task_id 匹配策略值得注释

`validateQualityGate` 中 `record.task_id == null`（宽松等）允许无 task_id 的质量门禁匹配任意 Task。这实现了一个合理的"全局门禁"语义，但未在注释中说明。

建议：在条件旁注释 "// 无 task_id 的质量门禁视为全局门禁，匹配所有 Task"。

## 未发现问题

- 无逻辑错误或死代码。
- 无 T3 Store 引用泄露（`list()` 返回的数组被遍历但不修改 Store 内部状态）。
- `evaluateHarnessRails` 纯读取（不写 Store），`guardedTransitionWorkItem` 才写入——职责清晰。
- `buildDecision` 的 `next_actions` 去重正确。
- `latestRecord` 的排序覆盖了无 `updated_at`/`created_at` 记录的回退。
- 无跨模块静默依赖或隐式状态修改。

## 建议状态

通过。非阻塞观察可由 Codex 自行决定是否在 commit 前处理。Review 通过后 T8 状态更新为已完成，T9/T11/T12 对 T8 的依赖解除。

## Codex 收尾处理

Codex 已处理两条非阻塞观察：

| 观察项 | 处理结果 |
| --- | --- |
| `maintainabilityCommentsSatisfied` 缺少 snake_case 别名 | 已补充 `maintainability_comments_satisfied` 支持 |
| 质量门禁 `task_id == null` 的全局门禁语义缺少注释 | 已补充维护性注释 |

补充验证后，`npm run verify:harness` 从 20 项扩展为 22 项，结果为 `22 passed, 0 failed`。
