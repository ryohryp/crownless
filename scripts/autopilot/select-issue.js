const AGENT_READY_LABEL = "agent-ready";
const AGENT_RUNNING_LABEL = "agent-running";

function labelNames(issue) {
  return new Set((issue?.labels || []).map((label) => typeof label === "string" ? label : label?.name).filter(Boolean));
}

function isEligibleIssue(issue) {
  return issue?.state === "OPEN" && labelNames(issue).has(AGENT_READY_LABEL);
}

function selectIssue(issues) {
  const eligible = issues.filter(isEligibleIssue).sort((left, right) => Number(left.number) - Number(right.number));
  return eligible[0] || null;
}

function assertEligibleIssue(issue) {
  if (!issue || issue.state !== "OPEN") {
    throw new Error("The requested Issue is not open.");
  }
  if (!labelNames(issue).has(AGENT_READY_LABEL)) {
    throw new Error(`Issue #${issue.number} is not explicitly marked ${AGENT_READY_LABEL}.`);
  }
}

function issueReferenceMatches(value, issueNumber) {
  const number = Number(issueNumber);
  if (value && typeof value === "object" && Number(value.number) === number) return true;
  return typeof value === "string" && new RegExp(`(^|\\D)#${number}(\\D|$)`).test(value);
}

function pullRequestTouchesIssue(pullRequest, issueNumber, branchName) {
  if (pullRequest?.headRefName === branchName) return true;
  if ((pullRequest?.closingIssuesReferences || []).some((issue) => issueReferenceMatches(issue, issueNumber))) return true;
  return issueReferenceMatches(pullRequest?.title, issueNumber) || issueReferenceMatches(pullRequest?.body, issueNumber);
}

function findBlockers({ issue, issueNumber = issue?.number, openPullRequests = [], runningIssues = [], branchName }) {
  const blockers = [];
  if (runningIssues.some((candidate) => Number(candidate.number) === Number(issueNumber))) {
    blockers.push(`Issue #${issueNumber} already has an agent-running lock.`);
  }
  const overlappingPrs = openPullRequests.filter((pullRequest) => pullRequestTouchesIssue(pullRequest, issueNumber, branchName));
  for (const pullRequest of overlappingPrs) {
    blockers.push(`Open PR #${pullRequest.number} already touches Issue #${issueNumber}.`);
  }
  return blockers;
}

module.exports = {
  AGENT_READY_LABEL,
  AGENT_RUNNING_LABEL,
  assertEligibleIssue,
  findBlockers,
  isEligibleIssue,
  issueReferenceMatches,
  labelNames,
  pullRequestTouchesIssue,
  selectIssue,
};
