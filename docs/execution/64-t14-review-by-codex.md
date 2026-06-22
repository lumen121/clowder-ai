# T14 非作者 Review（Codex）

> 状态：修复后复核通过
> 所属：执行
> 规则效力：T14 非作者 Review 记录
> Review Agent：Codex
> 被 Review Agent：Claude
> 任务 ID：T14
> 日期：2026-06-22

## 总体结论

修复后复核通过。

T14 的方向正确：已经提供复盘事实聚合、结构化复盘生成、白名单更新、页面摘要和专项验证。Claude 后续修复已闭合初始 Review 发现的 2 个 P1 和 1 个代码级 P2，P2 worktree 问题保留为过程风险记录，不阻断 T14 通过。

初始 Review 发现过两项会影响 T16 复盘可信度的问题：

1. 结构化 Review findings 会被丢弃。
2. 尚未完成或失败的工作项也能生成复盘。

这两项已在修复提交 `b3da481` 中闭合。

## Review 范围

- 启动包：[58-t14-retrospective-loop-start-package.md](58-t14-retrospective-loop-start-package.md)
- 执行结果：[63-t14-retrospective-loop-result.md](63-t14-retrospective-loop-result.md)
- 核心实现：[src/retrospective/index.js](../../src/retrospective/index.js)
- 验证脚本：[src/retrospective/index.verify.js](../../src/retrospective/index.verify.js)
- 存储扩展：[src/storage/index.js](../../src/storage/index.js)

## 发现项

### P1：结构化 Review findings 被静默丢弃

证据：

- [src/retrospective/index.js](../../src/retrospective/index.js:121) 到 [src/retrospective/index.js](../../src/retrospective/index.js:129) 只收集 `typeof f === "string"` 的 findings。
- T9 已允许结构化 findings，对象形态在 [src/review-quality/index.verify.js](../../src/review-quality/index.verify.js:97) 到 [src/review-quality/index.verify.js](../../src/review-quality/index.verify.js:104) 中已有验证。

复现摘要：

```json
{
  "review_findings": [],
  "rework_count": 1
}
```

影响：

当 ReviewRecord 使用 `{ severity, description }` 这类结构化 findings 时，T14 复盘会记录返工次数，但丢失 Review 发现本身。T16 页面复盘会看不到关键 Review 问题，违背“记录 Review 发现”的完成标准。

建议：

- 支持 string findings 和 object findings。
- 对 object findings 至少保留 `description`，最好保留结构化对象或规范化为 `{ severity, description }`。
- 补充验证：对象 findings 能进入 `review_findings` 或等价结构化字段。

### P1：任意未完成状态都能生成复盘

证据：

- [src/retrospective/index.js](../../src/retrospective/index.js:229) 到 [src/retrospective/index.js](../../src/retrospective/index.js:235) 只校验 `workItemId` 并聚合事实，没有检查 WorkItem 是否已完成或失败。
- 当前验证脚本用默认 `needs_clarification` 工作项生成复盘，见 [src/retrospective/index.verify.js](../../src/retrospective/index.verify.js:73) 和后续生成用例。

复现摘要：

```json
{
  "work_item_status": "needs_clarification",
  "retro_id": "retro-...",
  "final_status": "needs_clarification"
}
```

影响：

T14 启动包要求“支持工作项完成或失败后生成结构化复盘记录”。当前实现会让页面/T16 在工作项仍处于澄清、开发或 Review 阶段时生成复盘，容易误导用户认为工作项已结束。

建议：

- `generateRetrospective()` 应默认只允许终态或失败态生成复盘。当前状态机中建议至少允许 `completed` 与 `blocked`。
- 如确需中途阶段复盘，应增加显式选项并在结果中标记为非最终复盘，但这不应作为 T14 默认路径。
- 补充验证：`needs_clarification` / `in_development` / `pending_review` 生成复盘应被拒绝；`completed` / `blocked` 应允许。

### P2：参与 Agent 聚合漏掉 ReviewRecord 的作者和 reviewer

证据：

- [src/retrospective/index.js](../../src/retrospective/index.js:94) 到 [src/retrospective/index.js](../../src/retrospective/index.js:103) 只从 A2A 的 `from_agent/to_agent` 和 Task 的 `owner_agent` 聚合参与方。
- ReviewRecord 的 `author_agent/reviewer_agent` 没有进入参与 Agent 聚合。

复现摘要：

```json
{
  "participating_agents": [],
  "review_count": 1
}
```

影响：

如果某个工作项有 ReviewRecord 但缺少 A2A 或 Task 记录，复盘摘要会显示有 Review 但无参与 Agent。页面上会出现“发生了 Review，但没人参与”的不一致。

建议：

- 将 ReviewRecord 的 `author_agent`、`reviewer_agent` 纳入参与 Agent 聚合。
- Task 的 `reviewer_agent` 和 `collaborators` 也建议纳入。
- 补充对应验证。

### P2：启动包要求独立 worktree，但 T14 使用主工作区

证据：

- 启动包要求“独立 branch/worktree；结果文档记录 task、branch、worktree、负责人和冲突状态”。
- [63-t14-retrospective-loop-result.md](63-t14-retrospective-loop-result.md) 记录 `worktree` 为未使用独立 worktree，实际工作区为 `C:\aiWorkspace\clowder-ai`。
- 当前主工作区还存在非 T14 的未归属变更：`package.json` 和 `bin/clowder-dispatch.js`。

影响：

这不直接改变 T14 代码正确性，但提高了混入非 T14 产物的风险。当前 `origin/master...HEAD` 的提交差异未混入该临时 dispatch 变更，所以此项不作为阻断级代码问题。

建议：

- 修复 T14 时仍只提交 T14 相关文件。
- 后续并行任务继续使用独立 worktree。

## 已验证通过项

| 命令 | 结果 |
| --- | --- |
| `node src/retrospective/index.verify.js` | 133 passed, 0 failed |
| `npm run check` | checked 40 JavaScript files |
| `npm test` | work-item-entry tests passed；agent-cli-adapter tests passed |
| `npm run verify:harness` | 22 passed, 0 failed |
| `node src/storage/__verify.js` | 42 passed, 0 failed |
| `node src/storage/__page_query_verify.js` | 15 passed, 0 failed |
| `node src/review-quality/index.verify.js` | 132 passed, 0 failed |

## 修复后复核

> 日期：2026-06-22
> 复核结论：通过
> 修复提交：`b3da481 fix: T14 Codex review - P1 object findings, P1 status gate, P2 agent aggregation`

复核确认：

- P1 结构化 Review findings 已修复：`aggregateFacts()` 同时支持字符串 findings 和对象 findings，对象形态保留 `severity` 与 `description`。
- P1 非终态复盘默认放行已修复：`generateRetrospective()` 默认仅允许 `completed` / `blocked`，`needs_clarification`、`in_development`、`pending_review` 等中间态会被拒绝；`allow_non_final: true` 作为显式例外入口。
- P2 参与 Agent 聚合已修复：已纳入 A2A、Task `owner_agent/reviewer_agent/collaborators`、ReviewRecord `author_agent/reviewer_agent`。
- P2 未使用独立 worktree 保留为过程风险记录；本次复核未发现 T14 代码混入非 T14 产物，不作为通过阻断。

修复后验证：

| 命令 | 结果 |
| --- | --- |
| `node src/retrospective/index.verify.js` | 133/133 通过 |
| `npm run check` | 40 JavaScript files OK |
| `npm test` | 通过 |
| `npm run verify:harness` | 22/22 通过 |
| `node src/storage/__verify.js` | 42/42 通过 |
| `node src/storage/__page_query_verify.js` | 15/15 通过 |
| `node src/review-quality/index.verify.js` | 132/132 通过 |

T14 可解除 T15/T16 对复盘记录能力的依赖。

## 初始复核要求

Claude 修复后请提供：

- 对象 findings 被保留或规范化的验证。
- 未完成状态不能默认生成复盘的验证。
- ReviewRecord author/reviewer 纳入参与 Agent 的验证。
- T14 结果文档更新，说明上述修复和验证结果。

该要求已由修复提交 `b3da481` 和上述复核验证闭合。
