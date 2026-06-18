#!/usr/bin/env node

/**
 * minimal-codex.js
 *
 * 用 child_process.spawn() 调用 OpenAI Codex CLI (codex exec)，
 * 解析 --json 的 JSONL 输出，提取 agent_message 的文本并打印。
 *
 * 用法: node minimal-codex.js "你的问题"
 */

const { spawn } = require("child_process");
const readline = require("readline");

// ── 1. 获取用户问题 ────────────────────────────────────────────────
const question = process.argv[2];
if (!question) {
  console.error("用法: node minimal-codex.js <问题>");
  process.exit(1);
}

// ── 2. 启动 Codex CLI 子进程 ───────────────────────────────────────
// codex exec: 非交互模式
// --json:     JSONL 流式输出（每行一个 JSON 事件）
// --color never: 避免终端颜色码混入输出
// --skip-git-repo-check: 允许在非 git 仓库目录运行
const child = spawn("codex", [
  "exec",                        // 非交互子命令
  "--json",                      // JSONL 输出
  "--color", "never",            // 不要 ANSI 颜色码
  "--skip-git-repo-check",       // 允许非 git 目录
  question,                      // 用户问题
], {
  stdio: ["ignore", "pipe", "pipe"],
  shell: true,                   // Windows: 让 cmd.exe 解析命令，自动匹配 .cmd 文件
});

// ── 3. 逐行解析 stdout（JSONL）────────────────────────────────────
const rl = readline.createInterface({ input: child.stdout });

rl.on("line", (line) => {
  if (!line.trim()) return;

  let event;
  try {
    event = JSON.parse(line);
  } catch {
    return;
  }

  // ── 4. 提取 agent_message 中的文本 ──────────────────────────────
  //
  // Codex JSONL 事件类型:
  //   thread.started  — 会话开始，含 thread_id
  //   turn.started    — 新一轮开始
  //   item.completed  — 消息/工具调用完成，这是我们要的内容
  //   turn.completed  — 本轮结束，含 usage 用量信息

  if (event.type === "item.completed") {
    const item = event.item;
    if (!item) return;

    // agent_message: 模型的文本回复
    if (item.type === "agent_message" && item.text) {
      process.stdout.write(item.text);
    }

    // tool_call / tool_result 等可以简要提示（可选）
    if (item.type === "tool_call") {
      process.stdout.write(`\n[🔧 调用工具: ${item.name}]\n`);
    }
  }

  // 可选：打印 thread id
  if (event.type === "thread.started") {
    console.error(`[thread: ${event.thread_id}]`);
  }
});

// ── 5. stderr 透传 ─────────────────────────────────────────────────
child.stderr.on("data", (data) => {
  process.stderr.write(data);
});

// ── 6. 进程退出处理 ────────────────────────────────────────────────
child.on("close", (code) => {
  if (code !== 0) {
    console.error(`\n[Codex CLI 退出，退出码: ${code}]`);
  }
  process.exit(code ?? 1);
});

child.on("error", (err) => {
  console.error("启动 Codex CLI 失败:", err.message);
  process.exit(1);
});
