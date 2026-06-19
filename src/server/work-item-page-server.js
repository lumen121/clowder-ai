"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");

const { DEFAULT_DATA_DIR, createAndSaveWorkItem } = require("../work-items/create-work-item");
const { createPersistence } = require("../storage");

const PUBLIC_DIR = path.join(__dirname, "..", "..", "public");
const DOCS_DIR = path.join(__dirname, "..", "..", "docs", "execution");
const STATUS_BOARD_PATH = path.join(DOCS_DIR, "task-status-board.md");
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function startServer(options = {}) {
  const host = options.host || "127.0.0.1";
  const port = options.port ?? 4317;
  const dataDir = options.dataDir || DEFAULT_DATA_DIR;

  const server = http.createServer((request, response) => {
    handleRequest(request, response, { dataDir }).catch((error) => {
      const statusCode = isClientError(error) ? 400 : 500;
      sendJson(response, statusCode, { error: error.message });
    });
  });

  server.listen(port, host);
  return server;
}

async function handleRequest(request, response, context) {
  const url = new URL(request.url, "http://localhost");

  if (request.method === "POST" && url.pathname === "/api/work-items") {
    const body = await readJsonBody(request);
    const { workItem, storage } = createAndSaveWorkItem(
      {
        rawRequest: body.raw_request,
        title: body.title,
        type: body.type,
        source: "page",
      },
      { dataDir: context.dataDir },
    );
    sendJson(response, 201, { work_item: workItem, storage });
    return;
  }

  // ── T13A Lite 控制台 API ──────────────────────────────────────────

  // GET /api/console/status — 返回任务状态板结构化数据
  if (request.method === "GET" && url.pathname === "/api/console/status") {
    const statusData = readTaskStatusBoard();
    sendJson(response, 200, { tasks: statusData });
    return;
  }

  // GET /api/console/start-packages — 返回现有启动包列表
  if (request.method === "GET" && url.pathname === "/api/console/start-packages") {
    const packages = listStartPackages();
    sendJson(response, 200, { packages });
    return;
  }

  // POST /api/console/user-input — 保存用户补充信息/确认意见
  if (request.method === "POST" && url.pathname === "/api/console/user-input") {
    const body = await readJsonBody(request);
    const record = saveUserInput(body, context.dataDir);
    sendJson(response, 201, { record });
    return;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const filePath = resolveStaticPath(url.pathname);
  if (!filePath) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  const ext = path.extname(filePath);
  response.writeHead(200, {
    "content-type": MIME_TYPES[ext] || "application/octet-stream",
  });
  fs.createReadStream(filePath).pipe(response);
}

function resolveStaticPath(pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(PUBLIC_DIR, relative);
  if (!isPathInside(PUBLIC_DIR, filePath) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return null;
  }
  return filePath;
}

function isPathInside(basePath, candidatePath) {
  const resolvedBase = path.resolve(basePath);
  const resolvedCandidate = path.resolve(candidatePath);

  if (process.platform === "win32") {
    const base = resolvedBase.toLowerCase();
    const candidate = resolvedCandidate.toLowerCase();
    return candidate === base || candidate.startsWith(base + path.sep);
  }

  return resolvedCandidate === resolvedBase || resolvedCandidate.startsWith(resolvedBase + path.sep);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let data = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      data += chunk;
      if (data.length > 128 * 1024) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function isClientError(error) {
  return (
    error instanceof SyntaxError ||
    error.message === "Request body must be valid JSON." ||
    error.message === "Request body is too large." ||
    error.message === "Work item request is required." ||
    error.message.startsWith("Unknown work item type:")
  );
}

// ═══════════════════════════════════════════════════════════════════════
// T13A Lite 控制台辅助函数
// ═══════════════════════════════════════════════════════════════════════

/**
 * 解析 task-status-board.md 中的任务表格，返回结构化数据。
 *
 * 解析策略：
 *   - 找到 `| 任务 | 状态 | Owner |` 表头行。
 *   - 后续以 `| T` 或 `| T1` 开头的行视为数据行。
 *   - 按 `|` 分割，trim 各单元格，提取 10 列。
 *
 * @returns {object[]} 任务状态对象数组
 */
function readTaskStatusBoard() {
  let md;
  try {
    md = fs.readFileSync(STATUS_BOARD_PATH, "utf8");
  } catch {
    return [];
  }

  const lines = md.split("\n");
  const tasks = [];
  let inTable = false;

  for (const line of lines) {
    // 检测表头行
    if (line.startsWith("| 任务 ") || line.startsWith("| 任务\t")) {
      inTable = true;
      continue;
    }
    // 跳过表头分隔行
    if (inTable && line.includes("---")) continue;
    // 数据行
    if (inTable && (line.startsWith("| T1") || line.startsWith("| T"))) {
      const cols = line.split("|").map((c) => c.trim()).filter(Boolean);
      if (cols.length >= 10) {
        tasks.push({
          id:          cols[0],
          name:        cols[0],       // 任务 ID 作为名称
          status:      cols[1],
          owner:       cols[2],
          dependencies: cols[3],
          start_package: extractLink(cols[4]),
          result:      extractLink(cols[5]),
          review:      extractLink(cols[6]),
          verification: cols[7],
          blocked:     cols[8],
          next_step:   cols[9],
        });
      }
      continue;
    }
    // 空行或非表格行：结束表格
    if (inTable && (!line.trim() || !line.startsWith("|"))) {
      break;
    }
  }

  return tasks;
}

/**
 * 从 Markdown 链接或纯文本中提取首个链接 URL。
 * "[text](url)" → "url"，否则返回原文本。
 */
function extractLink(text) {
  const m = text.match(/\[([^\]]*)\]\(([^)]+)\)/);
  return m ? m[2] : text;
}

/**
 * 列出 docs/execution/ 下所有任务启动包文件。
 *
 * @returns {object[]} { task_id, path, title } 数组
 */
function listStartPackages() {
  let files;
  try {
    files = fs.readdirSync(DOCS_DIR);
  } catch {
    return [];
  }

  // 文件名示例: 39-t13a-lite-user-console-start-package.md
  const pkgPattern = /^(\d+)-(.+)-start-package\.md$/;
  const packages = [];

  for (const name of files) {
    const m = name.match(pkgPattern);
    if (!m) continue;

    // 尝试读取文件首行 # 标题
    let title = name;
    try {
      const content = fs.readFileSync(path.join(DOCS_DIR, name), "utf8");
      const h1 = content.match(/^#\s+(.+)$/m);
      if (h1) title = h1[1];
    } catch {
      // 读失败就用文件名
    }

    packages.push({
      task_id: `T${m[1]}`,
      path: `docs/execution/${name}`,
      title,
    });
  }

  packages.sort((a, b) => a.task_id.localeCompare(b.task_id));
  return packages;
}

/**
 * 将用户补充信息/确认意见保存为 T3 A2AEvent，确保可追踪。
 *
 * @param {object} body - 请求体 { content, context_type?, related_task? }
 * @param {string} dataDir - 数据目录
 * @returns {object} 创建的 A2AEvent 记录
 */
function saveUserInput(body, dataDir) {
  const content = String(body.content || "").trim();
  if (!content) {
    throw new Error("用户输入内容不能为空。");
  }

  const persistence = createPersistence(dataDir || DEFAULT_DATA_DIR);

  return persistence.createA2AEvent({
    from_agent: "user",
    to_agent: "system",
    work_item_id: "t13a-lite-console",
    task_id: body.related_task || null,
    purpose: "execution_sync",
    context: JSON.stringify({
      kind: "user_supplementary_input",
      context_type: body.context_type || "general",
      recorded_at: new Date().toISOString(),
    }),
    claim_or_request: "用户通过 Lite 控制台录入补充信息或确认意见",
    response: content,
    conclusion: "recorded",
    next_action: "awaiting_agent_review",
    requires_user_intervention: false,
  });
}

module.exports = {
  handleRequest,
  isPathInside,
  startServer,
  // 导出辅助函数供测试
  readTaskStatusBoard,
  listStartPackages,
  saveUserInput,
};
