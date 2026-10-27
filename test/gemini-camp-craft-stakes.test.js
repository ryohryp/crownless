'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Exercise the actual camp panel function without modifying the live save or
// fabricating combat results. The source remains the browser's source of truth.
function showPanel(state) {
  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  const start = html.indexOf('function forestReturnTeaser(found,crafted=false) {');
  const panelStart = html.indexOf('function showRpgPanel() {', start);
  const end = html.indexOf("document.getElementById('rpgOpenResults').addEventListener", panelStart);
  assert(start >= 0 && panelStart > start && end > panelStart,
    'return teaser and camp panel functions must be present');
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, {
          textContent: '',
          disabled: false,
          classList: { toggle() {} },
        });
      }
      return elements.get(id);
    },
  };
  const rpg = { phase: 'camp', unbanked: 0, banked: 0,
    crafted: false, lastOutcome: 'returned', ...state };
  // Evaluate the real teaser together with the panel, as the browser does.
  const run = vm.runInNewContext('(() => { ' + html.slice(start, end).trim() +
    '; return showRpgPanel; })()',
    { document, rpg, ginji: { hp: state.hp ?? 140, maxHp: 140 },
      state: { forestFinds: new Set(state.forestFinds || []) },
      rpgRules: { COST: 3, TEMPER_COST: 5 }, location: { search: '' }, URLSearchParams },
    { timeout: 1000 });
  run();
  return { info: elements.get('rpgInfo').textContent,
    keepExploring: elements.get('rpgKeepExploring').textContent,
    pushDeeper: elements.get('rpgPush').textContent,
    forgeDisabled: elements.get('rpgForge').disabled,
    temperDisabled: elements.get('rpgTemper').disabled,
    temperHidden: elements.get('rpgTemper').classList.hidden,
    bank: elements.get('rpgBank').textContent };
}

test('camp shows actual remaining fangs rather than falsely promising a sword', () => {
  for (const banked of [0, 1, 2]) {
    const view = showPanel({ banked });
    assert.match(view.info, new RegExp('鍛冶剣まで牙あと' + (3 - banked) + '個'));
    assert.match(view.info, /次の遠征で素材を持ち帰ろう/);
    assert.equal(view.forgeDisabled, true);
    assert.match(view.bank, new RegExp('倉庫のゴブリンの牙 ' + banked));
  }
  const ready = showPanel({ banked: 3 });
  assert.match(ready.info, /倉庫の牙3個で風裂きの剣を製作できる/);
  assert.equal(ready.forgeDisabled, false);
});

test('crafted, defeated and return decisions retain their distinct messages', () => {
  const craftedCamp = showPanel({ crafted: true, lastOutcome: 'crafted' });
  assert.match(craftedCamp.info, /風裂きの剣を装備/);
  assert.doesNotMatch(craftedCamp.info, /石門|切り開ける/,
    'crafting alone must not reveal the uninspected gate or its solution');
  assert.match(showPanel({ lastOutcome: 'defeated' }).info,
    /今回の未帰還素材は失った/);
  const risk = showPanel({ phase: 'return', banked: 1, unbanked: 2,
    lastOutcome: 'victory' });
  assert.match(risk.info, /今帰れば牙2個を確保/);
  assert.match(risk.info, /今帰れば鍛冶剣を作れる/);
  assert.match(risk.info, /敗北すると今回の牙2個を失う/);
  assert.match(risk.info, /湿った土にまだ読めない筋がある/);
  assert.match(risk.keepExploring, /気配を追って調べる/);
  assert.match(risk.pushDeeper, /次の敵に挑む（HP 140\/140・未帰還の牙 2個）/);
  const wounded = showPanel({ phase: 'return', hp: 21, unbanked: 3 });
  assert.match(wounded.pushDeeper, /次の敵に挑む（HP 21\/140・未帰還の牙 3個）/,
    'the next-wave button must preview the current health and loot at risk');
  assert.match(wounded.keepExploring, /気配を追って調べる/,
    'inspecting this forest must remain a separate action from starting another wave');
  const blocked = showPanel({ phase: 'return',
    forestFinds: ['traces', 'shrine'], unbanked: 2 });
  assert.match(blocked.info, /今の装備では踏み込めない。牙を持ち帰って鍛冶に備えよう/,
    'the actual return panel must not promise immediate access to the sword-locked gate');
  assert.doesNotMatch(blocked.info, /今調べるか、牙を持ち帰って装備を整えるか/,
    'the old impossible choice must not reappear');
  const equipped = showPanel({ phase: 'return', crafted: true,
    forestFinds: ['traces', 'shrine'] });
  assert.match(equipped.info, /鍛えた剣を手に、何があるか確かめよう/);
  const explored = showPanel({ phase: 'return',
    forestFinds: ['traces', 'shrine', 'hollow'] });
  assert.doesNotMatch(explored.info, /湿った土にまだ読めない筋がある/);
  assert.match(explored.keepExploring, /森の探索を続ける/);
});


test('after smithing, more returned fangs offer a real next-expedition attack upgrade', () => {
  const short = showPanel({ crafted: true, banked: 2 });
  assert.match(short.info, /研ぎ直しまで牙あと3個（攻撃\+4）/);
  assert.equal(short.temperDisabled, true);
  const ready = showPanel({ crafted: true, banked: 5 });
  assert.match(ready.info, /今帰れば牙で剣を研ぎ直せる（攻撃\+4）/);
  assert.equal(ready.temperDisabled, false);
  const done = showPanel({ crafted: true, tempered: true, banked: 4 });
  assert.match(done.info, /研ぎ直し済み（攻撃\+4）/);
  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  assert.match(html, /punchPower: 15 \+ \(rpg\.tempered \? 4 : 0\)/);
  assert.match(html, /kickPower: 17 \+ \(rpg\.tempered \? 4 : 0\)/);
  assert.match(html, /rpgRules\.temper\(rpg\)/);
  assert.match(html, /saveActionProgress\(\)/);
});

function shrineGoal(state) {
  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  const source=html.match(/function forestShrineCraftHint\(run,rules\) \{[\s\S]*?\n  \}/);
  assert.ok(source,'the actual shrine smithing preview must be present');
  const rpg = { banked: 0, unbanked: 0, crafted: false, tempered: false, ...state };
  const hint=vm.runInNewContext('('+source[0]+')',{}, { timeout: 1000 });
  return hint(rpg,{ COST: 3, TEMPER_COST: 5 });
}

test('shrine material-or-healing choice previews the real next smithing milestone', () => {
  assert.match(shrineGoal({ banked: 1, unbanked: 1 }),
    /鍛冶剣まで牙あと1個（\+1なら残り0、\+2なら残り0）/);
  assert.match(shrineGoal({ banked: 2, unbanked: 1 }), /生還すれば鍛冶剣の素材が揃う.*未帰還/);
  assert.match(shrineGoal({ banked: 3 }), /倉庫の牙だけで鍛冶剣を作れる/);
  assert.match(shrineGoal({ crafted: true, banked: 1, unbanked: 2 }),
    /剣の研ぎ直しまで牙あと2個（\+1なら残り1、\+2なら残り0）/);
  assert.match(shrineGoal({ crafted: true, banked: 1, unbanked: 4 }),
    /生還すれば剣の研ぎ直し素材が揃う.*未帰還/);
  assert.match(shrineGoal({ crafted: true, banked: 5 }),
    /倉庫の牙だけで剣を研ぎ直せる（攻撃\+4）/);
  const done = shrineGoal({ crafted: true, tempered: true, banked: 7 });
  assert.match(done, /牙の追加強化はまだない/);
  assert.doesNotMatch(done, /研ぎ直しまで牙あと|研ぎ直し素材は揃っている/,
    'do not promise a second temper after the one-time upgrade');
});
