const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'src', 'combat-feel-tuning.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');

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

test('ordinary enemy roles have distinct pace durability and danger', () => {
  const { CrownlessCore } = loadTuning();
  const enemies = CrownlessCore.discoverLocation().expedition.encounter.enemies;

  assert.deepEqual(
    enemies.slice(0, 3).map(({ kind, moveSpeed, attackRange, maxHealth, damage }) => ({ kind, moveSpeed, attackRange, maxHealth, damage })),
    [
      { kind: 'rusher', moveSpeed: 140, attackRange: 68, maxHealth: 37, damage: 13 },
      { kind: 'guard', moveSpeed: 63, attackRange: 76, maxHealth: 67, damage: 12 },
      { kind: 'skirmisher', moveSpeed: 114, attackRange: 245, maxHealth: 34, damage: 10 }
    ]
  );
});

test('boss tuning stays untouched', () => {
  const { CrownlessCore } = loadTuning();
  const boss = CrownlessCore.discoverLocation().expedition.encounter.enemies[3];
  assert.deepEqual(
    { moveSpeed: boss.moveSpeed, attackRange: boss.attackRange, maxHealth: boss.maxHealth, damage: boss.damage },
    { moveSpeed: 140, attackRange: 54, maxHealth: 80, damage: 18 }
  );
});

test('three ordinary enemy identities are explicit tuning intent', () => {
  const { CrownlessCombatFeel } = loadTuning();
  assert.equal(CrownlessCombatFeel.rusherIdentity.role, 'fast / dangerous / fragile');
  assert.equal(CrownlessCombatFeel.guardIdentity.role, 'slow / armored / break then punish');
  assert.equal(CrownlessCombatFeel.skirmisherIdentity.healthScale, 0.90);
  assert.equal(CrownlessCombatFeel.skirmisherIdentity.damageScale, 1.12);
  assert.equal(CrownlessCombatFeel.skirmisherIdentity.role, 'mobile / evasive / punish neglect');
});

test('existing combat loop gives guard a break then punish interaction', () => {
  assert.match(appSource, /enemy\.kind === "guard" && enemy\.guarding && !technique && !finisher/);
  assert.match(appSource, /addText\(enemy\.x, enemy\.y - 48, "BLOCK"/);
  assert.match(appSource, /enemy\.kind === "guard" && enemy\.guarding && \(technique \|\| finisher\)/);
  assert.match(appSource, /enemy\.guarding = false;[\s\S]*enemy\.guardCycle = 1\.3;[\s\S]*reaction = "BREAK"/);
  assert.match(appSource, /enemy\.guardCycle = \(enemy\.guardCycle \+ dt\) % 2\.7/);
  assert.match(appSource, /enemy\.guarding = enemy\.guardCycle < 1\.18/);
});

test('existing skirmisher loop kites pursuit and punishes neglect', () => {
  assert.match(appSource, /if \(d < 150\)[\s\S]*enemy\.moveSpeed \* 1\.2/);
  assert.match(appSource, /else if \(d > 250\)[\s\S]*enemy\.moveSpeed \* 0\.85/);
  assert.match(appSource, /tangent[\s\S]*enemy\.moveSpeed \* 0\.62/);
  assert.match(appSource, /d <= 315\) startTelegraph\(enemy, 0\.82\)/);
  assert.match(appSource, /enemy\.attackCooldown = 1\.65/);
});

test('player repositioning is slightly more responsive while preserving weapon identity', () => {
  const { CrownlessCore } = loadTuning();
  const fists = CrownlessCore.getCombatTuning();
  assert.equal(fists.moveSpeed, 229);
  assert.equal(fists.reach, 56);
});

test('tuning layer does not add conventional attack controls or a new combat system', () => {
  assert.doesNotMatch(source, /touch-light|virtual joystick|light-attack button/i);
  assert.match(source, /different movement choices/);
  assert.doesNotMatch(source, /chargeState|dashState|guardBreakState|kiteState|new skill/i);
});
