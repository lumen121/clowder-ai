# T3 逻辑模型与本地持久化 — 非作者 Review 报告

> 状态：Review 通过（第三轮修正复核已完成）
> 所属：执行
> 规则效力：T3 门禁 Review 记录
> 维护角色：Codex（非作者 Review 方）
> Review 对象：Claude 输出的 `22-t3-persistence-result.md` 及关联代码
> 初审日期：2026-06-18
> 最终复核日期：2026-06-19

## 任务启动包补充

本节按 [13-task-start-package-template.md](../collaboration/13-task-start-package-template.md) 补齐 T3 非作者 Review 的启动上下文，作为 Review 任务追溯依据。

| 字段 | 内容 |
| --- | --- |
| 任务 ID | T3 Review |
| 任务类型 | Review / 门禁检查 |
| 当前身份 | Codex，T3 非作者 Review 方 |
| 任务来源 | T3 交付物、T3 修复复核请求、P0-14/P0-15/P0-16 页面变更澄清 |
| Review 对象 | Claude 输出的 [22-t3-persistence-result.md](22-t3-persistence-result.md)、T3 存储代码、验证脚本和页面查询视角补充记录 |
| 被 Review 方 | Claude，T3 产出作者 |
| Review 方 | Codex，非作者 Review 方 |
| 优先级 | P0 |
| MiniMax 参与要求 | T3 为持久化与查询能力 Review，不直接做 UI 体验判断；MiniMax 仍需在 T13 页面主界面或 T16 E2E 前参与页面体验 Review |

Review 目标：

- 判断 T3 是否具备作为后续 T5/T6/T9/T10/T14 的本地持久化基线。
- 判断 T3 是否支持核心模型的创建、读取、更新、删除、列表、计数、原子写入、重启后读取和 UTF-8 中文读写。
- 判断 T3 是否能支撑页面查询视角，尤其是工作项详情、时间线、阻塞/待确认、Review、门禁和复盘摘要。
- 复核前序 Review 发现是否已修复。

范围内事项：

- `src/storage/store.js` 的 Store I/O 行为。
- `src/storage/index.js` 的模型工厂、默认值、必填校验和枚举校验。
- `src/storage/__verify.js` 的生产工厂复用和回归验证。
- T3 页面查询视角验证记录。
- T3 与 T2 在 WorkItem 类型和持久化出口上的一致性风险。

范围外事项：

- 不重写 T3 实现。
- 不扩展为 T5 状态机、T6 A2A、T9 Review/门禁模块或 T14 复盘模块。
- 不实现 T13 页面主界面。
- 不以 Review 任务替代 Claude 对 T3 的作者修复职责。

必读文档：

- [15-implementation-plan.md](15-implementation-plan.md)
- [22-t3-persistence-result.md](22-t3-persistence-result.md)
- [27-t3-page-query-verification.md](27-t3-page-query-verification.md)
- [../product/14-page-user-participation-proposal.md](../product/14-page-user-participation-proposal.md)
- [../product/15-page-change-implementation-clarifications.md](../product/15-page-change-implementation-clarifications.md)
- [../architecture/16-page-change-architecture-clarifications.md](../architecture/16-page-change-architecture-clarifications.md)
- [../collaboration/13-task-start-package-template.md](../collaboration/13-task-start-package-template.md)

页面变更影响：

- T3 不强制实现页面层代码，但必须证明其 Store 与 `list(filter)` 能支撑页面读取。
- T3 的页面查询视角可以由页面层、应用服务层或查询投影聚合，不应把页面专用逻辑塞进底层 Store。
- T2/T3 WorkItem 持久化出口统一是 T5 启动前硬门槛。
- T3 页面查询能力必须覆盖工作项详情、时间线、阻塞/待确认、Review、门禁、复盘摘要和最近一次关键结论来源。

Review 验收标准：

- 核心记录模型可创建、读取、更新、删除、列表和计数。
- 数据可重启后保留。
- 8 个模型具备本地 JSON Store 和生产工厂。
- WorkItem 类型与 T2 对齐为 `feature` / `bug_fix`。
- 验证脚本复用生产工厂，不以内联重复逻辑冒充生产路径。
- Store 返回值、过滤回调、create 输入和 update patch 不泄露可变引用。
- UTF-8 中文读写通过。
- 页面查询视角验证成立。
- Review 结论明确为通过 / 不通过 / 需修改，并记录证据。

禁止事项：

- 不得把 T3 Review 扩展成重写实现。
- 不得把页面查询能力缺口推给 T13 而不记录风险。
- 不得忽略 T2/T3 双 WorkItem 来源风险。
- 不得由 Claude 自审 T3 作为唯一通过依据。

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

## 九、A2 轻量确认

确认结论：通过。

A2 要求的两部分证据已成立：

- `22-t3-persistence-result.md` 已补录 T3 任务启动上下文，覆盖身份、来源、目标、边界、依赖、A2A/Review、允许动作级别、Git 身份、worktree 要求、质量门禁、失败处理、页面变更影响、偏离项和后续状态。
- `27-t3-page-query-verification.md` 已证明 T3 现有 API 能支撑 5 个页面视图，并明确“最近一次关键结论”由页面/应用服务层聚合，不把页面专用逻辑下沉到 Store。

本次轻量复核重新执行结果如下：

```text
> npm run check
checked 16 JavaScript files

> npm test
work-item-entry tests passed

> node src/storage/__verify.js
结果: 42 通过, 0 失败, 42 总计

> node src/storage/__page_query_verify.js
结果: 15 通过, 0 失败, 15 总计
```

非阻塞说明：

- [22-t3-persistence-result.md](22-t3-persistence-result.md) 中仍保留少量历史表述，例如早期的 `26 项`、`两轮 Review`。
- [27-t3-page-query-verification.md](27-t3-page-query-verification.md) 的结果摘录仍写着 `checked 12 JavaScript files` 和 `14 通过`，与当前脚本实测 `checked 16 JavaScript files`、`15 通过` 不一致。

这些问题属于归档证据同步瑕疵，不影响 A2 “已补录启动上下文并证明页面查询视角”的成立；后续作者同步文档时应一并修正，避免后续 Agent 误读。
