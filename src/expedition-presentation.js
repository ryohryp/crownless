"use strict";

(function expeditionPresentation() {
  const STORAGE_KEY = "crownless.expedition-poc.v1";
  const system = window.CrownlessExpeditionSystem;
  const narrative = window.CrownlessExpeditionNarrative;
  const sceneProjection = window.CrownlessExpeditionScenes;
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
  let reportSceneCursor = 0;
  let reportSceneExpeditionId = null;

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
      if (strong) strong.textContent = "遠征の様子を見る →";
      if (span) span.textContent = `${destination ? destination.name : "遠征先"}へ派遣中。進行中の記録を確認できる。`;
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

  function formatLiveClock(timestamp) {
    const date = new Date(timestamp);
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function activeLogEntries(expedition, now) {
    const duration = Math.max(1, expedition.expectedReturnAt - expedition.startedAt);
    const elapsed = Math.max(0, Math.min(duration, now - expedition.startedAt));
    const progress = elapsed / duration;
    const preview = system.resolveExpedition(expedition, state);
    const endMinute = Math.max(1, ...preview.log.map((entry) => Number(entry.minute) || 0));
    const cutoffMinute = progress * endMinute;

    return preview.log
      .filter((entry) => entry.type !== "return" && entry.minute <= cutoffMinute)
      .map((entry) => ({
        ...entry,
        liveTime: formatLiveClock(expedition.startedAt + (entry.minute / endMinute) * duration),
      }));
  }

  function renderActiveLog(content, expedition, now) {
    const entries = activeLogEntries(expedition, now);
    const details = el("details", "expedition-log expedition-log--active");
    details.open = true;
    details.append(el("summary", "", `遠征中の記録（${entries.length}件）`));
    const list = el("ol", "");
    entries.forEach((entry) => {
      const li = el("li", "");
      li.append(el("time", "", entry.liveTime), el("span", "", entry.text));
      list.append(li);
    });
    details.append(list);
    content.append(details);
  }

  function renderActive(content) {
    const exp = state.activeExpedition;
    const destination = state.destinations.find((d) => d.id === exp.inputs.destinationId);
    const party = exp.inputs.companionIds.map((id) => state.companions.find((c) => c.id === id)).filter(Boolean);
    const now = Date.now();
    const remaining = Math.max(0, exp.expectedReturnAt - now);
    content.append(heading("DISPATCHED / WAIT", destination ? destination.name : "遠征中", `${party.map((c) => c.name).join("、")}がまだ戻っていない。遠征中に届いた記録だけがここへ追記される。`));
    const status = el("div", "expedition-active");
    status.append(el("strong", "", `帰還まで 約${Math.max(1, Math.ceil(remaining / 60000))}分`), el("p", "", `方針: ${system.policies[exp.inputs.policyId].name} / seed ${exp.seed}`));
    const check = el("button", "expedition-dispatch", "最新の記録を確認する");
    check.type = "button";
    check.addEventListener("click", () => { refresh(Date.now()); render(); });
    const finish = el("button", "expedition-secondary", "開発用: 時間を進める");
    finish.type = "button";
    finish.addEventListener("click", () => { refresh(exp.expectedReturnAt); render(); });
    status.append(check, finish);
    content.append(status);
    renderActiveLog(content, exp, now);
  }

  function buildBattleNarrative(report) {
    if (!narrative || typeof narrative.buildExpeditionNarrative !== "function") return null;
    return narrative.buildExpeditionNarrative({ report, companions: state.companions, policies: system.policies });
  }

  function scrollToReportSummary(content) {
    const summary = content.querySelector("[data-expedition-summary]");
    if (!summary) return;
    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    summary.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }

  function renderKamishibai(content, report, generatedNarrative) {
    if (!sceneProjection || typeof sceneProjection.buildExpeditionScenes !== "function") return false;
    const deck = sceneProjection.buildExpeditionScenes({
      report,
      narrative: generatedNarrative,
      destinations: state.destinations,
    });
    if (!deck.scenes.length) return false;

    if (reportSceneExpeditionId !== report.expeditionId) {
      reportSceneExpeditionId = report.expeditionId;
      reportSceneCursor = 0;
    }
    reportSceneCursor = Math.max(0, Math.min(reportSceneCursor, deck.scenes.length - 1));

    const section = el("section", "expedition-kamishibai");
    section.setAttribute("aria-label", "遠征の紙芝居");
    const headingBox = el("header", "expedition-kamishibai__heading");
    headingBox.append(
      el("small", "", "EXPEDITION SCENES"),
      el("strong", "", "遠征絵巻")
    );
    const skip = el("button", "expedition-kamishibai__skip", "成果へ ↓");
    skip.type = "button";
    skip.addEventListener("click", () => scrollToReportSummary(content));
    headingBox.append(skip);

    const frame = el("article", "expedition-kamishibai__frame");
    frame.setAttribute("aria-live", "polite");
    const visual = el("div", "expedition-kamishibai__visual");
    const sceneMark = el("span", "expedition-kamishibai__mark", "");
    const copy = el("div", "expedition-kamishibai__copy");
    const phase = el("small", "expedition-kamishibai__phase", "");
    const sceneTitle = el("h3", "", "");
    const caption = el("p", "", "");
    copy.append(phase, sceneTitle, caption);
    frame.append(visual, sceneMark, copy);

    const nav = el("div", "expedition-kamishibai__nav");
    const previous = el("button", "expedition-secondary", "← 前の場面");
    previous.type = "button";
    const counter = el("span", "expedition-kamishibai__counter", "");
    const next = el("button", "expedition-dispatch", "次の場面 →");
    next.type = "button";
    nav.append(previous, counter, next);

    function drawScene() {
      const scene = deck.scenes[reportSceneCursor];
      const resolved = typeof sceneProjection.resolveVisual === "function"
        ? sceneProjection.resolveVisual(scene.visualKey)
        : { key: scene.visualKey, motif: "road" };
      const phaseLabel = scene.phase === "opening" ? "旅のはじまり" : scene.phase === "ending" ? "帰還" : "遠征の途中";

      visual.replaceChildren();
      visual.dataset.visualKey = resolved.key || scene.visualKey;
      visual.dataset.motif = resolved.motif || "road";
      visual.setAttribute("role", "img");
      visual.setAttribute("aria-label", resolved.alt || scene.headline);
      if (resolved.assetPath) {
        const image = document.createElement("img");
        image.className = `expedition-kamishibai__asset expedition-kamishibai__asset--${resolved.assetRole || "figure"}`;
        image.src = resolved.assetPath;
        image.alt = "";
        image.setAttribute("aria-hidden", "true");
        visual.append(image);
      }
      if (resolved.glyph) {
        const glyph = el("span", "expedition-kamishibai__glyph", resolved.glyph);
        glyph.setAttribute("aria-hidden", "true");
        visual.append(glyph);
      }

      sceneMark.textContent = `${String(reportSceneCursor + 1).padStart(2, "0")} / ${String(deck.scenes.length).padStart(2, "0")}`;
      phase.textContent = phaseLabel;
      sceneTitle.textContent = scene.headline;
      caption.textContent = scene.caption;
      counter.textContent = `${reportSceneCursor + 1} / ${deck.scenes.length}`;
      previous.disabled = reportSceneCursor === 0;
      next.textContent = reportSceneCursor === deck.scenes.length - 1 ? "成果を見る ↓" : "次の場面 →";
    }

    previous.addEventListener("click", () => {
      if (reportSceneCursor <= 0) return;
      reportSceneCursor -= 1;
      drawScene();
    });
    next.addEventListener("click", () => {
      if (reportSceneCursor >= deck.scenes.length - 1) {
        scrollToReportSummary(content);
        return;
      }
      reportSceneCursor += 1;
      drawScene();
    });

    section.append(headingBox, frame, nav);
    drawScene();
    content.append(section);
    return true;
  }

  function renderBattleNarrative(content, report, generated) {
    const built = generated || buildBattleNarrative(report);
    if (!built || !built.battles.length) return;

    const section = el("section", "expedition-narrative");
    const title = el("header", "expedition-narrative__heading");
    title.append(el("small", "", "BATTLE NARRATIVE"), el("strong", "", "遠征記"));
    section.append(title);

    built.battles.forEach((battle, index) => {
      const outcome = { victory: "勝利", retreat: "撤退", defeat: "敗北" }[battle.outcome] || battle.outcome;
      const article = el("article", "expedition-narrative__battle");
      article.append(el("h3", "", `${index + 1}. ${battle.encounterName} — ${outcome}`));
      battle.lines.forEach((line) => {
        const paragraph = el("p", "expedition-narrative__line", line.text);
        paragraph.dataset.phase = line.phase;
        article.append(paragraph);
      });
      section.append(article);
    });

    content.append(section);
  }

  function renderReport(content, report) {
    const outcomeLabel = { success: "生還", "early-return": "早期撤退", failed: "失敗" }[report.outcome] || report.outcome;
    content.append(heading("RETURN REPORT", `${report.destinationName} — ${outcomeLabel}`, `${report.policyName}方針。帰ってきた遠征隊の話を辿る。`));
    const generatedNarrative = buildBattleNarrative(report);
    renderKamishibai(content, report, generatedNarrative);

    const summary = el("section", "expedition-report-summary");
    summary.dataset.expeditionSummary = "";
    summary.setAttribute("aria-label", "遠征成果");
    summary.innerHTML = `<div><small>戦利品</small><strong>${report.loot.length ? report.loot.map((x) => x.name).join("、") : "なし"}</strong></div><div><small>負傷</small><strong>${report.injuries.length ? report.injuries.map((id) => state.companions.find((c) => c.id === id)?.name || id).join("、") : "なし"}</strong></div><div><small>新発見</small><strong>${report.discoveries.length ? report.discoveries.map((x) => x.name).join("、") : "なし"}</strong></div>`;
    content.append(summary);
    renderBattleNarrative(content, report, generatedNarrative);

    const details = el("details", "expedition-log");
    details.append(el("summary", "", "時系列と戦闘数値を確認する"));
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
    again.addEventListener("click", () => {
      lastResolved = null;
      reportSceneExpeditionId = null;
      reportSceneCursor = 0;
      content.replaceChildren();
      renderPrepare(content);
    });
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