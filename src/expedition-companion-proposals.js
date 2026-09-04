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

  function selectedCompanionIds(form) {
    if (!form || typeof form.querySelectorAll !== "function") return [];
    return Array.from(form.querySelectorAll('input[name="companion"]:checked')).map((input) => input.value).filter(Boolean).slice(0, 2);
  }

  function proposalEntries(companions) {
    return (Array.isArray(companions) ? companions : []).map((companion) => {
      const proposal = proposalFor(companion);
      return proposal ? { companion, proposal } : null;
    }).filter(Boolean);
  }

  function proposalsDisagree(entries) {
    if (!Array.isArray(entries) || entries.length < 2) return false;
    return new Set(entries.map(({ proposal }) => `${proposal.objective}:${proposal.policy}`)).size > 1;
  }

  function readState(root) {
    try {
      const raw = root.localStorage && root.localStorage.getItem("crownless.expedition-poc.v1");
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function applyProposal(form, proposal, root, companionId) {
    if (!form || !proposal) return false;
    const objective = form.querySelector(`input[name="objective"][value="${proposal.objective}"]`);
    const policy = form.querySelector(`input[name="policy"][value="${proposal.policy}"]`);
    if (!objective || !policy) return false;
    objective.checked = true;
    policy.checked = true;
    if (companionId) {
      const leader = form.querySelector(`input[name="leader"][value="${companionId}"]`);
      if (leader) leader.checked = true;
    }
    const EventCtor = root && root.Event || (typeof Event !== "undefined" ? Event : null);
    if (EventCtor) {
      objective.dispatchEvent(new EventCtor("change", { bubbles: true }));
      policy.dispatchEvent(new EventCtor("change", { bubbles: true }));
    }
    return true;
  }

  function objectiveName(id) {
    return id === "hunt" ? "狩り" : id === "scavenge" ? "漁り" : "探索";
  }

  function policyName(id) {
    return id === "greedy" ? "強欲" : id === "cautious" ? "慎重" : "通常";
  }

  function renderProposal(root) {
    const doc = root.document;
    const form = doc.querySelector("#expedition-folio form.expedition-prepare");
    if (!form) return false;
    const state = readState(root);
    const ids = selectedCompanionIds(form);
    const companions = state && Array.isArray(state.companions)
      ? ids.map((id) => state.companions.find((item) => item && item.id === id)).filter(Boolean)
      : [];
    const entries = proposalEntries(companions);
    let panel = form.querySelector("[data-companion-proposal]");
    if (!entries.length) {
      if (panel) panel.remove();
      return false;
    }

    const currentObjective = selectedValue(form, "objective") || "explore";
    const currentPolicy = selectedValue(form, "policy") || "standard";
    const leaderId = selectedValue(form, "leader") || "";
    const signature = [ids.join("|"), entries.map(({ proposal }) => proposal.trait).join("|"), currentObjective, currentPolicy, leaderId].join(":");
    if (panel && panel.dataset.proposalSignature === signature) return true;

    if (!panel) {
      panel = doc.createElement("aside");
      panel.className = "expedition-form-feedback";
      panel.dataset.companionProposal = "true";
      const companionGroup = Array.from(form.querySelectorAll("fieldset.expedition-choice"))
        .find((group) => group.querySelector("legend")?.textContent.trim().startsWith("仲間"));
      if (companionGroup) companionGroup.insertAdjacentElement("afterend", panel);
      else form.prepend(panel);
    }
    panel.dataset.proposalSignature = signature;
    panel.replaceChildren();

    const disagreement = proposalsDisagree(entries);
    const heading = doc.createElement("strong");
    heading.textContent = disagreement ? "仲間の意見が割れている" : `${entries[0].companion.name}の提案`;
    panel.append(heading);

    for (const { companion, proposal } of entries) {
      const agrees = currentObjective === proposal.objective && currentPolicy === proposal.policy;
      const copy = doc.createElement("span");
      copy.textContent = `【${companion.name}】「${proposal.line}」`;
      panel.append(copy);

      const detail = doc.createElement("small");
      detail.textContent = `${objectiveName(proposal.objective)} + ${policyName(proposal.policy)}${agrees ? "（現在の方針）" : ""}`;
      panel.append(detail);

      if (!agrees || (ids.length === 2 && leaderId !== companion.id)) {
        const button = doc.createElement("button");
        button.type = "button";
        button.className = "ghost";
        button.textContent = disagreement ? `${companion.name}の案を採用` : "提案を採用";
        button.addEventListener("click", () => {
          applyProposal(form, proposal, root, companion.id);
          renderProposal(root);
        });
        panel.append(button);
      }
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
        if (event.target && ["companion", "objective", "policy", "leader"].includes(event.target.name)) sync();
      });
      root.__crownlessCompanionProposalObserver = observer;
    }
    return true;
  }

  return { PROPOSALS, proposalFor, proposalEntries, proposalsDisagree, selectedCompanionIds, applyProposal, install };
});
