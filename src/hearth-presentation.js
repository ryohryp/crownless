(() => {
  "use strict";

  function ensureStylesheet(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = href;
    document.head.appendChild(stylesheet);
  }

  function ensureScript(src, onload) {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (window.CrownlessNpcLife) onload?.();
      else existing.addEventListener("load", () => onload?.(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.addEventListener("load", () => onload?.(), { once: true });
    document.head.appendChild(script);
  }

  ensureStylesheet("hearth-viewport.css");
  ensureStylesheet("hearth-location-visual.css");
  ensureScript("src/npc-life.js", scheduleRefresh);

  const Core = window.CrownlessCore;
  const LocationVisuals = window.CrownlessLocationVisuals;
  const scene = document.getElementById("hearth-scene");
  if (!scene) return;

  const fire = document.getElementById("hearth-fire-interaction");
  const character = document.getElementById("hearth-character-interaction");
  const loot = document.getElementById("hearth-loot-focus");
  const map = document.getElementById("hearth-map-focus");
  const mapPaper = map?.querySelector(".map-paper");
  const whisper = document.getElementById("hearth-whisper");
  const emberLayer = document.getElementById("hearth-embers");
  const shelfCount = document.getElementById("hearth-shelf-count");
  const mapStatus = document.getElementById("hearth-map-status");
  const residentNote = scene.querySelector(".hearth-room-note");
  const knowledgePanel = document.getElementById("world-knowledge-panel");
  const equippedLabel = document.getElementById("equipped-label");
  const loadoutTitle = document.getElementById("loadout-title");
  const loadoutDescription = document.getElementById("loadout-description");

  if (knowledgePanel) {
    knowledgePanel.hidden = true;
    knowledgePanel.setAttribute("aria-hidden", "true");
  }

  let whisperTimer = null;
  let mutationFrame = null;
  let mapVisualRequest = 0;
  let mapVisualAsset = "";
  let mapVisualResolved = null;
  let unavailableMapVisualAsset = "";
  let activeReunionCandidate = null;

  function speak(message, duration = 1500) {
    if (!whisper) return;
    whisper.textContent = message;
    whisper.classList.add("show");
    clearTimeout(whisperTimer);
    whisperTimer = setTimeout(() => whisper.classList.remove("show"), duration);
  }

  function temporaryClass(name, duration = 650) {
    scene.classList.remove(name);
    void scene.offsetWidth;
    scene.classList.add(name);
    setTimeout(() => scene.classList.remove(name), duration);
  }

  function scrollTo(selector) {
    const target = document.querySelector(selector);
    if (!target) return false;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }

  function spawnEmbers(count = 10) {
    if (!emberLayer) return;
    for (let i = 0; i < count; i += 1) {
      const ember = document.createElement("i");
      ember.style.setProperty("--drift", `${Math.round((Math.random() - 0.5) * 70)}px`);
      ember.style.left = `${42 + Math.random() * 16}%`;
      ember.style.animationDelay = `${Math.random() * 120}ms`;
      emberLayer.appendChild(ember);
      ember.addEventListener("animationend", () => ember.remove(), { once: true });
      setTimeout(() => ember.remove(), 1400);
    }
  }

  function numberFrom(selector) {
    const node = document.querySelector(selector);
    if (!node) return 0;
    const value = Number.parseInt(node.textContent, 10);
    return Number.isFinite(value) ? value : 0;
  }

  function weaponKind() {
    const label = (document.getElementById("equipped-label")?.textContent || "").toLowerCase();
    const title = (document.getElementById("loadout-title")?.textContent || "").toLowerCase();
    const text = `${label} ${title}`;
    if (/剣|sword/.test(text)) return "sword";
    if (/短刀|刀|dagger/.test(text)) return "dagger";
    return "fists";
  }

  function syncExpeditionReadinessCopy() {
    if (!character) return;
    const equipped = String(equippedLabel?.textContent || "").trim();
    const hasEquipment = Boolean(equipped && equipped !== "素手");
    const nextTitle = hasEquipment ? null : "遠征の支度をする";
    const nextDescription = hasEquipment
      ? `${equipped}は遠征へ持ち出せる。誰に託し、どこへ送るかを決めよう。`
      : "持ち出す装備はまだない。地図と仲間を見て、次の遠征を決めよう。";

    if (character.getAttribute("aria-label") !== "遠征に持ち出す装備を確かめる") {
      character.setAttribute("aria-label", "遠征に持ち出す装備を確かめる");
    }
    if (nextTitle && loadoutTitle && loadoutTitle.textContent !== nextTitle) loadoutTitle.textContent = nextTitle;
    if (loadoutDescription && loadoutDescription.textContent !== nextDescription) loadoutDescription.textContent = nextDescription;
  }

  function mapProgressLabel(renown, discovered) {
    let milestone = "地図はまだ白い";
    if (renown >= 30) milestone = "鍛冶火";
    else if (renown >= 15) milestone = "回収係";
    else if (renown >= 5) milestone = "地図掛け";
    return `RENOWN ${renown} / 探索録 ${discovered} / ${milestone}`;
  }

  function syncReunionInteraction(candidate) {
    activeReunionCandidate = candidate || null;
    if (!residentNote) return;
    if (!activeReunionCandidate) {
      residentNote.removeAttribute("role");
      residentNote.removeAttribute("tabindex");
      residentNote.removeAttribute("aria-label");
      return;
    }
    residentNote.setAttribute("role", "button");
    residentNote.setAttribute("tabindex", "0");
    residentNote.setAttribute("aria-label", `${activeReunionCandidate.destinationName}の再会候補を世界地図で確認する`);
  }

  function selectReunionDestination(candidate) {
    if (!candidate) return false;
    const Atlas = window.CrownlessWorldAtlas;
    if (!Atlas || typeof Atlas.openAtlas !== "function") return false;
    const safe = Core && typeof Core.loadSafeState === "function" ? Core.loadSafeState() : null;
    const discoveries = safe && safe.worldKnowledge && safe.worldKnowledge.discoveries;
    const remembered = discoveries && candidate.discoveryKey ? discoveries[candidate.discoveryKey] : null;
    const name = String(remembered && remembered.name || candidate.destinationName || "");
    const opened = Atlas.openAtlas(document, Core, window, { view: "world", autoScan: false });
    if (!opened) return false;
    const viewer = document.getElementById("world-atlas-viewer");
    if (!viewer) return true;
    const target = Array.from(viewer.querySelectorAll(".world-atlas-marker, .world-atlas-unplaced button")).find((node) => {
      if (node.classList?.contains("world-atlas-marker")) {
        const label = String(node.getAttribute("aria-label") || "");
        return name && label.startsWith(`${name}。`);
      }
      return name && String(node.textContent || "").trim() === name;
    });
    if (target) {
      target.click();
      target.focus();
    }
    speak(`${name || "再会候補"}を世界地図で開いた。`, 1700);
    return true;
  }

  function refreshResidentNote(now = new Date()) {
    const NpcLife = window.CrownlessNpcLife;
    if (!residentNote || !NpcLife || typeof NpcLife.snapshotAt !== "function" || typeof NpcLife.formatHearthStatus !== "function") return;
    const snapshot = NpcLife.snapshotAt(now);
    const safe = Core && typeof Core.loadSafeState === "function" ? Core.loadSafeState() : null;
    const knownDestinations = safe && safe.worldKnowledge ? safe.worldKnowledge.discoveries : null;
    const reunions = typeof NpcLife.reunionCandidates === "function"
      ? NpcLife.reunionCandidates(snapshot, knownDestinations)
      : [];
    syncReunionInteraction(reunions[0] || null);
    const reunionNote = reunions.length
      ? ` / 再会候補: ${reunions.map((candidate) => `${candidate.destinationName} — ${candidate.targetName}に会えるかもしれない。`).join(" / ")}`
      : "";
    const next = `「${NpcLife.formatHearthStatus(snapshot)}${reunionNote}」`;
    if (residentNote.textContent !== next) residentNote.textContent = next;
  }

  function closeLocationVisualViewer() {
    const viewer = document.getElementById("hearth-location-visual-viewer");
    if (viewer) viewer.remove();
    document.body.classList.remove("hearth-location-visual-open");
  }

  function openLocationVisualViewer() {
    const resolved = mapVisualResolved;
    const assetPath = resolved && resolved.visual ? String(resolved.visual.assetPath || "") : "";
    if (!assetPath || assetPath !== mapVisualAsset || !map?.classList.contains("has-location-visual")) return false;

    closeLocationVisualViewer();

    const viewer = document.createElement("div");
    viewer.id = "hearth-location-visual-viewer";
    viewer.className = "hearth-location-visual-viewer";
    viewer.setAttribute("role", "dialog");
    viewer.setAttribute("aria-modal", "true");
    viewer.setAttribute("aria-label", "探索録のロケーションビジュアル");

    const folio = document.createElement("figure");
    folio.className = "hearth-location-visual-folio";

    const image = document.createElement("img");
    image.src = assetPath;
    image.alt = String(resolved.visual.alt || "発見済み地点");
    image.decoding = "async";

    const caption = document.createElement("figcaption");
    const kicker = document.createElement("small");
    kicker.textContent = "DISCOVERED PLACE / 探索録";
    const title = document.createElement("strong");
    title.textContent = String(resolved.entry && resolved.entry.name || "発見済み地点");
    const note = document.createElement("span");
    note.textContent = "見つけた景色は、敗れても地図から消えない。";
    caption.append(kicker, title, note);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "hearth-location-visual-close";
    close.setAttribute("aria-label", "探索録を閉じる");
    close.textContent = "閉じる ×";
    close.addEventListener("click", closeLocationVisualViewer);

    folio.append(image, caption, close);
    viewer.appendChild(folio);
    viewer.addEventListener("click", (event) => {
      if (event.target === viewer) closeLocationVisualViewer();
    });
    viewer.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeLocationVisualViewer();
    });

    document.body.appendChild(viewer);
    document.body.classList.add("hearth-location-visual-open");
    requestAnimationFrame(() => viewer.classList.add("show"));
    close.focus();
    return true;
  }

  function clearMapVisual() {
    if (!map) return;
    mapVisualAsset = "";
    mapVisualResolved = null;
    map.classList.remove("has-location-visual");
    delete map.dataset.locationVisual;
    map.setAttribute("aria-label", "地図と灰炉の名声を見る");
    closeLocationVisualViewer();
    if (mapPaper) {
      for (const property of ["background-image", "background-position", "background-size", "background-repeat", "opacity", "filter"]) {
        mapPaper.style.removeProperty(property);
      }
    }
  }

  function refreshMapVisual() {
    if (!map || !mapPaper || !Core || typeof Core.loadSafeState !== "function" || !LocationVisuals || typeof LocationVisuals.resolveLatestDiscoveredVisual !== "function") {
      clearMapVisual();
      return;
    }

    const safe = Core.loadSafeState();
    const resolved = LocationVisuals.resolveLatestDiscoveredVisual(safe && safe.worldKnowledge);
    const assetPath = resolved && resolved.visual ? String(resolved.visual.assetPath || "") : "";
    if (!assetPath) {
      unavailableMapVisualAsset = "";
      clearMapVisual();
      return;
    }
    if (mapVisualAsset === assetPath) {
      mapVisualResolved = resolved;
      const placeName = String(resolved.entry && resolved.entry.name || "発見済み地点");
      map.setAttribute("aria-label", `探索録の地図。${placeName}の墨絵を見る`);
      return;
    }
    if (unavailableMapVisualAsset === assetPath) return;

    const requestId = ++mapVisualRequest;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (requestId !== mapVisualRequest) return;
      mapVisualAsset = assetPath;
      mapVisualResolved = resolved;
      unavailableMapVisualAsset = "";
      map.classList.add("has-location-visual");
      map.dataset.locationVisual = resolved.visual.id;
      const placeName = String(resolved.entry && resolved.entry.name || "発見済み地点");
      map.setAttribute("aria-label", `探索録の地図。${placeName}の墨絵を見る`);
    };
    image.onerror = () => {
      if (requestId !== mapVisualRequest) return;
      unavailableMapVisualAsset = assetPath;
      clearMapVisual();
    };
    image.src = assetPath;
  }

  function refreshSceneState() {
    const secured = numberFrom("#secured-count");
    const renown = numberFrom("#hearth-progress .renown-total strong");
    const discovered = numberFrom("#world-knowledge-count");

    scene.dataset.weapon = weaponKind();
    scene.classList.toggle("rank-1", renown >= 5);
    scene.classList.toggle("rank-2", renown >= 15);
    scene.classList.toggle("rank-3", renown >= 30);

    if (shelfCount) shelfCount.textContent = String(secured);
    if (mapStatus) mapStatus.textContent = mapProgressLabel(renown, discovered);
    syncExpeditionReadinessCopy();
    refreshResidentNote();
    refreshMapVisual();
  }

  function scheduleRefresh() {
    if (mutationFrame) return;
    mutationFrame = requestAnimationFrame(() => {
      mutationFrame = null;
      refreshSceneState();
    });
  }

  fire?.addEventListener("click", () => {
    temporaryClass("fire-stoked", 850);
    spawnEmbers(12);
    speak("薪を崩した。火の粉がひとつ、暗がりへ消えた。", 1700);
  });

  character?.addEventListener("click", () => {
    temporaryClass("character-ready", 650);
    const equipped = String(equippedLabel?.textContent || "").trim();
    speak(equipped && equipped !== "素手"
      ? `${equipped}を遠征装備として確かめた。誰に託すかは、送り出す前に決める。`
      : "装備棚はまだ心許ない。地図と仲間を見て、次の遠征を決めよう。", 1900);
  });

  loot?.addEventListener("click", () => {
    const count = numberFrom("#secured-count");
    speak(count ? `棚には ${count} 個。持ち帰った物だけが、ここに残る。` : "棚は空だ。外から何か持ち帰るしかない。", 1500);
    scrollTo("#hub-screen .inventory-panel");
  });

  residentNote?.addEventListener("click", () => {
    selectReunionDestination(activeReunionCandidate);
  });
  residentNote?.addEventListener("keydown", (event) => {
    if (!activeReunionCandidate || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    selectReunionDestination(activeReunionCandidate);
  });

  map?.addEventListener("click", () => {
    const renown = numberFrom("#hearth-progress .renown-total strong");
    const discovered = numberFrom("#world-knowledge-count");
    const latest = document.querySelector("#world-knowledge-panel .world-knowledge-entry strong")?.textContent || "";
    if (discovered > 0 && map.classList.contains("has-location-visual") && openLocationVisualViewer()) {
      const visualName = String(mapVisualResolved && mapVisualResolved.entry && mapVisualResolved.entry.name || latest || "発見済み地点");
      speak(`探索録は ${discovered}。墨印「${visualName}」の景色を開いた。`, 1600);
      return;
    }
    if (discovered > 0) {
      speak("探索録は残っている。画像付きの発見はまだない。崩れた物見台を見つけると、ここに景色が残る。", 2200);
    } else {
      speak(renown >= 5 ? "生還者の線はある。だが、探索録にはまだ名のある場所がない。" : "まだ白い。最初の発見を地図に残せ。", 1500);
    }
    if (!scrollTo("#hearth-progress")) setTimeout(() => scrollTo("#hearth-progress"), 0);
  });

  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.getElementById("hub-screen"), {
    subtree: true,
    childList: true,
    characterData: true
  });

  refreshSceneState();
})();