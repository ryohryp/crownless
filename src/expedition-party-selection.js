(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionPartySelection = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionPartySelection() {
  "use strict";

  const MAX_COMPANIONS = 2;
  const COMPANION_LEGEND = "仲間（2人まで）";
  const COMPANION_NAMES = Object.freeze({ mira: "ミラ", ed: "エド", sella: "セラ" });

  function selectedCompanionIds(form) {
    if (!form) return [];
    return Array.from(form.querySelectorAll('input[name="companion"]:checked'))
      .map((input) => input.value)
      .filter(Boolean)
      .slice(0, MAX_COMPANIONS);
  }

  function selectedLeaderId(form, companionIds) {
    const ids = Array.isArray(companionIds) ? companionIds : selectedCompanionIds(form);
    if (!form || ids.length !== MAX_COMPANIONS) return null;
    const selected = form.querySelector('input[name="leader"]:checked');
    return selected && ids.includes(selected.value) ? selected.value : ids[0];
  }

  function createLeaderGroup(doc, companionIds) {
    const group = doc.createElement("fieldset");
    group.className = "expedition-choice expedition-leader-choice";
    group.dataset.partyLeader = companionIds.join("|");
    const legend = doc.createElement("legend");
    legend.textContent = "隊長";
    group.append(legend);

    companionIds.forEach((id, index) => {
      const label = doc.createElement("label");
      label.className = "expedition-choice__item";
      const input = doc.createElement("input");
      input.type = "radio";
      input.name = "leader";
      input.value = id;
      input.checked = index === 0;
      const body = doc.createElement("span");
      const strong = doc.createElement("strong");
      strong.textContent = COMPANION_NAMES[id] || id;
      const small = doc.createElement("small");
      small.textContent = "この仲間に現地判断を任せる";
      body.append(strong, small);
      label.append(input, body);
      group.append(label);
    });
    return group;
  }

  function syncLeaderGroup(root, form, companionIds) {
    const doc = root.document;
    const existing = form.querySelector("[data-party-leader]");
    if (companionIds.length !== MAX_COMPANIONS) {
      if (!existing) return false;
      existing.remove();
      return true;
    }

    const signature = companionIds.join("|");
    if (existing && existing.dataset.partyLeader === signature) {
      const current = selectedLeaderId(form, companionIds);
      if (current) return false;
    }

    const previousLeader = existing ? selectedLeaderId(form, companionIds) : null;
    if (existing) existing.remove();
    const group = createLeaderGroup(doc, companionIds);
    const partyGroup = form.querySelector("[data-party-selection]") || form.querySelector('input[name="companion"]')?.closest("fieldset");
    if (partyGroup && typeof partyGroup.insertAdjacentElement === "function") partyGroup.insertAdjacentElement("afterend", group);
    else form.append(group);

    if (previousLeader && companionIds.includes(previousLeader)) {
      const radio = Array.from(group.querySelectorAll('input[name="leader"]')).find((input) => input.value === previousLeader);
      if (radio) {
        Array.from(group.querySelectorAll('input[name="leader"]')).forEach((input) => { input.checked = input === radio; });
      }
    }
    return true;
  }

  function enhancePrepare(root) {
    const form = root.document.querySelector("#expedition-folio form.expedition-prepare");
    if (!form) return false;
    const inputs = Array.from(form.querySelectorAll('input[name="companion"]'));
    if (!inputs.length) return false;

    let changed = false;
    inputs.forEach((input) => {
      if (input.type !== "checkbox") {
        input.type = "checkbox";
        changed = true;
      }
    });

    let checked = inputs.filter((input) => input.checked && !input.disabled);
    if (!checked.length) {
      const first = inputs.find((input) => !input.disabled);
      if (first && !first.checked) {
        first.checked = true;
        changed = true;
      }
    } else if (checked.length > MAX_COMPANIONS) {
      checked.slice(MAX_COMPANIONS).forEach((input) => {
        if (input.checked) {
          input.checked = false;
          changed = true;
        }
      });
    }
    checked = inputs.filter((input) => input.checked && !input.disabled).slice(0, MAX_COMPANIONS);

    const group = inputs[0].closest("fieldset");
    const legend = group && group.querySelector("legend");
    if (legend && legend.textContent !== COMPANION_LEGEND) {
      legend.textContent = COMPANION_LEGEND;
      changed = true;
    }
    if (group && group.dataset.partySelection !== "true") {
      group.dataset.partySelection = "true";
      changed = true;
    }

    if (syncLeaderGroup(root, form, checked.map((input) => input.value).filter(Boolean))) changed = true;
    return changed;
  }

  function enforceLimit(event) {
    const input = event && event.target;
    if (!input || input.name !== "companion" || !input.form) return;
    const selected = Array.from(input.form.querySelectorAll('input[name="companion"]:checked'));
    if (selected.length <= MAX_COMPANIONS) return;
    input.checked = false;
    const feedback = input.form.querySelector(".expedition-form-feedback");
    if (feedback) feedback.textContent = "遠征へ送れる仲間は2人まで。誰を組ませるか選んでください。";
  }

  function installDispatchHook(root) {
    const system = root.CrownlessExpeditionSystem;
    if (!system || system.__twoCompanionPartyInstalled) return Boolean(system);
    const baseDispatch = system.dispatchExpedition.bind(system);
    system.dispatchExpedition = function dispatchWithSelectedParty(state, input, nowMs) {
      const form = root.document.querySelector("#expedition-folio form.expedition-prepare");
      const selected = selectedCompanionIds(form);
      const leaderId = selectedLeaderId(form, selected);
      const nextInput = selected.length ? { ...input, companionIds: selected } : input;
      const nextState = baseDispatch(state, nextInput, nowMs);
      if (leaderId && nextState && nextState.activeExpedition && nextState.activeExpedition.inputs) {
        nextState.activeExpedition.inputs.leaderId = leaderId;
      }
      return nextState;
    };
    system.__twoCompanionPartyInstalled = true;
    return true;
  }

  function install(root) {
    if (!root || !root.document) return false;
    installDispatchHook(root);
    const sync = () => enhancePrepare(root);
    sync();
    if (!root.__crownlessPartySelectionObserver) {
      const observer = new root.MutationObserver(sync);
      observer.observe(root.document.body, { subtree: true, childList: true });
      root.document.addEventListener("change", (event) => {
        enforceLimit(event);
        if (event && event.target && event.target.name === "companion") sync();
      });
      root.__crownlessPartySelectionObserver = observer;
    }
    return true;
  }

  return {
    MAX_COMPANIONS,
    COMPANION_NAMES,
    selectedCompanionIds,
    selectedLeaderId,
    createLeaderGroup,
    syncLeaderGroup,
    enhancePrepare,
    installDispatchHook,
    install,
  };
});
