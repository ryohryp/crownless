/* Standalone forest-action experiment saves ONLY banked materials and crafted gear.
 * Never writes Crownless expedition saves, character progress, GPS or route history.
 * Deterministic and dependency-free so the browser and node:test can share it.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CrownlessActionSave = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  const MAX_BANKED = 1000000;
  const KEY_PREFIX = 'crownless-action-forest-v1-';
  function key(mode) {
    return ['demo', 'walk'].includes(mode) ? KEY_PREFIX + mode : null;
  }
  function valid(record) {
    return Boolean(record && !Array.isArray(record) &&
      record.version === VERSION && Number.isSafeInteger(record.banked) &&
      record.banked >= 0 && record.banked <= MAX_BANKED &&
      typeof record.crafted === 'boolean');
  }
  function decode(raw) {
    if (raw === null) return { version: VERSION, banked: 0, crafted: false };
    if (typeof raw !== 'string' || raw.length > 2000) return null;
    try {
      const value = JSON.parse(raw);
      return valid(value) ? { version: VERSION, banked: value.banked, crafted: value.crafted } : null;
    } catch { return null; }
  }
  function encode(state) {
    const value = { version: VERSION, banked: state?.banked, crafted: state?.crafted };
    if (!valid(value)) throw new TypeError('invalid action-lab progress');
    return JSON.stringify(value);
  }
  function restore(state, record) {
    if (!valid(record)) return false;
    state.banked = record.banked;
    state.crafted = record.crafted;
    // One fresh fight per page load. Interrupted, unreturned loot is not recoverable.
    state.unbanked = 0;
    state.phase = 'fight';
    return true;
  }
  return { VERSION, KEY_PREFIX, key, decode, encode, restore };
});
