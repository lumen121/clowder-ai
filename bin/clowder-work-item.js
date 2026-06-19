#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const { DEFAULT_DATA_DIR, createAndSaveWorkItem } = require("../src/work-items/create-work-item");

function main(argv) {
  const command = argv[2];
  switch (command) {
    case "create":
      return createCommand(argv.slice(3));
    default:
      printUsage();
      return 1;
  }
}

function createCommand(args) {
  const options = parseArgs(args);
  if (options.help) {
    printUsage();
    return 0;
  }

  const rawRequest = readRequest(options);
  const { workItem, storage } = createAndSaveWorkItem(
    {
      rawRequest,
      title: options.title,
      type: options.type,
      source: "cli_internal",
    },
    {
      dataDir: options.dataDir || DEFAULT_DATA_DIR,
    },
  );

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ storage, work_item: workItem }, null, 2)}\n`);
    return 0;
  }

  process.stdout.write(`Created work item ${workItem.id}\n`);
  process.stdout.write(`Type: ${typeLabel(workItem)} (${workItem.type})${typeHint(workItem)}\n`);
  process.stdout.write(`Status: ${workItem.status}\n`);
  process.stdout.write(`Storage: ${storage.path}\n`);
  return 0;
}

function parseArgs(args) {
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--data-dir":
        options.dataDir = requireValue(args, (index += 1), arg);
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--request":
      case "-r":
        options.request = requireValue(args, (index += 1), arg);
        break;
      case "--request-file":
        options.requestFile = requireValue(args, (index += 1), arg);
        break;
      case "--title":
        options.title = requireValue(args, (index += 1), arg);
        break;
      case "--type":
      case "-t":
        options.type = requireValue(args, (index += 1), arg);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function requireValue(args, index, flag) {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function readRequest(options) {
  if (options.request && options.requestFile) {
    throw new Error("Use either --request or --request-file, not both.");
  }

  if (options.requestFile) {
    return fs.readFileSync(path.resolve(options.requestFile), "utf8");
  }

  if (options.request) {
    return options.request;
  }

  throw new Error("Missing work item request. Use --request or --request-file.");
}

function printUsage() {
  process.stdout.write(`Usage (internal / phase-zero entry):
  node bin/clowder-work-item.js create --type <feature|bug_fix> --request "<request>"
  node bin/clowder-work-item.js create --request "<request>" --json

Options:
  --type, -t        Work item type. Supports feature, bug_fix, bug, 功能需求, Bug 修复.
  --request, -r     Raw user request text.
  --request-file    Read raw request text from a UTF-8 file.
  --title           Optional work item title.
  --data-dir        Override persistence root. Defaults to data.
  --json            Print JSON output.
`);
}

function typeHint(workItem) {
  const detection = workItem.metadata?.type_detection;
  if (!detection || detection.mode === "selected") {
    return "";
  }

  if (detection.mode === "defaulted") {
    return " [defaulted, low confidence; use --type to override]";
  }

  if (detection.confidence === "low") {
    return " [auto-detected, low confidence; use --type to override]";
  }

  return " [auto-detected]";
}

function typeLabel(workItem) {
  return WORK_ITEM_LABELS[workItem.type] || workItem.type;
}

const WORK_ITEM_LABELS = {
  feature: "功能需求",
  bug_fix: "Bug 修复",
};

try {
  process.exitCode = main(process.argv);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
