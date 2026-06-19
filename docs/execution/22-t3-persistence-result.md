# T3 逻辑模型与本地持久化结果

> 状态：通过（三轮非作者 Review 已通过）
> 所属：执行
> 规则效力：T3 交付记录
> 维护角色：系统架构师
> 执行 Agent：Claude
> 任务 ID：T3

本文记录 `T3 逻辑模型与本地持久化` 的实现结果，用于 Codex 非作者 Review，并为 T5（状态机）、T6（A2A 事件编排）、T9（Review 与门禁记录）提供持久化基础。

## 总体结论

T3 已实现 8 个逻辑模型的本地 JSON 持久化，覆盖架构设计中定义的全部数据实体。

当前实现支持：

- WorkItem、Task、A2AEvent、ReviewRecord、QualityGateRun、WorkspaceRecord、EscalationRecord、RetrospectiveMemory 的 CRUD 操作。
- 原子写入（先写 `.tmp` 再 `rename`）防止崩溃损坏数据。
- 惰性缓存 + 磁盘同步，支持重启后数据保留。
- 显式 UTF-8 编码，中文内容往返无损。
- 必填字段校验、类型枚举校验、Review 防自审拦截。
- 42 项自动化验证全部通过。

## 交付物

| 文件 | 说明 |
| --- | --- |
| `src/index.js` | 公共入口，导出 16 个符号（8 Store + 8 工厂）和全部常量枚举 |
| `src/storage/store.js` | 通用 JSON 文件 CRUD Store 类：create / read / update / delete / list / count |
| `src/storage/index.js` | 8 个模型工厂函数（校验 → 默认值 → 创建）+ 8 个 Store 实例 + 常量枚举 |
| `src/storage/__verify.js` | 26 项自动化验证脚本，覆盖 CRUD、重启持久化、中文 UTF-8、约束校验 |

## 架构决策

### 持久化策略：单文件每模型

```
data/
├── .gitkeep                  # 目录占位（Git 跟踪）
├── work-items.json           # WorkItem 记录数组
├── tasks.json                # Task 记录数组
├── a2a-events.json           # A2AEvent 记录数组
├── review-records.json       # ReviewRecord 记录数组
├── quality-gate-runs.json    # QualityGateRun 记录数组
├── workspace-records.json    # WorkspaceRecord 记录数组
├── escalation-records.json   # EscalationRecord 记录数组
└── retrospective-memories.json # RetrospectiveMemory 记录数组
```

选择单文件每模型而非单文件每记录的理由：

- 首版数据量小（单用户、单项目），单文件加载成本可控。
- 跨记录查询（如"某 WorkItem 下的全部 Task"）无需扫描目录。
- 原子写入保护整个模型的数据一致性。
- 实现简单，符合"不过早设计成复杂数据库"的约束。

### 分层设计

```
模型工厂层 (src/storage/index.js)
  ├── 校验: 必填字段、类型枚举、业务规则（防自审）
  ├── 默认值: 基于架构设计字段填充
  └── 委托: 调用 Store.create()
  
存储层 (src/storage/store.js)
  ├── 读写: JSON 序列化 / 反序列化
  ├── 缓存: 惰性加载，减少磁盘 I/O
  ├── 原子写入: .tmp → rename
  └── 编码: 显式 UTF-8
```

模型工厂层负责业务规则（什么数据合法），存储层只负责 I/O（怎么读写磁盘）。两层可独立替换。

## 8 个模型覆盖情况

| 模型 | 架构字段数 | 已实现 | 必填校验 | 枚举校验 | 业务规则 |
| --- | --- | --- | --- | --- | --- |
| WorkItem | 16 | 16 | goal | type/status | — |
| Task | 12 | 12 | work_item_id, owner_agent | status | — |
| A2AEvent | 12 | 12 | from/to, work_item_id, purpose | purpose (12 种) | — |
| ReviewRecord | 10 | 10 | work_item_id, author, reviewer | result (4 种) | 防自审 |
| QualityGateRun | 7 | 7 | work_item_id, gate_name | final_status (4 种) | — |
| WorkspaceRecord | 8 | 8 | agent, task_id, branch | conflict_status (4 种) | — |
| EscalationRecord | 7 | 7 | work_item_id, what_happened | — | — |
| RetrospectiveMemory | 8 | 8 | work_item_id | — | — |

字段定义来源：`docs/architecture/14-system-architecture-design.md` §数据与状态模型。

## 验证结果

```
T3 持久化模块验证（生产工厂）

── Store 基础 CRUD ──            10 通过
── 重启持久化 ──                   1 通过
── 可变引用隔离回归测试 ──         6 通过
── WorkItem ──                    5 通过
── Task ──                        2 通过
── A2AEvent ──                    1 通过
── ReviewRecord ──                3 通过
── QualityGateRun ──              1 通过
── WorkspaceRecord ──             1 通过
── EscalationRecord ──            1 通过
── RetrospectiveMemory ──         1 通过
── UTF-8 中文读写 ──              1 通过
── 文件落盘验证 ──                9 通过（8 模型 JSON + 目录）
──────────────────────────────────────
结果: 42 通过, 0 失败, 42 总计
```

运行方式：`node src/storage/__verify.js`

## 验收标准对照

| 标准（来自 15-implementation-plan.md T3） | 状态 | 证据 |
| --- | --- | --- |
| 能创建、读取、更新核心记录 | ✅ | 42 项验证全部通过，覆盖全部 8 个模型 |
| 数据可重启后保留 | ✅ | Store 缓存失效→重读测试通过 |
| Store 全部 I/O 边界不可变（防绕过 update） | ✅ | 6 项回归测试：返回值、filter 回调、create input、update patch 全路径隔离 |
| UTF-8 中文读写正确 | ✅ | 中文 Markdown 内容往返测试通过 |
| 不设计成复杂数据库 schema | ✅ | 零依赖，纯 JSON 文件 |
| 持久化路径 `data/` | ✅ | 已在 T1 中创建 `data/.gitkeep`，T3 写入同目录 |

## 已知问题：与 T2 的架构重叠

Codex 在 T2 中独立实现了 `src/work-items/create-work-item.js`，采用**单文件每记录**策略（`data/work-items/wi-xxx.json`），与 T3 的**单文件每模型**策略不同。双方都定义了 `createWorkItem`，字段和语义有重叠但不完全一致。

| 维度 | T2（Codex） | T3（Claude） |
| --- | --- | --- |
| 存储粒度 | 每 WorkItem 一个文件 | 每模型类型一个文件 |
| 存储路径 | `data/work-items/wi-xxx.json` | `data/work-items.json` |
| 字段集合 | 面向录入：raw_request, title, type, type_detection | 面向全生命周期：goal, scope, solution, tasks, review_status 等 |
| schema_version | 有（metadata.schema_version） | 无（字段即 schema） |

建议在交叉 Review 阶段（Codex Review T3）统一路径，方案：

1. **T2 录入层**负责接收用户输入，呼叫 T3 的 `createWorkItem()` 落盘。
2. **T3 存储层**作为唯一的持久化出口，T2 不再直接写文件。
3. T2 特有的字段（如 `type_detection.matched_keywords`）可合并到 WorkItem 模型定义中。

该问题不应阻塞 T3 独立验收，因为 T3 的验收标准是"核心记录可 CRUD + 重启后保留"，不依赖 T2 的录入路径。

## 阻塞项清单

无硬阻塞项。T3 已通过非作者 Agent（Codex）Review。

## 可降级处理项

- 与 T2 的架构重叠：T5 前统一 T2 录入 + T3 持久化出口。
- 查询能力：当前仅支持 `list(filterFn)` 内存过滤，未实现索引或复杂查询。首版数据量小，可接受。
- 并发写入：当前无锁保护，但在单用户、单 Agent 串行执行模式下风险极低。
- T3 执行未使用独立 worktree：零阶段人工协作下的治理偏差，后续并行任务必须建立 branch/worktree 绑定。

## 非作者 Review 后修正

Codex 已完成三轮 T3 非作者 Review。

### 第一轮修正

- **type 枚举对齐**：`WORK_ITEM_TYPES` 从 `["feature", "bug"]` 调整为 `["feature", "bug_fix"]`。
- **生产工厂复用**：`__verify.js` 通过 `createPersistence(dataDir)` 使用生产工厂。
- **T2/T3 持久化出口统一**：记录为 T5 前集成任务。

### 第二轮修正（Codex 复核发现：返回值引用泄露）

- `read()` / `list()` / `create()` / `update()` 全部改为返回 `structuredClone` 深拷贝。
- 新增 3 项可变引用隔离回归测试（read、save 隔离、list 返回）。

### 第三轮修正（Codex 二次复核发现：输入/回调引用泄露）

- `list(filterFn)` — 过滤回调传入深拷贝，防止回调内部修改参数污染缓存。
- `create(data)` — 输入 data 深拷贝后再构造记录，防止调用方后续修改 input 对象。
- `update(id, patch)` — patch 深拷贝后再合并，防止调用方后续修改 patch 对象。
- 新增 3 项回归测试（filter 回调、create input、update patch）。

验证结果更新：
- `npm run check` — 12 文件通过
- `npm test` — T2 测试通过
- `node src/storage/__verify.js` — 42 通过（含 6 可变引用回归测试）
- Codex 复现场景验证：filter 回调 / create 输入 / update patch 全 PASS

## 是否建议进入下一阶段

非作者 Agent Review 已通过（三轮修正完成）。T3 门禁放行，可作为 T5/T6/T7/T9/T10/T14 的持久化基线。

## 补充：页面查询视角验证

P0-14/P0-15/P0-16 批准后，产品负责人要求 T3 证明能支撑页面读取。详见 [27-t3-page-query-verification.md](27-t3-page-query-verification.md)。

结论：T3 现有 API（`read` / `list(filter)` / `update`）零修改支撑全部 5 个页面视图的数据读写。15 项页面查询验证全部通过。最近关键结论由页面/应用服务层聚合（符合架构要求）。

## 任务启动包补充（补录）

> 本段为治理补录，依据 `docs/collaboration/13-task-start-package-template.md` 事后补写 T3 任务启动上下文。T3 执行时该模板尚未产出，以下字段基于实际执行事实回溯，而非前置计划。

### 1. 基本信息

| 字段 | 值 |
|---|---|
| 任务 ID | T3 |
| 任务类型 | 功能需求 |
| 当前身份 | Claude（Clowder Claude \<claude@clowder.local\>） |
| 任务来源 | `docs/execution/15-implementation-plan.md` §T3 |
| 关联工作项 | P0-14 / P0-15 / P0-16（后期追加，原始 T3 启动时尚未批准） |
| 优先级 | P0 |

### 2. 目标与边界

**任务目标**：实现 8 个逻辑模型的本地 JSON 持久化，覆盖架构设计中 WorkItem、Task、A2AEvent、ReviewRecord、QualityGateRun、WorkspaceRecord、EscalationRecord、RetrospectiveMemory 的全部 CRUD 操作，为 T5/T6/T7/T9/T10/T14 提供持久化基础。

**范围内事项**：
- 8 个模型的 Store CRUD（create / read / update / delete / list / count）。
- 8 个模型工厂函数（校验 → 默认值 → 创建）。
- 原子写入（`.tmp` → `rename`）。
- 惰性缓存 + `_invalidate()` 支持重启持久化。
- 必填字段校验、类型枚举校验、业务规则校验（Review 防自审）。
- 显式 UTF-8 编码。
- `createPersistence(dataDir)` 支持测试/生产目录分离。
- 自动验证脚本（42 项）。
- 页面查询视角证明（P0-14/15/16 批准后追加）。

**范围外事项**：
- 完整数据库 schema 设计、索引、迁移系统。
- 并发锁、事务、连接池。
- T4 Agent CLI 适配。
- T5 状态机。
- T6 A2A 事件编排。
- T13 完整页面主界面。
- 页面专用查询逻辑沉入 Store 层。

**交付物**：
- `src/storage/store.js` — 通用 JSON CRUD Store。
- `src/storage/index.js` — 8 模型工厂 + Store 实例 + 常量枚举。
- `src/index.js` — 公共入口（16 符号 + createPersistence + 常量）。
- `src/storage/__verify.js` — 42 项自动化验证。
- `src/storage/__page_query_verify.js` — 15 项页面查询验证。
- `docs/execution/22-t3-persistence-result.md` — 本文档。
- `docs/execution/27-t3-page-query-verification.md` — 页面查询验证记录。

**完成标准**：
- 8 个模型全部具备 CRUD 操作。
- 重启后数据可保留。
- 必填字段、类型枚举、业务规则校验生效。
- UTF-8 中文往返无损。
- 验证全部通过。
- 非作者 Review（Codex）通过。
- 页面查询视角证明成立（P0-14/15/16 后追加）。

### 3. 上下文与必读材料

**必读文档**：
- `docs/00-index.md`
- `docs/product/01-prd.md`
- `docs/architecture/14-system-architecture-design.md`（数据与状态模型部分）
- `docs/execution/15-implementation-plan.md`
- `docs/agents/06-agent-claude.md`
- `AGENTS.md`

**P0-14/15/16 批准后追加必读**：
- `docs/product/14-page-user-participation-proposal.md`
- `docs/product/15-page-change-implementation-clarifications.md`
- `docs/architecture/16-page-change-architecture-clarifications.md`

**依赖任务**：
- T1 基线确认已完成。
- T2 CLI 录入已完成（T3 启动时 T2 尚未统一持久化出口）。

**已知变更影响**：
- P0-14/15/16 在 T3 执行中期批准，要求 T3 证明页面查询视角成立（不强制改代码）。已通过 27 号文档和 `__page_query_verify.js` 响应。

**默认假设**：
- 首版为单用户、单项目，数据量小，单文件每模型方案可接受。
- 单 Agent 串行执行，无并发写入风险。
- T2/T3 持久化出口统一将在 T5 前完成，不阻塞 T3 独立验收。

### 4. 分工与协作

| 字段 | 值 |
|---|---|
| 主执行 Agent | Claude |
| 协作 Agent | 无（串行执行，无并行协作需求） |
| Review 方 | Codex |
| A2A 协作要求 | 非作者 Review（三轮，由 Codex 执行） |
| MiniMax 参与要求 | 不适用（T3 为纯持久化模块，无 UI/视觉/交互内容） |

### 5. 执行约束

| 字段 | 值 |
|---|---|
| 允许动作级别 | 文件修改、检查执行、提交准备、feature 分支推送 |
| 禁止事项 | 不得设计成复杂数据库 schema；不得引入外部依赖；不得修改与 T3 无关的文件；不得部署；不得合并主干；不得绕过非作者 Review |
| 文件/模块边界 | `src/storage/store.js`、`src/storage/index.js`、`src/index.js`、`src/storage/__verify.js`、`src/storage/__page_query_verify.js`。不得修改 T2 代码或 `bin/`、`public/`、`src/server/` 目录。 |
| 维护性注释要求 | 对非显而易见的逻辑（缓存失效、原子写入、深拷贝隔离）补充注释；不要求逐行注释。 |
| Git 身份要求 | `Clowder Claude <claude@clowder.local>` |
| worktree / 分支要求 | 应为独立 worktree 或分支。实际执行中未创建（见下方偏离说明）。 |
| 高风险动作限制 | 无部署、无合并主干、无破坏性文件操作。 |

### 6. 验收与门禁

| 字段 | 值 |
|---|---|
| 验收标准 | 8 模型 CRUD 可用；重启持久化通过；字段校验生效；UTF-8 往返无误；验证全绿；非作者 Review 通过 |
| 验证方式 | `node src/storage/__verify.js`（42 项）；`node src/storage/__page_query_verify.js`（15 项）；`npm run check`；Codex 复现场景验证 |
| Review 通过标准 | 非作者 Agent（Codex）确认：CRUD 正确、引用隔离无泄露、类型枚举对齐、测试覆盖充分 |
| 质量门禁 | 42 项验证零失败；语法检查通过；非作者 Review 三轮全部修正完成 |
| 失败处理 | 任何验证失败 → 定位根因 → 修正 → 重跑全量验证；Review 反馈 → 修复 → 重新提交 Review |

### 7. 人工升级条件

以下情况升级给产品负责人或系统架构师：
- 发现架构设计中模型字段与产品需求冲突。
- Store 设计无法支撑后续任务（T5/T6/T7）的读写需求。
- 需要引入外部数据库依赖。
- P0-14/15/16 要求 T3 改代码但产品侧明确不强制。

### 8. 输出记录

- **实际完成内容**：8 模型 Store + 工厂 + 42 项验证 + 15 项页面查询验证。三轮 Codex Review 修正完成。
- **未完成内容**：T2/T3 持久化出口统一（已识别为 T5 前集成任务，后续由 T2 修订完成）。
- **修改过的文件**：`src/storage/store.js`、`src/storage/index.js`、`src/index.js`、`src/storage/__verify.js`、`src/storage/__page_query_verify.js`、`docs/execution/22-t3-persistence-result.md`、`docs/execution/24-t3-review-by-codex.md`、`docs/execution/27-t3-page-query-verification.md`、`docs/execution/25-change-impact-assessment-p0-14-16.md`。
- **验证结果**：`npm run check` 通过；42 项持久化验证通过；15 项页面查询验证通过；Codex 复现场景全 PASS。
- **Review 结论**：通过（三轮 Review，Codex）。
- **偏离项**：
  - worktree 未创建：T3 在 Codex 的 `feature/t2-work-item-entry` 分支上直接执行，未建立独立分支/worktree。原因是零阶段人工串行协作中，T2 和 T3 实际由用户协调串行执行。已记录为治理偏差（见 `memory/worktree-governance-deviation.md`），后续并行任务必须纠正。
  - 任务启动包缺失：T3 执行时 13 号模板尚未产出，未按标准格式生成启动包。本段为事后补录。
  - P0-14/15/16 中途批准：T3 原始范围不包含页面查询证明。产品侧要求后，在不变更代码的前提下追加了 27 号文档和 `__page_query_verify.js`。
  - "页面录入推迟到 T13" 建议被产品否决：Claude 在 25 号变更评估中的相关建议未被采纳（见 `docs/execution/25-change-impact-assessment-p0-14-16.md` §5）。不影响 T3 最终交付，但作为跨任务决策记录。
- **建议下一状态**：T3 已完成并通过 Review，关闭；交接给 T5 启动前 WorkItem 单一事实来源确认。
- **是否解除依赖**：是。T3 持久化模块已就绪，T5/T6/T7/T9/T10/T14 可直接依赖。
- **是否阻断后续任务**：否。T3 不阻断任何后续任务。T2/T3 持久化统一已在 T2 修订中完成（见 21/28 号文档）。
- **是否触发 Review / 质量门禁 / 人工确认 / 复盘**：非作者 Review 已触发并完成（Codex，三轮）。质量门禁通过（42 验证 + 15 页面查询验证）。无人工确认或复盘触发。
- **后续阻断关系**：T5 启动前需确认 WorkItem 事实来源已统一（当前 T2 修订已解决，见 A6）。
- **遗留风险**：无。
- **是否需要产品负责人或系统架构师确认**：否。T3 交付已通过 Codex Review，产品侧认可的页面查询证明已输出。
