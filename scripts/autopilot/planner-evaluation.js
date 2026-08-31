const { validatePlannerProposal } = require("./planner-proposal.js");
const { collectWorkItems } = require("./work-items.js");
const { detectDuplicateProposal } = require("./duplicate-detection.js");
const { assessPlannerProposal } = require("./risk-policy.js");

function stop(reason, extra = {}) {
  return {
    ok: false,
    decision: "stop",
    reason,
    ...extra,
  };
}

function evaluatePlannerProposal(
  proposal,
  {
    repo,
    collect = collectWorkItems,
    detectDuplicate = detectDuplicateProposal,
    assessRisk = assessPlannerProposal,
  } = {},
) {
  const validation = validatePlannerProposal(proposal);
  if (!validation.ok) {
    return stop("invalid_proposal", { error: validation.error });
  }

  if (proposal.action === "no_action") {
    return {
      ok: true,
      decision: "no_action",
      reason: proposal.reason,
      duplicate: null,
      risk: null,
    };
  }

  if (typeof repo !== "string" || !repo.trim()) {
    return stop("invalid_repo", { error: "repo is required in owner/name form" });
  }

  let snapshot;
  try {
    snapshot = collect({ repo });
  } catch (error) {
    return stop("work_item_collection_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (!snapshot || !Array.isArray(snapshot.items)) {
    return stop("invalid_work_item_snapshot", {
      error: "collector must return an object with an items array",
    });
  }

  const duplicate = detectDuplicate(proposal, snapshot.items);
  if (!duplicate || duplicate.ok !== true) {
    return stop("duplicate_detection_failed", {
      error: duplicate && duplicate.error ? duplicate.error : "duplicate detector failed",
      duplicate: duplicate || null,
    });
  }

  if (duplicate.decision !== "continue") {
    return {
      ok: true,
      decision: duplicate.decision,
      reason: duplicate.reason,
      duplicate,
      risk: null,
      snapshotCounts: snapshot.counts || null,
    };
  }

  const risk = assessRisk(proposal);
  if (!risk || !["agent-ready", "agent-proposed", "no_action"].includes(risk.decision)) {
    return stop("risk_assessment_failed", {
      risk: risk || null,
      snapshotCounts: snapshot.counts || null,
    });
  }

  return {
    ok: true,
    decision: risk.decision,
    reason: risk.reasons && risk.reasons.length ? "risk_gate" : null,
    duplicate,
    risk,
    snapshotCounts: snapshot.counts || null,
  };
}

module.exports = {
  evaluatePlannerProposal,
};
