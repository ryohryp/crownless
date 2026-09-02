(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionCompanionProposals = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createCompanionProposals() {
  "use strict";

  const PROPOSALS = Object.freeze({
    cautious: Object.freeze({ objective: "explore", policy: "cautious", line: "急がない方がいい。痕跡を拾って、危なくなる前に戻ろう。" }),
    tracker: Object.freeze({ objective: "explore", policy: "cautious", line: "まず足跡を読む。獲物より、帰れる道を残したい。" }),
    brave: Object.freeze({ objective: "hunt", policy: "standard", line: "敵影があるなら確かめよう。ただし退き時は残しておく。" }),
    strong: Object.freeze({ objective: "hunt", policy: "standard", line: "正面から当たれる。狩りに出るなら俺が前に立つ。" }),
    greedy: Object.freeze({ objective: "scavenge", policy: "greedy", line: "空手で帰るくらいなら、もう一つ価値のある物を探そう。" }),
    "keen-eye": Object.freeze({ objective: "scavenge", policy: "greedy", line: "見落とした物がある。漁るなら、少し奥まで見る価値はある。" }),
  });

  function proposalFor(companion) {
    if (!companion || !Array.isArray(companion.traits)) return null;
    for (const trait of companion.traits) {
      if (PROPOSALS[trait]) return { trait, ...PROPOSALS[trait] };
    }
    return null;
  }

  function selectedValue(form, name) {
    const input = form && form.querySelector(`input[name="${name}"]:checked`);
    return input && input.value || null;
  }

  function readState(root) {
    try {
      const raw = root.localStorage && root.localStorage.getItem("crownless.expedition-poc.v1");
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function applyProposal(form, proposal) {
    if (!form || !proposal) return false;
    const objective = form.querySelector(`input[name="objective"][value="${proposal.objective}"]`);
    const policy = form.querySelector(`input[name="policy"][value="${proposal.policy}"]`);
    if (!objective || !policy) return false;
    objective.checked = true;
    policy.checked = true;
    objective.dispatchEvent(new Event("change", { bubbles: true }));
    policy.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function renderProposal(root) {
    const doc = root.document;
    const form = doc.querySelector("#expedition-folio form.expedition-prepare");
    if (!form) return false;
    const state = readState(root);
    const companionId = selectedValue(form, "companion");
    const companion = state && Array.isArray(state.companions)
      ? state.companions.find((item) => item && item.id === companionId)
      : null;
    const proposal = proposalFor(companion);
    let panel = form.querySelector("[data-companion-proposal]");
    if (!companion || !proposal) {
      if (panel) panel.remove();
      return false;
    }

    if (!panel) {
      panel = doc.createElement("aside");
      panel.className = "expedition-form-feedback";
      panel.dataset.companionProposal = "true";
      const companionGroup = Array.from(form.querySelectorAll("fieldset.expedition-choice"))
        .find((group) => group.querySelector("legend")?.textContent.trim() === "仲間");
      if (companionGroup) companionGroup.insertAdjacentElement("afterend", panel);
      else form.prepend(panel);
    }

    const currentObjective = selectedValue(form, "objective") || "explore";
    const currentPolicy = selectedValue(form, "policy") || "standard";
    const agrees = currentObjective === proposal.objective && currentPolicy === proposal.policy;
    panel.replaceChildren();

    const strong = doc.createElement("strong");
    strong.textContent = `${companion.name}の提案`;
    const copy = doc.createElement("span");
    copy.textContent = `「${proposal.line}」`;
    panel.append(strong, copy);

    const detail = doc.createElement("small");
    const objectiveName = proposal.objective === "hunt" ? "狩り" : proposal.objective === "scavenge" ? "漁り" : "探索";
    const policyName = proposal.policy === "greedy" ? "強欲" : proposal.policy === "cautious" ? "慎重" : "通常";
    detail.textContent = agrees ? `${objectiveName} + ${policyName}で意見が一致している。` : `提案: ${objectiveName} + ${policyName}`;
    panel.append(detail);

    if (!agrees) {
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "ghost";
      button.textContent = "提案を採用";
      button.addEventListener("click", () => {
        applyProposal(form, proposal);
        renderProposal(root);
      });
      panel.append(button);
    }
    return true;
  }

  function install(root) {
    if (!root || !root.document) return false;
    const sync = () => renderProposal(root);
    sync();
    if (!root.__crownlessCompanionProposalObserver) {
      const observer = new root.MutationObserver(sync);
      observer.observe(root.document.body, { subtree: true, childList: true });
      root.document.addEventListener("change", (event) => {
        if (event.target && ["companion", "objective", "policy"].includes(event.target.name)) sync();
      });
      root.__crownlessCompanionProposalObserver = observer;
    }
    return true;
  }

  return { PROPOSALS, proposalFor, applyProposal, install };
});
