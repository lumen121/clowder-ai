"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");

const { DEFAULT_DATA_DIR, createAndSaveWorkItem } = require("../work-items/create-work-item");

const PUBLIC_DIR = path.join(__dirname, "..", "..", "public");
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

module.exports = {
  handleRequest,
  isPathInside,
  startServer,
};
