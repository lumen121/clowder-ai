#!/usr/bin/env node

/**
 * invoke-cli.js
 *
 * 统一的 CLI 调用接口：invoke(cli, prompt) → Promise<string>
 * 支持 claude、codex、mmx 三种后端。
 *
 * 用法:
 *   const { invoke } = require("./invoke-cli");
 *   const reply = await invoke("claude", "你好");
 *   console.log(reply);
 *
 * 或直接命令行:
 *   node invoke-cli.js claude "你好，介绍自己"
 *   node invoke-cli.js codex "你好，介绍自己"
 *   node invoke-cli.js mmx  "你好，介绍自己"
 */

const { spawn } = require("child_process");
const { platform } = require("os");

const isWindows = platform() === "win32";

// ── 工具函数 ────────────────────────────────────────────────────────

/**
 * 对 cmd.exe 命令行参数进行转义。
 * 包含空格/特殊字符的参数用双引号包裹，内部双引号加倍转义。
 */
function escapeCmdArg(arg) {
  if (/[ \t&|<>^"%!()]/.test(arg)) {
    return `"${arg.replace(/"/g, '""')}"`;
  }
  return arg;
}

/**
 * 将参数数组拼接成 cmd.exe /c 所需的单行命令字符串。
 */
function joinCmdArgs(args) {
  return args.map(escapeCmdArg).join(" ");
}

// ── CLI 配置表 ──────────────────────────────────────────────────────

const CLI_CONFIG = {

  claude: {
    command: "claude",
    args: (prompt) => [
      "-p", prompt,
      "--output-format", "stream-json",
      "--verbose",
    ],
    // claude.exe 是 PE 可执行文件，Windows 可直接 spawn，无需 shell
    windowsShell: false,

    parseOutput(stdout) {
      const lines = stdout.split("\n");
      const texts = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        let event;
        try { event = JSON.parse(line); } catch { continue; }
        if (event.type !== "assistant") continue;
        const content = event.message?.content;
        if (!Array.isArray(content)) continue;
        for (const block of content) {
          if (block.type === "text" && block.text) {
            texts.push(block.text);
          }
        }
      }
      return texts.join("");
    },
  },

  codex: {
    command: "codex",
    args: (prompt) => [
      "exec",
      "--json",
      "--color", "never",
      "--skip-git-repo-check",
      prompt,
    ],
    windowsShell: true,            // codex 是 shell 脚本，需通过 cmd.exe 启动

    parseOutput(stdout) {
      const lines = stdout.split("\n");
      const texts = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        let event;
        try { event = JSON.parse(line); } catch { continue; }
        if (event.type !== "item.completed") continue;
        const item = event.item;
        if (item?.type === "agent_message" && item.text) {
          texts.push(item.text);
        }
      }
      return texts.join("");
    },
  },

  mmx: {
    command: "mmx",
    args: (prompt) => [
      "text", "chat",
      "--message", prompt,
      "--output", "json",
      "--no-color",
      "--non-interactive",
      "--stream",
    ],
    windowsShell: true,            // mmx 是 shell 脚本，需通过 cmd.exe 启动

    parseOutput(stdout) {
      const result = JSON.parse(stdout.trim());
      return result.content?.trim() ?? "";
    },
  },
};

// ── 核心函数 ────────────────────────────────────────────────────────

/**
 * 调用指定的 CLI 后端，返回模型回复的完整文本。
 *
 * Windows 下对 shell 脚本类型的 CLI（codex, mmx）使用显式 cmd.exe /d /c
 * 来启动，避免 `shell: true` 的 DeprecationWarning。
 *
 * @param {"claude"|"codex"|"mmx"} cli - CLI 名称
 * @param {string} prompt - 用户输入
 * @returns {Promise<string>} 模型回复文本
 */
async function invoke(cli, prompt) {
  const config = CLI_CONFIG[cli];
  if (!config) {
    throw new Error(`未知的 CLI: ${cli}，支持: ${Object.keys(CLI_CONFIG).join(", ")}`);
  }

  let { command, args: buildArgs, parseOutput, windowsShell } = config;
  let spawnArgs = buildArgs(prompt);
  let spawnOptions = { stdio: ["ignore", "pipe", "pipe"] };

  // Windows 下对 shell 脚本 CLI，通过 cmd.exe /d /c 显式启动
  // 这样既解决了 shell 脚本无法被 CreateProcess 直接执行的问题，
  // 也避免了 spawn() 的 shell:true 带来的 DeprecationWarning。
  if (isWindows && windowsShell) {
    const cmdExe = process.env.ComSpec || "cmd.exe";
    const cmdLine = [command, ...spawnArgs];
    spawnArgs = ["/d", "/c", joinCmdArgs(cmdLine)];
    command = cmdExe;
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, spawnArgs, spawnOptions);

    const chunks = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));

    // stderr 透传（进度信息、spinner 等）
    child.stderr.on("data", (data) => process.stderr.write(data));

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${cli} CLI 退出码: ${code}`));
        return;
      }
      try {
        const stdout = Buffer.concat(chunks).toString("utf-8");
        resolve(parseOutput(stdout));
      } catch (err) {
        reject(new Error(`解析 ${cli} 输出失败: ${err.message}`));
      }
    });

    child.on("error", (err) => {
      reject(new Error(`启动 ${cli} CLI 失败: ${err.message}`));
    });
  });
}

// ── 命令行入口 ─────────────────────────────────────────────────────
if (require.main === module) {
  const cli = process.argv[2];
  const prompt = process.argv[3];

  if (!cli || !prompt) {
    console.error("用法: node invoke-cli.js <claude|codex|mmx> <问题>");
    process.exit(1);
  }

  invoke(cli, prompt)
    .then((reply) => console.log(reply))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { invoke };
