const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MAX_RECENT_LIMIT,
  collectWorkItems,
  normalizeRecentLimit,
} = require("../scripts/autopilot/work-items.js");

test("collectWorkItems queries four read-only categories and normalizes them", () => {
  const calls = [];
  const responses = [
    [{ number: 10, title: "Open issue", body: "issue body", url: "https://example.test/issues/10", state: "OPEN", labels: [{ name: "playtest-pending" }, { name: "agent-ready" }] }],
    [{ number: 11, title: "Open PR", body: "pr body", url: "https://example.test/pull/11", state: "OPEN", labels: [] }],
    [{ number: 8, title: "Closed issue", body: null, url: "https://example.test/issues/8", state: "CLOSED" }],
    [{ number: 9, title: "Merged PR", body: "done", url: "https://example.test/pull/9", state: "MERGED" }],
  ];
  const run = (args) => {
    calls.push(args);
    return JSON.stringify(responses[calls.length - 1]);
  };

  const snapshot = collectWorkItems({ repo: "ryohryp/crownless", recentLimit: 12, run });

  assert.equal(calls.length, 4);
  assert.deepEqual(calls.map((args) => args.slice(0, 4)), [
    ["issue", "list", "--state", "open"],
    ["pr", "list", "--state", "open"],
    ["issue", "list", "--state", "closed"],
    ["pr", "list", "--state", "merged"],
  ]);
  for (const args of calls) {
    assert.equal(args.includes("--repo"), true);
    assert.equal(args.includes("ryohryp/crownless"), true);
    assert.equal(args.some((value) => ["create", "edit", "close", "merge"].includes(value)), false);
    assert.equal(args.includes("number,title,body,url,state,labels"), true);
  }
  assert.equal(calls[2].includes("12"), true);
  assert.equal(calls[3].includes("12"), true);
  assert.equal(calls[2].includes("sort:updated-desc"), true);
  assert.equal(calls[3].includes("sort:updated-desc"), true);

  assert.deepEqual(snapshot.counts, {
    openIssues: 1,
    openPullRequests: 1,
    recentClosedIssues: 1,
    recentMergedPullRequests: 1,
  });
  assert.deepEqual(snapshot.items[0], {
    id: 10,
    number: 10,
    type: "issue",
    state: "open",
    title: "Open issue",
    body: "issue body",
    url: "https://example.test/issues/10",
    labels: ["playtest-pending", "agent-ready"],
  });
  assert.equal(snapshot.items[2].body, "");
  assert.deepEqual(snapshot.items[2].labels, []);
  assert.equal(snapshot.items[3].type, "pull_request");
  assert.equal(snapshot.items[3].state, "merged");
  assert.match(snapshot.collectedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("recentLimit is bounded and invalid limits fail closed", () => {
  assert.equal(normalizeRecentLimit(MAX_RECENT_LIMIT + 100), MAX_RECENT_LIMIT);
  assert.throws(() => normalizeRecentLimit(0), /positive integer/);
  assert.throws(() => normalizeRecentLimit(1.5), /positive integer/);
});

test("malformed GitHub JSON fails closed", () => {
  assert.throws(
    () => collectWorkItems({ repo: "ryohryp/crownless", run: () => "not-json" }),
    /Failed to parse open issues JSON/,
  );
});

test("unexpected GitHub result shape fails closed", () => {
  assert.throws(
    () => collectWorkItems({ repo: "ryohryp/crownless", run: () => JSON.stringify({ items: [] }) }),
    /Expected open issues to be a JSON array/,
  );
});

test("command failures propagate instead of producing an empty snapshot", () => {
  const failure = new Error("gh unavailable");
  assert.throws(
    () => collectWorkItems({ repo: "ryohryp/crownless", run: () => { throw failure; } }),
    (error) => error === failure,
  );
});
