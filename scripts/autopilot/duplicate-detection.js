const { validatePlannerProposal } = require("./planner-proposal.js");

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();
}

function ngrams(value, size = 2) {
  const text = normalizeText(value);
  if (!text) return new Set();
  if (text.length <= size) return new Set([text]);
  const result = new Set();
  for (let index = 0; index <= text.length - size; index += 1) {
    result.add(text.slice(index, index + size));
  }
  return result;
}

function diceSimilarity(left, right) {
  const a = ngrams(left);
  const b = ngrams(right);
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const gram of a) {
    if (b.has(gram)) overlap += 1;
  }
  return (2 * overlap) / (a.size + b.size);
}

function compareProposalToItem(proposal, item) {
  const proposalTitle = normalizeText(proposal.title);
  const itemTitle = normalizeText(item && item.title);
  if (!proposalTitle || !itemTitle) return null;

  if (proposalTitle === itemTitle) {
    return { reason: "exact_title", score: 1 };
  }

  const shorter = proposalTitle.length <= itemTitle.length ? proposalTitle : itemTitle;
  const longer = proposalTitle.length > itemTitle.length ? proposalTitle : itemTitle;
  if (shorter.length >= 8 && longer.includes(shorter)) {
    return { reason: "title_contains", score: shorter.length / longer.length };
  }

  const titleScore = diceSimilarity(proposal.title, item.title);
  const proposalIntent = `${proposal.title} ${proposal.scope}`;
  const itemIntent = `${item.title || ""} ${item.body || ""}`;
  const intentScore = diceSimilarity(proposalIntent, itemIntent);
  const score = Math.max(titleScore, intentScore);

  if (score >= 0.72) {
    return { reason: "ngram_similarity", score };
  }

  return null;
}

function detectDuplicateProposal(proposal, workItems = []) {
  const validation = validatePlannerProposal(proposal);
  if (!validation.ok) {
    return {
      ok: false,
      duplicate: true,
      decision: "stop",
      reason: "invalid_proposal",
      error: validation.error,
      match: null,
    };
  }

  if (proposal.action === "no_action") {
    return {
      ok: true,
      duplicate: false,
      decision: "no_action",
      reason: null,
      match: null,
    };
  }

  for (const item of workItems) {
    const match = compareProposalToItem(proposal, item);
    if (!match) continue;
    return {
      ok: true,
      duplicate: true,
      decision: "stop",
      reason: match.reason,
      match: {
        id: item.id ?? item.number ?? null,
        type: item.type || "work_item",
        state: item.state || null,
        title: item.title || "",
        url: item.url || null,
        score: Number(match.score.toFixed(3)),
      },
    };
  }

  return {
    ok: true,
    duplicate: false,
    decision: "continue",
    reason: null,
    match: null,
  };
}

module.exports = {
  compareProposalToItem,
  detectDuplicateProposal,
  diceSimilarity,
  normalizeText,
};
