# Agent 角色文档索引

> 状态：当前基线
> 所属：Agent 角色
> 规则效力：角色规则与职责边界
> 维护角色：产品负责人

本目录定义 Codex、Claude、MiniMax 的角色使命、职责边界、协作规则、升级触发条件和完成标准。

## 当前文档

- [05-agent-codex.md](05-agent-codex.md)：Codex 角色定义。
- [06-agent-claude.md](06-agent-claude.md)：Claude 角色定义。
- [07-agent-minimax.md](07-agent-minimax.md)：MiniMax 角色定义。

## 使用规则

- Agent 在执行任务前必须读取自己的角色文档。
- Codex 负责需求统筹和方案推进，但其他 Agent 必须评估方案合理性，不能无脑执行。
- Codex、Claude、MiniMax 都可以参与开发；作者不能作为自己变更的唯一 Review 方。
- 涉及 UI、视觉、多模态、语音、视频、图片或交互体验的任务，应优先让 MiniMax 参与设计或 Review。
