(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrownlessSaveData = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const SAVE_KEYS = ['crownless-expedition-v1-demo', 'crownless-expedition-v1-walk'];
  const MODE_KEY = 'crownless-expedition-mode';
  const FOOTPRINT_KEYS = ['crownless-travel-footprints-v1-demo', 'crownless-travel-footprints-v1-walk'];
  function validFootprints(data) {
    const F = typeof module === 'object' && module.exports
      ? require('./travel-footprints.js') : globalThis.CrownlessTravelFootprints;
    if (!F || !data || typeof data !== 'object' || F.parse(data) !== data) throw new Error('invalid footprints');
    return JSON.stringify(data);
  }
  function exportBackup(storage) {
    const saves = {};
    for (const key of SAVE_KEYS) {
      const raw = storage.getItem(key);
      if (raw) saves[key] = JSON.parse(raw);
    }
    const footprints = {};
    for (const key of FOOTPRINT_KEYS) {
      const raw = storage.getItem(key);
      if (raw !== null) footprints[key] = JSON.parse(validFootprints(JSON.parse(raw)));
    }
    const mode = storage.getItem(MODE_KEY);
    return JSON.stringify({ kind: 'crownless-save', version: 1, mode: ['demo','walk'].includes(mode) ? mode : null, saves, footprints }, null, 2);
  }
  function parseBackup(text, parseState) {
    const backup = JSON.parse(String(text || ''));
    if (!backup || backup.kind !== 'crownless-save' || backup.version !== 1 || !backup.saves || typeof backup.saves !== 'object') throw new Error('unsupported backup');
    const validated = {};
    for (const key of SAVE_KEYS) {
      if (!(key in backup.saves)) continue;
      const raw = JSON.stringify(backup.saves[key]);
      const state = parseState(raw);
      const expectedMode = key.endsWith('-demo') ? 'demo' : 'walk';
      if (!state || (state.mode && state.mode !== expectedMode)) throw new Error('invalid save');
      validated[key] = raw;
    }
    const footprints = {};
    if (backup.footprints !== undefined) {
      if (!backup.footprints || typeof backup.footprints !== 'object' || Array.isArray(backup.footprints)) throw new Error('invalid footprints');
      for (const key of FOOTPRINT_KEYS) {
        if (Object.prototype.hasOwnProperty.call(backup.footprints, key)) footprints[key] = validFootprints(backup.footprints[key]);
      }
    }
    if (!Object.keys(validated).length && !Object.keys(footprints).length) throw new Error('empty backup');
    return { mode: ['demo','walk'].includes(backup.mode) ? backup.mode : null, saves: validated, footprints };
  }
  function importBackup(storage, text, parseState) {
    const backup = parseBackup(text, parseState);
    const entries = [...Object.entries(backup.saves), ...Object.entries(backup.footprints)];
    if (backup.mode) entries.push([MODE_KEY, backup.mode]);
    const previous = entries.map(([key]) => [key, storage.getItem(key)]);
    try {
      for (const [key, raw] of entries) storage.setItem(key, raw);
    } catch (error) {
      for (const [key, raw] of previous.reverse()) {
        try { if (raw === null) storage.removeItem(key); else storage.setItem(key, raw); } catch {}
      }
      throw error;
    }
    return backup;
  }
  function resetJourney(storage) {
    for (const key of [...SAVE_KEYS, ...FOOTPRINT_KEYS, MODE_KEY, 'crownless-expedition-v1-walk-anchor']) storage.removeItem(key);
  }
  return { SAVE_KEYS, FOOTPRINT_KEYS, exportBackup, parseBackup, importBackup, resetJourney };
});
