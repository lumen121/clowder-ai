# 执行文档索引

> 状态：当前基线
> 所属：执行
> 规则效力：执行计划、阶段门禁与执行节奏
> 维护角色：系统架构师

本目录放当前怎么执行、按什么顺序执行、哪些门禁必须先过，以及阶段性执行状态。这里不放构建产物、发布包或最终交付物。

## 当前文档

- [15-implementation-plan.md](15-implementation-plan.md)：基于系统架构设计的一周实现任务拆解与开发计划。
- [19-t1-baseline-confirmation-result.md](19-t1-baseline-confirmation-result.md)：T1 实现基线确认结果，供非作者 Agent Review 使用。
- [20-t1-review-by-claude.md](20-t1-review-by-claude.md)：T1 非作者 Review 报告（Claude），结论为需要修改。

## 使用规则

- 进入实现阶段后，必须从 `T1 实现基线确认` 开始。
- 不得跳过 Git/worktree、Agent CLI、持久化、检查命令和编码策略验证。
- 执行计划可以随阶段更新，但更新必须保留门禁原因和产品/架构确认记录。
