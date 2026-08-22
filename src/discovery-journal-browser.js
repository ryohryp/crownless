(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessDiscoveryJournal = api;
  if (root && root.document) api.install(root.document, root.CrownlessCore, root.CrownlessLocationVisuals, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createDiscoveryJournalBrowser() {
  "use strict";

  const TERRAIN_LABELS = Object.freeze({
    water: "水辺",
    crossing: "渡り場",
    sacred: "聖域",
    woods: "森",
    road_hub: "街道の結節",
    height: "高地",
    coast: "海辺",
    settlement: "集落"
  });

  const KIND_LABELS = Object.freeze({
    dungeon: "遺構",
    encounter: "遭遇",
    combat: "戦場",
    event: "異変",
    cache: "物資",
    shrine: "聖所",
    traveler: "旅人"
  });

  const STATE_LABELS = Object.freeze({
    discovered: "発見済み",
    investigated: "調査済み",
    cleared: "踏破済み"
  });

  function cleanText(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function journalEntries(worldKnowledge) {
    const discoveries = worldKnowledge && worldKnowledge.discoveries;
    if (!discoveries || typeof discoveries !== "object" || Array.isArray(discoveries)) return [];
    return Object.values(discoveries)
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => ({ ...entry }))
      .sort((left, right) => (Number(right.firstDiscoveredAt) || 0) - (Number(left.firstDiscoveredAt) || 0));
  }

  function entryViewModel(entry, LocationVisuals) {
    const source = entry && typeof entry === "object" ? entry : {};
    const terrain = Array.isArray(source.terrain)
      ? source.terrain.map((item) => cleanText(item)).filter(Boolean)
      : [];
    const visual = LocationVisuals && typeof LocationVisuals.resolveLocationVisual === "function"
      ? LocationVisuals.resolveLocationVisual(source)
      : null;
    return {
      key: cleanText(source.key),
      name: cleanText(source.name, "名もない発見"),
      state: cleanText(source.state, "discovered"),
      stateLabel: STATE_LABELS[cleanText(source.state)] || cleanText(source.state, "発見済み"),
      contentKind: cleanText(source.contentKind, "unknown"),
      kindLabel: KIND_LABELS[cleanText(source.contentKind)] || "不明な気配",
      terrain,
      terrainLabel: terrain.length ? terrain.map((item) => TERRAIN_LABELS[item] || item).join(" / ") : "地形不明",
      visits: Math.max(1, Number(source.visits) || 1),
      firstDiscoveredAt: Math.max(0, Number(source.firstDiscoveredAt) || 0),
      visual
    };
  }

  function formatDiscoveryDate(timestamp) {
    const value = Number(timestamp);
    if (!Number.isFinite(value) || value <= 0) return "記録時刻不明";
    try {
      return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
    } catch (_) {
      return "記録時刻不明";
    }
  }

  function ensureStylesheet(document, href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = href;
    document.head.appendChild(stylesheet);
  }

  function install(document, Core, LocationVisuals, root) {
    if (!document || !Core || Core.__discoveryJournalBrowserInstalled) return false;
    const map = document.getElementById("hearth-map-focus");
    if (!map || typeof Core.loadSafeState !== "function") return false;

    ensureStylesheet(document, "discovery-journal-browser.css");
    let previousFocus = null;

    function closeBrowser() {
      const viewer = document.getElementById("discovery-journal-browser");
      if (viewer) viewer.remove();
      document.body.classList.remove("discovery-journal-open");
      if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
      previousFocus = null;
    }

    function renderDetail(detail, entry) {
      const model = entryViewModel(entry, LocationVisuals);
      detail.innerHTML = "";

      const media = document.createElement("div");
      media.className = `discovery-journal-media${model.visual ? " has-visual" : ""}`;
      if (model.visual) {
        const image = document.createElement("img");
        image.src = cleanText(model.visual.assetPath);
        image.alt = cleanText(model.visual.alt, model.name);
        image.decoding = "async";
        image.addEventListener("error", () => {
          media.classList.remove("has-visual");
          image.remove();
        }, { once: true });
        media.appendChild(image);
      }
      const seal = document.createElement("span");
      seal.className = "discovery-journal-seal";
      seal.textContent = model.visual ? "RECORDED VIEW" : "NO ILLUSTRATION";
      media.appendChild(seal);

      const copy = document.createElement("div");
      copy.className = "discovery-journal-detail-copy";
      const eyebrow = document.createElement("p");
      eyebrow.className = "discovery-journal-eyebrow";
      eyebrow.textContent = "DISCOVERED PLACE / 探索録";
      const title = document.createElement("h2");
      title.textContent = model.name;
      const meta = document.createElement("div");
      meta.className = "discovery-journal-meta";
      for (const [label, value] of [
        ["状態", model.stateLabel],
        ["種別", model.kindLabel],
        ["地形", model.terrainLabel],
        ["訪問", `${model.visits}回`],
        ["初回", formatDiscoveryDate(model.firstDiscoveredAt)]
      ]) {
        const row = document.createElement("div");
        const term = document.createElement("span");
        const data = document.createElement("strong");
        term.textContent = label;
        data.textContent = value;
        row.append(term, data);
        meta.appendChild(row);
      }
      const note = document.createElement("p");
      note.className = "discovery-journal-note";
      note.textContent = model.visits > 1
        ? "一度きりの噂ではない。あなたはここへ戻り、この場所を確かな記憶にした。"
        : "見つけた場所は、敗れても地図から消えない。";
      copy.append(eyebrow, title, meta, note);
      detail.append(media, copy);
    }

    function openBrowser() {
      closeBrowser();
      previousFocus = document.activeElement;
      const safe = Core.loadSafeState();
      const entries = journalEntries(safe && safe.worldKnowledge);

      const viewer = document.createElement("div");
      viewer.id = "discovery-journal-browser";
      viewer.className = "discovery-journal-browser";
      viewer.setAttribute("role", "dialog");
      viewer.setAttribute("aria-modal", "true");
      viewer.setAttribute("aria-label", "探索録を見る");

      const folio = document.createElement("section");
      folio.className = "discovery-journal-folio";

      const header = document.createElement("header");
      header.className = "discovery-journal-header";
      const heading = document.createElement("div");
      const kicker = document.createElement("small");
      kicker.textContent = "WORLD KNOWLEDGE / DISCOVERY JOURNAL";
      const title = document.createElement("h1");
      title.textContent = "探索録";
      const count = document.createElement("span");
      count.textContent = `${entries.length} PLACES`;
      heading.append(kicker, title);
      header.append(heading, count);

      const close = document.createElement("button");
      close.type = "button";
      close.className = "discovery-journal-close";
      close.textContent = "閉じる ×";
      close.setAttribute("aria-label", "探索録を閉じる");
      close.addEventListener("click", closeBrowser);

      const body = document.createElement("div");
      body.className = "discovery-journal-body";
      const list = document.createElement("nav");
      list.className = "discovery-journal-list";
      list.setAttribute("aria-label", "探索済みの場所");
      const detail = document.createElement("article");
      detail.className = "discovery-journal-detail";
      detail.setAttribute("aria-live", "polite");

      if (entries.length) {
        entries.forEach((entry, index) => {
          const model = entryViewModel(entry, LocationVisuals);
          const button = document.createElement("button");
          button.type = "button";
          button.className = `discovery-journal-entry${index === 0 ? " selected" : ""}`;
          button.dataset.discoveryKey = model.key;
          const entryTitle = document.createElement("strong");
          entryTitle.textContent = model.name;
          const entryMeta = document.createElement("span");
          entryMeta.textContent = `${model.kindLabel} · ${model.visits}回${model.visual ? " · ◈" : ""}`;
          button.append(entryTitle, entryMeta);
          button.addEventListener("click", () => {
            list.querySelectorAll(".discovery-journal-entry.selected").forEach((node) => node.classList.remove("selected"));
            button.classList.add("selected");
            renderDetail(detail, entry);
          });
          list.appendChild(button);
        });
        renderDetail(detail, entries[0]);
      } else {
        const empty = document.createElement("div");
        empty.className = "discovery-journal-empty";
        const emptyTitle = document.createElement("strong");
        emptyTitle.textContent = "探索録はまだ白紙だ。";
        const emptyCopy = document.createElement("p");
        emptyCopy.textContent = "霧の外へ出て場所を見つけると、ここから過去の発見を読み返せる。";
        empty.append(emptyTitle, emptyCopy);
        body.classList.add("empty");
        detail.appendChild(empty);
      }

      body.append(list, detail);
      folio.append(header, body, close);
      viewer.appendChild(folio);
      viewer.addEventListener("click", (event) => {
        if (event.target === viewer) closeBrowser();
      });
      viewer.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeBrowser();
      });

      document.body.appendChild(viewer);
      document.body.classList.add("discovery-journal-open");
      requestAnimationFrame(() => viewer.classList.add("show"));
      close.focus();
      return true;
    }

    map.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      openBrowser();
    }, true);

    Core.__discoveryJournalBrowserInstalled = true;
    api.open = openBrowser;
    api.close = closeBrowser;
    return true;
  }

  const api = {
    TERRAIN_LABELS,
    KIND_LABELS,
    STATE_LABELS,
    journalEntries,
    entryViewModel,
    formatDiscoveryDate,
    install,
    open: () => false,
    close: () => {}
  };

  return api;
});