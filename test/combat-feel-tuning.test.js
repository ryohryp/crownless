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
          { kind: 'rusher', moveSpeed: 132, attackRange: 52 },
          { kind: 'guard', moveSpeed: 72, attackRange: 76 },
          { kind: 'skirmisher', moveSpeed: 104, attackRange: 250 },
          { kind: 'rusher', moveSpeed: 140, attackRange: 54, boss: true }
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

test('ordinary enemy roles keep space more clearly without touching bosses', () => {
  const { CrownlessCore } = loadTuning();
  const enemies = CrownlessCore.discoverLocation().expedition.encounter.enemies;

  assert.deepEqual(
    enemies.slice(0, 3).map(({ kind, moveSpeed, attackRange }) => ({ kind, moveSpeed, attackRange })),
    [
      { kind: 'rusher', moveSpeed: 124, attackRange: 50 },
      { kind: 'guard', moveSpeed: 68, attackRange: 74 },
      { kind: 'skirmisher', moveSpeed: 100, attackRange: 245 }
    ]
  );
  assert.equal(enemies[3].moveSpeed, 140);
  assert.equal(enemies[3].attackRange, 54);
});

test('player repositioning is slightly more responsive while preserving weapon identity', () => {
  const { CrownlessCore } = loadTuning();
  const fists = CrownlessCore.getCombatTuning();
  assert.equal(fists.moveSpeed, 229);
  assert.equal(fists.reach, 56);
});

test('tuning layer does not add conventional attack controls', () => {
  assert.doesNotMatch(source, /touch-light|virtual joystick|light-attack button/i);
  assert.match(source, /clearer stop-to-strike openings/);
});
