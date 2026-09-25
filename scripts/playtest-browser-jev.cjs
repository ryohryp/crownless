"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");

const JEV_BROWSER_PACKAGE = "@jkudish/jev-browser@0.5.0";
const DEFAULT_TASK =
  "Crownlessの体験モードを開始し、囁きの森へ遠征する。敵と遭遇したら「斬る」ボタンをクリックして敵にダメージを与え、ダメージ結果が表示されたら完了とする。現実の散策モードや位置情報/GPSは使わない。";
const DEFAULT_MAX_STEPS = "12";
const DEFAULT_MAX_SECONDS = "30";

function fail(message) {
  console.error(`[jev-browser] ${message}`);
  process.exitCode = 1;
}

function waitForServer(server) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      reject(new Error(`Crownless server did not start in time. ${stderr}`));
    }, 5000);

    server.stdout.setEncoding("utf8");
    server.stderr.setEncoding("utf8");

    server.stdout.on("data", (chunk) => {
      stdout += chunk;
      const match = stdout.match(/http:\/\/localhost:(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(Number(match[1]));
      }
    });

    server.stderr.on("data", (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });

    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Crownless server exited before becoming ready (code ${code}). ${stderr}`));
    });
  });
}

function runCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

async function main() {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor < 22) {
    fail(`Node.js 22+ is required by ${JEV_BROWSER_PACKAGE}; current: ${process.version}`);
    return;
  }

  if (!process.env.TYPESAFE_API_KEY) {
    fail("TYPESAFE_API_KEY is required. Keep the key in the environment; never put it in the task or repository.");
    return;
  }

  const root = path.resolve(__dirname, "..");
  const server = spawn(process.execPath, ["scripts/serve-slice.cjs"], {
    cwd: root,
    env: { ...process.env, PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let port;
  try {
    port = await waitForServer(server);
  } catch (error) {
    server.kill();
    throw error;
  }

  const startUrl = `http://127.0.0.1:${port}/`;
  const task = process.env.CROWNLESS_JEV_TASK || DEFAULT_TASK;
  const maxSteps = process.env.CROWNLESS_JEV_MAX_STEPS || DEFAULT_MAX_STEPS;
  const maxSeconds = process.env.CROWNLESS_JEV_MAX_SECONDS || DEFAULT_MAX_SECONDS;
  const npxArgs = [
    "-y",
    JEV_BROWSER_PACKAGE,
    "run",
    task,
    startUrl,
    "--format",
    "text",
    "--max-chars",
    "4000",
    "--max-steps",
    String(maxSteps),
    "--max-seconds",
    String(maxSeconds),
    "--no-typing",
  ];
  const command = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npx";
  const args = process.platform === "win32" ? ["/c", "npx", ...npxArgs] : npxArgs;

  console.log(`[jev-browser] start: ${startUrl}`);
  console.log(`[jev-browser] task: ${task}`);
  console.log(`[jev-browser] package: ${JEV_BROWSER_PACKAGE}`);

  const startedAt = Date.now();

  try {
    const result = await runCommand(
      command,
      args,
      {
        cwd: root,
        env: process.env,
        stdio: "inherit",
      }
    );

    const elapsedMs = Date.now() - startedAt;
    console.log(`[jev-browser] elapsed: ${elapsedMs}ms`);

    if (result.code !== 0) {
      fail(`browser playtest failed (exit ${result.code ?? "null"}, signal ${result.signal ?? "none"})`);
    }
  } finally {
    server.kill();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
