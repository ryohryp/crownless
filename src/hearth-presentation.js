(() => {
  "use strict";

  const scene = document.getElementById("hearth-scene");
  if (!scene) return;

  const fire = document.getElementById("hearth-fire-interaction");
  const character = document.getElementById("hearth-character-interaction");
  const loot = document.getElementById("hearth-loot-focus");
  const map = document.getElementById("hearth-map-focus");
  const whisper = document.getElementById("hearth-whisper");
  const emberLayer = document.getElementById("hearth-embers");
  const shelfCount = document.getElementById("hearth-shelf-count");
  const mapStatus = document.getElementById("hearth-map-status");

  let whisperTimer = null;
  let mutationFrame = null;

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

  function refreshSceneState() {
    const secured = numberFrom("#secured-count");
    const renown = numberFrom("#hearth-progress .renown-total strong");

    scene.dataset.weapon = weaponKind();
    scene.classList.toggle("rank-1", renown >= 5);
    scene.classList.toggle("rank-2", renown >= 15);
    scene.classList.toggle("rank-3", renown >= 30);

    if (shelfCount) shelfCount.textContent = String(secured);
    if (mapStatus) {
      if (renown >= 30) mapStatus.textContent = `RENOWN ${renown} / 鍛冶火`;
      else if (renown >= 15) mapStatus.textContent = `RENOWN ${renown} / 回収係`;
      else if (renown >= 5) mapStatus.textContent = `RENOWN ${renown} / 地図掛け`;
      else mapStatus.textContent = `RENOWN ${renown} / 地図はまだ白い`;
    }
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
    speak(renown >= 5 ? "生還者の線が少しずつ世界を地図に変えている。" : "まだ白い。最初の生還者の線を引け。", 1500);
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
