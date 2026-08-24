const fs = require('node:fs');

function replaceOnce(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Could not apply ${label}`);
  return next;
}

function requireCondition(condition, label) {
  if (!condition) throw new Error(`Refactor verification failed: ${label}`);
}

let app = fs.readFileSync('src/app.js', 'utf8');
if (!app.includes('const CombatActionProfiles = window.CrownlessCombatActionProfiles;')) {
  app = replaceOnce(
    app,
    '  const Core = window.CrownlessCore;\n',
    '  const Core = window.CrownlessCore;\n  const CombatActionProfiles = window.CrownlessCombatActionProfiles;\n  if (!CombatActionProfiles) throw new Error("CrownlessCombatActionProfiles must load before app.js");\n',
    'combat action profile dependency'
  );
}

app = replaceOnce(
  app,
  /  function techniqueProfile\(counter = false\) \{[\s\S]*?(?=  function dropEnemyWeapon\(enemy\) \{)/,
  `  function techniqueProfile(counter = false) {\n    const weapon = battle ? battle.tuning.weaponType : "fists";\n    return CombatActionProfiles.techniqueProfile(weapon, counter);\n  }\n\n  function normalAttackProfile() {\n    return CombatActionProfiles.normalAttackProfile(battle ? battle.tuning : null);\n  }\n\n  function battlefieldWeaponSpec(enemy) {\n    return CombatActionProfiles.battlefieldWeaponSpec(enemy && enemy.kind);\n  }\n\n  function battlefieldWeaponTuning(type) {\n    const base = battle.baseTuning || battle.tuning;\n    return CombatActionProfiles.battlefieldWeaponTuning(base, type);\n  }\n\n`,
  'combat profile wrappers'
);
fs.writeFileSync('src/app.js', app);

let html = fs.readFileSync('index.html', 'utf8');
if (!html.includes('src/combat-action-profiles.js')) {
  html = replaceOnce(
    html,
    /(<script src="src\/app\.js"><\/script>)/,
    '<script src="src/combat-action-profiles.js"></script>\n  $1',
    'combat action profile script load order'
  );
  fs.writeFileSync('index.html', html);
}

let workflow = fs.readFileSync('.github/workflows/test.yml', 'utf8');
if (!workflow.includes('node --check src/combat-action-profiles.js')) {
  workflow = replaceOnce(
    workflow,
    '          node --check src/app-runtime-state.js\n',
    '          node --check src/app-runtime-state.js\n          node --check src/combat-action-profiles.js\n',
    'combat action profile syntax check'
  );
  fs.writeFileSync('.github/workflows/test.yml', workflow);
}

let testSource = fs.readFileSync('test/combat-action-profiles.test.js', 'utf8');
if (!testSource.includes("const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');")) {
  testSource = replaceOnce(
    testSource,
    "const source = fs.readFileSync(path.join(root, 'src', 'combat-action-profiles.js'), 'utf8');\n",
    "const source = fs.readFileSync(path.join(root, 'src', 'combat-action-profiles.js'), 'utf8');\nconst html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');\nconst appSource = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');\n",
    'integration fixtures'
  );
}
if (!testSource.includes("test('combat action profiles load before app.js'")) {
  testSource += `\n\ntest('combat action profiles load before app.js', () => {\n  const profiles = html.indexOf('src/combat-action-profiles.js');\n  const app = html.indexOf('src/app.js');\n  assert.ok(profiles >= 0 && profiles < app);\n});\n\ntest('app.js delegates static combat profile lookup to the extracted module', () => {\n  assert.match(appSource, /const CombatActionProfiles = window\\.CrownlessCombatActionProfiles/);\n  assert.match(appSource, /CombatActionProfiles\\.techniqueProfile\\(weapon, counter\\)/);\n  assert.match(appSource, /CombatActionProfiles\\.normalAttackProfile\\(battle \\? battle\\.tuning : null\\)/);\n  assert.match(appSource, /CombatActionProfiles\\.battlefieldWeaponSpec\\(enemy && enemy\\.kind\\)/);\n  assert.match(appSource, /CombatActionProfiles\\.battlefieldWeaponTuning\\(base, type\\)/);\n});\n`;
  fs.writeFileSync('test/combat-action-profiles.test.js', testSource);
}

const integratedHtml = fs.readFileSync('index.html', 'utf8');
const integratedApp = fs.readFileSync('src/app.js', 'utf8');
requireCondition(
  integratedHtml.indexOf('src/combat-action-profiles.js') >= 0 &&
    integratedHtml.indexOf('src/combat-action-profiles.js') < integratedHtml.indexOf('src/app.js'),
  'combat action profile module must load before app.js'
);
requireCondition(
  integratedApp.includes('CombatActionProfiles.techniqueProfile(weapon, counter)') &&
    integratedApp.includes('CombatActionProfiles.normalAttackProfile(battle ? battle.tuning : null)') &&
    integratedApp.includes('CombatActionProfiles.battlefieldWeaponSpec(enemy && enemy.kind)') &&
    integratedApp.includes('CombatActionProfiles.battlefieldWeaponTuning(base, type)'),
  'app.js must delegate all extracted combat profile lookups'
);
requireCondition(!integratedApp.includes('if (weapon === "dagger") return { duration: 0.5'), 'inline technique profile must be removed');

for (const path of [
  'docs/refactoring-placeholder.md',
  'docs/refactoring-placeholder-2.md',
  'docs/refactoring-placeholder-3.md'
]) {
  if (fs.existsSync(path)) fs.rmSync(path);
}
