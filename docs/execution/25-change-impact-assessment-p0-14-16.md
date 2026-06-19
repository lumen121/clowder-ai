# P0-14/P0-15/P0-16 变更影响评估

> 状态：评估完成（产品裁决后已更新，原待确认项已闭环）
> 所属：执行
> 规则效力：变更影响评估记录；第五节为产品裁决后追加，覆盖原建议
> 维护角色：Claude（T3 执行 Agent）
> 评估日期：2026-06-19
> 更新日期：2026-06-19（追加产品裁决后状态）
> 变更来源：`docs/product/14-page-user-participation-proposal.md`（已批准）
> 触发需求：P0-14 / P0-15 / P0-16

---

## 一、变更摘要

产品负责人批准了三个新 P0 需求，核心变化：

- **页面成为首版主入口**。CLI 降级为零阶段/内部入口。
- 首版必须提供 5 个页面/视图能力：工作项录入、统一聊天室与时间线、工作项详情、阻塞与人工确认、Review/门禁/复盘。
- T2（CLI 录入）和 T3（持久化）部分回溯，T13（时间线 UI）重定范围。

---

## 二、按五类逐项评估

### 保留（无需修改）

| # | 保留项 | 涉及产物 | 理由 |
|---|---|---|---|
| 1 | T3 全部 8 个模型 Store 和工厂函数 | `src/storage/store.js`, `src/storage/index.js` | P0-15 页面详情需要展示 WorkItem/Task 字段（目标、范围、负责人、依赖、Review 方、当前状态），P0-16 需要 ReviewRecord/QualityGateRun/RetrospectiveMemory 的查询读取——当前模型字段完全覆盖这些需求 |
| 2 | Store CRUD API 签名 | `read(id)`, `list(filter)`, `create()`, `update()` | 页面查询模式：按 work_item_id 过滤 Tasks/A2AEvents/Reviews → `list(r => r.work_item_id === wiId)` 直接支持 |
| 3 | 深拷贝隔离策略 | `_copy()` 五处调用点 | 页面渲染不会意外污染持久化数据 |
| 4 | `createPersistence(dataDir)` | `src/storage/index.js` | 页面渲染层可注入测试 dataDir，不依赖文件系统全局状态 |
| 5 | UTF-8 和原子写入 | `store.js` | 页面展示中文内容无编码风险 |
| 6 | T2 类型识别和 CLI 录入逻辑 | `src/work-items/create-work-item.js` | P0-14 明确"CLI 可以作为零阶段或内部入口保留"，代码本身无需删除或回退 |
| 7 | T3 42 项验证脚本 | `src/storage/__verify.js` | 全部通过，无回归 |
| 8 | WORK_ITEM_TYPES 枚举 | `["feature", "bug_fix"]` | 无变更 |

**结论**：T3 持久化模块（全部 4 个源文件）无需修改，直接可用。

---

### 补齐（需要新增，但不改动已有代码）

| # | 补齐项 | 涉及任务 | 说明 |
|---|---|---|---|
| 1 | 页面级工作项录入入口 | T2 补充 / 或新任务 | P0-14 要求"用户可以通过页面提交工作项"。当前 T2 仅有 CLI 入口（`bin/clowder-work-item.js`）。需新增页面录入能力，底层可复用 T3 `createWorkItem()` |
| 2 | 统一聊天室/时间线页面 | T13 重定 | P0-14 要求展示用户消息、Agent 消息、A2A 交互、决策、状态变化、Review/门禁/复盘结果。当前 T3 的 A2AEvent Store 可提供结构化事件数据源，但缺少页面渲染层 |
| 3 | 工作项详情视图 | T13 重定 | P0-15 要求展示目标、范围、任务拆解、当前阶段、阻塞项、待确认项、最近一次关键结论。T3 的 WorkItem/Task/EscalationRecord Store 可提供全部数据，但缺少"最近一次关键结论"聚合查询 |
| 4 | 阻塞与人工确认视图 | T13 重定 | P0-14/P0-15 要求用户可在页面完成歧义/分歧/风险确认。T3 的 EscalationRecord Store 支持读写升级记录，但缺少页面交互层 |
| 5 | Review/门禁/复盘查看页面 | T13 重定 | P0-16 要求页面展示 Review 结果、门禁结果、失败原因、复盘结论。T3 的三个对应 Store 已就绪，缺少渲染层 |
| 6 | CLI 入口定位更新 | T2 文档 | T2 交付文档（21-t2-work-item-entry-result.md）当前将 CLI 描述为"工作项录入 CLI"，需补充说明 CLI 为零阶段/内部入口，页面为主入口 |
| 7 | `list()` 排序能力 | T3 可选补齐 | 页面时间线需要按时间排序。当前 `list(filter)` 返回数组但不保证顺序。Store 内部以创建顺序存储，天然有序，但 `filter()` 后顺序不变。如需显式排序，调用方自己做 `sort()` 即可——当前无需改动 Store |

**结论**：补齐工作集中在 T13（页面实现），T3 只需在"最近一次关键结论"聚合查询上评估是否需要新增便捷方法。

---

### 回退（需要修改或删除已有产物）

| # | 回退项 | 涉及产物 | 说明 |
|---|---|---|---|
| 1 | T2 交付文档中"CLI 是唯一入口"的隐含表述 | `docs/execution/21-t2-work-item-entry-result.md` | 文档说"用户通过 CLI 输入原始请求"（第 18 行），未提及页面入口。需追加说明：CLI 保留为零阶段/内部入口，页面是首版主入口 |
| 2 | T16 端到端验收范围 | `docs/execution/15-implementation-plan.md` T16 | P0-14 明确"端到端验收必须覆盖页面参与，而不能只验证 CLI 闭环"。T16 需要调整验收条件 |

**结论**：无代码回退。仅文档调整。

---

### 阻塞（当前无法推进）

| # | 阻塞项 | 原因 | 解除条件 |
|---|---|---|---|
| — | **无** | — | — |

当前无阻塞项。T3 持久化模块可以直接支撑页面所需的数据读写，不存在技术障碍。

---

### 需要确认（产品负责人决策）

| # | 确认项 | 上下文 | 建议 |
|---|---|---|---|
| 1 | T13 重定后的范围边界 | P0-14 说"首版至少需要 5 个页面/视图能力"，但未定义是否合并为单页还是多页。T13 原范围是"统一时间线最小 UI"，新范围显著扩大 | 建议由系统架构师更新 T13 任务定义，明确页面数量和路由 |
| 2 | T2 是否需要在当前阶段就补充页面录入 | P0-14 说 T2 "部分回溯，CLI 结果保留但需补充页面录入入口"。当前 T2 已通过 Review，是否立即回补还是留给 T13？ | 建议页面录入作为 T13 的一部分实现，T2 仅追加文档说明 |
| 3 | "最近一次关键结论"的语义定义 | P0-15 要求展示"最近一次关键结论"。是指最近一次 A2A 的 conclusion 字段？最近一次 Review 结果？还是两者都需要？ | 建议产品负责人明确"关键结论"的数据来源 |
| 4 | MiniMax 在页面实现中的角色 | P0-14/P0-15/P0-16 涉及 UI 和交互体验，按规则 MiniMax 必须参与方案或 Review。但 T13 原计划中 MiniMax 仅为协作方 | 建议明确 MiniMax 在 T13 中的参与程度 |

---

## 三、T3 持久化对页面需求的数据支撑分析

以下是 5 个页面视图所需数据与 T3 Store 的映射：

| 页面视图 | 所需数据 | T3 支撑 Store | 状态 |
|---|---|---|---|
| 工作项录入 | 创建 WorkItem | `createWorkItem()` | ✅ |
| 统一聊天室/时间线 | WorkItem + A2AEvent + 状态变化 | `workItemStore.read()` + `a2aEventStore.list(filter)` | ✅ |
| 工作项详情 | WorkItem 全部字段 + Tasks + 最近关键结论 | `workItemStore.read()` + `taskStore.list(filter)` + A2A/Review 最新记录 | ✅* |
| 阻塞与人工确认 | EscalationRecord 列表 + 用户决策回写 | `escalationRecordStore.list(filter)` + `update()` | ✅ |
| Review/门禁/复盘 | ReviewRecord + QualityGateRun + RetrospectiveMemory | 对应三个 Store 的 `list(filter)` | ✅ |

> *"最近一次关键结论"需要调用方执行 `a2aEventStore.list(r => r.work_item_id === wiId)` 后按 `created_at` 排序取最新。当前 API 已支持，无需修改 Store。如需便捷方法（如 `latestA2AEvent(workItemId)`），可在页面实现时补齐。

**结论：T3 持久化模块完整支撑 P0-14/P0-15/P0-16 的全部页面数据需求，无需任何代码修改。**

---

## 四、对已完成 Review 产物的影响

| 产物 | 状态 | 影响 |
|---|---|---|
| T1 基线确认 | ✅ 通过 | 无影响（P0-14 明确"不回溯"） |
| T2 CLI 录入 | ✅ 通过 | 文档需追加"CLI 为零阶段/内部入口"说明；代码不变 |
| T2 Review（23） | ✅ 通过 | Review 结论不受影响 |
| T3 持久化 | ✅ 通过 | 无代码变更；交付文档需追加本评估引用 |
| T3 Review（24） | ✅ 通过 | Review 结论不受影响 |

---

## 五、产品裁决后状态

> **本段于 2026-06-19 追加。产品负责人和系统架构师已对第四节的 4 项待确认做出裁决。以下标注哪些原评估建议已被否决或修正，后续 Agent 必须以裁决为准，不得沿用原建议。**

### 已被产品明确否决的原建议

| 原评估位置 | 原建议 | 产品裁决 | 影响 |
|---|---|---|---|
| 待确认 #2 | "页面录入作为 T13 的一部分实现，T2 仅追加文档说明" | **不采纳。** T2 必须回补最小页面录入入口，不能把页面录入全部推迟到 T13 | T2 需重做；本评估"补齐 #1"中"T2 补充 / 或新任务"的模糊表述失效，明确落点为 T2 修订 |
| 结论 #3 | "无阻塞项" | 原结论仅从 T3 视角得出。从项目全局看，T2 缺少页面录入入口 + T2/T3 持久化出口未统一构成 T5 前阻塞 | 本评估的"无阻塞项"判断仅对 T3 成立，不代表项目全局；详见 [15-page-change-implementation-clarifications.md](../product/15-page-change-implementation-clarifications.md) 和 [16-page-change-architecture-clarifications.md](../architecture/16-page-change-architecture-clarifications.md) |

### 已被产品/架构澄清的原待确认项

| 原待确认项 | 裁决结果 | 引用 |
|---|---|---|
| T13 范围边界 | 单页或多区域均可；必须覆盖 5 类能力；可拆 T13a/T13b | [16](../architecture/16-page-change-architecture-clarifications.md) §T13 页面形态 |
| "最近一次关键结论"语义 | 来自 A2AEvent/ReviewRecord/QualityGateRun/EscalationRecord/RetrospectiveMemory 的最近一条结构化结论；无结论时显示"待形成"；由页面查询层聚合，不改 Store | [15](../product/15-page-change-implementation-clarifications.md) §4, [16](../architecture/16-page-change-architecture-clarifications.md) §最近一次关键结论 |
| MiniMax 参与节奏 | T2 页面骨架可先由 Codex/Claude 完成；MiniMax 必须在 T13 或 T16 前参与页面体验 Review | [15](../product/15-page-change-implementation-clarifications.md) §6, [16](../architecture/16-page-change-architecture-clarifications.md) §MiniMax 参与节奏 |
| T2/T3 持久化出口 | 必须统一到 T3 单一事实来源，进入 T5 前完成；T2 页面入口和 CLI 内部入口都走同一出口 | [15](../product/15-page-change-implementation-clarifications.md) §3, [16](../architecture/16-page-change-architecture-clarifications.md) §T2/T3 持久化出口 |

### 原评估"补齐"表的修正

| 原补齐项 | 原落点 | 裁决后落点 |
|---|---|---|
| 页面级工作项录入入口 | "T2 补充 / 或新任务" | **T2 修订（必须）** |
| CLI 入口定位更新 | "T2 文档" | T2 文档 + CLI 改为内部入口 |

### 本文档的效力边界

本文档是评估时刻（产品澄清前）的快照。以下内容已被裁决覆盖，不再作为执行依据：

- 第四节"需要确认"中所有 4 项 → 以产品/架构澄清为准。
- 第五节原结论 #3 "无阻塞项" → 仅对 T3 成立；项目全局阻塞项见产品澄清和架构澄清。
- 补齐 #1 "T2 补充 / 或新任务" → 裁决为 **T2 必须回补**。

以下内容仍有效，且与产品/架构裁决一致：

- T3 持久化模块零代码修改。
- 8 个 Store 可支撑全部页面数据需求。
- 无代码回退。
- 补齐工作中心在 T13（完整页面主界面），但 T2 先补最小录入入口。

---

## 六、结论（裁决后更新）

1. **T3 持久化模块零修改**。当前 8 个 Store 和模型工厂可直接支撑页面所需的全部数据读写。产品负责人和架构师均已确认不强制 T3 改代码。
2. **无代码回退**。所有已完成代码保留。
3. **项目全局阻塞项**（非 T3 范围）：T2 必须回补最小页面录入入口；T2/T3 持久化出口必须在 T5 前统一到 T3 单一事实来源。
4. **T2 修订优先于 T13**。T2 先补页面录入 + 持久化统一，T13 再做完整页面主界面。
5. **MiniMax** 在 T2 页面骨架阶段可暂不参与，但 T13 或 T16 前必须参与页面体验 Review。
6. **T3 待办**：补 `metadata` 默认值 + 页面查询视角证明（两项均为轻量改动，不阻塞 T2/T5 推进）。
