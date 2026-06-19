# T4 Agent CLI 适配与最小调用闭环结果

> 状态：通过（Claude 非作者 Review 已通过）
> 所属：执行
> 规则效力：T4 交付记录
> 维护角色：系统架构师
> 执行 Agent：Codex
> 任务 ID：T4

本文记录 T4 的实现结果。Claude 非作者 Review 已通过，Review 记录见 [31-t4-review-by-claude.md](31-t4-review-by-claude.md)。

## 启动与隔离

| 项 | 结果 |
| --- | --- |
| 执行身份 | Codex；Git 写入身份要求为 `Clowder Codex <codex@clowder.local>` |
| branch | `codex/t4-agent-cli-adapter` |
| worktree | `C:\aiWorkspace\clowder-ai-t4` |
| 基线 | `origin/feature/t2-work-item-entry`，提交 `97eaef5` |
| Review 方 | Claude |
| 状态 | 已完成实现、自检和 Claude 非作者 Review |

## 实施方案结论

启动前方案未发现与 T4 启动包、产品基线或架构基线冲突。实际实现范围保持在 Agent CLI 适配、结构化上下文、结果归一化、T3 A2AEvent 回写和必要验证记录内，未扩展到 T6 A2A 编排、T8 Harness 或页面主界面。

## 完成内容

| 交付物 | 内容 |
| --- | --- |
| `src/agents/task-context.js` | 定义并校验 T4 最小结构化任务上下文；生成下发给 Agent CLI 的 prompt。 |
| `src/agents/cli-adapter.js` | 封装 `codex`、`claude`、`mmx` 三个真实本地 CLI；归一化 stdout、stderr、退出码、超时和失败分类。 |
| `src/agents/response-recording.js` | 对 CLI 输出做脱敏和摘要，并将结果写回 T3 `A2AEvent`。 |
| `bin/clowder-agent.js` | 提供内部 CLI 入口：读取 JSON 上下文、调用指定 Agent、可选写回 T3 记录。 |
| `test/agent-cli-adapter.test.js` | 覆盖上下文校验、结果归一化、超时/CLI 不存在分类、脱敏和 A2AEvent 回写。 |
| `scripts/verify-agent-cli.js` | 真实调用 Codex、Claude、MiniMax CLI，并写入脱敏后的 T3 A2AEvent 记录。 |
| `package.json` | 新增 `verify:agents` 脚本和 `clowder-agent` bin。 |
| `src/index.js` | 导出 T4 适配层公共 API。 |

## 输入上下文约定

T4 任务上下文至少包含：

- `identity`
- `task_id`
- `goal`
- `boundary`
- `dependencies`
- `review_party`
- `acceptance`
- `prohibited_items`
- `allowed_actions`
- `file_module_boundary`
- `verification`
- `quality_gate`
- `failure_handling`
- `maintainability_comments`
- `git_identity`

缺少任一必填字段时，适配层拒绝调用。

## 结果结构约定

每次调用归一化为：

- `agent`
- `identity`
- `task_id`
- `success`
- `stdout`
- `stderr`
- `exit_code`
- `signal`
- `timed_out`
- `timeout_ms`
- `duration_ms`
- `error_classification`
- `started_at`
- `completed_at`

当前失败分类包括：`none`、`timeout`、`usage_error`、`authentication_error`、`quota_exceeded`、`content_filter`、`nonzero_exit`、`cli_not_found`、`spawn_error`。

## 真实 CLI 验证

命令：

```bash
npm run verify:agents
```

结果摘要：

| Agent | 结果 | exit_code | 分类 | A2AEvent 记录 |
| --- | --- | --- | --- | --- |
| Codex | 通过 | `0` | `none` | `a2a-mqkwl7ruac14b5` |
| Claude | 通过 | `0` | `none` | `a2a-mqkwlbvd30358e` |
| MiniMax | 通过 | `0` | `none` | `a2a-mqkwlgqd9f991f` |

验证记录写入本地忽略目录：`data/__t4-agent-verify/a2a-events.json`。该目录用于本机验证，不作为提交产物。

过程中发现并修复两项适配问题：

- Codex 多行 prompt 作为命令参数传递时在 Windows shell 包装下被拆分，改为 stdin 下发。
- MiniMax `--messages-file -` 在当前 Windows 环境被解析为文件路径，改为 `--message user:<compact prompt>` 非交互调用。

## 检查命令

| 命令 | 结果 |
| --- | --- |
| `npm run check` | 通过，`checked 22 JavaScript files` |
| `npm test` | 通过，`work-item-entry tests passed`；`agent-cli-adapter tests passed` |
| `npm run verify:agents` | 通过，Codex / Claude / MiniMax 三个真实 CLI 均返回 exit code `0` |

## T3 回写证据

`recordAgentInvocation()` 复用 T3 `createPersistence(dataDir).createA2AEvent()`，写入目的为 `execution_sync`，不修改 T3 核心模型语义，不新增第二事实来源。

回写内容经过脱敏和摘要处理：

- token / key 样式文本替换为 `[REDACTED]`
- 本地用户路径和工作区路径替换为 `[LOCAL_PATH]`
- stdout / stderr 按摘要长度截断，避免全量日志入库

## 遗留风险

| 风险 | 影响 | 处理 |
| --- | --- | --- |
| Codex CLI stderr 含远程插件目录认证 warning | 不影响本次 CLI 调用成功，但可能影响后续插件能力 | 记录为非阻塞风险；T6/T8 若依赖插件能力需单独验证。 |
| 各 Agent CLI 输出格式不统一 | T4 当前只要求进程级归一化，不解析语义内容 | 后续 T6 若需要语义解析，应在编排层定义更严格协议。 |
| CLI 真实调用依赖本机认证和网络 | 其他环境可能失败 | `verify:agents` 会分类失败并返回非零，不能静默判定通过。 |

## Review 建议处理意见

Claude 非作者 Review 已归档：[31-t4-review-by-claude.md](31-t4-review-by-claude.md)，结论为通过。对 Review 中 3 条非阻塞建议，作者处理意见如下：

| Review 建议 | 作者判断 | 处理 |
| --- | --- | --- |
| `to_agent: "Clowder"` 非标准 Agent 身份 | 建议合理，但不阻塞 T4。T4 当前只需证明适配层可调用并可回写 A2AEvent；系统/Harness 身份枚举应由 T6 A2A 编排或后续架构澄清统一。 | 保留当前实现；作为 T6 设计关注点。 |
| Windows 超时 kill 语义 | 建议合理，但不阻塞 T4。当前结果已显式记录 `timed_out`、`signal`、`error_classification`，满足最小超时治理；更细的两级 kill 属于稳健性增强。 | 保留当前实现；后续如 T8 需要强超时护栏，再补两级终止策略。 |
| 验证数据目录未忽略 | 经复核，该建议不成立。`.gitignore` 已包含 `data/__*/`，覆盖 `data/__t4-agent-verify/`。 | 无需修改。 |

## 结论

T4 已满足新的最小实现基线：三个真实本地 Agent CLI 均可由统一适配层调用，任务上下文完整下发，调用结果统一归一化，并至少一条结果可回写为 T3 结构化记录。

当前状态：Claude 非作者 Review 已通过。T4 可交接给 T6；T6 对 T4 的依赖可解除。
