#!/usr/bin/env node
"use strict";

const { startServer } = require("../src/server/work-item-page-server");

function main(argv) {
  const options = parseArgs(argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const server = startServer({
    host: options.host,
    port: options.port,
    dataDir: options.dataDir,
  });

  server.on("listening", () => {
    const address = server.address();
    const host = address.address === "::" ? "localhost" : address.address;
    process.stdout.write(`Clowder AI T2 page entry: http://${host}:${address.port}\n`);
  });
}

function parseArgs(args) {
  const options = {
    host: "127.0.0.1",
    port: 4317,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--host":
        options.host = requireValue(args, (index += 1), arg);
        break;
      case "--port":
        options.port = Number(requireValue(args, (index += 1), arg));
        if (!Number.isInteger(options.port) || options.port <= 0) {
          throw new Error("--port must be a positive integer.");
        }
        break;
      case "--data-dir":
        options.dataDir = requireValue(args, (index += 1), arg);
        break;
      case "--help":
      case "-h":
        options.help = true;
        return options;
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

function printUsage() {
  process.stdout.write(`Usage:
  node bin/clowder-page.js [--host 127.0.0.1] [--port 4317]

Options:
  --host       Host to bind. Defaults to 127.0.0.1.
  --port       Port to bind. Defaults to 4317.
  --data-dir   Override persistence root. Defaults to data.
`);
}

try {
  main(process.argv);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
