(() => {
  "use strict";
  const Variety = window.CrownlessExplorationVariety;
  if (!Variety) return;
  const visits = Object.create(null);

  function decorate(placeId) {
    const memory = document.querySelector('.atlas-memory');
    if (!memory || memory.classList.contains('unknown')) return;
    const mood = Variety.moodFor(placeId, visits[placeId] || 0);
    if (!mood) return;
    visits[placeId] = (visits[placeId] || 0) + 1;
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