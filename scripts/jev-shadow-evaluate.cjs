#!/usr/bin/env node
"use strict";

const { execFile } = require("node:child_process");

const ALLOWED = new Set(["done", "retry", "change_strategy", "needs_human"]);
const MAX_TEXT = 2000;
const MAX_FILES = 80;

function boundedText(value, max = MAX_TEXT) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function sanitizeEvidence(input) {
  const checks = input && typeof input.checks === "object" && input.checks ? input.checks : {};
  return {
    task: boundedText(input?.task, 1000),
    agentChoice: ALLOWED.has(input?.agentChoice) ? input.agentChoice : "needs_human",
    changedFiles: Array.isArray(input?.changedFiles)
      ? input.changedFiles.slice(0, MAX_FILES).map((value) => boundedText(value, 300))
      : [],
    diffSummary: boundedText(input?.diffSummary),
    checks: Object.fromEntries(
      Object.entries(checks).slice(0, 20).map(([key, value]) => [
        boundedText(key, 100),
        boundedText(String(value), 500),
      ]),
    ),
    ci: boundedText(input?.ci, 500),
    playtest: boundedText(input?.playtest, 1500),
    retryCount: Number.isInteger(input?.retryCount)
      ? Math.max(0, Math.min(input.retryCount, 20))
      : 0,
  };
}

function normalizeChoice(value) {
  const choice = String(value || "").trim().toLowerCase().replace(/[ -]+/g, "_");
  const aliases = {
    complete: "done",
    completed: "done",
    change: "change_strategy",
    change_strategy: "change_strategy",
    human: "needs_human",
    needs_human: "needs_human",
  };
  const normalized = aliases[choice] || choice;
  return ALLOWED.has(normalized) ? normalized : null;
}

function resultBase(evidence) {
  return {
    kind: "crownless.jev-shadow.v1",
    shadowOnly: true,
    authoritative: false,
    agentChoice: evidence.agentChoice,
  };
}

function emit(value) {
  process.stdout.write(JSON.stringify(value) + "\n");
}

function parseCommand(command) {
  const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return parts.map((part) => part.replace(/^"|"$/g, ""));
}

function evaluate(command, request, timeoutMs) {
  return new Promise((resolve) => {
    const parts = parseCommand(command);
    if (!parts.length) {
      resolve({ error: "empty_command" });
      return;
    }

    const child = execFile(
      parts[0],
      parts.slice(1),
      { timeout: timeoutMs, maxBuffer: 1024 * 1024, env: process.env },
      (error, stdout) => {
        if (error) {
          resolve({ error: error.killed ? "timeout" : "evaluator_failed" });
          return;
        }
        try {
          resolve({ response: JSON.parse(stdout) });
        } catch {
          resolve({ error: "invalid_json" });
        }
      },
    );
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify(request));
  });
}

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;

  let input;
  try {
    input = raw.trim() ? JSON.parse(raw) : {};
  } catch {
    emit({
      kind: "crownless.jev-shadow.v1",
      shadowOnly: true,
      authoritative: false,
      available: false,
      error: "invalid_evidence_json",
    });
    return;
  }

  const evidence = sanitizeEvidence(input);
  const base = resultBase(evidence);
  const command = process.env.CROWNLESS_JEV_MCP_COMMAND;

  if (!command) {
    emit({ ...base, available: false, error: "not_configured" });
    return;
  }

  const requestedTimeout = Number(process.env.CROWNLESS_JEV_TIMEOUT_MS || 8000);
  const timeoutMs = Math.max(1000, Math.min(Number.isFinite(requestedTimeout) ? requestedTimeout : 8000, 30000));
  const request = {
    task: "Judge Crownless cycle evidence only. Do not authorize actions.",
    choices: ["done", "retry", "change_strategy", "needs_human"],
    evidence,
  };

  const outcome = await evaluate(command, request, timeoutMs);
  if (outcome.error) {
    emit({ ...base, available: false, error: outcome.error });
    return;
  }

  const response = outcome.response || {};
  const choice = normalizeChoice(response.choice ?? response.decision ?? response.result?.choice);
  if (!choice) {
    emit({ ...base, available: false, error: "invalid_choice" });
    return;
  }

  const confidence = Number(response.confidence ?? response.result?.confidence);
  const probabilities = response.probabilities ?? response.result?.probabilities;
  emit({
    ...base,
    available: true,
    choice,
    agrees: choice === evidence.agentChoice,
    ...(Number.isFinite(confidence) ? { confidence } : {}),
    ...(probabilities && typeof probabilities === "object" ? { probabilities } : {}),
  });
}

main().catch(() => {
  emit({
    kind: "crownless.jev-shadow.v1",
    shadowOnly: true,
    authoritative: false,
    available: false,
    error: "unexpected_failure",
  });
});
