"use strict";

(function expeditionPresentation() {
  const STORAGE_KEY = "crownless.expedition-poc.v1";
  const system = window.CrownlessExpeditionSystem;
  if (!system) return;

  function load() {
    try {
      return system.normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
    } catch (_) {
      return system.initialState();
    }
  }

  function save(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  let state = load();
  let lastResolved = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function ensureShell() {
    let shell = document.getElementById("expedition-folio");
    if (shell) return shell;
    shell = el("section", "expedition-folio");
    shell.id = "expedition-folio";
    shell.setAttribute("aria-live", "polite");
    shell.innerHTML = '<div class="expedition-folio__veil" data-expedition-close></div><div class="expedition-folio__page" role="dialog" aria-modal="true" aria-label="遠征台帳"><button class="expedition-folio__close" type="button" data-expedition-close aria-label="閉じる">×</button><div id="expedition-folio-content"></div></div>';
    document.body.appendChild(shell);
    shell.addEventListener("click", (event) => {
      if (event.target.closest("[data-expedition-close]")) close();
    });
    return shell;
  }

  function open() {
    const shell = ensureShell();
    refresh(Date.now());
    render();
    shell.classList.add("is-open");
  }

  function close() {
    const shell = document.getElementById("expedition-folio");
    if (shell) shell.classList.remove("is-open");
  }

  function refresh(now) {
    const advanced = system.advance(state, now);
    state = advanced.state;
    if (advanced.report) lastResolved = advanced.report;
    save(state);
    updateGateCopy();
  }

  function updateGateCopy() {
    const gate = document.getElementById("start-expedition");
    if (!gate) return;
    const strong = gate.querySelector(".object-label strong");
    const span = gate.querySelector(".object-label span:last-child");
    if (state.activeExpedition) {
      const destination = state.destinations.find((d) => d.id === state.activeExpedition.inputs.destinationId);
      if (strong) strong.textContent = "遠征の帰りを待つ →";
      if (span) span.textContent = `${destination ? destination.name : "遠征先"}へ派遣中。報告は帰還後に届く。`;
    } else if (state.completedReports.length) {
      if (strong) strong.textContent = "遠征台帳を開く →";
      if (span) span.textContent = "帰還報告を読み、次の遠征を決める。";
    } else {
      if (strong) strong.textContent = "遠征を送り出す →";
      if (span) span.textContent = "仲間と道具と方針を決め、霧の向こうへ送り出す。";
    }
  }

  function render() {
    const content = document.getElementById("expedition-folio-content");
    if (!content) return;
    content.replaceChildren();
    if (state.activeExpedition) renderActive(content);
    else if (lastResolved || state.completedReports.length) renderReport(content, lastResolved || state.completedReports[0]);
    else renderPrepare(content);
  }

  function heading(kicker, title, copy) {
    const box = el("header", "expedition-folio__heading");
    box.append(el("p", "expedition-folio__eyebrow", kicker), el("h2", "", title), el("p", "", copy));
    return box;
  }

  function companionAvailable(item) {
    return !item.condition || ["healthy", "ready"].includes(item.condition);
  }

  function choiceGroup(title, name, items, selectedId, describe) {
    const group = el("fieldset", "expedition-choice");
    group.append(el("legend", "", title));
    items.forEach((item) => {
      const label = el("label", "expedition-choice__item");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = name;
      input.value = item.id;
      const unavailableCompanion = name === "companion" && !companionAvailable(item);
      input.disabled = unavailableCompanion;
      if (item.id === selectedId && !unavailableCompanion) input.checked = true;
      if (unavailableCompanion) {
        label.setAttribute("aria-disabled", "true");
        label.style.opacity = "0.5";
      }
      const body = el("span", "");
      body.append(el("strong", "", item.name), el("small", "", describe(item)));
      label.append(input, body);
      group.append(label);
    });
    return group;
  }

  function renderPrepare(content) {
    content.append(heading("GREY HEARTH / PREPARE", "誰を、どこへ送り出す？", "選ぶのは少しだけ。結果はあとで報告として返ってくる。"));
    const form = el("form", "expedition-prepare");
    const availableCompanions = state.companions.filter(companionAvailable);
    form.append(
      choiceGroup("遠征先", "destination", state.destinations, state.destinations[0].id, (d) => `危険: ${d.dangerTags.join("・")} / 約${Math.round(d.durationMs / 60000)}分`),
      choiceGroup("仲間", "companion", state.companions, availableCompanions[0]?.id, (c) => `${c.origin} / ${c.traits.join("・")} / ${c.condition}`),
      choiceGroup("方針", "policy", Object.values(system.policies), "standard", (p) => p.id === "cautious" ? "負傷や危険で早めに引く" : p.id === "greedy" ? "成果のため危険を受け入れる" : "生還と成果の中間")
    );

    const gear = el("fieldset", "expedition-choice expedition-choice--gear");
    gear.append(el("legend", "", "道具（2つまで）"));
    state.equipment.forEach((item) => {
      const label = el("label", "expedition-choice__item");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "equipment";
      input.value = item.id;
      label.append(input, el("span", "", `${item.name} — ${item.tags.join("・")}`));
      gear.append(label);
    });
    form.append(gear);

    const feedback = el("p", "expedition-form-feedback", "");
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    form.append(feedback);

    const actions = el("div", "expedition-actions");
    const dispatch = el("button", "expedition-dispatch", "遠征を送り出す →");
    dispatch.type = "submit";
    const instant = el("label", "expedition-dev-toggle");
    instant.innerHTML = '<input type="checkbox" name="instant"> 開発用: 即時帰還';
    actions.append(instant);

    if (!availableCompanions.length) {
      dispatch.disabled = true;
      dispatch.textContent = "派遣できる仲間がいない";
      const recover = el("button", "expedition-secondary", "灰炉で休養する");
      recover.type = "button";
      recover.addEventListener("click", () => {
        let recovered = 0;
        state.companions.forEach((companion) => {
          if (companion.condition === "injured") {
            companion.condition = "healthy";
            companion.history = `${companion.history || ""} / 灰炉で休養`;
            recovered += 1;
          }
        });
        save(state);
        if (!recovered) {
          feedback.textContent = "今すぐ遠征に出せる仲間がいない。";
          return;
        }
        content.replaceChildren();
        renderPrepare(content);
      });
      actions.append(recover);
      feedback.textContent = "全員が負傷中。休養させると再び派遣できる。";
    }

    actions.append(dispatch);
    form.append(actions);
    form.addEventListener("change", (event) => {
      feedback.textContent = "";
      if (event.target.name === "equipment") {
        const checked = form.querySelectorAll('input[name="equipment"]:checked');
        if (checked.length > 2) event.target.checked = false;
      }
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const companionId = data.get("companion");
      if (!companionId) {
        feedback.textContent = "派遣できる仲間を選んでください。";
        return;
      }
      const now = Date.now();
      try {
        state = system.dispatchExpedition(state, {
          destinationId: data.get("destination"),
          companionIds: [companionId],
          equipmentIds: data.getAll("equipment"),
          policyId: data.get("policy"),
          objective: "explore",
          durationMs: data.get("instant") ? 0 : undefined,
        }, now);
        save(state);
        refresh(now);
        render();
      } catch (error) {
        feedback.textContent = `遠征を開始できない: ${error && error.message ? error.message : "不明なエラー"}`;
      }
    });
    content.append(form);
  }

  function renderActive(content) {
    const exp = state.activeExpedition;
    const destination = state.destinations.find((d) => d.id === exp.inputs.destinationId);
    const party = exp.inputs.companionIds.map((id) => state.companions.find((c) => c.id === id)).filter(Boolean);
    const remaining = Math.max(0, exp.expectedReturnAt - Date.now());
    content.append(heading("DISPATCHED / WAIT", destination ? destination.name : "遠征中", `${party.map((c) => c.name).join("、")}がまだ戻っていない。`));
    const status = el("div", "expedition-active");
    status.append(el("strong", "", `帰還まで 約${Math.max(1, Math.ceil(remaining / 60000))}分`), el("p", "", `方針: ${system.policies[exp.inputs.policyId].name} / seed ${exp.seed}`));
    const check = el("button", "expedition-dispatch", "帰還を確認する");
    check.type = "button";
    check.addEventListener("click", () => { refresh(Date.now()); render(); });
    const finish = el("button", "expedition-secondary", "開発用: 時間を進める");
    finish.type = "button";
    finish.addEventListener("click", () => { refresh(exp.expectedReturnAt); render(); });
    status.append(check, finish);
    content.append(status);
  }

  function renderReport(content, report) {
    const outcomeLabel = { success: "生還", "early-return": "早期撤退", failed: "失敗" }[report.outcome] || report.outcome;
    content.append(heading("RETURN REPORT", `${report.destinationName} — ${outcomeLabel}`, `${report.policyName}方針。${report.notableEvent ? report.notableEvent.text : "報告が届いた。"}`));
    const summary = el("div", "expedition-report-summary");
    summary.innerHTML = `<div><small>戦利品</small><strong>${report.loot.length ? report.loot.map((x) => x.name).join("、") : "なし"}</strong></div><div><small>負傷</small><strong>${report.injuries.length ? report.injuries.map((id) => state.companions.find((c) => c.id === id)?.name || id).join("、") : "なし"}</strong></div><div><small>新発見</small><strong>${report.discoveries.length ? report.discoveries.map((x) => x.name).join("、") : "なし"}</strong></div>`;
    content.append(summary);
    const details = el("details", "expedition-log");
    details.open = true;
    details.append(el("summary", "", "時系列の報告を読む"));
    const list = el("ol", "");
    report.log.forEach((entry) => {
      const li = el("li", "");
      li.innerHTML = `<time>${entry.time}</time><span>${entry.text}</span>${entry.causes.length ? `<small>${entry.causes.join(" / ")}</small>` : ""}`;
      list.append(li);
    });
    details.append(list);
    content.append(details);
    const again = el("button", "expedition-dispatch", "次の遠征を準備する →");
    again.type = "button";
    again.addEventListener("click", () => { lastResolved = null; renderPrepare(content.replaceChildren() || content); });
    content.append(again);
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#start-expedition")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open();
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  refresh(Date.now());
  updateGateCopy();
  window.setInterval(() => {
    if (!state.activeExpedition) return;
    refresh(Date.now());
    const shell = document.getElementById("expedition-folio");
    if (shell && shell.classList.contains("is-open")) render();
  }, 15000);
})();
