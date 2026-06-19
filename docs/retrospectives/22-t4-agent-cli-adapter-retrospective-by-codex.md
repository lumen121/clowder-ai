# T4 Agent CLI 适配轻量复盘（Codex）

> 状态：历史记录
> 所属：复盘
> 规则效力：事实记录与改进输入
> 维护角色：Codex
> 任务 ID：T4
> 日期：2026-06-20

## 事实摘要

T4 已完成 Agent CLI 适配与最小调用闭环：

- 新增 Codex、Claude、MiniMax 三个真实本地 CLI 适配。
- 定义结构化任务上下文校验。
- 统一 stdout、stderr、exit code、timeout 和错误分类结果结构。
- 复用 T3 `A2AEvent` 写回脱敏后的调用结果。
- 增加 `bin/clowder-agent.js`、`scripts/verify-agent-cli.js` 和适配层测试。
- Claude 非作者 Review 已通过：[../execution/31-t4-review-by-claude.md](../execution/31-t4-review-by-claude.md)。
- T4 提交并推送：`35da528 feat: add T4 agent CLI adapter`，分支 `codex/t4-agent-cli-adapter`。

## 验证

| 命令 | 结果 |
| --- | --- |
| `npm run check` | 通过 |
| `npm test` | 通过 |
| `npm run verify:agents` | 通过，Codex / Claude / MiniMax 三个真实 CLI 均返回 exit code `0` |

## Review 建议处理

| 建议 | 处理结果 |
| --- | --- |
| `to_agent: "Clowder"` 非标准身份 | 不阻塞 T4；转为 T6 A2A 编排时统一系统/Harness 身份。 |
| Windows 超时 kill 语义 | 不阻塞 T4；转为 T8 或后续稳健性增强。 |
| 验证数据目录未忽略 | 复核后不成立，`.gitignore` 已覆盖 `data/__*/`。 |

## 有效做法

- 先用可注入 runner 做单元测试，再用 `verify:agents` 做真实 CLI 验证，能同时覆盖可测性和真实环境可用性。
- 将真实验证结果写入被忽略的本地 T3 A2AEvent 目录，既保留证据，又避免把本机运行数据提交。
- 在作者结果文档中补充对 Review 建议的处理意见，能减少后续 Agent 对“建议是否需返工”的误读。

## 遗留风险

- 真实 CLI 调用依赖本机认证和网络，换环境后仍需重新执行 `npm run verify:agents`。
- Codex CLI stderr 存在远程插件目录认证 warning，本次不影响最小 CLI 调用，但后续若依赖插件能力需单独验证。
- T6 需要明确 A2A 的系统/Harness 身份，否则 `to_agent` 查询口径可能不一致。

## 改进输入

- T6：统一系统/Harness 在 A2AEvent 中的身份命名。
- T8：如需要强护栏，可补充更严格的超时终止策略和失败恢复规则。
- 后续任务：并行开发时继续保持独立 worktree / branch，避免 T4 与 T5 这类并行任务的产物归属混淆。
