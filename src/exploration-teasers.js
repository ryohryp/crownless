(() => {
  'use strict';

  const TEASERS = Object.freeze({
    wood: '湿った土に、獣とも人ともつかない足跡が続いている。',
    tower: '霧の向こうから、鳴るはずのない鐘の音がする。',
    fen: '夜、水面の近くで青い光がゆっくり揺れている。',
    crypt: '地の下から、ときどき金属を引きずる音が響く。'
  });

  function applyTeasers(root = document) {
    root.querySelectorAll('.atlas-marker.unknown[data-value]').forEach(marker => {
      const teaser = TEASERS[marker.dataset.value];
      if (!teaser) return;
      const strong = marker.querySelector('.atlas-marker-copy strong');
      const small = marker.querySelector('.atlas-marker-copy small');
      if (strong) strong.textContent = '未知の予兆';
      if (small) small.textContent = teaser;
      marker.setAttribute('aria-label', `未知の予兆・${teaser}`);
    });

    const selectedUnknown = root.querySelector('.atlas-marker.selected.unknown[data-value]');
    const memory = root.querySelector('.atlas-memory.unknown');
    const teaser = selectedUnknown && TEASERS[selectedUnknown.dataset.value];
    if (memory && teaser) {
      const strong = memory.querySelector('strong');
      const small = memory.querySelector('small');
      if (strong) strong.textContent = '何かが、霧の向こうにいる。';
      if (small) small.textContent = teaser;
    }
  }

  window.CrownlessExplorationTeasers = { TEASERS, applyTeasers };

  const game = document.querySelector('#game');
  if (!game) return;
  let queued = false;
  const refresh = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; applyTeasers(game); });
  };
  new MutationObserver(refresh).observe(game, { childList: true, subtree: true });
  refresh();
})();
