# T2 工作项录入与类型选择/识别最小入口结果

> 状态：通过（非作者 Agent Review 已通过）
> 所属：执行
> 规则效力：T2 交付记录
> 维护角色：系统架构师
> 执行 Agent：Codex
> 任务 ID：T2

本文记录 `T2 工作项录入与类型选择/识别最小入口` 的实现结果，用于 Claude 非作者 Review，并为 T3 本地持久化提供对接信息。

## 总体结论

T2 已实现最小 CLI 入口和 WorkItem 初始记录创建能力。

当前实现支持：

- 用户通过 CLI 输入原始请求。
- 用户显式选择 `feature` 或 `bug_fix`。
- 未显式选择时，根据关键词做最小类型识别。
- 无法识别时默认 `feature`，并在非 JSON 输出中提示低置信度。
- 创建 WorkItem 初始记录。
- 将 WorkItem JSON 写入 `data/work-items/`。
- 输出创建结果，包含 `id`、类型、状态和文件路径。

## 交付物

| 文件 | 说明 |
| --- | --- |
| `package.json` | 新增最小 npm 脚本：`npm run check`、`npm test`。 |
| `scripts/check-js.js` | 递归执行 `node --check`，覆盖根脚本、`bin/`、`scripts/`、`src/`、`test/`。 |
| `bin/clowder-work-item.js` | 工作项录入 CLI。 |
| `src/work-items/create-work-item.js` | WorkItem 创建、类型解析、保存逻辑。 |
| `test/work-item-entry.test.js` | 无依赖单元测试。 |
| `data/work-items/.gitkeep` | WorkItem 默认写入目录占位。 |

## CLI 用法

```text
node bin/clowder-work-item.js create --type feature --request "支持用户录入功能需求"
node bin/clowder-work-item.js create --request "保存时报错，需要修复" --json
node bin/clowder-work-item.js create --request-file request.md --type bug_fix
```

支持的类型输入：

- `feature`
- `bug_fix`
- `bug`
- `fix`
- `功能需求`
- `Bug 修复`
- `修复`

当未提供 `--type` 且类型无法可靠识别时，非 JSON 输出会提示：

```text
Type: 功能需求 (feature) [defaulted, low confidence; use --type to override]
```

## WorkItem 初始记录

T2 创建的 WorkItem 包含以下关键字段：

```text
id
type
type_label
title
raw_request
status
assumptions
ambiguities
risks
solution
tasks
disagreements
escalations
review_status
quality_status
delivery_status
retrospective_status
created_at
updated_at
source
metadata.schema_version
metadata.type_detection
```

初始状态为：

```text
needs_clarification
```

以下状态字段初始值为 `null`，表示尚未进入对应流程：

```text
review_status
quality_status
delivery_status
retrospective_status
```

## 与 T3 的对接

T2 只实现最小落盘，不定义最终持久化架构。

当前默认写入路径：

```text
data/work-items/
```

T3 可以替换或封装当前 `saveWorkItem` 实现，但应保留以下行为：

- 能创建 WorkItem 初始记录。
- 能保存原始用户请求。
- 能保存工作项类型。
- 能保存初始状态。
- 能重启后读取记录。

## 验证结果

语法检查：

```text
> npm run check
checked 12 JavaScript files
```

测试：

```text
> npm test
work-item-entry tests passed
```

CLI 烟测：

```text
> node bin/clowder-work-item.js create --type feature --request "支持用户录入功能需求并创建初始 WorkItem" --json
{
  "work_item": {
    "type": "feature",
    "type_label": "功能需求",
    "status": "needs_clarification"
  }
}
```

```text
> node bin/clowder-work-item.js create --request "保存时报错，需要修复" --json
{
  "work_item": {
    "type": "bug_fix",
    "type_label": "Bug 修复",
    "status": "needs_clarification"
  }
}
```

烟测生成的临时 JSON 已清理，仅保留 `data/work-items/.gitkeep`。

## 非作者 Review 后修正

Claude 已完成 T2 非作者 Review，结论为“需要修改”。本轮已处理：

- 低置信度默认类型识别提示。
- `review_status`、`quality_status`、`delivery_status`、`retrospective_status` 初始值统一为 `null`。
- `npm run check` 改为递归检查当前 JavaScript 文件，覆盖并行出现的 T3 存储文件。

仍需与 T3/后续集成对齐：

- T2 使用 `bug_fix` 表示 Bug 修复；T3 当前使用 `bug`。建议统一为 `bug_fix`，该修改应在 T3 存储模型或集成阶段完成。
- T2 当前保留最小 `data/work-items/<id>.json` 落盘，T3 提供 `data/work-items.json` 模型级持久化。后续应将 T2 CLI 接入 T3 存储层作为唯一落盘出口。

## 风险与后续

- 当前入口是 CLI，不是最终 UI。
- 类型识别是最小关键词启发式，不替代后续 A2A 澄清。
- 当前 JSON 落盘是 T2 最小实现，T3 应提供正式本地持久化模块。
- T2 未实现状态机推进、A2A、Review 或质量门禁，这些属于后续任务。

## 是否建议进入后续任务

建议由 Claude 对 T2 做非作者 Review。

Review 通过后，T2 可作为 T3/T5/T6 的 WorkItem 创建入口基线。
