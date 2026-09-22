(() => {
  "use strict";
  const Variety = window.CrownlessExplorationVariety;
  const Unknown = window.CrownlessUnknownQuarter;
  if (!Variety) return;
  const visits = Object.create(null);

  function walkRegionFamiliarity() {
    if (!Unknown) return { active: false, familiar: true, key: null };
    let mode = null;
    let anchor = null;
    let known = [];
    try {
      mode = localStorage.getItem('crownless-expedition-mode');
      anchor = JSON.parse(localStorage.getItem('crownless-expedition-v1-walk-anchor') || 'null');
      known = Unknown.normalizeKnownRegions(JSON.parse(localStorage.getItem(Unknown.STORAGE_KEY) || '[]'));
    } catch { return { active: false, familiar: true, key: null }; }
    const key = Unknown.regionKey(anchor);
    return { active: mode === 'walk' && Boolean(key), familiar: Unknown.isKnown(known, key), key, known };
  }

  function rememberRegion(info) {
    if (!Unknown || !info.active || !info.key || info.familiar) return;
    try { localStorage.setItem(Unknown.STORAGE_KEY, JSON.stringify(Unknown.markKnown(info.known, info.key))); } catch { /* Familiarity is optional; exploration still works. */ }
  }

  function decorate(placeId) {
    const memory = document.querySelector('.atlas-memory');
    if (!memory || memory.classList.contains('unknown')) return;
    let mood = Variety.moodFor(placeId, visits[placeId] || 0);
    if (!mood) return;
    visits[placeId] = (visits[placeId] || 0) + 1;
    const familiarity = walkRegionFamiliarity();
    mood = Unknown && familiarity.active ? Unknown.obscureMood(mood, familiarity.familiar) : mood;
    rememberRegion(familiarity);
    const small = memory.querySelector('small');
    if (!small) return;
    small.textContent = `${mood.text} · ${mood.cue}`;
    const label = memory.querySelector('span');
    if (label) label.textContent = mood.label;
  }

  document.addEventListener('click', event => {
    const marker = event.target.closest('[data-action="select"][data-value]');
    if (!marker) return;
    const placeId = marker.dataset.value;
    requestAnimationFrame(() => decorate(placeId));
  });
})();