const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'combat-action-profiles.js'), 'utf8');

function loadProfiles() {
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.CrownlessCombatActionProfiles;
}

test('technique profiles preserve weapon-specific standard and counter timings', () => {
  const profiles = loadProfiles();
  assert.deepEqual(
    JSON.parse(JSON.stringify(profiles.techniqueProfile('dagger', false))),
    { duration: 0.5, activeAt: 0.2, lunge: 46, damage: 0.96, stagger: 0.95, knock: 0.9, label: 'TECHNIQUE' }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(profiles.techniqueProfile('sword', true))),
    { duration: 0.5, activeAt: 0.18, lunge: 50, damage: 1.6, stagger: 1.75, knock: 1.5, label: 'CLASH' }
  );
});

test('normal attack profiles preserve reach and unarmed tempo behavior', () => {
  const profiles = loadProfiles();
  assert.deepEqual(
    JSON.parse(JSON.stringify(profiles.normalAttackProfile({ weaponType: 'dagger', reach: 62, unarmedTempo: 1 }))),
    { settle: 0.06, range: 70, comboLength: 6, duration: 0.17, activeAt: 0.046, cadence: 0.015, lunge: 9, damage: 0.82, finisher: 1.5, arc: 0.28 }
  );
  const fists = profiles.normalAttackProfile({ weaponType: 'fists', reach: 56, unarmedTempo: 1.2 });
  assert.equal(fists.range, 62);
  assert.equal(fists.comboLength, 4);
  assert.equal(fists.duration, 0.215 / 1.2);
  assert.equal(fists.activeAt, 0.06 / 1.2);
});

test('battlefield weapon drops and temporary tuning preserve current values', () => {
  const profiles = loadProfiles();
  assert.deepEqual(JSON.parse(JSON.stringify(profiles.battlefieldWeaponSpec('guard'))), { type: 'sword', name: '欠け盾兵の剣' });
  assert.deepEqual(JSON.parse(JSON.stringify(profiles.battlefieldWeaponSpec('skirmisher'))), { type: 'dagger', name: '藪射ちの狩猟刀' });
  assert.deepEqual(JSON.parse(JSON.stringify(profiles.battlefieldWeaponSpec('rusher'))), { type: 'dagger', name: '街道荒らしの短刀' });

  const sword = profiles.battlefieldWeaponTuning({ lightDamage: 20, heavyDamage: 30 }, 'sword');
  assert.equal(sword.weaponType, 'sword');
  assert.equal(sword.lightDamage, 21.6);
  assert.equal(sword.heavyDamage, 33.6);
  assert.equal(sword.reach, 82);

  const dagger = profiles.battlefieldWeaponTuning({ lightDamage: 8, heavyDamage: 15 }, 'dagger');
  assert.equal(dagger.weaponType, 'dagger');
  assert.equal(dagger.lightDamage, 11 * 0.92);
  assert.equal(dagger.heavyDamage, 21 * 0.95);
  assert.equal(dagger.reach, 62);
});

test('profile callers receive fresh objects instead of shared mutable config', () => {
  const profiles = loadProfiles();
  const first = profiles.techniqueProfile('fists', false);
  first.damage = 999;
  assert.equal(profiles.techniqueProfile('fists', false).damage, 1);
});
