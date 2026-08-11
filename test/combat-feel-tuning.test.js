const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'src', 'combat-feel-tuning.js'), 'utf8');

function makeState() {
  return {
    expedition: {
      encounter: {
        enemies: [
          { kind: 'rusher', moveSpeed: 132, attackRange: 52, maxHealth: 44, damage: 11 },
          { kind: 'guard', moveSpeed: 72, attackRange: 76, maxHealth: 62, damage: 13 },
          { kind: 'skirmisher', moveSpeed: 104, attackRange: 250, maxHealth: 38, damage: 9 },
          { kind: 'rusher', moveSpeed: 140, attackRange: 54, maxHealth: 80, damage: 18, boss: true }
        ]
      }
    }
  };
}

function loadTuning() {
  const Core = {
    discoverLocation: () => makeState(),
    resolveEventChoice: () => makeState(),
    discoverNextCell: () => makeState(),
    buildEnemies: () => makeState().expedition.encounter.enemies,
    getCombatTuning: () => ({ weaponType: 'fists', moveSpeed: 218, reach: 53 })
  };
  const context = { window: { CrownlessCore: Core } };
  vm.runInNewContext(source, context);
  return context.window;
}

test('combat feel tuning loads before app.js', () => {
  const tuning = html.indexOf('src/combat-feel-tuning.js');
  const app = html.indexOf('src/app.js');
  assert.ok(tuning >= 0 && tuning < app);
});

test('ordinary enemy roles stay readable while rusher becomes fast dangerous and fragile', () => {
  const { CrownlessCore } = loadTuning();
  const enemies = CrownlessCore.discoverLocation().expedition.encounter.enemies;

  assert.deepEqual(
    enemies.slice(0, 3).map(({ kind, moveSpeed, attackRange, maxHealth, damage }) => ({ kind, moveSpeed, attackRange, maxHealth, damage })),
    [
      { kind: 'rusher', moveSpeed: 140, attackRange: 68, maxHealth: 37, damage: 13 },
      { kind: 'guard', moveSpeed: 68, attackRange: 74, maxHealth: 62, damage: 13 },
      { kind: 'skirmisher', moveSpeed: 100, attackRange: 245, maxHealth: 38, damage: 9 }
    ]
  );
});

test('rusher identity does not modify bosses', () => {
  const { CrownlessCore } = loadTuning();
  const boss = CrownlessCore.discoverLocation().expedition.encounter.enemies[3];
  assert.deepEqual(
    { moveSpeed: boss.moveSpeed, attackRange: boss.attackRange, maxHealth: boss.maxHealth, damage: boss.damage },
    { moveSpeed: 140, attackRange: 54, maxHealth: 80, damage: 18 }
  );
});

test('rusher identity is exposed as explicit tuning intent', () => {
  const { CrownlessCombatFeel } = loadTuning();
  assert.equal(CrownlessCombatFeel.rusherIdentity.healthScale, 0.84);
  assert.equal(CrownlessCombatFeel.rusherIdentity.damageScale, 1.18);
  assert.equal(CrownlessCombatFeel.rusherIdentity.role, 'fast / dangerous / fragile');
});

test('player repositioning is slightly more responsive while preserving weapon identity', () => {
  const { CrownlessCore } = loadTuning();
  const fists = CrownlessCore.getCombatTuning();
  assert.equal(fists.moveSpeed, 229);
  assert.equal(fists.reach, 56);
});

test('tuning layer does not add conventional attack controls or a new combat system', () => {
  assert.doesNotMatch(source, /touch-light|virtual joystick|light-attack button/i);
  assert.match(source, /readable high-risk rusher/);
  assert.doesNotMatch(source, /chargeState|dashState|new skill/i);
});
