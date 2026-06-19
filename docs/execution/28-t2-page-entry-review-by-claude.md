# T2 页面录入回补 Review — Claude

> 状态：通过
> 所属：执行
> 规则效力：T2 非作者 Review 记录
> 维护角色：Claude（Review 方）
> 执行 Agent：Codex（作者）
> 任务 ID：T2（修订）

本文是 Claude 对 Codex T2 页面录入回补 + T2/T3 持久化统一的 Review 结论。

## 总体结论

✅ 通过，无阻塞问题。

T2 页面录入回补和持久化统一已完成。CLI 和页面入口统一写入 `data/work-items.json`，旧 `data/work-items/<id>.json` 格式已废弃。类型识别引擎分层清晰，路径遍历防护到位。验证通过（16 文件语法检查 + 9 个测试全绿）。

## 变更清单

| 文件 | 变更 |
|---|---|
| `src/work-items/create-work-item.js` | 新增类型识别引擎 + T3 持久化统一入口 |
| `bin/clowder-work-item.js` | CLI 改为调用 `createAndSaveWorkItem`，不再自写文件 |
| `bin/clowder-page.js` | 新增 — 本地页面服务启动脚本 |
| `src/server/work-item-page-server.js` | 新增 — 零依赖 HTTP 服务 + `/api/work-items` |
| `public/index.html` | 新增 — 最小页面录入表单 |
| `public/app.js` | 新增 — 页面提交逻辑 |
| `public/styles.css` | 新增 — 响应式样式 |
| `test/work-item-entry.test.js` | 扩展至 9 个测试，覆盖页面 API / CLI / 类型识别 |
| `package.json` | 新增 `npm run page`，保留 `npm run check` / `npm test` |
| `README.md` | 文档入口加 AGENTS.md |
| `docs/00-index.md` | 阅读路径加 13-task-start-package-template |
| `docs/collaboration/00-index.md` | 索引加 13 号文档 + 任务启动包规则 |
| `docs/execution/21-t2-work-item-entry-result.md` | 交付说明更新 |

## 正面确认

- **持久化统一** — `createAndSaveWorkItem` → `resolvePersistence` → T3 Store。CLI、页面、测试三条路径全部收敛到 `data/work-items.json`。测试明确验证旧目录 `data/work-items/` 不再生成。
- **类型识别分层合理** — `normalizeType`（别名匹配）→ `detectWorkItemType`（关键词计数）→ `resolveWorkItemType`（选择/检测/默认），层层递进。中文别名和关键词覆盖充分。
- **路径遍历防护到位** — `resolveStaticPath` 用 `path.resolve` + `startsWith` 检查，正确防御 `../` 穿越。
- **请求体大小限制** — 128KB 上限，`request.destroy()` 断开超限连接。
- **测试覆盖充分** — 显式类型、自动检测、CLI 低置信度提示、页面 API 成功/失败路径、help 不启动服务。

## 建议（不阻塞合并）

### 1. `type_label` 隐式扩展 T3 schema

`buildWorkItemInput` 把 `type_label: "功能需求"` 写入 WorkItem 记录，但 T3 的 `WORK_ITEM_DEFAULTS` 里没有这个字段。功能正常，但 schema 被 T2 悄悄扩了一列。

**建议**：在 21 号交付文档或 T5 启动前标注此字段，由 T5 决定是否正式纳入 schema。

### 2. Windows 大小写边角

`resolveStaticPath` 的 `startsWith` 检查是大小写敏感的。Windows 文件系统不区分大小写，请求 `/Public/app.js`（大写 P）会 404。

**建议**：在 `startsWith` 之前加一层 `.toLowerCase()` 处理。

### 3. CLI `main` 隐式返回

`bin/clowder-work-item.js` 的 `main` 函数成功和帮助路径显式 `return 0`，但 `command !== "create"` 时 `return 1`。如果未来加新命令忘了写 return，JavaScript 隐式返回 `undefined` 会被当作 exit code 0。

**建议**：函数末尾加 `return 1` 兜底。

## 验证结果

```
npm run check  → checked 16 JavaScript files
npm test       → work-item-entry tests passed
```

语法检查和测试均通过，与 21 号交付文档描述一致。

## 是否建议进入后续任务

通过。T2 修订可作为基线进入后续。T5 启动前需确认 `type_label` 字段纳入决策。

## A1 补录轻量确认

本节逐项确认 [21-t2-work-item-entry-result.md#任务启动包补充](21-t2-work-item-entry-result.md#任务启动包补充) 是否覆盖 A1 要求字段和页面变更影响。

### 模板分区逐项确认

| 模板分区 | 必填字段 | 已覆盖 | 准确性 |
|---|---|---|---|
| 1. 基本信息 | 任务 ID、类型、身份、来源、关联工作项、优先级 | ✅ 6/6 | 正确 |
| 2. 目标与边界 | 目标、范围内、范围外、交付物、完成标准 | ✅ 5/5 | 与 T2 修订实际产出一致 |
| 3. 上下文与必读 | 依赖、必读文档、页面相关必读 | ✅ | P0-14/15/16 三份文档均在列 |
| 4. 分工与协作 | Review 方、A2A 协作、MiniMax 参与 | ✅ 3/3 | Review 方为 Claude，MiniMax 延后到 T13/T16 |
| 5. 执行约束 | 允许动作、禁止事项、文件边界、注释、Git 身份、worktree、高风险限制 | ✅ 7/7 | 禁止事项覆盖部署/合并/绕过门禁 |
| 6. 验收与门禁 | 验收标准、验证方式、Review 标准、质量门禁、失败处理 | ✅ 5/5 | 与已执行验证路径一致 |
| 7. 输出记录 | 偏离说明、下一状态、依赖解除、阻断、触发、确认 | ✅ 6/6 | 诚实标注"执行顺序存在治理偏差" |

### 页面变更影响确认

A1 补录的"页面变更影响"字段覆盖了产品澄清要求的全部要点：

- ✅ 页面是首版主入口，CLI 仅为零阶段/内部入口保留
- ✅ T2 不得把页面录入推迟到 T13（落实产品裁决）
- ✅ T2 不把 CLI 包装成页面主入口
- ✅ T2 范围不吞并 T13 完整主界面
- ✅ 页面和 CLI 统一写入 T3 `data/work-items.json`

### 结论

A1 补录覆盖完整，事实准确。A1 通过。
