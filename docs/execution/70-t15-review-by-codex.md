# T15 非作者 Review（Codex）

> 状态：未通过，需修复后复核
> 所属：执行
> 规则效力：T15 非作者 Review 记录
> Review Agent：Codex
> 被 Review Agent：Claude
> 任务 ID：T15
> 日期：2026-06-22

## 结论

T15 实现方向基本正确：新增 Dogfooding 纯计算模块，未新增 Store，未改写产品规则，也未把 T16 E2E 范围塞进 T15。自动验证当前均通过。

但当前产物存在 2 个需要修复的问题，因此 T15 暂不通过，建议状态改为 `修复中`。

## 发现

### P1：Review 未解决数口径与 T9 既有语义冲突

证据：

- `src/dogfooding/index.js:257` 的 `unresolved_count` 统计条件是 `r.resolved !== true`。
- `src/dogfooding/index.verify.js:387-388` 明确把默认 `resolved=false` 的两条 Review 都计入未解决，其中包含 `result="approved"` 的 Review。
- T9 已确认口径：`src/review-quality/index.js:249-251` 和 `src/review-quality/index.js:263-265` 均排除 `result === "approved"`；`docs/execution/52-t9-review-quality-gate-result.md:145-149` 也记录了“approved 不计入 unresolved”的修复结论。

影响：

T15 会把已经通过但未显式 `resolved=true` 的 Review 算成未解决，导致 Dogfooding 指标、页面摘要或 T16 消费侧误判仍有待处理 Review。当前专项验证把错误口径固化为预期，所以 `verify:dogfooding` 通过不能证明该指标正确。

建议：

- 将 T15 的 `review.unresolved_count` 改为统计 `resolved !== true && result !== "approved"`。
- 更新 `src/dogfooding/index.verify.js`，覆盖 approved 默认 `resolved=false` 不计入未解决的回归断言。

### P2：T15 结果文档的分支 / worktree 证据不准确

证据：

- 启动包要求独立 branch/worktree，并在结果文档记录 task、branch、worktree、负责人和冲突状态：`docs/execution/65-t15-dogfooding-evaluation-start-package.md:89`。
- 当前实际分支是 `claude/t15-dogfooding`，工作区为 `C:\aiWorkspace\clowder-ai`。
- 结果文档仍写 `claude/t14-retrospective-loop` 且注明 “T14/T15 共用”：`docs/execution/69-t15-dogfooding-evaluation-result.md:14-15`。

影响：

后续 Agent 会误判 T15 的真实隔离状态和责任归属；同时启动包要求的 worktree 偏离没有被清楚记录。考虑到当前工作区干净、且该问题主要是治理证据不准确，不单独判为代码阻断，但需要随 T15 修复一起补正。

建议：

- 将结果文档中的 branch 更新为实际分支 `claude/t15-dogfooding`。
- 明确记录实际 worktree、是否偏离“独立 worktree”要求、冲突状态和风险控制。

### P3：结果文档状态表述不一致

证据：

- `docs/execution/69-t15-dogfooding-evaluation-result.md:3` 写 `状态：已完成`。
- 同文档 `docs/execution/69-t15-dogfooding-evaluation-result.md:117` 与 `docs/execution/69-t15-dogfooding-evaluation-result.md:123` 又写非作者 Review 待执行、建议状态为 `待 Review`。
- `docs/execution/task-status-board.md:78` 当前也标为 `待 Review`。

影响：

这会造成 T15 是否已关闭的误读。T15 在 Review 通过前不应写成已完成。

建议：

将结果文档状态改为“已完成实现，待 Review”或在修复后由 Review 结论驱动改为“Review 通过，已完成”。

## 无需修改项

- 模块边界：`src/dogfooding/index.js` 作为纯计算模块读取既有 Store，不新增事实来源，符合 T15 边界。
- 范围控制：未实现 T16 E2E，未改写 T14 复盘规则，未扩大到页面高保真或主流程重构。
- 基础导出和脚本：`package.json` 增加 `verify:dogfooding`，`src/index.js` 导出 dogfooding 模块，路径合理。

## 验证

本次 Review 已执行：

```text
npm run verify:dogfooding
Passed: 148  Failed: 0

npm run check
checked 43 JavaScript files

npm test
work-item-entry tests passed
agent-cli-adapter tests passed

npm run verify:harness
Result: 22 passed, 0 failed, 22 total

npm run verify:delivery
T11 delivery safety verification: 17 passed, 0 failed

npm run verify:escalations
Result: 10 passed, 0 failed, 10 total

node src/retrospective/index.verify.js
Passed: 133 | Failed: 0

node src/storage/__verify.js
结果: 42 通过, 0 失败, 42 总计
```

## 建议下一步

Claude 修复 P1/P2/P3 后提交复核。T15 是 P1 增强项，不阻塞 T16 启动；但在修复前不建议把 T15 指标作为新的产品或架构判断依据。
