const assert = require("node:assert/strict");
const test = require("node:test");
const { detectDuplicateProposal, diceSimilarity } = require("../scripts/autopilot/duplicate-detection.js");

function score(value = 2, applicable = true) { return { applicable, score: value, rationale: "test rationale" }; }
function gate() { return { playerVisible: score(), decision: score(), riskReward: score(0, false), coreLoop: score(), replayability: score(), fantasy: score(), geography: score(0, false), canon: score(3) }; }
function candidate(title, kind, reason, selected) {
  return { title, kind, locationRelated: false, gameplayGate: gate(), reason, selected, learningSources: [], revisitsKilledHypothesis: false, killRevisitEvidence: null };
}
function proposal(overrides = {}) {
  const title = overrides.title || "遠征報告から負傷した仲間へ直接移動できるようにする";
  const scope = overrides.scope || "report summary から既存 companion detail を開く導線のみ";
  return {
    action: "create_issue", title, whyNow: "Report → Adapt の導線が途切れている", scope,
    acceptanceCriteria: ["負傷した仲間の詳細を報告から開ける"], nonGoals: ["No new companion mechanics"], risk: "low", humanGate: false, playtestRequired: false,
    proposalType: "friction", recentCycleReview: { cyclesReviewed: 5, newPlayAdded: false, maintenanceHeavy: false, summary: "Recent cycles reviewed" },
    recentPlaytestLearning: { entries: [], summary: "No human-confirmed playtest learning found" },
    learningApplication: { appliedSources: [], ignoredSources: [], summary: "No playtest learning to apply" },
    candidates: [
      candidate(title, "friction", "clear friction", true),
      candidate("Alternative A", "gameplay", "not now", false),
      candidate("Alternative B", "gameplay", "not now", false),
    ], gameplayHypothesis: null,
    ...overrides, title, scope,
  };
}

test("detects normalized exact title matches", () => {
  const result = detectDuplicateProposal(proposal({ title: "World Atlas の表示を改善する" }), [{ type: "issue", number: 10, state: "open", title: "world atlasの表示を改善する", url: "https://example.test/10" }]);
  assert.equal(result.duplicate, true); assert.equal(result.reason, "exact_title"); assert.equal(result.match.id, 10); assert.equal(result.match.type, "issue");
});

test("detects clear title containment", () => {
  const result = detectDuplicateProposal(proposal({ title: "Autopilot Planner duplicate detection" }), [{ type: "pull_request", number: 20, state: "open", title: "feat: Autopilot Planner duplicate detection を追加する" }]);
  assert.equal(result.duplicate, true); assert.equal(result.reason, "title_contains"); assert.equal(result.match.type, "pull_request");
});

test("detects Japanese and English near-duplicates with character n-grams", () => {
  const japanese = detectDuplicateProposal(proposal(), [{ type: "closed_issue", number: 30, state: "closed", title: "帰還報告から負傷した仲間の詳細へ直接移動する", body: "report summary の injured companion から detail を開く" }]);
  assert.equal(japanese.duplicate, true); assert.equal(japanese.reason, "ngram_similarity");
  const english = detectDuplicateProposal(proposal({ title: "Add report history selector", scope: "Allow selecting older expedition reports from the ledger" }), [{ type: "merged_pr", number: 40, state: "merged", title: "feat: add expedition report history selector", body: "Read older completed expedition reports from the ledger" }]);
  assert.equal(english.duplicate, true); assert.equal(english.reason, "ngram_similarity");
});

test("does not flag unrelated work", () => {
  assert.deepEqual(detectDuplicateProposal(proposal(), [
    { type: "issue", number: 50, state: "open", title: "World Atlas の座標投影を修正する", body: "広域探索の地図表示" },
    { type: "merged_pr", number: 51, state: "merged", title: "Autopilot preflight を追加する", body: "gh と Codex CLI を検証する" },
  ]), { ok: true, duplicate: false, decision: "continue", reason: null, match: null });
});

test("treats all work item types uniformly", () => {
  for (const type of ["issue", "pull_request", "closed_issue", "merged_pr"]) {
    const result = detectDuplicateProposal(proposal({ title: "同じ改善" }), [{ type, number: 60, state: "open", title: "同じ改善" }]);
    assert.equal(result.duplicate, true, type); assert.equal(result.match.type, type, type);
  }
});

test("fails closed for malformed proposals", () => {
  const result = detectDuplicateProposal(proposal({ acceptanceCriteria: [] }), []);
  assert.equal(result.ok, false); assert.equal(result.duplicate, true); assert.equal(result.reason, "invalid_proposal"); assert.match(result.error, /acceptanceCriteria/);
});

test("no_action bypasses duplicate comparison without mutation intent", () => {
  assert.deepEqual(detectDuplicateProposal({ action: "no_action", reason: "An overlapping PR already exists" }, [{ type: "issue", number: 70, title: "anything" }]), { ok: true, duplicate: false, decision: "no_action", reason: null, match: null });
});

test("n-gram similarity stays bounded", () => {
  assert.equal(diceSimilarity("same", "same"), 1); assert.equal(diceSimilarity("alpha", "omega") >= 0, true); assert.equal(diceSimilarity("alpha", "omega") <= 1, true);
});
