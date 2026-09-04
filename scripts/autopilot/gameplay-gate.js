const { validatePlannerProposal } = require("./planner-proposal.js");

function result(eligible, reasons = [], extra = {}) {
  return {
    eligible,
    decision: eligible ? "continue" : "stop",
    reasons,
    ...extra,
  };
}

function assessGameplayGate(proposal) {
  const validation = validatePlannerProposal(proposal);
  if (!validation.ok) {
    return result(false, ["invalid_proposal"], { error: validation.error });
  }

  if (proposal.action === "no_action") {
    return { eligible: false, decision: "no_action", reasons: [] };
  }

  const reasons = [];
  const selected = proposal.candidates.find((candidate) => candidate.selected);

  // A clear bug can short-circuit ideation. Otherwise the planner must compare
  // three alternatives so a maintenance task does not win merely by being first.
  if (proposal.proposalType !== "bug" && proposal.candidates.length !== 3) {
    reasons.push("three_candidate_comparison_required");
  }

  // Consecutive maintenance-heavy cycles are deliberately interrupted. A clear
  // bug or player friction should be classified as such instead of maintenance.
  if (proposal.proposalType === "maintenance" && proposal.recentCycleReview.maintenanceHeavy) {
    reasons.push("maintenance_streak");
  }

  if (proposal.proposalType === "gameplay") {
    const gate = selected.gameplayGate;
    if (!gate.decision.applicable || gate.decision.score === 0) reasons.push("decision_zero");
    if (!gate.coreLoop.applicable || gate.coreLoop.score === 0) reasons.push("core_loop_zero");
    if (selected.locationRelated && (!gate.geography.applicable || gate.geography.score === 0)) {
      reasons.push("location_without_geography");
    }
    if (!proposal.playtestRequired) reasons.push("gameplay_playtest_required");
  }

  return result(reasons.length === 0, [...new Set(reasons)], { selectedCandidate: selected });
}

module.exports = {
  assessGameplayGate,
};
