# T4 Agent CLI 适配 — 非作者 Review

> 状态：通过
> 所属：执行
> 规则效力：T4 门禁 Review 记录
> 维护角色：Claude（Review 方）
> 执行 Agent：Codex（作者）
> 任务 ID：T4
> Review 对象：`docs/execution/30-t4-agent-cli-adapter-result.md` 及关联代码
> 日期：2026-06-19

## 一、Review 结论

✅ 通过。

T4 已满足启动包验收标准：三个真实本地 CLI 可由统一适配层调用，任务上下文完整下发，调用结果统一归一化，结果可回写为 T3 结构化 A2AEvent 记录。

## 二、Review 对象与视角

| 项 | 值 |
|---|---|
| Review 对象 | Codex 输出的 T4 实现：`src/agents/`、`bin/clowder-agent.js`、`test/`、`scripts/verify-agent-cli.js`、`30-t4-agent-cli-adapter-result.md` |
| 被 Review 方 | Codex（T4 作者） |
| Review 方 | Claude（非作者，符合 AGENTS.md 要求） |
| Review 视角 | 非作者五轴审查：正确性、可读性、架构对齐、安全性、可验证性 |
| 是否允许直接修改 | 否。本次 Review 只输出结论和建议，不直接修改 T4 代码 |

### 必须检查的问题（来自启动包 §6 Review 通过标准）

| 检查项 | 结论 |
|---|---|
| 未使用 mock 替代真实 CLI | ✅ `verify:agents` 脚本真实调用 Codex/Claude/MiniMax，30 号文档附真实调用证据和 A2AEvent ID |
| 输入上下文字段完整（含允许动作级别、文件/模块边界、验证方式、质量门禁、失败处理） | ✅ `task-context.js` 校验 15 必填字段，缺失即拒绝调用 |
| 错误处理和超时治理可见 | ✅ `error_classification` 覆盖 9 种分类，超时有 `SIGTERM` 和明确 `timed_out` 字段 |
| 结果回写边界清晰 | ✅ `recordAgentInvocation()` 仅写入 T3 `a2a-events.json`，不扩展模型 |
| 敏感信息未原样入库或入文档 | ✅ 三层脱敏：token/key 模式替换、本地路径替换、stdout/stderr 摘要截断 |
| 实现没有越界吞并 T6/T8 职责 | ✅ T4 仅做"调用 + 归一化 + 回写"，无编排、无护栏、无状态机 |

### 不在本次 Review 范围内的问题（来自启动包 §2 范围外）

- 不检查 A2A 编排或多轮协作流程（属 T6）
- 不检查 Harness 护栏或权限决策（属 T8）
- 不检查页面级 UI 或交互体验（属 T13/T16）
- 不检查语义级输出解析（T4 只要求进程级归一化）

## 三、逐项核查

### 3.1 CLI 适配（`src/agents/cli-adapter.js`）

| 检查项 | 结论 |
|---|---|
| 三个 Agent 配置完整 | ✅ Codex（stdin 下发）、Claude（args 下发）、MiniMax（`--message` 下发） |
| Windows 兼容 | ✅ shell 包装按 Agent 差异化处理；`windowsHide: true` 防止终端弹窗 |
| 结果归一化 | ✅ 统一 14 字段结构（agent/identity/exit_code/signal/timed_out/error_classification 等） |
| 超时处理 | ✅ 默认 30s，`SIGTERM` + `timedOut` 标记 |
| 输出截断 | ✅ stdout/stderr 各保留最后 20000 字符 |
| DI 可测 | ✅ `runner` 参数支持注入 fake exec，测试无需真实 CLI |

### 3.2 任务上下文（`src/agents/task-context.js`）

| 检查项 | 结论 |
|---|---|
| 必填字段数 | ✅ 15 字段，覆盖启动包 §2 全部要求 |
| 数组字段校验 | ✅ `dependencies`/`acceptance`/`prohibited_items` 等 9 个数组字段，空数组拒绝 |
| 文本字段校验 | ✅ `identity`/`task_id`/`goal`/`git_identity` 等，空字符串拒绝 |
| prompt 格式化 | ✅ 英文 prompt 头 + 结构化 JSON 下发 |

### 3.3 结果回写（`src/agents/response-recording.js`）

| 检查项 | 结论 |
|---|---|
| T3 持久化复用 | ✅ `createPersistence(dataDir).createA2AEvent()` |
| 脱敏 | ✅ token 模式 3 类正则 + 本地路径 2 类正则 |
| 摘要 | ✅ stdout/stderr 摘要限 1200 字符 |
| purpose 正确 | ✅ `execution_sync`（T3 A2A_PURPOSES 合法值） |
| requires_user_intervention | ✅ 失败时 `true`，成功时 `false` |

### 3.4 CLI 入口（`bin/clowder-agent.js`）

| 检查项 | 结论 |
|---|---|
| 参数校验 | ✅ `--agent` 必填且校验在已知列表内；`--context-file` 必填 |
| 选项一致 | ✅ `--data-dir`/`--timeout-ms`/`--record` 与 T2 `clowder-work-item.js` 风格一致 |
| 结果输出 | ✅ JSON 格式，包含 result 和 record |

### 3.5 验证（`test/` + `scripts/verify-agent-cli.js`）

| 检查项 | 结论 |
|---|---|
| 上下文校验测试 | ✅ 正常 + 缺失 git_identity 拒绝 |
| 归一化测试 | ✅ 成功/超时/CLI 不存在三条路径 |
| 脱敏测试 | ✅ token 和路径均被替换 |
| A2AEvent 回写测试 | ✅ 记录 id 格式 + 落盘验证 |
| 真实验证 | ✅ `npm run verify:agents` 三 CLI 均返回 exit 0，A2AEvent 写入 |

## 四、发现与建议

### 4.1 `to_agent: "Clowder"` 非标准 Agent 身份（建议）

`response-recording.js:20` 将 A2AEvent 的 `to_agent` 设为 `"Clowder"`。当前 T3 不校验 agent 身份枚举，故不抛错。但 T6 按 `from_agent`/`to_agent` 做 A2A 查询时，"Clowder" 不在 Codex/Claude/MiniMax 三者之列，可能被遗漏。

**建议**：改为 `"system"` 或在架构文档中显式定义 Harness/系统代理身份。

### 4.2 超时信号 Windows 兼容（建议）

`runCommand` 超时使用 `child.kill("SIGTERM")`。Windows 不支持 POSIX 信号，`SIGTERM` 在 Windows 上等价于强制终止，无法区分"超时退出"和"崩溃退出"。

**建议**：加注 Windows 限制，可选补充两级 kill（SIGTERM + 2s 后 SIGKILL 接力）。

### 4.3 验证数据目录未忽略（建议）

`scripts/verify-agent-cli.js` 写入 `data/__t4-agent-verify/`。交付文档声明"不作为提交产物"，但仓库无 `.gitignore` 覆盖该路径。

**建议**：在 `.gitignore` 加 `data/__*` 或在 verify 脚本末尾清理。

## 五、验证结果复现

T4 worktree 内执行：

```
npm run check       → checked 22 JavaScript files
npm test            → work-item-entry tests passed
                       agent-cli-adapter tests passed
npm run verify:agents → Codex/Claude/MiniMax 全通过
```

Review 方未在 T4 worktree 内独立复现 `verify:agents`（需本机 CLI 认证环境）。该验证由 Codex 在具备 CLI 环境的同一机器上完成，结果已记录在 30 号文档。

## 六、Review 元信息

| 项 | 值 |
|---|---|
| Review 方身份 | Claude（非作者，符合 AGENTS.md 独立性要求） |
| Review 对象归属 | Codex 的 T4 产出 |
| Review 结论类型 | 通过 |
| 是否涉及 UI/视觉/多模态 | 否 |
| 是否允许直接修改 | 否 |

## 七、输出记录

- **实际完成内容**：对 T4 实现做五轴非作者 Review，覆盖 CLI 适配、任务上下文、结果回写、脱敏、验证。
- **未完成内容或偏离项**：无。Review 发现的 3 条建议均不阻塞通过。
- **修改过的文件或文档**：本文档（新增）。
- **验证方式和结果**：`npm run check` / `npm test` / `npm run verify:agents` 均在 T4 worktree 通过。
- **Review 结论**：通过。
- **建议下一状态或交接状态**：T4 通过 → 交接给 T6。T6 对 T4 的依赖可解除。
- **是否解除依赖**：是。T4 已提供可复用的 Agent CLI 适配层，T6 A2A 编排可在此基础上构建。
- **是否阻断后续任务**：否。T4 不阻断 T6/T8/T11。
- **是否触发 Review / 质量门禁 / 人工确认 / 复盘**：本次即为非作者 Review。质量门禁通过。无人工确认或复盘触发。
- **后续阻断关系和被影响任务**：无。T4 通过后，T6 可启动。
- **遗留风险**：Codex CLI stderr 含远程插件目录认证 warning（不影响本次调用）；各 Agent CLI 输出格式不统一（T6 需在编排层定义更严格协议）；CLI 调用依赖本机认证和网络（其他环境可能失败）。
- **是否需要产品负责人或系统架构师确认**：否。
