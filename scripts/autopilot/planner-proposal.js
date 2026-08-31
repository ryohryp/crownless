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
]);
const NO_ACTION_FIELDS = new Set(["action", "reason"]);
const RISKS = new Set(["low", "medium", "high"]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateStringArray(name, value, { minItems = 0 } = {}) {
  if (!Array.isArray(value)) return `${name} must be an array`;
  if (value.length < minItems) return `${name} must contain at least ${minItems} item(s)`;
  if (value.some((item) => !isNonEmptyString(item))) return `${name} must contain only non-empty strings`;
  return null;
}

function unknownFields(proposal, allowed) {
  return Object.keys(proposal).filter((key) => !allowed.has(key));
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
  parsePlannerProposal,
  validatePlannerProposal,
};
