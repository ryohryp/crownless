/* One disposable, session-only RPG experiment around the unchanged Gemini fighting model.
 * No saving, GPS, economy or main Crownless runtime integration.
 */
(function (root) {
  'use strict';
  const COST = 3;
  function create() {
    return { phase: 'fight', unbanked: 0, banked: 0, crafted: false,
      victories: 0, retreats: 0, defeats: 0, lastOutcome: '' };
  }
  function claimMaterial(s) {
    if (s.phase !== 'fight' && s.phase !== 'return') return false;
    s.unbanked++;
    return true;
  }
  function clearWave(s) {
    if (s.phase !== 'fight') return false;
    s.phase = 'return';
    s.victories++;
    s.lastOutcome = 'victory';
    return true;
  }
  function pushDeeper(s) {
    if (s.phase !== 'return') return false;
    s.phase = 'fight';
    return true;
  }
  function returnAlive(s, hp) {
    if (s.phase !== 'return' || !(hp > 0)) return false;
    s.banked += s.unbanked;
    s.unbanked = 0;
    s.phase = 'camp';
    s.retreats++;
    s.lastOutcome = 'returned';
    return true;
  }
  function loseExpedition(s) {
    if (s.phase !== 'fight' && s.phase !== 'return') return false;
    s.unbanked = 0;
    s.phase = 'camp';
    s.defeats++;
    s.lastOutcome = 'defeated';
    return true;
  }
  function forge(s) {
    if (s.phase !== 'camp' || s.crafted || s.banked < COST) return false;
    s.banked -= COST;
    s.crafted = true;
    s.lastOutcome = 'crafted';
    return true;
  }
  function depart(s) {
    if (s.phase !== 'camp') return false;
    s.unbanked = 0;
    s.phase = 'fight';
    s.lastOutcome = 'departed';
    return true;
  }
  const api = { COST, create, claimMaterial, clearWave, pushDeeper,
    returnAlive, loseExpedition, forge, depart };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CrownlessRpgLoop = api;
})(typeof window !== 'undefined' ? window : globalThis);
