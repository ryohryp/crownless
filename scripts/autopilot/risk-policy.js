const { validatePlannerProposal } = require("./planner-proposal.js");

const POLICY_TOPICS = [
  { code: "gameplay_canon", pattern: /\bcanon\b|core loop|gameplay direction|ゲーム.?canon|コアループ|ゲームデザイン/i },
  { code: "balance_economy", pattern: /balance|economy|drop rate|reward rate|バランス|経済|報酬量|ドロップ率/i },
  { code: "gps_privacy", pattern: /\bgps\b|raw location|route history|privacy|位置情報|座標|移動履歴|プライバシー/i },
  { code: "save_migration", pattern: /save migration|save compatibility|player-state migration|セーブ移行|セーブ互換|データ移行/i },
  { code: "production_visual", pattern: /production visual|asset approval|visual direction|production asset|本番アセット|ビジュアル承認|視覚方向/i },
  { code: "hosting_deployment", pattern: /hosting|deployment|production deploy|公開範囲|ホスティング|デプロイ/i },
  { code: "credential_security", pattern: /credential|secret|api key|security boundary|認証情報|秘密鍵|シークレット|セキュリティ境界/i },
  { code: "major_architecture", pattern: /major architecture|backend migration|platform rewrite|大規模アーキテクチャ|バックエンド移行|基盤刷新/i },
  { code: "substantial_deletion", pattern: /substantial deletion|legacy deletion|remove legacy system|大規模削除|レガシー削除/i },
  { code: "monetization", pattern: /monetization|payment|subscription|課金|収益化|サブスクリプション/i },
];

function proposalText(proposal) {
  return [
    proposal.title,
    proposal.whyNow,
    proposal.scope,
    ...(proposal.acceptanceCriteria || []),
    ...(proposal.nonGoals || []),
  ]
    .filter((value) => typeof value === "string")
    .join("\n");
}

function assessPlannerProposal(proposal) {
  const validation = validatePlannerProposal(proposal);
  if (!validation.ok) {
    return {
      eligible: false,
      decision: "agent-proposed",
      reasons: ["invalid_proposal"],
      error: validation.error,
    };
  }

  if (proposal.action === "no_action") {
    return { eligible: false, decision: "no_action", reasons: [] };
  }

  const reasons = [];
  if (proposal.humanGate) reasons.push("planner_human_gate");
  if (proposal.risk !== "low") reasons.push(`risk_${proposal.risk}`);
  if (proposal.playtestRequired) reasons.push("playtest_required");

  const text = proposalText(proposal);
  for (const topic of POLICY_TOPICS) {
    if (topic.pattern.test(text)) reasons.push(`policy_${topic.code}`);
  }

  const uniqueReasons = [...new Set(reasons)];
  return {
    eligible: uniqueReasons.length === 0,
    decision: uniqueReasons.length === 0 ? "agent-ready" : "agent-proposed",
    reasons: uniqueReasons,
  };
}

module.exports = {
  assessPlannerProposal,
  POLICY_TOPICS,
};
