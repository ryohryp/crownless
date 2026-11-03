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
      rpgRules: { COST: 3, TEMPER_COST: 5 }, location: { search: '' }, URLSearchParams,
      lastCampSaveSucceeded: state.lastCampSaveSucceeded ?? null },
    { timeout: 1000 });
  run();
  return { title: elements.get('rpgTitle').textContent,
    info: elements.get('rpgInfo').textContent,
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

test('camp title distinguishes an in-session return from durable saved loot', () => {
  assert.equal(showPanel({ lastOutcome: 'returned', lastCampSaveSucceeded: true }).title,
    '無事に生還！');
  assert.equal(showPanel({ lastOutcome: 'returned', lastCampSaveSucceeded: false }).title,
    '⚠ 保存できない（成果はこの画面限り）');
  assert.equal(showPanel({ lastOutcome: 'crafted', lastCampSaveSucceeded: false }).title,
    '⚠ 保存できない（成果はこの画面限り）');
  assert.equal(showPanel({ lastOutcome: 'tempered', lastCampSaveSucceeded: false }).title,
    '⚠ 保存できない（成果はこの画面限り）');
  assert.equal(showPanel({ lastOutcome: '' }).title, 'キャンプで再開');
  assert.equal(showPanel({ lastOutcome: 'defeated', lastCampSaveSucceeded: false }).title,
    '敗北。素材を失った……');
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
  assert.match(risk.info, /森の奥に、まだ確かめていない気配がある/);
  assert.doesNotMatch(risk.info, /湿った土|獣の痕跡/,
    'the return decision must not spoil a scent that has not been earned');
  assert.match(risk.keepExploring, /気配を追って調べる/);
  assert.match(risk.pushDeeper, /次の陣・敵3体に挑む（HP 140\/140・未帰還の牙 2個／敗北で喪失）/);
  // The next wave always spawns three enemies; show the real commitment without
  // spoiling the later-wave ambush. Empty bags must not claim loot loss.
  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  assert.match(html, /function spawnEnemyWave\(waveNum, count=3, shrineGuardian=false\)/,
    'the next-wave preview must agree with the actual default enemy count');
  const emptyBag = showPanel({ phase: 'return', unbanked: 0 });
  assert.match(emptyBag.pushDeeper, /次の陣・敵3体に挑む/);
  assert.doesNotMatch(emptyBag.pushDeeper, /敗北で喪失/,
    'an empty bag must not imply that unsecured materials can be lost');
  const wounded = showPanel({ phase: 'return', hp: 21, unbanked: 3 });
  assert.match(wounded.pushDeeper, /次の陣・敵3体に挑む（HP 21\/140・未帰還の牙 3個／敗北で喪失）/,
    'the next-wave button must preview the current health and loot at risk');
  assert.match(wounded.keepExploring, /気配を追って調べる/,
    'inspecting this forest must remain a separate action from starting another wave');
  const swordless = showPanel({ phase: 'return',
    forestFinds: ['traces', 'shrine'], unbanked: 2 });
  assert.match(swordless.info, /剣がなくても手前の茨なら探れそうだ。近づいて確かめよう/,
    'the actual return panel must invite the accessible swordless gate inspection');
  assert.doesNotMatch(swordless.info, /今の装備では奥へ踏み込めない|茨の石門/,
    'do not falsely lock out the player or spoil the uninspected site');
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


test('next-wave choice never rounds fractional remaining HP up', () => {
  // Damage can leave fractional HP. Risk preview must not promise an extra point.
  const injured = showPanel({ phase: 'return', hp: 12.5, unbanked: 3 });
  assert.match(injured.pushDeeper,
    /次の陣・敵3体に挑む（HP 12\/140・未帰還の牙 3個／敗北で喪失）/);
  assert.doesNotMatch(injured.pushDeeper, /HP 13\/140/,
    'do not overstate survivability when choosing another fight');
  assert.match(showPanel({ phase: 'return', hp: 21, unbanked: 0 }).pushDeeper,
    /HP 21\/140・未帰還の牙 0個/,
    'integer HP and empty-bag preview remain unchanged');
});
