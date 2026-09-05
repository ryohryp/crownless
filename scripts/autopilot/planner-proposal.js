const PROPOSAL_TYPES = new Set(["gameplay", "bug", "friction", "maintenance"]);
const RISKS = new Set(["low", "medium", "high"]);
const PLAYTEST_STATUSES = new Set(["Keep", "Change", "Kill"]);
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
  "recentPlaytestLearning",
  "learningApplication",
  "candidates",
  "gameplayHypothesis",
]);
const NO_ACTION_FIELDS = new Set(["action", "reason"]);
const RECENT_CYCLE_FIELDS = new Set(["cyclesReviewed", "newPlayAdded", "maintenanceHeavy", "summary"]);
const PLAYTEST_LEARNING_FIELDS = new Set(["entries", "summary"]);
const PLAYTEST_LEARNING_ENTRY_FIELDS = new Set(["source", "status", "observation", "plannerImplication"]);
const LEARNING_APPLICATION_FIELDS = new Set(["appliedSources", "ignoredSources", "summary"]);
const IGNORED_LEARNING_FIELDS = new Set(["source", "reason"]);
const CANDIDATE_FIELDS = new Set([
  "title",
  "kind",
  "locationRelated",
  "gameplayGate",
  "reason",
  "selected",
  "learningSources",
  "revisitsKilledHypothesis",
  "killRevisitEvidence",
]);
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

function validateRecentPlaytestLearning(value) {
  const objectError = validateExactObject("recentPlaytestLearning", value, PLAYTEST_LEARNING_FIELDS);
  if (objectError) return objectError;
  if (!Array.isArray(value.entries)) return "recentPlaytestLearning.entries must be an array";
  if (value.entries.length > 5) return "recentPlaytestLearning.entries must contain at most 5 items";
  if (!isNonEmptyString(value.summary)) return "recentPlaytestLearning.summary must be a non-empty string";

  const sources = new Set();
  for (const [index, entry] of value.entries.entries()) {
    const name = `recentPlaytestLearning.entries[${index}]`;
    const entryError = validateExactObject(name, entry, PLAYTEST_LEARNING_ENTRY_FIELDS);
    if (entryError) return entryError;
    if (!isNonEmptyString(entry.source)) return `${name}.source must be a non-empty string`;
    if (sources.has(entry.source)) return `recentPlaytestLearning.entries source must be unique: ${entry.source}`;
    sources.add(entry.source);
    if (!PLAYTEST_STATUSES.has(entry.status)) return `${name}.status must be Keep, Change, or Kill`;
    if (!isNonEmptyString(entry.observation)) return `${name}.observation must be a non-empty string`;
    if (!isNonEmptyString(entry.plannerImplication)) return `${name}.plannerImplication must be a non-empty string`;
  }
  return null;
}

function validateLearningApplication(value, learningEntries) {
  const objectError = validateExactObject("learningApplication", value, LEARNING_APPLICATION_FIELDS);
  if (objectError) return objectError;
  const appliedError = validateStringArray("learningApplication.appliedSources", value.appliedSources);
  if (appliedError) return appliedError;
  if (!Array.isArray(value.ignoredSources)) return "learningApplication.ignoredSources must be an array";
  if (!isNonEmptyString(value.summary)) return "learningApplication.summary must be a non-empty string";

  const knownSources = new Set(learningEntries.map((entry) => entry.source));
  const accounted = new Set();
  for (const source of value.appliedSources) {
    if (!knownSources.has(source)) return `learningApplication.appliedSources contains unknown source: ${source}`;
    if (accounted.has(source)) return `learningApplication contains duplicate source: ${source}`;
    accounted.add(source);
  }

  for (const [index, ignored] of value.ignoredSources.entries()) {
    const name = `learningApplication.ignoredSources[${index}]`;
    const ignoredError = validateExactObject(name, ignored, IGNORED_LEARNING_FIELDS);
    if (ignoredError) return ignoredError;
    if (!isNonEmptyString(ignored.source)) return `${name}.source must be a non-empty string`;
    if (!knownSources.has(ignored.source)) return `${name}.source is unknown: ${ignored.source}`;
    if (accounted.has(ignored.source)) return `learningApplication contains duplicate source: ${ignored.source}`;
    if (!isNonEmptyString(ignored.reason)) return `${name}.reason must be a non-empty string`;
    accounted.add(ignored.source);
  }

  if (accounted.size !== knownSources.size) {
    const missing = [...knownSources].filter((source) => !accounted.has(source));
    return `learningApplication must apply or explicitly ignore every learning source: ${missing.join(", ")}`;
  }

  const applied = new Set(value.appliedSources);
  for (const entry of learningEntries) {
    if (entry.status === "Change" && !applied.has(entry.source)) {
      return `Change learning must be applied to candidate generation: ${entry.source}`;
    }
  }
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

  const learningBySource = new Map(proposal.recentPlaytestLearning.entries.map((entry) => [entry.source, entry]));
  const appliedSources = new Set(proposal.learningApplication.appliedSources);
  const changeSourcesUsed = new Set();
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

    const learningError = validateStringArray(`${name}.learningSources`, candidate.learningSources);
    if (learningError) return learningError;
    const uniqueLearningSources = new Set(candidate.learningSources);
    if (uniqueLearningSources.size !== candidate.learningSources.length) return `${name}.learningSources must be unique`;
    for (const source of candidate.learningSources) {
      if (!learningBySource.has(source)) return `${name}.learningSources contains unknown source: ${source}`;
      if (!appliedSources.has(source)) return `${name}.learningSources must reference an applied learning source: ${source}`;
      if (learningBySource.get(source).status === "Change") changeSourcesUsed.add(source);
    }

    if (typeof candidate.revisitsKilledHypothesis !== "boolean") {
      return `${name}.revisitsKilledHypothesis must be boolean`;
    }
    if (candidate.revisitsKilledHypothesis) {
      const referencesKill = candidate.learningSources.some((source) => learningBySource.get(source)?.status === "Kill");
      if (!referencesKill) return `${name}.revisitsKilledHypothesis requires a referenced Kill learning source`;
      if (!isNonEmptyString(candidate.killRevisitEvidence)) {
        return `${name}.killRevisitEvidence must explain new evidence or changed conditions`;
      }
    } else if (candidate.killRevisitEvidence !== null) {
      return `${name}.killRevisitEvidence must be null when revisitsKilledHypothesis is false`;
    }

    if (candidate.selected) selectedCount += 1;
  }

  for (const entry of proposal.recentPlaytestLearning.entries) {
    if (entry.status === "Change" && !changeSourcesUsed.has(entry.source)) {
      return `Change learning must influence at least one candidate: ${entry.source}`;
    }
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
  const learningError = validateRecentPlaytestLearning(proposal.recentPlaytestLearning);
  if (learningError) return { ok: false, error: learningError };
  const applicationError = validateLearningApplication(
    proposal.learningApplication,
    proposal.recentPlaytestLearning.entries,
  );
  if (applicationError) return { ok: false, error: applicationError };
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
  PLAYTEST_STATUSES,
  PROPOSAL_TYPES,
  parsePlannerProposal,
  validatePlannerProposal,
};
