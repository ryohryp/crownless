(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrownlessSaveData = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const SAVE_KEYS = ['crownless-expedition-v1-demo', 'crownless-expedition-v1-walk'];
  const MODE_KEY = 'crownless-expedition-mode';
  function exportBackup(storage) {
    const saves = {};
    for (const key of SAVE_KEYS) {
      const raw = storage.getItem(key);
      if (raw) saves[key] = JSON.parse(raw);
    }
    const mode = storage.getItem(MODE_KEY);
    return JSON.stringify({ kind: 'crownless-save', version: 1, mode: ['demo','walk'].includes(mode) ? mode : null, saves }, null, 2);
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
    if (!Object.keys(validated).length) throw new Error('empty backup');
    return { mode: ['demo','walk'].includes(backup.mode) ? backup.mode : null, saves: validated };
  }
  function importBackup(storage, text, parseState) {
    const backup = parseBackup(text, parseState);
    for (const [key, raw] of Object.entries(backup.saves)) storage.setItem(key, raw);
    if (backup.mode) storage.setItem(MODE_KEY, backup.mode);
    return backup;
  }
  function resetJourney(storage) {
    for (const key of [...SAVE_KEYS, MODE_KEY, 'crownless-expedition-v1-walk-anchor']) storage.removeItem(key);
  }
  return { SAVE_KEYS, exportBackup, parseBackup, importBackup, resetJourney };
});
