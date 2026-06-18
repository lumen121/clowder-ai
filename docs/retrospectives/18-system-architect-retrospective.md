# 系统架构师复盘记录：架构设计、实现计划与复盘 Review

> 状态：历史记录
> 所属：复盘
> 规则效力：系统架构师复盘与改进输入
> 维护角色：系统架构师


## 复盘对象

本复盘记录覆盖系统架构师在零阶段后半段的工作：

- 输出系统架构设计。
- 输出实现任务拆解与一周开发计划。
- 根据产品负责人审查意见修订架构文档和实现计划。
- Review 产品负责人输出的零阶段复盘记录。
- 将架构侧 Review 归档为独立文档。

相关文档：

- [14-system-architecture-design.md](../architecture/14-system-architecture-design.md)
- [15-implementation-plan.md](../execution/15-implementation-plan.md)
- [16-phase-zero-retrospective.md](16-phase-zero-retrospective.md)
- [17-architecture-review-of-phase-zero-retrospective.md](17-architecture-review-of-phase-zero-retrospective.md)

## 参与角色

- 用户：提出架构设计、计划落档、复盘和审查要求，并持续要求保持独立判断。
- 产品负责人：对架构设计、实现计划和架构侧 Review 做产品侧覆盖性审查。
- 系统架构师：输出架构设计、实现计划、架构侧 Review 和本复盘。

## 完成的工作

### 1. 系统架构设计

系统架构师基于产品文档输出 [14-system-architecture-design.md](../architecture/14-system-architecture-design.md)，覆盖：

- 系统模块划分。
- 工作项状态机。
- A2A 交互模型。
- Harness 设计。
- Agent 角色与权限模型。
- 上下文与记忆设计。
- 工具沙箱与安全模型。
- 并行开发与 worktree 隔离方案。
- Review 与质量门禁方案。
- 人工升级设计。
- 观测、指标和评估模型。
- 失败恢复策略。
- Git 提交、feature 分支推送和可选 PR 流程。
- Dogfooding 支撑设计。
- 产品验收标准到系统能力的映射。

产品负责人审查后确认通过。

### 2. 架构文档表达修订

根据产品负责人审查意见，系统架构师完成两处表达优化：

- 明确数据与状态模型是逻辑模型，不代表最终物理存储设计或数据库 schema。
- 将“本地事件日志和查询投影的具体存储方案”改为“本地持久化与查询模型的具体方案”。

### 3. 实现任务拆解与一周开发计划

系统架构师输出 [15-implementation-plan.md](../execution/15-implementation-plan.md)，并在产品负责人审查后修订。

最终计划包含：

- 工作项录入与类型选择/识别最小入口。
- 逻辑模型与本地持久化。
- Agent CLI 适配与最小调用闭环。
- 工作项状态机。
- A2A 事件编排与记录。
- 方案与任务拆解流程。
- Harness 核心护栏。
- Review 与质量门禁记录。
- Worktree 与任务隔离最小治理。
- Git feature 分支交付安全流程。
- 人工升级流程。
- 统一时间线最小 UI。
- 复盘记录最小闭环。
- Dogfooding 评估增强。
- 首个端到端样例验证。

产品负责人审查后确认通过。

### 4. 零阶段复盘架构 Review

系统架构师 Review 了 [16-phase-zero-retrospective.md](16-phase-zero-retrospective.md)，并输出 [17-architecture-review-of-phase-zero-retrospective.md](17-architecture-review-of-phase-zero-retrospective.md)。

该 Review 重点补充：

- Git 仓库、远程、SSH、feature 分支、worktree 的执行风险。
- Agent CLI 可用性和调用协议风险。
- 文档审查门禁与系统运行质量门禁需要分类。
- 复盘记录需要区分事实、解释、改进建议、技术执行建议和已确认产品规则。
- T1 实现基线确认应作为硬门禁。

产品负责人已吸收其中应进入产品/治理基线的部分。

## 有效做法

- 先读产品文档再做架构设计，避免从聊天上下文猜测最终规则。
- 在架构文档中明确 Harness 是治理核心，而不是工具调用器。
- 在实现计划中把 P0 能力拆到可执行任务，避免架构停留在概念层。
- 对产品负责人反馈逐点判断，而不是默认附和或默认反驳。
- 将复盘 Review 独立成文档，避免直接改写产品负责人复盘，保留角色边界。
- 在后续补充中区分产品规则、架构建议和技术执行建议。

## 发现的问题

### 1. 初版实现计划低估了 Agent 接入的重要性

初版实现计划偏向流程记录、状态机、门禁和持久化，缺少 Agent CLI 适配任务。

影响：

- 可能把首版做成协作流程管理器，而不是三 Agent 协作聊天室。
- 无法验证 Codex、Claude、MiniMax 是否真的能在 Harness 下协作。

修正：

- 补充 `T4 Agent CLI 适配与最小调用闭环` 为 P0。

### 2. 初版实现计划遗漏工作项录入入口

计划目标中写了“用户录入工作项”，但任务表没有明确实现录入入口。

影响：

- E2E 无法从真实用户入口开始。
- 时间线可能只展示记录，而不能创建工作项。

修正：

- 补充 `T2 工作项录入与类型选择/识别最小入口` 为 P0。

### 3. 初版优先级误判了 Git 和 worktree 最小治理

初版将 Git feature 分支交付安全流程和 worktree 最小治理放为 P1。

影响：

- 与产品 P0 中的 feature 分支交付能力和并行治理要求不一致。
- Day 7 E2E 可能无法覆盖交付能力。

修正：

- 将 `T10 Worktree 与任务隔离最小治理` 调整为 P0。
- 将 `T11 Git feature 分支交付安全流程` 调整为 P0。

### 4. 初版任务拆解流程归属不清

初版没有明确谁负责生成任务负责人、依赖、边界、Review 方和验收标准。

影响：

- 方案先行可能退化为自由文本方案。
- Harness 无法结构化校验“是否允许进入开发”。

修正：

- 补充 `T7 方案与任务拆解流程` 为 P0。

### 5. 初版低估了复盘记录对首周闭环的重要性

初版将 Dogfooding 与复盘记录放为 P1。

影响：

- Day 7 虽可跑通流程，但自学习和复盘能力偏弱。

修正：

- 拆分为 `T14 复盘记录最小闭环` P0 和 `T15 Dogfooding 评估增强` P1。

### 6. 架构 Review 中未及时标记产品负责人确认状态

系统架构师输出 [17-architecture-review-of-phase-zero-retrospective.md](17-architecture-review-of-phase-zero-retrospective.md) 后，文档中曾保留“需要产品负责人确认的问题”。

影响：

- 产品负责人确认后，后续读者可能误以为问题仍未确认。

修正：

- 产品负责人已按方案补充“产品负责人后续确认结果”。

## 返工记录

- 新增系统架构设计文档。
- 为架构设计文档补充核心逻辑设计图。
- 删除架构文档中的“架构审查要求”，避免架构文档反向规定产品审查口径。
- 将系统架构设计加入文档索引。
- 新增实现任务拆解与一周开发计划。
- 根据产品负责人审查意见补充 Agent CLI、工作项录入、任务拆解流程。
- 将 Git feature 分支交付和 worktree 最小治理调整为 P0。
- 将复盘记录最小闭环调整为 P0。
- 新增系统架构师对零阶段复盘的 Review 文档。
- 将架构侧 Review 加入文档索引。

## 架构判断

### 1. 可以进入实现阶段，但只能从 T1 开始

当前文档基线已经足以进入实现阶段，但不能直接进入功能开发。

必须先执行 `T1 实现基线确认`，验证：

- 项目运行方式。
- Git 仓库状态。
- 远程仓库配置。
- worktree 可用性。
- Agent CLI 可用性。
- 本地持久化路径。
- 测试、构建或检查命令。
- 文件读写和编码策略。

### 2. Agent CLI 是首周最大执行不确定性

如果 Codex、Claude、MiniMax 不能被真实调用，自动化三 Agent 闭环不能算通过。

可接受的阶段性降级是继续零阶段人工接力，并把降级原因记录为阻塞或执行风险；不应静默使用模拟结果替代三 Agent 协作。

### 3. Git 交付能力需要真实环境验证

feature 分支交付是首版核心能力。若 Git 环境或凭证未就绪，可以阶段性接受“交付前检查通过 + 推送阻塞原因可见”，但不能算完整交付能力通过。

### 4. 复盘分类应成为 Harness/Dogfooding 的基础能力

后续复盘记录至少应区分：

- 观察到的事实。
- Agent 或角色解释。
- 改进建议。
- 技术执行建议。
- 已确认产品规则。

否则 Dogfooding 反馈容易污染产品基线。

## 技术执行建议

以下是系统架构师建议，不自动成为产品规则。

- T1 应作为硬门禁执行，不应被压缩。
- T4 应优先验证真实 Agent CLI 调用，而不是先做模拟。
- T10 只做最小 worktree 绑定和冲突状态检查，不做完整自动合并。
- T11 先实现交付前检查和 feature 分支准备，再处理可选 PR。
- T16 至少验证一条成功路径和一条被门禁阻断的失败路径。
- UTF-8 读取和展示应作为实现环境风险处理。

## 需要产品负责人 Review 的问题

1. 本复盘中“架构判断”和“技术执行建议”的边界是否清晰？
2. 是否需要将本复盘中的某些内容吸收进 [16-phase-zero-retrospective.md](16-phase-zero-retrospective.md)，还是保留为架构师独立复盘即可？
3. `T1` 是否需要在 [15-implementation-plan.md](../execution/15-implementation-plan.md) 中进一步展开为子检查项，还是由开发执行时细化？
4. “Agent CLI 不可用时继续零阶段人工接力”是否应补充到风险控制或零阶段流程文档中？

## 下一步

等待产品负责人对本复盘做产品侧 Review。

在本复盘未被产品负责人吸收前，后续开发仍应按 [15-implementation-plan.md](../execution/15-implementation-plan.md) 从 `T1 实现基线确认` 开始，不跳过 Git/worktree、Agent CLI、持久化、检查命令和编码策略验证。

## 产品负责人 Review 结果

产品负责人已完成本复盘的产品侧 Review。

结论：

- 本复盘中“架构判断”和“技术执行建议”的边界清晰，没有把技术实现细节错误升级成产品规则。
- 本复盘可作为系统架构师独立复盘保留，不需要并入 [16-phase-zero-retrospective.md](16-phase-zero-retrospective.md) 全文。
- `T1 实现基线确认` 需要在 [15-implementation-plan.md](../execution/15-implementation-plan.md) 中进一步展开为子检查项。
- “Agent CLI 不可用时继续零阶段人工接力”需要补充到风险控制和零阶段流程文档中。

已吸收更新：

- [15-implementation-plan.md](../execution/15-implementation-plan.md) 已补充 `T1` 子检查清单。
- [09-risk-controls.md](../product/09-risk-controls.md) 已补充 Agent CLI 降级规则。
- [12-phase-zero-manual-workflow.md](../collaboration/12-phase-zero-manual-workflow.md) 已补充 Agent CLI 不可用时的降级处理。

因此，本复盘中“需要产品负责人 Review 的问题”已完成处理；后续开发仍应按 [15-implementation-plan.md](../execution/15-implementation-plan.md) 从 `T1 实现基线确认` 开始。
