# T8 Harness 核心护栏结果

> 状态：已完成
> 所属：执行
> 规则效力：T8 交付记录
> 维护角色：系统架构师
> 执行 Agent：Codex
> 任务 ID：T8
> 日期：2026-06-20

本文记录 T8 的实现结果。Claude 非作者 Review 已通过，Review 记录见 [47-t8-review-by-claude.md](47-t8-review-by-claude.md)。

## 启动与隔离

| 项 | 结果 |
| --- | --- |
| 执行身份 | Codex；Git 写入身份要求为 `Clowder Codex <codex@clowder.local>` |
| branch | `codex/t8-harness-core-rails` |
| worktree | `C:\aiWorkspace\clowder-ai-t8` |
| 基线 | `origin/master`，提交 `8dfc0a5` |
| Review 方 | Claude |
| 状态 | 已完成实现、自检和 Claude 非作者 Review |

## 启动前方案确认

T8 采用独立 Harness 判定层，不改写 T5 状态机，不扩展 T9/T10/T11/T12。

- 新增 `src/harness/core-rails.js` 作为护栏判定入口。
- 新增 `evaluateHarnessRails()`，返回 `allowed / blocked / blockers / next_actions / gates_checked`。
- 新增 `guardedTransitionWorkItem()`，先执行 T8 护栏，再调用 T5 `transitionWorkItem()`。
- 复用 T7 写入的 WorkItem `solution` 和 Task 字段，校验负责人、边界、依赖、产物、Review 方和验收标准。
- 复用 T3 `ReviewRecord` 和 `QualityGateRun` 作为已有记录来源，但不实现 T9 记录模块。
- 高风险动作仅做分类和拦截，不实现 T11 Git 交付流程。

未发现与启动包、产品基线、架构基线或执行计划冲突的待确认项。

## 完成内容

| 文件 | 内容 |
| --- | --- |
| `src/harness/core-rails.js` | Harness 核心护栏：方案/任务拆解、非作者 Review、质量门禁、维护性注释要求、Git 身份、高风险动作拦截 |
| `src/harness/core-rails.verify.js` | T8 专属验证脚本，覆盖 22 项成功与阻断路径 |
| `src/index.js` | 导出 T8 公共 API |
| `package.json` | 新增 `verify:harness` 脚本 |
| `docs/execution/00-index.md` | 补充 T8 结果文档入口 |
| `docs/execution/task-status-board.md` | T8 状态更新为待 Review |

## API

```js
evaluateHarnessRails(persistence, params)
evaluateHighRiskAction(action, options)
guardedTransitionWorkItem(persistence, workItemId, targetStatus, options)
```

阻断结果示例：

```js
{
  allowed: false,
  blocked: true,
  blockers: [
    {
      code: "MISSING_APPROVED_REVIEW",
      message: "No non-author approved ReviewRecord exists for this WorkItem.",
      next_action: "Request and record non-author review before verification or delivery.",
      blocked_gate: "review",
      severity: "blocker"
    }
  ]
}
```

## 护栏覆盖

| 护栏 | 结果 |
| --- | --- |
| 方案先行 | 缺少 `solution.summary` / `solution.approach` 时阻断进入开发相关状态 |
| 任务拆解完整 | 缺少 Task、owner、boundary、dependencies、expected_artifacts、reviewer、acceptance_criteria 时阻断 |
| 非作者 Review | 缺少 approved ReviewRecord、Review 未解决或作者自审时阻断 |
| 质量门禁 | 缺少 QualityGateRun 或最新门禁非 `passed` 时阻断 |
| 维护性注释要求 | 交付状态缺少维护性注释要求或显式满足标记时阻断 |
| Git 身份归因 | 交付状态缺少或不匹配当前 Agent Git 身份时阻断 |
| 高风险动作 | deploy、main/master push、force push、绕过 Review/门禁等未确认时阻断 |

## 边界说明

- 未实现 Review 与质量门禁记录模块，T8 只消费已有 `ReviewRecord` / `QualityGateRun`，T9 负责记录能力。
- 未实现 worktree / 分支隔离治理，T10 负责。
- 未实现 Git feature 分支交付安全流程，T11 负责。
- 未实现页面确认界面或 EscalationRecord 回写，T12/T13 负责。
- 未修改产品、架构或固定 Agent 规则。

## 验证结果

```
npm run check                           -> checked 31 JavaScript files
npm test                                -> work-item-entry tests passed; agent-cli-adapter tests passed
npm run verify:harness                  -> 22 passed, 0 failed
node src/work-items/state-machine.verify.js      -> 46 passed, 0 failed
node src/work-items/solution-breakdown.verify.js -> 19 passed, 0 failed
```

## 是否解除依赖

Claude Review 通过后，T8 可解除以下依赖：

- T9 Review 与质量门禁记录。
- T11 Git feature 分支交付安全流程。
- T12 人工升级与页面确认流程。

当前已通过 Claude 非作者 Review。

## Claude Review 处理

Claude 非作者 Review 结论为通过，并提出 2 条非阻塞观察。作者已在收尾时处理：

| 观察项 | 处理 |
| --- | --- |
| `maintainabilityCommentsSatisfied` 缺少 snake_case 别名 | 已补充 `maintainability_comments_satisfied`，并新增验证覆盖 |
| 无 `task_id` 的质量门禁匹配任意 Task 需要注释 | 已补维护性注释，并新增 work-item 级质量门禁验证 |

## 遗留风险

| 风险 | 影响 | 处理 |
| --- | --- | --- |
| T9 尚未实现结构化记录模块 | T8 只能消费现有 Store 记录，不能生成 Review/门禁记录 | 保持范围，交给 T9 |
| 维护性注释满足度依赖调用方传参 | 当前无法自动静态判断注释质量 | T11/T16 可结合交付检查再加强 |
| 高风险动作只做判定，不生成升级记录 | 页面确认和用户决策回写尚未闭环 | 交给 T12/T13 |

## 建议下一状态

T8 已完成。可解除 T9/T11/T12 对 T8 的依赖；后续 T9 负责 Review/质量门禁记录模块，T11 负责 Git 交付安全流程，T12 负责人工升级与页面确认。
