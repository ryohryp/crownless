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

  function selectedCompanionIds(form) {
    if (!form) return [];
    return Array.from(form.querySelectorAll('input[name="companion"]:checked'))
      .map((input) => input.value)
      .filter(Boolean)
      .slice(0, MAX_COMPANIONS);
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

    const checked = inputs.filter((input) => input.checked && !input.disabled);
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
      const nextInput = selected.length ? { ...input, companionIds: selected } : input;
      return baseDispatch(state, nextInput, nowMs);
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
      root.document.addEventListener("change", enforceLimit);
      root.__crownlessPartySelectionObserver = observer;
    }
    return true;
  }

  return { MAX_COMPANIONS, selectedCompanionIds, enhancePrepare, installDispatchHook, install };
});
