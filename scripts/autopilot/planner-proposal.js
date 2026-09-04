const PROPOSAL_TYPES = new Set(["gameplay", "bug", "friction", "maintenance"]);
const RISKS = new Set(["low", "medium", "high"]);
const GATE_DIMENSIONS = [
  "playerVisible",
  "decision",
  "riskReward",
  "coreLoop",
  "replayability",
  "fantasy",
  "geography",
  "canon",
];

const CREATE_ISSUE_FIELDS = new Set([
  "action",
  "title",
  "whyNow",
  "scope",
  "acceptanceCriteria",
  "nonGoals",
  "risk",
  "humanGate",
  "playtestRequired",
  "proposalType",
  "recentCycleReview",
  "candidates",
  "gameplayHypothesis",
]);
const NO_ACTION_FIELDS = new Set(["action", "reason"]);
const RECENT_CYCLE_FIELDS = new Set(["cyclesReviewed", "newPlayAdded", "maintenanceHeavy", "summary"]);
const CANDIDATE_FIELDS = new Set(["title", "kind", "locationRelated", "gameplayGate", "reason", "selected"]);
const GATE_SCORE_FIELDS = new Set(["applicable", "score", "rationale"]);
const HYPOTHESIS_FIELDS = new Set(["interestingDecision", "mda", "verticalSlice"]);
const MDA_FIELDS = new Set(["mechanic", "dynamic", "desiredExperience"]);
const VERTICAL_SLICE_FIELDS = new Set([
  "discoveryOrInformation",
  "decision",
  "action",
  "resultOrDanger",
  "rewardOrLoss",
  "persistentChange",
]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function unknownFields(value, allowed) {
  return Object.keys(value).filter((key) => !allowed.has(key));
}

function validateExactObject(name, value, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return `${name} must be an object`;
  const unknown = unknownFields(value, allowed);
  if (unknown.length) return `${name} has unknown field(s): ${unknown.join(", ")}`;
  return null;
}

function validateStringArray(name, value, { minItems = 0 } = {}) {
  if (!Array.isArray(value)) return `${name} must be an array`;
  if (value.length < minItems) return `${name} must contain at least ${minItems} item(s)`;
  if (value.some((item) => !isNonEmptyString(item))) return `${name} must contain only non-empty strings`;
  return null;
}

function validateRecentCycleReview(value) {
  const objectError = validateExactObject("recentCycleReview", value, RECENT_CYCLE_FIELDS);
  if (objectError) return objectError;
  if (!Number.isInteger(value.cyclesReviewed) || value.cyclesReviewed < 3 || value.cyclesReviewed > 5) {
    return "recentCycleReview.cyclesReviewed must be an integer from 3 to 5";
  }
  if (typeof value.newPlayAdded !== "boolean") return "recentCycleReview.newPlayAdded must be boolean";
  if (typeof value.maintenanceHeavy !== "boolean") return "recentCycleReview.maintenanceHeavy must be boolean";
  if (!isNonEmptyString(value.summary)) return "recentCycleReview.summary must be a non-empty string";
  return null;
}

function validateGateScore(name, value) {
  const objectError = validateExactObject(name, value, GATE_SCORE_FIELDS);
  if (objectError) return objectError;
  if (typeof value.applicable !== "boolean") return `${name}.applicable must be boolean`;
  if (!Number.isInteger(value.score) || value.score < 0 || value.score > 3) {
    return `${name}.score must be an integer from 0 to 3`;
  }
  if (!isNonEmptyString(value.rationale)) return `${name}.rationale must be a non-empty string`;
  return null;
}

function validateGameplayGate(name, value) {
  const allowed = new Set(GATE_DIMENSIONS);
  const objectError = validateExactObject(name, value, allowed);
  if (objectError) return objectError;
  for (const dimension of GATE_DIMENSIONS) {
    if (!(dimension in value)) return `${name}.${dimension} is required`;
    const error = validateGateScore(`${name}.${dimension}`, value[dimension]);
    if (error) return error;
  }
  return null;
}

function validateCandidates(value, proposal) {
  if (!Array.isArray(value)) return "candidates must be an array";
  if (value.length < 1 || value.length > 3) return "candidates must contain 1 to 3 items";

  let selectedCount = 0;
  for (const [index, candidate] of value.entries()) {
    const name = `candidates[${index}]`;
    const objectError = validateExactObject(name, candidate, CANDIDATE_FIELDS);
    if (objectError) return objectError;
    if (!isNonEmptyString(candidate.title)) return `${name}.title must be a non-empty string`;
    if (!PROPOSAL_TYPES.has(candidate.kind)) return `${name}.kind must be gameplay, bug, friction, or maintenance`;
    if (typeof candidate.locationRelated !== "boolean") return `${name}.locationRelated must be boolean`;
    const gateError = validateGameplayGate(`${name}.gameplayGate`, candidate.gameplayGate);
    if (gateError) return gateError;
    if (!isNonEmptyString(candidate.reason)) return `${name}.reason must be a non-empty string`;
    if (typeof candidate.selected !== "boolean") return `${name}.selected must be boolean`;
    if (candidate.selected) selectedCount += 1;
  }

  if (selectedCount !== 1) return "candidates must contain exactly one selected item";
  const selected = value.find((candidate) => candidate.selected);
  if (selected.title !== proposal.title) return "selected candidate title must match proposal title";
  if (selected.kind !== proposal.proposalType) return "selected candidate kind must match proposalType";
  return null;
}

function validateMda(value) {
  const objectError = validateExactObject("gameplayHypothesis.mda", value, MDA_FIELDS);
  if (objectError) return objectError;
  for (const field of MDA_FIELDS) {
    if (!isNonEmptyString(value[field])) return `gameplayHypothesis.mda.${field} must be a non-empty string`;
  }
  return null;
}

function validateVerticalSlice(value) {
  const objectError = validateExactObject("gameplayHypothesis.verticalSlice", value, VERTICAL_SLICE_FIELDS);
  if (objectError) return objectError;
  for (const field of VERTICAL_SLICE_FIELDS) {
    if (!isNonEmptyString(value[field])) {
      return `gameplayHypothesis.verticalSlice.${field} must be a non-empty string`;
    }
  }
  return null;
}

function validateGameplayHypothesis(value, proposalType) {
  if (proposalType !== "gameplay") {
    return value === null ? null : "gameplayHypothesis must be null for non-gameplay proposals";
  }

  const objectError = validateExactObject("gameplayHypothesis", value, HYPOTHESIS_FIELDS);
  if (objectError) return objectError;
  if (!isNonEmptyString(value.interestingDecision)) {
    return "gameplayHypothesis.interestingDecision must be a non-empty string";
  }
  return validateMda(value.mda) || validateVerticalSlice(value.verticalSlice);
}

function validateCreateIssue(proposal) {
  const unknown = unknownFields(proposal, CREATE_ISSUE_FIELDS);
  if (unknown.length) return { ok: false, error: `unknown field(s): ${unknown.join(", ")}` };

  for (const field of ["title", "whyNow", "scope"]) {
    if (!isNonEmptyString(proposal[field])) return { ok: false, error: `${field} must be a non-empty string` };
  }

  const criteriaError = validateStringArray("acceptanceCriteria", proposal.acceptanceCriteria, { minItems: 1 });
  if (criteriaError) return { ok: false, error: criteriaError };
  const nonGoalsError = validateStringArray("nonGoals", proposal.nonGoals);
  if (nonGoalsError) return { ok: false, error: nonGoalsError };

  if (!RISKS.has(proposal.risk)) return { ok: false, error: "risk must be low, medium, or high" };
  if (typeof proposal.humanGate !== "boolean") return { ok: false, error: "humanGate must be boolean" };
  if (typeof proposal.playtestRequired !== "boolean") return { ok: false, error: "playtestRequired must be boolean" };
  if (!PROPOSAL_TYPES.has(proposal.proposalType)) {
    return { ok: false, error: "proposalType must be gameplay, bug, friction, or maintenance" };
  }

  const recentError = validateRecentCycleReview(proposal.recentCycleReview);
  if (recentError) return { ok: false, error: recentError };
  const candidateError = validateCandidates(proposal.candidates, proposal);
  if (candidateError) return { ok: false, error: candidateError };
  const hypothesisError = validateGameplayHypothesis(proposal.gameplayHypothesis, proposal.proposalType);
  if (hypothesisError) return { ok: false, error: hypothesisError };

  return { ok: true, proposal };
}

function validateNoAction(proposal) {
  const unknown = unknownFields(proposal, NO_ACTION_FIELDS);
  if (unknown.length) return { ok: false, error: `unknown field(s): ${unknown.join(", ")}` };
  if (!isNonEmptyString(proposal.reason)) return { ok: false, error: "reason must be a non-empty string" };
  return { ok: true, proposal };
}

function validatePlannerProposal(proposal) {
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) {
    return { ok: false, error: "proposal must be an object" };
  }
  if (proposal.action === "create_issue") return validateCreateIssue(proposal);
  if (proposal.action === "no_action") return validateNoAction(proposal);
  return { ok: false, error: "action must be create_issue or no_action" };
}

function parsePlannerProposal(text) {
  let proposal;
  try {
    proposal = JSON.parse(text);
  } catch {
    return { ok: false, error: "proposal must be valid JSON" };
  }
  return validatePlannerProposal(proposal);
}

module.exports = {
  GATE_DIMENSIONS,
  PROPOSAL_TYPES,
  parsePlannerProposal,
  validatePlannerProposal,
};
