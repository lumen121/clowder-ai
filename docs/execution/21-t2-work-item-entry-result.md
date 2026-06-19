# T2 页面工作项录入与类型选择/识别最小入口结果

> 状态：通过（Claude 非作者 Review 已通过；非阻塞建议已处理）
> 所属：执行
> 规则效力：T2 交付记录
> 维护角色：系统架构师
> 执行 Agent：Codex
> 任务 ID：T2

本文记录 `T2 页面工作项录入与类型选择/识别最小入口` 的实现结果。

旧版 T2 已完成 CLI 工作项录入入口。根据已批准的 `P0-14`、`P0-15`、`P0-16` 以及产品/架构澄清，CLI 结果仅保留为零阶段或内部入口历史事实；新的 T2 基线必须提供最小页面录入入口，并统一到 T3 WorkItem 持久化出口。

## 任务启动包补充

本节按 [13-task-start-package-template.md](../collaboration/13-task-start-package-template.md) 补齐 T2 修订的启动上下文，作为后续 Agent Review 和任务追溯依据。

| 字段 | 内容 |
| --- | --- |
| 当前身份 | Codex，T2 主执行 Agent |
| 任务 ID | T2 |
| 任务类型 | 功能需求 / 页面入口开发 |
| 任务来源 | [15-implementation-plan.md](15-implementation-plan.md)；P0-14/P0-15/P0-16 页面级用户参与变更；产品与架构澄清文档 |
| 关联工作项 | P0-14 页面级用户参与入口；P0-15 页面级工作项详情与状态可见；P0-16 页面级 Review / 门禁 / 复盘查看 |
| 优先级 | P0 |
| 任务目标 | 补齐最小页面工作项录入入口，让用户可以通过页面提交功能需求或 Bug 修复，并真实创建 WorkItem；页面入口和 CLI 内部入口统一到 T3 WorkItem 持久化出口。 |
| 范围内事项 | 本地页面录入入口；`feature` / `bug_fix` 类型选择或自动识别；创建 WorkItem 初始记录；创建后展示 ID、类型、当前状态、标题/目标、类型识别结果和持久化位置；CLI 保留为零阶段或内部入口并改为使用同一持久化出口。 |
| 范围外事项 | 完整统一聊天室或时间线；工作项详情全量视图；阻塞确认完整流程；Review、门禁、交付和复盘页面视图；高保真视觉设计、完整设计系统、复杂路由或 T13 主界面范围。 |
| 交付物 | `bin/clowder-page.js`；`public/index.html`；`public/app.js`；`public/styles.css`；`src/server/work-item-page-server.js`；`src/work-items/create-work-item.js`；`bin/clowder-work-item.js`；`test/work-item-entry.test.js`；`package.json`；本文档。 |
| 完成标准 | 页面入口可创建 WorkItem；创建后最小初始状态可见；CLI 内部入口和页面入口写入同一 T3 持久化出口；检查与测试通过；Claude 非作者 Review 通过。 |
| 依赖 | T1 基线确认；T3 本地持久化能力和 `createPersistence(dataDir)` / WorkItem Store 可用；P0-14/P0-15/P0-16 产品与架构澄清已生效。 |
| 必读文档 | [../product/14-page-user-participation-proposal.md](../product/14-page-user-participation-proposal.md)；[../product/15-page-change-implementation-clarifications.md](../product/15-page-change-implementation-clarifications.md)；[../architecture/16-page-change-architecture-clarifications.md](../architecture/16-page-change-architecture-clarifications.md)；[15-implementation-plan.md](15-implementation-plan.md)；[../collaboration/13-task-start-package-template.md](../collaboration/13-task-start-package-template.md)。 |
| Review 方 | Claude，非作者 Review 方。Review 记录：[28-t2-page-entry-review-by-claude.md](28-t2-page-entry-review-by-claude.md) |
| A2A 协作要求 | T2 由 Codex 执行，Claude 作为非作者 Review 方；T2 与 T3 的持久化出口一致性需在 T5 前由相关 Agent / 系统架构师再次确认；发现产品或架构冲突时升级，不自行兼容。 |
| MiniMax 是否需要参与及参与节点 | T2 最小页面录入入口允许先由 Codex/Claude 完成和 Review；MiniMax 必须在 T13 页面主界面或 T16 E2E 前参与页面体验 Review。 |
| 允许动作级别 / 工具权限 | 文件修改；检查执行；提交准备。允许范围限于 T2 页面入口、WorkItem 创建调用路径、必要测试/验证文件和相关执行文档。 |
| 禁止事项 | 不得扩大到完整 T13 页面主界面；不得恢复旧 `data/work-items/<id>.json` 事实来源；不得跳过非作者 Review；不得将 T2 判定为完整页面体验验收；不得部署、合并主干或绕过质量门禁。 |
| 文件/模块边界 | 允许触碰 T2 页面录入入口、CLI 内部入口、WorkItem 创建服务、T2 测试、必要脚本和执行文档；不触碰 T5 状态机、T6 A2A 编排、T9 Review/门禁完整模块、T14 复盘模块和 T13 完整主界面。 |
| 维护性注释要求 | 仅对非显而易见的创建流程、类型识别/选择逻辑、页面与统一持久化出口的连接点补充必要注释；不做显而易见的逐行注释。 |
| Git 身份要求 | 若发生 Git 写入动作，沿用仓库当前 T2 分支治理口径；本次补录不要求新增提交或推送。 |
| worktree / 分支要求 | T2 在 `feature/t2-work-item-entry` 分支上交付；后续并行任务应使用独立分支或 worktree 并记录负责人和冲突状态。 |
| 验收标准 | 用户可以通过页面录入工作项；页面入口真实创建 WorkItem；系统记录原始请求、工作项类型、初始状态和来源；创建后页面可见 ID、类型、当前状态、标题或目标、类型识别结果和持久化位置；CLI 内部入口和页面入口统一到 T3 持久化出口。 |
| 验证方式 | `npm run check`；`npm test`；`node src/storage/__verify.js`；`node src/storage/__page_query_verify.js`；`npm run page` 页面烟测；浏览器响应式检查。 |
| Review 通过标准 | Claude 作为非作者 Review 方确认页面入口真实创建 WorkItem、持久化出口统一、范围未扩展到 T13、检查和测试结果可信，并输出明确通过 / 不通过 / 需修改结论。 |
| 质量门禁 | 页面录入路径验证通过；WorkItem 创建结果可读取；自动检查和测试通过；非作者 Review 完成后才能视为 T2 修订通过。 |
| 失败处理 | 页面入口不能真实创建 WorkItem时，T2 不得通过；页面入口和 CLI 内部入口写入不同事实来源时，记录为 T5 前阻塞；MiniMax 未参与时，记录为 T13 或 T16 前待触发体验 Review。 |
| 页面变更影响 | 页面是首版主入口，CLI 只能作为零阶段或内部入口保留；T2 不得把页面录入全部推迟到 T13；T2 不得把 CLI 输出包装成页面主入口；T2 页面只覆盖最小录入和初始状态展示，不吞并 T13 完整页面级用户参与主界面；页面入口和 CLI 内部入口都必须写入 T3 `data/work-items.json`。 |
| 已完成内容是否偏离启动包 | 实现范围未偏离启动包；执行顺序存在治理偏差，即 T2 开发和 Review 先于完整启动包记录完成，本节用于补齐可追踪上下文。 |
| 建议下一状态或交接状态 | T2 实现维持“通过”；A1 补录完成后建议进入“待 Review”，由原 Review 方轻量确认补录是否足以支撑当前任务边界和验收。 |
| 是否解除依赖 | 已解除 T2 对“最小页面录入入口不存在”的依赖；未解除 A6，T5 前仍需确认当前分支内 T2/T3 WorkItem 单一事实来源。 |
| 是否阻断后续任务 | T2 实现不阻断后续任务；A6 未关闭前，T5 状态机启动仍需做 WorkItem 单一事实来源确认。 |
| 是否触发 Review / 质量门禁 / 人工确认 / 复盘 | 已触发并通过 Claude 非作者 Review（[28-t2-page-entry-review-by-claude.md](28-t2-page-entry-review-by-claude.md)）和质量门禁；本次补录建议触发 Claude 轻量确认；暂无新增产品负责人或系统架构师确认项；不单独触发复盘。 |
| 后续阻断关系和被影响任务 | 若 T5 前发现 T2/T3 WorkItem 事实来源再次分叉，将阻断 T5 状态机，并影响 T6 A2A、T9 Review/门禁、T13 页面主界面和 T16 E2E。 |
| 是否需要产品负责人或系统架构师确认 | 当前无新增产品或架构确认项；若后续要求扩大 T2 页面范围、降低 P0 验收、调整 MiniMax 参与节点、改变持久化事实来源或跳过 Review/门禁，必须升级确认。 |

## 总体结论

T2 已补齐最小页面录入入口，并将页面入口与 CLI 内部入口统一到 T3 `data/work-items.json` 持久化来源。

当前实现支持：

- 用户通过本地页面提交功能需求或 Bug 修复。
- 用户显式选择 `feature` / `bug_fix`，或使用自动类型识别。
- 页面入口真实创建 WorkItem。
- 创建后展示 ID、类型、状态、标题/目标、类型识别置信度和持久化位置。
- CLI 保留为零阶段或内部入口，并走同一持久化出口。
- T2 字段映射到 T3 WorkItem：`raw_request -> goal`，`type_detection -> metadata.type_detection`，`source -> metadata.source`。

## 交付物

| 文件 | 说明 |
| --- | --- |
| `package.json` | 新增 `npm run page`，保留 `npm run check`、`npm test`。 |
| `bin/clowder-page.js` | T2 本地页面入口启动脚本。 |
| `bin/clowder-work-item.js` | CLI 内部入口，已改为使用 T3 持久化出口。 |
| `public/index.html` | 最小页面录入表单和初始状态展示区域。 |
| `public/app.js` | 页面提交、错误处理和创建结果渲染。 |
| `public/styles.css` | 最小可用页面样式，覆盖响应式和键盘焦点状态。 |
| `src/server/work-item-page-server.js` | 无依赖本地 HTTP 服务和 `/api/work-items` 创建接口。 |
| `src/work-items/create-work-item.js` | T2 类型识别、字段映射和统一 WorkItem 创建服务。 |
| `test/work-item-entry.test.js` | 覆盖类型识别、T3 持久化、CLI 内部入口、页面启动脚本和页面 API 成功/失败路径。 |

## 页面入口

启动方式：

```text
npm run page
```

默认访问：

```text
http://127.0.0.1:4317
```

页面能力边界：

- 包含：输入请求、选择/识别类型、创建 WorkItem、展示初始状态。
- 不包含：完整统一聊天室、全量详情视图、阻塞确认流程、Review/门禁/复盘视图。
- 上述完整页面主界面仍属于 T13。

## CLI 内部入口

CLI 保留为零阶段或内部入口：

```text
node bin/clowder-work-item.js create --type feature --request "支持用户录入功能需求"
node bin/clowder-work-item.js create --request "保存时报错，需要修复" --json
```

CLI 不再写入 `data/work-items/<id>.json`。它与页面入口一样写入 T3 Store：

```text
data/work-items.json
```

## WorkItem 字段映射

| T2 输入 | T3 WorkItem 字段 |
| --- | --- |
| 原始请求 `raw_request` | `goal` |
| 标题 `title` | `title` 可选展示字段；未输入时取 `goal` 首行 |
| 类型选择/识别 | `type` |
| 类型识别详情 | `metadata.type_detection` |
| 来源 | `metadata.source`，值为 `page` 或 `cli_internal` |

说明：T2 不再向 T3 WorkItem 记录写入 `type_label`，避免由 T2 隐式扩展 T3 schema；页面和 CLI 展示层按 `type` 自行映射中文标签。

初始状态为：

```text
needs_clarification
```

## 验证结果

语法检查：

```text
> npm run check
checked 16 JavaScript files
```

测试：

```text
> npm test
work-item-entry tests passed
```

测试覆盖补充：

- `bin/clowder-page.js --help` 返回用法并退出，不启动长驻服务。
- `/api/work-items` 成功创建 WorkItem 时返回 `201`。
- 空请求通过 `/api/work-items` 提交时返回 `400`，且不写入 `work-items.json`。
- CLI 内部入口写入 `data/work-items.json`，不再创建 `data/work-items/` 目录。
- WorkItem 持久化记录不包含 `type_label`。
- 静态资源路径边界检查覆盖 Windows 大小写路径场景和 `..` 越界场景。

T3 持久化验证：

```text
> node src/storage/__verify.js
结果: 42 通过, 0 失败, 42 总计
```

T3 页面查询视角验证：

```text
> node src/storage/__page_query_verify.js
结果: 15 通过, 0 失败, 15 总计
```

页面烟测：

```text
> npm run page
访问 http://127.0.0.1:4317
```

浏览器验证结果：

- 页面标题为 `Clowder AI 工作项录入`。
- 页面存在请求表单和 `创建工作项` 按钮。
- 提交 `保存时报错，需要修复并展示初始状态` 后，页面展示：
  - `type = Bug 修复 (bug_fix)`
  - `status = needs_clarification`
  - `metadata.type_detection.mode = detected`
  - `storage = data/work-items.json`
- 响应式检查覆盖 `320`、`768`、`1024`、`1440` 宽度，未发现横向溢出。

## 变更影响处理

已处理 `P0-14`、`P0-15`、`P0-16` 对 T2 的影响：

- 旧 CLI 入口保留为历史事实和内部入口。
- 页面录入入口已补齐。
- 页面和 CLI 内部入口已统一到 T3 持久化出口。
- T2 未扩大到 T13 的完整页面主界面范围。

Claude 非作者 Review 已通过，Review 文档为 [28-t2-page-entry-review-by-claude.md](28-t2-page-entry-review-by-claude.md)。Review 中提出的非阻塞建议已处理：

- 移除 T2 写入的 `type_label`，避免隐式扩展 T3 schema。
- 静态资源路径边界检查改为规范化路径比较，覆盖 Windows 大小写差异。
- CLI 入口改为显式命令分发，避免未来新增命令时出现隐式成功返回。

仍需后续任务处理：

- T13 实现完整页面级用户参与主界面。
- T13 或 T16 前引入 MiniMax 做页面体验 Review。
- T5 启动前再次确认 WorkItem 单一事实来源。

## 是否建议进入后续任务

T2 已通过 Claude 非作者 Review，可作为页面录入和 WorkItem 创建入口基线；T5 启动前仍需确认 T3 持久化产物已纳入当前分支并保持单一事实来源。
