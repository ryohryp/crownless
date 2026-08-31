const { execFileSync } = require("node:child_process");

const DEFAULT_RECENT_LIMIT = 20;
const MAX_RECENT_LIMIT = 50;
const OPEN_LIMIT = 100;
const JSON_FIELDS = "number,title,body,url,state";

function defaultRunner(args) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function normalizeRecentLimit(value) {
  if (value === undefined) return DEFAULT_RECENT_LIMIT;
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError("recentLimit must be a positive integer");
  }
  return Math.min(value, MAX_RECENT_LIMIT);
}

function parseList(raw, label) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse ${label} JSON: ${error.message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected ${label} to be a JSON array`);
  }
  return parsed;
}

function normalizeItem(item, type) {
  if (!item || typeof item !== "object") {
    throw new Error(`Invalid ${type} work item`);
  }
  const number = Number(item.number);
  if (!Number.isInteger(number) || number < 1 || typeof item.title !== "string") {
    throw new Error(`Invalid ${type} work item shape`);
  }
  return {
    id: number,
    number,
    type,
    state: String(item.state || "unknown").toLowerCase(),
    title: item.title,
    body: typeof item.body === "string" ? item.body : "",
    url: typeof item.url === "string" ? item.url : null,
  };
}

function queryList(run, args, label, type) {
  const raw = run(args);
  return parseList(raw, label).map((item) => normalizeItem(item, type));
}

function collectWorkItems({ repo, recentLimit, run = defaultRunner } = {}) {
  if (typeof repo !== "string" || !repo.trim()) {
    throw new TypeError("repo is required in owner/name form");
  }
  if (typeof run !== "function") {
    throw new TypeError("run must be a function");
  }

  const recent = normalizeRecentLimit(recentLimit);
  const common = ["--repo", repo, "--json", JSON_FIELDS];

  const openIssues = queryList(
    run,
    ["issue", "list", "--state", "open", "--limit", String(OPEN_LIMIT), ...common],
    "open issues",
    "issue",
  );
  const openPullRequests = queryList(
    run,
    ["pr", "list", "--state", "open", "--limit", String(OPEN_LIMIT), ...common],
    "open pull requests",
    "pull_request",
  );
  const recentClosedIssues = queryList(
    run,
    [
      "issue",
      "list",
      "--state",
      "closed",
      "--limit",
      String(recent),
      "--search",
      "sort:updated-desc",
      ...common,
    ],
    "recent closed issues",
    "issue",
  );
  const recentMergedPullRequests = queryList(
    run,
    [
      "pr",
      "list",
      "--state",
      "merged",
      "--limit",
      String(recent),
      "--search",
      "sort:updated-desc",
      ...common,
    ],
    "recent merged pull requests",
    "pull_request",
  );

  return {
    collectedAt: new Date().toISOString(),
    items: [
      ...openIssues,
      ...openPullRequests,
      ...recentClosedIssues,
      ...recentMergedPullRequests,
    ],
    counts: {
      openIssues: openIssues.length,
      openPullRequests: openPullRequests.length,
      recentClosedIssues: recentClosedIssues.length,
      recentMergedPullRequests: recentMergedPullRequests.length,
    },
  };
}

module.exports = {
  DEFAULT_RECENT_LIMIT,
  MAX_RECENT_LIMIT,
  collectWorkItems,
  normalizeItem,
  normalizeRecentLimit,
  parseList,
};
