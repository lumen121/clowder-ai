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
- 26 项自动化验证全部通过。

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

Codex 已完成两轮 T3 非作者 Review。

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

非作者 Agent Review 已通过（两轮修正完成）。T3 门禁放行，可作为 T5/T6/T7/T9/T10/T14 的持久化基线。
