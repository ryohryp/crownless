(() => {
  "use strict";

  const scene = document.getElementById("hearth-scene");
  const hubGrid = document.querySelector("#hub-screen .hub-grid");
  const inventory = hubGrid?.querySelector(".inventory-panel");
  const chronicle = hubGrid?.querySelector(".chronicle");
  const lootShelf = document.getElementById("hearth-loot-focus");
  if (!scene || !hubGrid || !inventory || !chronicle) return;

  let returnFocus = null;

  const journal = document.createElement("button");
  journal.id = "hearth-chronicle-focus";
  journal.className = "hearth-chronicle-focus";
  journal.type = "button";
  journal.setAttribute("aria-label", "遠征記録を開く");
  journal.innerHTML = '<span aria-hidden="true">▱</span><small>HEARTH JOURNAL</small><strong>遠征記録</strong>';

  const folio = document.createElement("div");
  folio.id = "hearth-folio";
  folio.className = "hearth-folio";
  folio.hidden = true;
  folio.setAttribute("aria-hidden", "true");

  const page = document.createElement("section");
  page.className = "hearth-folio__page";
  page.setAttribute("role", "dialog");
  page.setAttribute("aria-modal", "true");
  page.setAttribute("aria-labelledby", "hearth-folio-title");
  page.tabIndex = -1;

  const header = document.createElement("header");
  header.className = "hearth-folio__header";
  header.innerHTML = '<div><p class="eyebrow">GREY HEARTH / SECURED</p><h2 id="hearth-folio-title">灰炉の棚</h2></div>';

  const close = document.createElement("button");
  close.type = "button";
  close.className = "hearth-folio__close";
  close.setAttribute("aria-label", "灰炉の帳面を閉じる");
  close.textContent = "閉じる ×";
  header.appendChild(close);

  const tabs = document.createElement("div");
  tabs.className = "hearth-folio__tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "灰炉の帳面");

  function tabButton(kind, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.hearthFolioTab = kind;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", `hearth-folio-${kind}`);
    button.textContent = label;
    tabs.appendChild(button);
    return button;
  }

  const lootTab = tabButton("loot", "持ち帰った物");
  const recordTab = tabButton("record", "遠征記録");

  const body = document.createElement("div");
  body.className = "hearth-folio__body";

  inventory.id = "hearth-folio-loot";
  inventory.classList.add("hearth-folio__pane");
  inventory.setAttribute("role", "tabpanel");

  chronicle.id = "hearth-folio-record";
  chronicle.classList.add("hearth-folio__pane");
  chronicle.setAttribute("role", "tabpanel");

  lootTab.id = "hearth-folio-tab-loot";
  recordTab.id = "hearth-folio-tab-record";
  inventory.setAttribute("aria-labelledby", lootTab.id);
  chronicle.setAttribute("aria-labelledby", recordTab.id);

  body.append(inventory, chronicle);
  page.append(header, tabs, body);
  folio.appendChild(page);
  scene.append(journal, folio);
  hubGrid.remove();

  function focusableNodes() {
    return Array.from(page.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((node) => !node.hidden && node.getClientRects().length > 0);
  }

  function select(kind = "loot") {
    const record = kind === "record";
    inventory.hidden = record;
    chronicle.hidden = !record;
    lootTab.setAttribute("aria-selected", String(!record));
    recordTab.setAttribute("aria-selected", String(record));
    lootTab.tabIndex = record ? -1 : 0;
    recordTab.tabIndex = record ? 0 : -1;
    document.getElementById("hearth-folio-title").textContent = record ? "遠征記録" : "灰炉の棚";
  }

  function open(kind = "loot", trigger = null) {
    returnFocus = trigger instanceof HTMLElement ? trigger : document.activeElement;
    select(kind);
    folio.hidden = false;
    folio.setAttribute("aria-hidden", "false");
    document.body.classList.add("hearth-folio-open");
    requestAnimationFrame(() => close.focus());
    return true;
  }

  function closeFolio({ restoreFocus = true } = {}) {
    if (folio.hidden) return false;
    folio.hidden = true;
    folio.setAttribute("aria-hidden", "true");
    document.body.classList.remove("hearth-folio-open");
    if (restoreFocus && returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus();
    returnFocus = null;
    return true;
  }

  close.addEventListener("click", () => closeFolio());
  lootTab.addEventListener("click", () => select("loot"));
  recordTab.addEventListener("click", () => select("record"));
  journal.addEventListener("click", () => open("record", journal));
  lootShelf?.addEventListener("click", () => open("loot", lootShelf));

  folio.addEventListener("click", (event) => {
    if (event.target === folio) closeFolio();
  });

  folio.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeFolio();
      return;
    }
    if (event.key !== "Tab") return;
    const nodes = focusableNodes();
    if (!nodes.length) {
      event.preventDefault();
      page.focus();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  select("loot");

  window.CrownlessHearthHomeShell = Object.freeze({
    open,
    close: closeFolio,
    isOpen: () => !folio.hidden,
    select
  });
})();
