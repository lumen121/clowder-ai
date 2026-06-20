# T10 非作者 Review（Codex）

> 状态：通过（复核）
> 所属：执行
> 规则效力：T10 非作者 Review 记录
> Review Agent：Codex
> 被 Review 任务：T10 Worktree 与任务隔离最小治理
> 日期：2026-06-20

## 结论

未通过，先修复再复核。

T10 的方向是对的：已经把 `WorkspaceRecord` 扩成了 task/branch/worktree 绑定、冲突状态和合并前最小检查，`npm run check`、`npm test`、`node src/worktree/isolation-governance.verify.js` 也都通过。

但当前实现里有两处会直接影响后续 T11/T16 使用的治理缺口：

1. 分支复用后，`preMergeCheck()` 可能命中历史归档记录而不是当前活跃记录。
2. 默认 `worktree_path` 推导到了仓库内子目录，而不是文档约定的同级 worktree 目录。

这两个问题都会让“任务到 worktree/branch 的隔离绑定”失真，不建议按通过处理。

## Review 范围

| 项 | 结果 |
| --- | --- |
| worktree | `C:\aiWorkspace\clowder-ai-t10` |
| branch | `claude/t10-worktree-isolation` |
| 启动包 | [45-t10-worktree-isolation-start-package.md](45-t10-worktree-isolation-start-package.md) |
| 结果文档 | [48-t10-worktree-isolation-result.md](48-t10-worktree-isolation-result.md) |
| 核心实现 | [src/worktree/isolation-governance.js](../../src/worktree/isolation-governance.js) |
| 验证脚本 | [src/worktree/isolation-governance.verify.js](../../src/worktree/isolation-governance.verify.js) |

## 验证命令

| 命令 | 结果 |
| --- | --- |
| `npm run check` | 通过 |
| `npm test` | 通过 |
| `node src/worktree/isolation-governance.verify.js` | 通过，`42 / 42` |

## 主要问题

### P1：分支复用后会选到历史记录，导致 `preMergeCheck()` 误判失败

证据：

- [src/worktree/isolation-governance.js](../../src/worktree/isolation-governance.js:236) 的 `getWorkspaceByBranch()` 仅按 `branch` 找第一条记录。
- [src/worktree/isolation-governance.js](../../src/worktree/isolation-governance.js:311) 的 `preMergeCheck()` 直接依赖这个查询结果。
- `registerWorkspace()` 只禁止“同一 branch 的活跃绑定重复创建”，并不禁止同一 branch 在归档后重新登记，这是合理场景。

复现场景摘要：

1. 创建 `feature/reused` 的第一条绑定。
2. 将该记录更新为 `cleanup_status = "archived"`。
3. 用同一 branch 再创建一条新的活跃绑定。
4. `getWorkspaceByBranch("feature/reused")` 返回的是旧归档记录。
5. `preMergeCheck("feature/reused")` 因读到 `archived` 而失败。

实际复现结果摘要：

```json
{
  "selected": { "cleanup_status": "archived" },
  "pass": false
}
```

风险：

- T11 交付前检查会把一个本来可交付的活跃分支判成失败。
- 历史记录一旦积累，branch 复用会越来越不可靠。
- 这和 T10 “每个 branch 至多一个活跃绑定”的设计目标不一致，问题不在登记，而在查询策略。

建议：

- `getWorkspaceByBranch()` 至少优先返回 `cleanup_status === "active"` 的记录；如无活跃记录，再决定是否返回最新历史记录或 `null`。
- `preMergeCheck()` 应明确只基于当前活跃绑定做判断。
- 补一条验证：同一 branch 归档后重建新绑定，`preMergeCheck()` 应命中新记录并通过。

### P1：默认 `worktree_path` 推导路径错误，记录到了仓库内部

证据：

- [src/worktree/isolation-governance.js](../../src/worktree/isolation-governance.js:121) 注释写的是 `<repo>/../clowder-ai-<task>`。
- 但实现使用 `path.resolve(path.dirname(path.dirname(__dirname)), ...)`，从当前文件位置计算后实际落点是仓库根目录下的子目录。
- 在当前 T10 worktree 中，自动推导结果实际为：

```text
C:\aiWorkspace\clowder-ai-t10\clowder-ai-t8
```

而不是文档约定的同级目录：

```text
C:\aiWorkspace\clowder-ai-t8
```

- [src/worktree/isolation-governance.verify.js](../../src/worktree/isolation-governance.verify.js:122) 只校验了路径中包含 `clowder-ai-t8`，没有校验目录层级，所以没拦住这个问题。

风险：

- T10 记录的 worktree 绑定路径与真实协作约定不一致。
- 后续 T11/T16 如果复用该字段做隔离校验、清理或展示，会指向错误位置。
- 文档和实现已经发生偏差，后续 Agent 容易误判“绑定记录可信”。

建议：

- 修正默认路径推导，使其与当前项目约定一致，记录到仓库同级目录。
- 将验证脚本从“包含任务名”提升为“完整路径层级正确”。
- 同步结果文档里的默认路径说明，避免继续传播错误约定。

## 非阻塞观察

- `updateWorkspaceStatus()` 当前只校验 `conflict_status` 和 `cleanup_status`，对 `changed_files` 元素类型和 `merge_order` 数值边界没有进一步限制。现阶段不阻塞 T10，但后续如果 T11/T16 要直接消费这些字段，建议补最小类型约束。

## 建议修复清单

1. 修复 `getWorkspaceByBranch()` / `preMergeCheck()` 对 branch 复用场景的记录选择逻辑。
2. 修复默认 `worktree_path` 推导路径。
3. 为上述两个场景补验证用例。
4. 修复后重跑 `npm run check`、`npm test`、`node src/worktree/isolation-governance.verify.js`。

## 最终判断

当前 T10 不建议通过。核心能力已基本成形，但“当前活跃绑定识别”和“默认 worktree 路径记录”这两处基础治理信息还不可靠，修复后再复核更合适。

## 第二轮复核记录

> 复核对象：Claude 对 T10 两项 P1 问题的修复
> 复核时间：2026-06-20
> 复核结论：通过。

### 修复确认

| 原问题 | 复核结论 | 证据 |
| --- | --- | --- |
| 分支复用后 `getWorkspaceByBranch()` 命中历史归档记录，导致 `preMergeCheck()` 误判 | 已修复 | `getWorkspaceByBranch()` 现在优先返回 `cleanup_status === "active"` 的记录；无活跃记录时才回退最新历史记录。验证新增 branch 归档后重新绑定场景。 |
| 默认 `worktree_path` 推导到仓库内部子目录 | 已修复 | 默认路径推导改为从仓库父目录生成 `clowder-ai-<task>`；验证从“包含任务名”提升为检查路径不发生仓库内嵌套。 |

### 复核验证命令

| 命令 | 结果 |
| --- | --- |
| `npm run check` | 通过，`checked 31 JavaScript files` |
| `npm test` | 通过，`work-item-entry tests passed`，`agent-cli-adapter tests passed` |
| `node src/worktree/isolation-governance.verify.js` | 通过，`44 / 44` |

### 最终复核判断

T10 通过 Codex 非作者 Review。原两项 P1 问题已闭合，T10 可解除 T11 对 worktree / branch 隔离治理的依赖。非阻塞观察仍可留给 T11/T16 按实际消费场景再加强字段类型约束，不阻塞 T10 关闭。
