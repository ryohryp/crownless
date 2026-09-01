((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.CrownlessHearthResidents = api;
    if (root.document) api.install(root.document, root);
  }
})(typeof window !== "undefined" ? window : globalThis, () => {
  "use strict";

  const STYLE_HREF = "hearth-residents.css";
  const LAYER_ID = "hearth-resident-layer";

  function presentResidents(snapshot) {
    return (Array.isArray(snapshot) ? snapshot : []).filter((resident) => resident && resident.atHearth);
  }

  function ensureStylesheet(documentRef) {
    if (!documentRef || documentRef.querySelector(`link[href="${STYLE_HREF}"]`)) return;
    const stylesheet = documentRef.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = STYLE_HREF;
    documentRef.head?.appendChild(stylesheet);
  }

  function residentAriaLabel(resident) {
    const name = String(resident?.name || "住人");
    const role = String(resident?.role || "");
    return role ? `${name}、${role}。灰炉にいる。` : `${name}。灰炉にいる。`;
  }

  function createResidentNode(documentRef, resident, index = 0) {
    const node = documentRef.createElement("div");
    node.className = "hearth-resident";
    node.dataset.residentId = String(resident.id || "resident");
    node.dataset.residentIndex = String(index);
    node.setAttribute("role", "img");
    node.setAttribute("aria-label", residentAriaLabel(resident));

    const figure = documentRef.createElement("span");
    figure.className = "hearth-resident-figure";
    figure.setAttribute("aria-hidden", "true");
    for (const className of ["resident-head", "resident-body", "resident-arm left", "resident-arm right", "resident-leg left", "resident-leg right", "resident-prop"]) {
      const part = documentRef.createElement("i");
      part.className = className;
      figure.appendChild(part);
    }

    const label = documentRef.createElement("span");
    label.className = "hearth-resident-label";
    label.setAttribute("aria-hidden", "true");
    const name = documentRef.createElement("strong");
    name.textContent = String(resident.name || "住人");
    const role = documentRef.createElement("small");
    role.textContent = String(resident.role || "");
    label.append(name, role);

    node.append(figure, label);
    return node;
  }

  function ensureLayer(documentRef, scene) {
    let layer = documentRef.getElementById(LAYER_ID);
    if (layer) return layer;
    const room = scene?.querySelector(".hearth-room");
    if (!room) return null;
    layer = documentRef.createElement("div");
    layer.id = LAYER_ID;
    layer.className = "hearth-resident-layer";
    layer.setAttribute("role", "group");
    layer.setAttribute("aria-label", "灰炉にいる住人");
    room.appendChild(layer);
    return layer;
  }

  function renderResidents(documentRef, scene, snapshot) {
    if (!documentRef || !scene) return [];
    const layer = ensureLayer(documentRef, scene);
    if (!layer) return [];
    const residents = presentResidents(snapshot);
    const nodes = residents.map((resident, index) => createResidentNode(documentRef, resident, index));
    layer.replaceChildren(...nodes);
    layer.hidden = residents.length === 0;
    return residents;
  }

  function refresh(documentRef, rootRef) {
    const scene = documentRef?.getElementById("hearth-scene");
    const NpcLife = rootRef?.CrownlessNpcLife;
    if (!scene || !NpcLife || typeof NpcLife.snapshotAt !== "function") return [];
    return renderResidents(documentRef, scene, NpcLife.snapshotAt(new Date()));
  }

  function install(documentRef, rootRef) {
    if (!documentRef || !rootRef) return null;
    const scene = documentRef.getElementById("hearth-scene");
    if (!scene) return null;

    ensureStylesheet(documentRef);
    const refreshNow = () => refresh(documentRef, rootRef);
    refreshNow();

    const npcScript = documentRef.querySelector('script[src="src/npc-life.js"]');
    if (!rootRef.CrownlessNpcLife && npcScript) {
      npcScript.addEventListener("load", refreshNow, { once: true });
    }

    const residentNote = scene.querySelector(".hearth-room-note");
    const observer = residentNote && typeof rootRef.MutationObserver === "function"
      ? new rootRef.MutationObserver(refreshNow)
      : null;
    observer?.observe(residentNote, { childList: true, characterData: true, subtree: true });

    const onVisibility = () => {
      if (documentRef.visibilityState !== "hidden") refreshNow();
    };
    rootRef.addEventListener?.("pageshow", refreshNow);
    rootRef.addEventListener?.("focus", refreshNow);
    documentRef.addEventListener?.("visibilitychange", onVisibility);

    return Object.freeze({
      refresh: refreshNow,
      disconnect() {
        observer?.disconnect();
        rootRef.removeEventListener?.("pageshow", refreshNow);
        rootRef.removeEventListener?.("focus", refreshNow);
        documentRef.removeEventListener?.("visibilitychange", onVisibility);
      }
    });
  }

  return Object.freeze({
    STYLE_HREF,
    LAYER_ID,
    presentResidents,
    residentAriaLabel,
    createResidentNode,
    renderResidents,
    refresh,
    install
  });
});
