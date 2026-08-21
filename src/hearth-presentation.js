(() => {
  "use strict";

  if (!document.querySelector('link[href="hearth-viewport.css"]')) {
    const layout = document.createElement("link");
    layout.rel = "stylesheet";
    layout.href = "hearth-viewport.css";
    document.head.appendChild(layout);
  }

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
  const knowledgePanel = document.getElementById("world-knowledge-panel");

  if (knowledgePanel) {
    knowledgePanel.hidden = true;
    knowledgePanel.setAttribute("aria-hidden", "true");
  }

  let whisperTimer = null;
  let mutationFrame = null;
  let mapVisualRequest = 0;
  let mapVisualAsset = "";
  let unavailableMapVisualAsset = "";

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

  function mapProgressLabel(renown, discovered) {
    let milestone = "地図はまだ白い";
    if (renown >= 30) milestone = "鍛冶火";
    else if (renown >= 15) milestone = "回収係";
    else if (renown >= 5) milestone = "地図掛け";
    return `RENOWN ${renown} / 探索録 ${discovered} / ${milestone}`;
  }

  function clearMapVisual() {
    if (!map) return;
    mapVisualAsset = "";
    map.classList.remove("has-location-visual");
    delete map.dataset.locationVisual;
    map.setAttribute("aria-label", "地図と灰炉の名声を見る");
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
    const resolved = LocationVisuals.resolveLatestDiscoveredVisual(safe && safe.worldKnowledge && safe.worldKnowledge.discoveries);
    const assetPath = resolved && resolved.visual ? String(resolved.visual.assetPath || "") : "";
    if (!assetPath) {
      unavailableMapVisualAsset = "";
      clearMapVisual();
      return;
    }
    if (mapVisualAsset === assetPath || unavailableMapVisualAsset === assetPath) return;

    const requestId = ++mapVisualRequest;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (requestId !== mapVisualRequest) return;
      mapVisualAsset = assetPath;
      unavailableMapVisualAsset = "";
      const escapedAssetPath = assetPath.replace(/"/g, "%22");
      mapPaper.style.backgroundImage = `linear-gradient(rgba(111,91,64,.20),rgba(65,50,34,.34)),url("${escapedAssetPath}")`;
      mapPaper.style.backgroundPosition = "center";
      mapPaper.style.backgroundSize = "cover";
      mapPaper.style.backgroundRepeat = "no-repeat";
      mapPaper.style.opacity = ".92";
      mapPaper.style.filter = "sepia(.22) saturate(.72) contrast(.94) brightness(.88)";
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
    const equipped = document.getElementById("equipped-label")?.textContent || "素手";
    speak(equipped === "素手" ? "拳を鳴らした。武器がなくても、外へは出られる。" : `${equipped}の重さを確かめた。`, 1700);
  });

  loot?.addEventListener("click", () => {
    const count = numberFrom("#secured-count");
    speak(count ? `棚には ${count} 個。持ち帰った物だけが、ここに残る。` : "棚は空だ。外から何か持ち帰るしかない。", 1500);
    scrollTo("#hub-screen .inventory-panel");
  });

  map?.addEventListener("click", () => {
    const renown = numberFrom("#hearth-progress .renown-total strong");
    const discovered = numberFrom("#world-knowledge-count");
    const latest = document.querySelector("#world-knowledge-panel .world-knowledge-entry strong")?.textContent || "";
    if (discovered > 0) {
      if (map.classList.contains("has-location-visual") && latest) speak(`探索録は ${discovered}。最近の墨印「${latest}」には、見つけた景色も残っている。`, 1900);
      else speak(latest ? `探索録は ${discovered}。最近の墨印は「${latest}」。` : `探索録は ${discovered}。地図に発見の墨印が残っている。`, 1800);
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
