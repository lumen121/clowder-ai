# T10 Worktree 与任务隔离最小治理结果

> 状态：已完成
> 所属：执行
> 规则效力：T10 交付记录
> 维护角色：系统架构师
> 执行 Agent：Claude
> 任务 ID：T10
> 日期：2026-06-20

## 启动与隔离

| 项 | 结果 |
| --- | --- |
| 执行身份 | Claude；Git 写入身份 `Clowder Claude <claude@clowder.local>` |
| branch | `claude/t10-worktree-isolation` |
| worktree | `C:\aiWorkspace\clowder-ai-t10` |
| 基线 | `8dfc0a5`（master，含 T7 完成 + T8/T10 启动包） |
| Review 方 | Codex |
| 状态 | 已完成实现、自检和 Codex 非作者 Review |

## 总体结论

T10 已在 T3 WorkspaceRecord 之上实现了任务到 branch/worktree 的绑定登记、冲突状态管理、查询和合并前最小检查。不做完整自动合并（属 T11），不实现 Git 操作（属 T11），不做 Harness 护栏决策（属 T8）。

## 交付物

| 文件 | 操作 | 说明 |
| --- | --- | --- |
| `src/storage/index.js` | 修改 | WorkspaceRecord 增加 `base_ref` 字段 |
| `src/worktree/isolation-governance.js` | **新增** | 核心模块：绑定登记、状态更新、查询、合并前检查 |
| `src/worktree/isolation-governance.verify.js` | **新增** | 44 项验证 |
| `src/index.js` | 修改 | 新增 T10 导出 |

## API 设计

### registerWorkspace(persistence, input) → WorkspaceRecord

登记任务隔离工作区，创建 task→branch/worktree 绑定记录：
- 必填：`task_id`、`agent`、`branch`
- 可选：`worktree_path`（自动推导 `clowder-ai-<task>`）、`base_ref`、`changed_files`、`merge_order`
- 同一 branch 重复绑定拒绝（需先清理旧绑定）
- 返回结构化克隆

### updateWorkspaceStatus(persistence, wsId, updates) → WorkspaceRecord

更新工作区状态字段，白名单控制：
- 允许更新：`conflict_status`、`cleanup_status`、`changed_files`、`merge_order`
- 禁止修改绑定身份字段（`agent`、`task_id`、`branch`、`worktree_path`、`base_ref`）
- 非法 `conflict_status` / `cleanup_status` 拒绝

### 查询 API

| 函数 | 返回值 |
| --- | --- |
| `getWorkspaceByTask(p, taskId)` | WorkspaceRecord[] |
| `getWorkspaceByBranch(p, branch)` | WorkspaceRecord \| null |
| `getActiveWorkspaces(p)` | WorkspaceRecord[]（cleanup_status=active） |
| `getConflictingWorkspaces(p)` | WorkspaceRecord[]（conflict_status≠clean） |

### preMergeCheck(persistence, branch) → { pass, reasons, workspace }

合并前最小检查（按顺序，首个失败即返回）：
1. 分支是否存在 WorkspaceRecord 绑定
2. `cleanup_status` 必须为 `active`
3. `conflict_status` 必须为 `clean` 或 `resolved`

## 与 T3/T7/T8/T11 的关系

| 模块 | 关系 |
| --- | --- |
| T3 | 复用 WorkspaceRecord Store 和工厂；新增 `base_ref` 字段向后兼容 |
| T7 | 查询 task_id 关联的工作区（T7 拆解的任务→T10 绑定的工作区） |
| T8 | T10 提供数据和 `preMergeCheck`；T8 负责决定"是否允许" |
| T11 | T11 调用 T10 的 `preMergeCheck` 作为交付前检查的一部分 |

## 验证结果

```
node src/worktree/isolation-governance.verify.js  → 44/44 通过
npm run check                                      → 31 JavaScript files OK
npm test                                           → work-item-entry + agent-cli-adapter 通过
```

### 验证覆盖

- registerWorkspace：完整字段 / 最小字段 / 自动路径推导 / base_ref 记录 / 重复拒绝 / 无效 persistence / 必填校验
- 数据隔离：structuredClone 验证
- updateWorkspaceStatus：冲突状态 / 清理状态 / changed_files / merge_order / 非法值拒绝 / 白名单控制 / 不存在 ID
- 查询：按 task / branch / active / conflicting
- preMergeCheck：通过（clean+active、resolved+active）/ 失败（无绑定、file_conflict、semantic_conflict_risk、cleaned）/ 边界（无效 persistence、空 branch）
- 常量：WS_CLEANUP_STATUSES 枚举和冻结

## Codex Review 后修复

Codex 非作者 Review（[49-t10-review-by-codex.md](49-t10-review-by-codex.md)）发现两项 P1 问题，均已修复并通过复核：

### P1-1：分支复用后 `getWorkspaceByBranch` 命中归档记录

- **问题**：branch 归档→重新绑定后，`getWorkspaceByBranch` 返回旧归档记录，导致 `preMergeCheck` 误判失败
- **修复**：`getWorkspaceByBranch` 优先返回 `cleanup_status === "active"` 的记录；无活跃记录时回退到最新历史记录
- **验证**：新增 2 项测试（查询 + preMergeCheck 场景），44/44 通过

### P1-2：默认 `worktree_path` 推导到仓库内部

- **问题**：`path.dirname` 层级少一级，推导结果在仓库根目录下（如 `clowder-ai-t10/clowder-ai-t8`）而非约定的同级目录（`C:\aiWorkspace\clowder-ai-t8`）
- **修复**：`path.dirname` 由 2 层改为 3 层，从仓库父目录推导
- **验证**：worktree_path 测试从"包含 clowder-ai-t8"提升为"恰好包含一个 clowder-ai-t<N>"，确保不在仓库内部嵌套

## 未完成内容

无。T10 范围内全部完成。

范围外（明确不属于 T10）：
- 完整自动合并（属 T11）
- Git 操作或 feature 分支推送（属 T11）
- Harness 护栏决策（属 T8）
- 页面视图

## 是否解除依赖

是。T10 通过后解除 T11 对 T10 的依赖。

## 是否阻断后续任务

否。

## 遗留风险

无。
