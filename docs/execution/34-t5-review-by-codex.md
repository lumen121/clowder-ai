# T5 非作者 Review（Codex）

> 状态：需要修改
> 所属：执行
> 规则效力：T5 非作者 Review 记录
> Review Agent：Codex
> 被 Review 任务：T5 工作项状态机
> 日期：2026-06-19

## 结论

T5 当前实现具备一个可运行的状态流转规则模块，核心合法路径、非法跳转拦截、`blocked` 入口和 T3 Store 基础回写验证均可通过。

但当前产物不建议判定为 T5 通过，原因是启动包要求的执行治理和交付记录缺失，且状态机接口还没有形成稳定的持久化调用约定。建议进入“需要修改”。

## Review 范围

| 项 | 结果 |
| --- | --- |
| 当前工作区 | `C:\aiWorkspace\clowder-ai` |
| 当前分支 | `feature/t2-work-item-entry` |
| 变更状态 | `src/index.js` 已修改；`src/work-items/state-machine.js`、`src/work-items/state-machine.verify.js` 未跟踪 |
| 启动包 | [32-t5-work-item-state-machine-start-package.md](32-t5-work-item-state-machine-start-package.md) |
| Review 产物 | 本文档 |

## 验证命令

| 命令 | 结果 |
| --- | --- |
| `npm run check` | 通过，`checked 18 JavaScript files` |
| `npm test` | 通过，`work-item-entry tests passed` |
| `node src/work-items/state-machine.verify.js` | 通过，`40 通过, 0 失败` |

## 主要问题

### P1：未按 T5 启动包使用独立 branch/worktree

证据：

- `git worktree list` 只显示 `C:\aiWorkspace\clowder-ai` 和 `C:\aiWorkspace\clowder-ai-t4`。
- T5 变更出现在既有 `feature/t2-work-item-entry` 工作区中。
- 当前工作区状态显示 T5 文件未提交且未隔离。

风险：

- T5 产物归属不清，容易混入 T2/T3/T4 或主工作区变更。
- 后续提交、Review、冲突定位和回滚成本增加。
- 启动包明确要求必须在独立 branch/worktree 中执行并记录任务、branch、worktree、负责人和冲突状态。

建议：

- 补录实际执行目录、分支、变更归属和冲突状态。
- 若确实未隔离，应在 T5 结果文档中明确作为治理偏差记录。
- 后续修复和提交应迁移到独立 T5 branch/worktree，或由用户/系统架构师确认临时降级。

### P1：缺少 T5 主结果文档和状态板更新

证据：

- `docs/execution/33-t5-work-item-state-machine-result.md` 不存在。
- [task-status-board.md](task-status-board.md) 中 T5 仍为 `未开始`，实现结果、验证证据和 Review 链接均为 `待补充`。

风险：

- 后续 Agent 无法从执行文档判断 T5 当前状态、验证结论和交接条件。
- 不满足启动包“完成实现和作者自检后，将 T5 状态更新为待 Review，并链接 T5 主结果文档”的要求。

建议：

- 补齐 `33-t5-work-item-state-machine-result.md`，至少包含启动前方案、完成内容、变更文件、规则摘要、验证证据、T3 Store 集成证据、页面可解释信息示例、遗留风险。
- 更新 `task-status-board.md` 的 T5 行为 `待 Review`，并链接结果文档和本文 Review。

### P1：状态机没有提供写回 T3 Store 的稳定接口

证据：

- `src/work-items/state-machine.js` 只提供纯函数 `transition(currentStatus, targetStatus, opts)`。
- `state-machine.verify.js` 中由验证脚本手写 `p.workItemStore.update(wi.id, { status: r.status })`、`_blockedFrom`、`_blockReason`。
- 这些字段和调用约定没有在生产 API 中集中封装。

风险：

- 后续 T7/T8/T12/T13 需要自行拼装状态更新字段，状态规则仍可能散落。
- `blocked` 的原因记录字段 `_blockReason`、来源字段 `_blockedFrom` 属于隐式约定，页面可解释信息和后续 Harness 很难稳定复用。
- 启动包要求“状态更新复用 T3 WorkItem Store”与“原因可追踪且页面可解释”，当前更像验证脚本证明能手工写回，而不是状态机模块提供可复用写回接口。

建议：

- 在 T5 范围内补一个窄接口，例如 `transitionWorkItem(persistence, workItemId, targetStatus, options)` 或等价应用服务。
- 该接口负责读取 WorkItem、校验状态、写回 T3 Store，并统一记录 `blocked` 原因、解除条件或页面可解释摘要。
- 保留纯函数用于规则校验，但不要让后续模块直接拼装内部字段。

### P2：`blocked` 元数据字段使用下划线内部字段，未形成页面可解释结构

证据：

- 验证脚本写入 `_blockedFrom` 和 `_blockReason`。
- 解除阻塞时只将 `_blockedFrom` 置为 `null`，没有统一处理 `_blockReason`、解除说明、下一步动作或页面展示摘要。

风险：

- 页面侧无法稳定解释“为什么阻塞、从哪来、如何解除、下一步是什么”。
- 下划线字段暗示内部实现细节，但已写入 WorkItem Store，可能成为事实 schema。

建议：

- 使用明确字段或 `metadata` 子结构承载阻塞信息，例如 `metadata.blocking`，并写明字段约定。
- 至少在结果文档中说明当前字段是临时约定还是正式约定；若是正式约定，应补充测试覆盖。

### P2：`WORK_ITEM_STATUSES` 在状态机中重复定义，存在漂移风险

证据：

- `src/work-items/state-machine.js` 第 3-10 行复制了 T3 状态枚举。
- 注释说明是为避免循环依赖，但当前模块可直接从 `src/storage` 导入常量，未见实际循环依赖。

风险：

- T3 后续状态枚举变更时，状态机可能不同步。
- T5 启动包要求以 T3 `WORK_ITEM_STATUSES` 为基线。

建议：

- 优先复用 `src/storage` 导出的 `WORK_ITEM_STATUSES`。
- 如果确实不能导入，应增加验证脚本对比 T3 常量与状态机常量完全一致。

### P2：状态路径与架构文本存在解释差异，需要文档说明

证据：

- 架构图文本只线性展示 `pending_review -> needs_fix -> in_development -> pending_verification`。
- 当前实现允许 `pending_review -> pending_verification` 和 `pending_review -> needs_fix` 两条分支。

判断：

- 该设计从 Review 语义上是合理的：Review 通过应进入 `pending_verification`，不通过进入 `needs_fix`。
- 但结果文档缺失，导致无法确认这是 Claude 的显式方案结论还是隐式实现判断。

建议：

- 在 T5 结果文档中明确状态规则解释：`pending_review` 有 Review 通过/需修复两个出口。
- 如果架构师认为线性文本不允许该分支，需要升级确认；否则可作为合理实现保留。

## 非阻塞观察

- `transition()` 将同状态转移视为 no-op，除 `blocked -> blocked` 外不报错。该设计可接受，但需要在结果文档说明，避免 Harness 误以为重复推进一定是错误。
- `canTransition()` 对 `blocked` 入口不传 `reason`，因此 `canTransition("in_development", "blocked")` 返回 `false`，容易误导调用方。若保留该函数，建议支持 options 或文档标注。

## 建议修复清单

1. 补齐 T5 主结果文档，并更新任务状态板。
2. 补录或修正 worktree/branch 隔离信息；若无法补救，记录为治理偏差并请求确认。
3. 增加一个复用 T3 WorkItem Store 的状态推进接口，避免后续模块手写更新字段。
4. 明确 `blocked` 元数据结构和页面可解释字段。
5. 复用或校验 T3 `WORK_ITEM_STATUSES`，降低枚举漂移风险。
6. 将 T5 专属验证纳入 npm 脚本或结果文档明确要求手动运行。

## 最终判断

当前 T5 不建议通过。实现方向基本正确，但需要补齐交付治理记录，并把“状态规则纯函数”提升为“可复用、可追踪、写回 T3 Store 的状态机接口”后再复核。
