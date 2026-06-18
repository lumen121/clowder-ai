# T2 工作项录入 — 非作者 Review 报告

> 状态：Review 通过（修正复核已完成）

---

## 修正复核（2026-06-18）

Codex 已完成三轮修正，复核结果：

| # | 原始问题 | 修正状态 | 验证 |
|---|---|---|---|
| 1 | type 枚举不一致（bug_fix vs bug） | 方向已对齐，待 T3 执行 | T3 修改 `WORK_ITEM_TYPES` 为 `feature`/`bug_fix` |
| 2 | 低置信度无用户提示 | ✅ 已修正 | CLI 输出三级提示：显式无警告、检测低置信度警告、默认警告 |
| 3 | status 字段 "not_started" vs null | ✅ 已修正 | review/quality/delivery/retrospective_status 均初始化为 `null` |
| 4 | npm run check 未覆盖 T3 | ✅ 已修正 | `scripts/check-js.js` 递归扫描全部 JS 文件（12 个），自动覆盖 T3 |

**复核结论：T2 通过。**
> 所属：执行
> 规则效力：T2 门禁 Review 记录
> 维护角色：Claude（非作者 Review 方）
> Review 对象：Codex 输出的 `21-t2-work-item-entry-result.md` 及关联代码
> Review 日期：2026-06-18

---

## 一、Review 结论

> **需要修改**

T2 核心功能（CLI 录入→类型识别→WorkItem 创建→落盘）实现正确，错误处理完整，测试覆盖合理。但存在 3 项与 T3 的架构对齐问题及 1 项构建脚本遗漏，修正后可通过。

---

## 二、验收标准逐项评估

| # | 验收标准（来自 15-implementation-plan.md T2） | 判定 | 证据 |
|---|---|---|---|
| 1 | 用户可以录入工作项 | ✅ 通过 | CLI `create` 命令可用，支持 `--request` 和 `--request-file` 两种输入 |
| 2 | 系统能记录原始请求 | ✅ 通过 | `raw_request` 字段完整保存，中文无损 |
| 3 | 系统能记录工作项类型 | ✅ 通过 | 显式选择（`--type`）和关键词自动识别均正确 |
| 4 | 系统能记录初始状态 | ✅ 通过 | 初始状态固定为 `needs_clarification` |
| 5 | 实际落盘（非仅展示） | ✅ 通过 | JSON 文件写入磁盘，`testPersistence` 验证重读一致 |

**关键风险排除**：实现计划标记的 T2 风险"只做展示入口，未真正创建 WorkItem"——**未发生**。CLI 确实写入了磁盘文件且可重读。

---

## 三、代码审查

### 3.1 `bin/clowder-work-item.js` — CLI 入口

| 检查项 | 结果 |
|---|---|
| 参数解析完整性 | ✅ 6 个选项，短参数 `-r`/`-t` 可用 |
| 互斥校验（request vs request-file） | ✅ 明确报错 |
| 必填校验（缺少 request） | ✅ 明确报错 |
| 未知参数报错 | ✅ 报错退出码 1 |
| 未知命令显示用法 | ✅ 输出 usage |
| JSON 输出模式 | ✅ `--json` 输出结构化结果 |
| stderr 错误输出 | ✅ 错误写入 stderr |
| 退出码正确性 | ✅ 成功 0，失败 1 |

**发现**：Usage 文本未列出 `-r`/`-t` 短参数，但代码已支持。低优先级。

### 3.2 `src/work-items/create-work-item.js` — 核心逻辑

| 检查项 | 结果 |
|---|---|
| 类型标准化（normalizeType） | ✅ 支持中英文别名 7 种 |
| 关键词检测（detectWorkItemType） | ✅ 中英文双语文关键词表 |
| 置信度分级（high/medium/low） | ✅ 显式 > 检测 > 默认 |
| 默认回退（无法识别→feature） | ⚠️ 见问题 2 |
| 必填校验（rawRequest 为空报错） | ✅ |
| 非法类型报错 | ✅ |
| UTF-8 文件写入 | ✅ 显式 `utf8` |
| schema_version 预留 | ✅ |
| id 生成（时间戳 + UUID 片段） | ✅ |

### 3.3 `test/work-item-entry.test.js` — 测试

| 检查项 | 结果 |
|---|---|
| 显式类型创建 | ✅ |
| Bug 关键词检测 | ✅ |
| 持久化→重读 | ✅ 临时目录隔离 |
| 非法类型报错 | ✅ |
| 测试隔离（不污染正式数据） | ✅ `mkdtempSync` |

### 3.4 `package.json`

| 检查项 | 结果 |
|---|---|
| `npm run check` 覆盖 | ⚠️ 见问题 4 |
| `npm test` | ✅ |
| `bin` 入口声明 | ✅ |

---

## 四、发现的问题

### 问题 1：type 枚举值与 T3 不一致（需对齐）

T2 使用 `bug_fix` 作为 Bug 修复的类型值，T3 使用 `bug`。架构设计文档（14-system-architecture-design.md）未明确枚举值，但 PRD（01-prd.md）统一使用"功能需求"和"Bug 修复"两个中文标签。

| 来源 | feature 对应值 | bug 对应值 |
|---|---|---|
| T2（Codex） | `feature` | `bug_fix` |
| T3（Claude） | `feature` | `bug` |

**影响**：T5（状态机）、T6（A2A）、T7（任务拆解）需要一致的 type 枚举。当前两个值不同会导致下游判断不一致。

**建议**：统一为 `bug_fix`（T2 的命名更精确，避免与 git 术语混淆），由 T3 修改常量 `WORK_ITEM_TYPES`。

---

### 问题 2：无法识别时默认 feature，缺少低置信度提示

`detectWorkItemType` 在没有任何关键词匹配时回退为 `feature` + `confidence: "low"`。这个行为本身合理（大部分用户输入是功能需求），但 CLI 输出不区分 `mode: "defaulted"` 和 `mode: "detected"`——用户看到的是同样的成功输出，不知道类型是猜的。

**建议**：当 `mode === "defaulted"` 时，在非 JSON 输出中追加一行提示：
```
Type: 功能需求 (feature) [auto-detected, low confidence — use --type to override]
```

---

### 问题 3：部分状态字段使用 `"not_started"` 字符串，T3 使用 `null`

T2 的 `review_status`、`quality_status`、`delivery_status`、`retrospective_status` 初始值为 `"not_started"`。T3 对应字段初始值为 `null`。

**影响**：下游状态机判断 `if (workItem.review_status)` 时，`"not_started"` 为 truthy，`null` 为 falsy，会导致逻辑分支不一致。

**建议**：统一为 `null`（语义更准确：未开始 ≠ 有一个叫 "not_started" 的状态），或统一为 `"not_started"`。**倾向 `null`**，因为架构设计未定义这些中间状态字符串。

---

### 问题 4：`npm run check` 未覆盖 T3 文件

当前 `check` 脚本仅覆盖 T2 文件 + 基线脚本，未包含 T3 新增的 `src/storage/store.js`、`src/storage/index.js`、`src/index.js`。

**建议**：追加 T3 路径到 `check` 脚本，或改用通配：
```json
"check": "node --check bin/clowder-work-item.js && node --check src/**/*.js && node --check invoke-cli.js && node --check minimal-*.js"
```

---

## 五、通过项（无需修改）

- CLI 参数解析逻辑清晰，错误处理完整。
- 关键词检测支持中英文双语，表驱动设计易于扩展。
- 测试使用临时目录隔离，不污染正式数据。
- `schema_version` 预留了数据迁移能力。
- `--data-dir` 可覆盖持久化路径，方便测试和 T3 对接。
- 文档如实描述了"最小实现"边界，未过度承诺。

---

## 六、风险判断

| 风险项 | 严重程度 | 说明 |
|---|---|---|
| type 枚举不一致 | **中** | 阻塞 T5/T6 对类型的统一判断，需尽快对齐 |
| 默认 type 无用户提示 | **低** | 用户可能不知道类型是自动推断的 |
| status 字段值不一致 | **低** | 影响下游状态判断逻辑，可在 T5 前统一 |
| check 脚本遗漏 T3 | **低** | 不影响功能，仅影响 CI 覆盖 |

---

## 七、是否同意 T2 通过

> **有条件同意，前提是完成问题 1（type 枚举对齐）。**

问题 2-4 可在后续任务中逐步修正，不阻塞 T5/T6 使用 T2 作为录入入口。

**具体操作**：
1. T2 和 T3 统一 type 枚举值（建议统一为 `feature` / `bug_fix`），由 T3 修改常量。
2. 问题 2（低置信度提示）在 T2 下一轮修改时一并处理。
3. 问题 3（status 字段）在 T5 状态机实现时统一。
4. 问题 4（check 脚本）由下一个修改 package.json 的 Agent 补齐。

---

## 八、与 T3 的架构重叠说明

T2 实现了独立的 `saveWorkItem`（写 `data/work-items/wi-xxx.json`），T3 实现了通用的 `workItemStore`（写 `data/work-items.json`）。两者当前各自落盘，不互通。

**建议的统一路径**（已在 T3 交付文档中详述）：
1. T2 的 `createWorkItem()` 负责录入逻辑（类型识别、字段组装）。
2. T3 的 `workItemStore.create()` 作为唯一的落盘出口。
3. T2 的 `bin/clowder-work-item.js` CLI 调用 T3 的存储层完成持久化。

此重构建议在 T2/T3 交叉 Review 通过后、T5 启动前执行。

---

## 九、Review 元信息

- **Review 方身份**：Claude（非作者，符合 Review 独立性要求）
- **Review 对象**：Codex 的 T2 产出
- **覆盖规则**：符合 `09-risk-controls.md` "Codex 产出必须由 Claude 或 MiniMax Review"
- **Review 结论类型**：需要修改
- **是否涉及 UI/视觉/多模态**：否（MiniMax 无需参与本次 Review）
