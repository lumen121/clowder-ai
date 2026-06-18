#!/usr/bin/env node

/**
 * minimal-mm.js
 *
 * 用 child_process.spawn() 调用 MiniMax CLI (mmx text chat)，
 * 解析 --output json 的输出，提取 content 文本并打印。
 *
 * 用法: node minimal-mm.js "你的问题"
 *
 * 注意: mmx 的 --output json 返回的是单个 JSON 对象（非 NDJSON），
 * 所以这里在进程结束后一次性解析，而不是逐行解析。
 */

const { spawn } = require("child_process");

// ── 1. 获取用户问题 ────────────────────────────────────────────────
const question = process.argv[2];
if (!question) {
  console.error("用法: node minimal-mm.js <问题>");
  process.exit(1);
}

// ── 2. 启动 mmx CLI 子进程 ─────────────────────────────────────────
// mmx text chat: 文本聊天
// --message:     用户消息
// --output json: 输出 JSON 格式（非 NDJSON，是完整 JSON）
// --no-color:    去掉 ANSI 颜色码
// --non-interactive: 禁用交互式提示，适合 CI/脚本模式
// --stream:      启用流式生成（更快的首字响应）
const child = spawn("mmx", [
  "text", "chat",                // 资源=text, 命令=chat
  "--message", question,         // 用户消息
  "--output", "json",            // JSON 输出
  "--no-color",                  // 不要 ANSI 颜色码
  "--non-interactive",           // 非交互模式
  "--stream",                    // 流式生成
], {
  stdio: ["ignore", "pipe", "pipe"],
  shell: true,                   // Windows: mmx 是 shell 脚本，需要 cmd.exe 解析
});

// ── 3. 收集 stdout（mmx 返回完整 JSON，不是 NDJSON）─────────────────
let stdout = "";

child.stdout.on("data", (chunk) => {
  stdout += chunk.toString();
});

// ── 4. stderr 透传（spinner "Thinking (Xs)" 等进度信息）────────────
child.stderr.on("data", (data) => {
  process.stderr.write(data);
});

// ── 5. 进程退出时解析 JSON ──────────────────────────────────────────
child.on("close", (code) => {
  if (code !== 0) {
    console.error(`\n[mmx CLI 退出，退出码: ${code}]`);
    process.exit(code ?? 1);
  }

  // 解析 JSON 输出
  try {
    const result = JSON.parse(stdout.trim());
    // mmx 的 JSON 结构: { "content": "回复文本", "usage": {...} }
    if (result.content) {
      process.stdout.write(result.content.trim() + "\n");
    }
  } catch (err) {
    console.error("解析 mmx 输出失败:", err.message);
    console.error("原始输出:", stdout.slice(0, 500));
    process.exit(1);
  }
});

// ── 6. 错误处理 ─────────────────────────────────────────────────────
child.on("error", (err) => {
  console.error("启动 mmx CLI 失败:", err.message);
  process.exit(1);
});
