"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");

const JEV_BROWSER_PACKAGE = process.env.CROWNLESS_JEV_PACKAGE || "@jkudish/jev-browser@0.7.0";
const SMOKE_TASK =
  "Crownlessの体験モードを開始し、囁きの森へ遠征する。敵と遭遇したら「斬る」ボタンをクリックして敵にダメージを与え、ダメージ結果が表示されたら完了とする。現実の散策モードや位置情報/GPSは使わない。";
const FULL_LOOP_TASK =
  "Crownlessの体験モードを開始し、囁きの森へ遠征する。戦闘中は撤退せず、敵の予兆を見て戦う。強撃は気力が2以上ある時だけ使い、気力不足なら「斬る」で気力を回復する。遠征を生還して帰還画面まで進み、入手装備や鉄片を確認する。Gearで補強できる場合は補強ボタンを押して結果を確認し、その後「この装備で囁きの森へもう一度」から同じ土地へ再遠征する。再遠征先で最初の戦闘行動を行い、強化後の攻撃結果または再遠征が成立したことを確認したら完了とする。現実の散策モードや位置情報/GPSは使わない。";
const MODE_DEFAULTS = {
  smoke: { task: SMOKE_TASK, maxSteps: "12", maxSeconds: "30" },
  full: { task: FULL_LOOP_TASK, maxSteps: "30", maxSeconds: "120" },
};

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

  const mode = process.argv.includes("--full") ? "full" : (process.env.CROWNLESS_JEV_MODE || "smoke");
  const defaults = MODE_DEFAULTS[mode];
  if (!defaults) {
    fail(`Unknown CROWNLESS_JEV_MODE "${mode}". Use "smoke" or "full".`);
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
  const task = process.env.CROWNLESS_JEV_TASK || defaults.task;
  const maxSteps = process.env.CROWNLESS_JEV_MAX_STEPS || defaults.maxSteps;
  const maxSeconds = process.env.CROWNLESS_JEV_MAX_SECONDS || defaults.maxSeconds;
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

  console.log(`[jev-browser] mode: ${mode}`);
  console.log(`[jev-browser] start: ${startUrl}`);
  console.log(`[jev-browser] task: ${task}`);
  console.log(`[jev-browser] package: ${JEV_BROWSER_PACKAGE}`);

  const startedAt = Date.now();

  try {
    const result = await runCommand(command, args, {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    });

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
