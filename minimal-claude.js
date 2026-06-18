#!/usr/bin/env node

/**
 * minimal-claude.js
 *
 * 用 child_process.spawn() 调用 Claude CLI，解析 stream-json 输出，
 * 提取 assistant 事件的文本内容并打印到终端。
 *
 * 用法: node minimal-claude.js "你的问题"
 */

const { spawn } = require("child_process");
const readline = require("readline");

// ── 1. 获取用户问题 ────────────────────────────────────────────────
const question = process.argv[2];
if (!question) {
  console.error("用法: node minimal-claude.js <问题>");
  process.exit(1);
}

// ── 2. 启动 Claude CLI 子进程 ───────────────────────────────────────
const child = spawn("claude", [
  "-p", question,                 // 非交互模式，直接传入问题
  "--output-format", "stream-json", // NDJSON 流式输出
  "--verbose",                    // 必须和 stream-json 一起用
], {
  stdio: ["ignore", "pipe", "pipe"], // stdin 忽略，stdout/stderr 用 pipe 读取
});

// ── 3. 逐行解析 stdout（NDJSON）────────────────────────────────────
const rl = readline.createInterface({ input: child.stdout });

rl.on("line", (line) => {
  // 跳过空行
  if (!line.trim()) return;

  let event;
  try {
    event = JSON.parse(line);
  } catch {
    // 非 JSON 行直接忽略（比如某些调试输出）
    return;
  }

  // ── 4. 提取 assistant 类型事件中的文本 ──────────────────────────
  if (event.type === "assistant") {
    const content = event.message?.content;
    if (!Array.isArray(content)) return;

    for (const block of content) {
      // text 类型的 block 直接输出
      if (block.type === "text" && block.text) {
        process.stdout.write(block.text);
      }
      // tool_use 类型的 block 也可以简要提示（可选）
      if (block.type === "tool_use") {
        process.stdout.write(`\n[🔧 调用工具: ${block.name}]\n`);
      }
    }
  }

  // 可选：打印 system/subtype:init 中的 session_id
  if (event.type === "system" && event.subtype === "init") {
    console.error(`[session: ${event.session_id}]`);
  }
});

// ── 5. 处理 stderr（进度信息、verbose 日志等）──────────────────────
child.stderr.on("data", (data) => {
  // 这里只输出到 stderr，不干扰 stdout 的解析
  process.stderr.write(data);
});

// ── 6. 处理进程退出 ────────────────────────────────────────────────
child.on("close", (code) => {
  if (code !== 0) {
    console.error(`\n[Claude CLI 退出，退出码: ${code}]`);
  }
  process.exit(code ?? 1);
});

// 同时监听 error 事件（比如 claude 命令不存在）
child.on("error", (err) => {
  console.error("启动 Claude CLI 失败:", err.message);
  process.exit(1);
});
