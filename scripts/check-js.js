#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ROOT_FILES = [
  "invoke-cli.js",
  "minimal-claude.js",
  "minimal-codex.js",
  "minimal-mm.js",
];
const DIRS = ["bin", "scripts", "src", "test"];

function main() {
  const files = [
    ...ROOT_FILES.map((file) => path.join(ROOT, file)).filter((file) => fs.existsSync(file)),
    ...DIRS.flatMap((dir) => collectJsFiles(path.join(ROOT, dir))),
  ];

  for (const file of files) {
    const result = spawnSync(process.execPath, ["--check", file], {
      cwd: ROOT,
      encoding: "utf8",
    });

    if (result.status !== 0) {
      process.stderr.write(result.stderr || result.stdout);
      process.exit(result.status || 1);
    }
  }

  process.stdout.write(`checked ${files.length} JavaScript files\n`);
}

function collectJsFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }
  return files;
}

main();
