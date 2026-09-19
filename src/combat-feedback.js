(() => {
  'use strict';

  const root = document.querySelector('#game');
  if (!root || typeof MutationObserver === 'undefined') return;

  let previous = null;
  let clearTimer = 0;

  function snapshot() {
    const battle = root.querySelector('.battle-layout');
    if (!battle) return null;
    const enemyHp = battle.querySelector('.panel > .hp-row span');
    const playerHp = battle.querySelector('.combat-vitals .hp-row strong, .visual-column > .vitals .hp-row strong');
    const log = battle.querySelector('.combat-log p:last-child');
    return {
      battle,
      enemyHp: enemyHp ? Number.parseInt(enemyHp.textContent, 10) : NaN,
      playerHp: playerHp ? Number.parseInt(playerHp.textContent, 10) : NaN,
      log: log ? log.textContent : ''
    };
  }

  function pulse(battle, kind) {
    battle.classList.remove('combat-feedback-hit', 'combat-feedback-hurt', 'combat-feedback-dodge');
    // Restart the short CSS animation when consecutive turns have the same result.
    void battle.offsetWidth;
    battle.classList.add(`combat-feedback-${kind}`);
    window.clearTimeout(clearTimer);
    clearTimer = window.setTimeout(() => battle.classList.remove(`combat-feedback-${kind}`), 320);
  }

  function inspect() {
    const next = snapshot();
    if (!next) { previous = null; return; }
    if (previous) {
      if (Number.isFinite(next.playerHp) && Number.isFinite(previous.playerHp) && next.playerHp < previous.playerHp) pulse(next.battle, 'hurt');
      else if (Number.isFinite(next.enemyHp) && Number.isFinite(previous.enemyHp) && next.enemyHp < previous.enemyHp) pulse(next.battle, 'hit');
      else if (/身をかわした/.test(next.log) && next.log !== previous.log) pulse(next.battle, 'dodge');
    }
    previous = { enemyHp: next.enemyHp, playerHp: next.playerHp, log: next.log };
  }

  new MutationObserver(() => requestAnimationFrame(inspect)).observe(root, { childList: true, subtree: true });
  inspect();
})();
