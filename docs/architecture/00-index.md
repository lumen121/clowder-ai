# 架构文档索引

> 状态：当前基线
> 所属：架构
> 规则效力：架构输入与架构约束
> 维护角色：系统架构师

本目录说明系统架构师的输入要求和 Clowder AI 当前系统架构设计。

## 当前文档

- [11-architecture-brief.md](11-architecture-brief.md)：系统架构师的输入说明和输出要求。
- [14-system-architecture-design.md](14-system-architecture-design.md)：系统架构设计，覆盖模块划分、状态机、A2A、Harness、worktree、Review、质量门禁、人工升级、Dogfooding 和反馈回路。

## 使用规则

- 架构文档是产品基线的系统设计解释，不反向覆盖产品规则。
- 架构发现产品规则不可实现、成本过高或风险过大时，必须升级给产品负责人确认。
- 数据与状态模型是逻辑模型，不代表最终数据库 schema。
