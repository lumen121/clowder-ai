# T3 逻辑模型与本地持久化 — 非作者 Review 报告

> 状态：Review 通过（第三轮修正复核已完成）
> 所属：执行
> 规则效力：T3 门禁 Review 记录
> 维护角色：Codex（非作者 Review 方）
> Review 对象：Claude 输出的 `22-t3-persistence-result.md` 及关联代码
> 初审日期：2026-06-18
> 最终复核日期：2026-06-19

## 一、Review 结论

通过。

T3 的核心持久化能力成立：8 个逻辑模型均有本地 JSON Store，支持创建、读取、更新、删除、列表、计数、原子写入、重启后读取和 UTF-8 中文读写。前两轮 Review 发现的 WorkItem 类型不一致、验证脚本未复用生产工厂、Store 可变引用泄露问题均已修复。

本轮复核未发现新的 T3 阻塞项。T3 可以作为 T5/T6/T9/T10/T14 的持久化基线，但 T5 前仍必须完成 T2/T3 持久化出口统一。

## 二、复核验证结果

```text
> npm run check
checked 12 JavaScript files

> npm test
work-item-entry tests passed

> node src/storage/__verify.js
结果: 42 通过, 0 失败, 42 总计
```

补充引用隔离探测结果：

```json
{
  "readMutationPersisted": false,
  "listResultMutationPersisted": false,
  "filterMutationPersisted": false,
  "createReturnMutationPersisted": false,
  "updateReturnMutationPersisted": false,
  "createInputMutationPersisted": false,
  "updatePatchMutationPersisted": false
}
```

## 三、修正复核

### WorkItem 类型枚举

已通过。

- `WORK_ITEM_TYPES` 当前为 `["feature", "bug_fix"]`。
- `createWorkItem({ type: "bug_fix" })` 可创建。
- 旧枚举值 `bug` 会被拒绝。

### 生产工厂复用

已通过。

- `src/storage/__verify.js` 通过 `createPersistence(dataDir)` 注入测试目录。
- 验证脚本复用生产工厂，不再以内联重复逻辑作为主要验证路径。

### Store 可变引用隔离

已通过。

已确认以下路径均不会污染内部缓存或被意外持久化：

- 修改 `read()` 返回值。
- 修改 `list()` 返回值。
- 在 `list(filterFn)` 回调内修改入参。
- 修改 `create()` 返回值。
- 修改 `update()` 返回值。
- `create(data)` 后修改原始输入对象及其嵌套数组/对象。
- `update(id, patch)` 后修改原始 patch 及其嵌套数组/对象。

`src/storage/__verify.js` 已覆盖 6 项可变引用隔离回归测试。

## 四、验收标准评估

| 验收标准（来自 T3） | 判定 | 证据 |
| --- | --- | --- |
| 能创建、读取、更新核心记录 | 通过 | `node src/storage/__verify.js` 42 项通过，覆盖 Store CRUD 和 8 个模型。 |
| 数据可重启后保留 | 通过 | 验证脚本通过缓存失效后重读测试。 |
| 支持核心记录模型 | 通过 | 覆盖 WorkItem、Task、A2AEvent、ReviewRecord、QualityGateRun、WorkspaceRecord、EscalationRecord、RetrospectiveMemory。 |
| 数据可本地持久化到 `data/` | 通过 | Store 默认路径为 `data/<model>.json`。 |
| UTF-8 中文读写 | 通过 | 中文内容持久化后重读一致。 |
| Store I/O 边界不可变 | 通过 | 返回值、过滤回调、create 输入、update patch 的引用隔离探测均通过。 |

## 五、仍需跟进但不阻塞 T3

### T2/T3 持久化出口尚未统一

T2 当前写入：

```text
data/work-items/<id>.json
```

T3 当前写入：

```text
data/work-items.json
```

该问题不阻塞 T3 独立验收，但必须在 T5 前解决。建议 T2 保留录入和类型识别逻辑，T3 作为唯一持久化出口，T2 CLI 或后续页面入口调用 T3 的 `createWorkItem()` 或统一应用服务落盘。

### T3 执行未使用独立 worktree

从当前工作区状态看，T3 产物落在 `feature/t2-work-item-entry` 当前工作目录中，未看到 Claude/T3 使用独立 worktree 的证据。

判断：

- 这是零阶段人工协作下的治理偏差，不是 T3 代码逻辑缺陷。
- 后续并行任务必须建立明确的 branch/worktree 绑定，或明确降级为串行。

## 六、通过项

- Store 设计保持简单，符合首版单用户、单项目、本地 JSON 的约束。
- 原子写入采用 `.tmp` 后 `rename`，方向正确。
- Store 层负责 I/O，模型工厂负责校验，分层合理。
- Review 防自审拦截已在模型工厂层实现。
- `createPersistence(dataDir)` 支持验证和后续模块集成。
- 查询能力当前仅支持 `list(filterFn)` 可以接受，首版数据量小，不需要索引或数据库。

## 七、是否同意 T3 通过

同意 T3 通过。

T3 门禁可放行。进入 T5 前必须先处理 T2/T3 持久化出口统一，避免状态机面对两个 WorkItem 来源。

## 八、Review 元信息

- Review 方身份：Codex（非作者，符合 Review 独立性要求）
- Review 对象：Claude 的 T3 产出
- 覆盖规则：Claude 产出必须由 Codex 或 MiniMax Review
- Review 结论类型：通过
- 是否涉及 UI/视觉/多模态：否
