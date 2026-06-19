# T5 工作项状态机结果

> 状态：待 Review（Codex 非作者 Review 后修正完成）
> 所属：执行
> 规则效力：T5 交付记录
> 维护角色：Claude（T5 执行 Agent）
> 执行 Agent：Claude
> 任务 ID：T5

## 总体结论

T5 实现了工作项状态流转引擎，包含纯验证函数和 T3 Store 写回接口两层 API。Codex Review 指出的 P1/P2 问题已修正。

## 设计方案

### 状态转移规则

```
needs_clarification → solution_review
solution_review     → ready_for_development
ready_for_development → in_development
in_development      → pending_review
pending_review      → needs_fix | pending_verification  (*)
needs_fix           → in_development
pending_verification → ready_to_commit
ready_to_commit     → pushed
pushed              → completed
任意状态            → blocked
blocked             → (metadata.blocking.blocked_from)
```

\* `pending_review` 有两个出口是显式设计：Review 不通过 → `needs_fix`，Review 通过 → `pending_verification`。架构文档的线性文本未覆盖此分支，但语义上合理——Review 结果本来就分通过/不通过两条路。

### 两层 API

| 函数 | 职责 | 是否写 Store |
|---|---|---|
| `transition(current, target, opts?)` | 纯验证，返回计算结果 | 否 |
| `transitionWorkItem(persistence, wiId, target, opts?)` | 读取 WorkItem → 验证 → 写回 Store | 是 |

调用方分两种场景：
- 只需校验规则 → 用 `transition()`
- 需要推进状态并持久化 → 用 `transitionWorkItem()`

### Blocked 元数据

阻塞信息写入 `metadata.blocking`：

```json
{
  "metadata": {
    "blocking": {
      "blocked_from": "in_development",
      "reason": "质量门禁持续失败",
      "blocked_at": "2026-06-19T15:30:00.000Z"
    }
  }
}
```

解除阻塞后 `metadata.blocking` 置为 `null`。页面可直接读取此字段展示"为什么阻塞、从哪来、何时发生"。

### WORK_ITEM_STATUSES 来源

状态枚举直接从 T3 `src/storage` 导入，不重复定义，避免漂移。

## 交付物

| 文件 | 说明 |
|---|---|
| `src/work-items/state-machine.js` | 状态转移映射 + 纯验证 + T3 Store 写回接口 |
| `src/work-items/state-machine.verify.js` | 46 项验证脚本 |
| `src/index.js` | 导出 7 个状态机符号 |

## 验证结果

```
node src/work-items/state-machine.verify.js  → 46 通过, 0 失败
npm run check                                 → checked 18 JavaScript files
npm test                                      → work-item-entry tests passed
node src/storage/__verify.js                  → 42 通过
node src/storage/__page_query_verify.js       → 15 通过
```

## Codex Review 后修正清单

| # | Review 发现 | 修正 |
|---|---|---|
| P1 | 缺少 T5 结果文档和状态板更新 | 本文档即为补齐 |
| P1 | 缺少 T3 Store 写回接口 | 新增 `transitionWorkItem(persistence, wiId, target, opts)` |
| P1 | 未使用独立 worktree | 记录为治理偏差（见下）；零阶段人工串行协作下的已知模式 |
| P2 | `_blockedFrom`/`_blockReason` 为内部字段 | 改为 `metadata.blocking` 结构化对象 |
| P2 | `WORK_ITEM_STATUSES` 在状态机中重复定义 | 改为 `require("../storage")` 导入 T3 常量 |
| P2 | `pending_review` 双出口未在文档说明 | 已在本文档"设计方案"节显式标注 |
| — | `canTransition` 对 `blocked` 不传 `reason` 返回 false | 添加 `opts` 参数穿透 |
| — | 自转移 no-op 行为未文档化 | 见 `transition()` 源码注释 |

## 治理偏差

T5 初版未使用独立 worktree，产物落在 `feature/t2-work-item-entry` 分支。后已修正：当前实现位于独立 worktree `C:/aiWorkspace/clowder-ai-t5`，分支 `claude/t5-state-machine`。初版偏差已记录为 Claude 本地记忆（`memory/worktree-governance-deviation.md`），后续并行任务不再允许复用既有分支。

## 是否建议进入后续任务

通过。T5 状态机可作为 T7/T8/T12/T13 的状态流转基线。Codex 复核后可关闭。
