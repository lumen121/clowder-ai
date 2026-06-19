# 协作治理文档索引

> 状态：当前基线
> 所属：协作治理
> 规则效力：协作规则与 Harness 治理规则
> 维护角色：产品负责人

本目录定义三个 Agent 如何协作、如何受 Harness 治理、如何进行 Dogfooding，以及在自动聊天室和 Harness 建成前如何进行零阶段人工协作。

## 当前文档

- [03-a2a-collaboration-protocol.md](03-a2a-collaboration-protocol.md)：Agent-to-Agent 协作规则，覆盖澄清、方案、拆解、执行、Review、验证和复盘。
- [04-harness-governance.md](04-harness-governance.md)：上下文、记忆、工具沙箱、权限、Agent Loop、护栏、安全、观测和反馈要求。
- [10-dogfooding-plan.md](10-dogfooding-plan.md)：使用 Clowder AI 开发和优化 Clowder AI 自身的机制。
- [12-phase-zero-manual-workflow.md](12-phase-zero-manual-workflow.md)：自动聊天室和 Harness 建成前的人工协作流程。
- [13-task-start-package-template.md](13-task-start-package-template.md)：任务启动包的产品侧模板、必填字段、阻断规则和按任务类型的补充要求。

## 使用规则

- A2A 不只发生在 Review 阶段，而是覆盖工作项完整生命周期。
- Harness 是多 Agent 协作的治理层，不只是工具调用器。
- Agent 启动任务前必须获得明确任务启动包；字段缺失、冲突或越权时不得直接执行。
- 零阶段流程是临时人工接力方式，不代表自动化三 Agent 闭环已经具备。
