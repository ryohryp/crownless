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
    { document, rpg, state: { forestFinds: new Set(state.forestFinds || []) },
      rpgRules: { COST: 3 }, location: { search: '' }, URLSearchParams },
    { timeout: 1000 });
  run();
  return { info: elements.get('rpgInfo').textContent,
    keepExploring: elements.get('rpgKeepExploring').textContent,
    forgeDisabled: elements.get('rpgForge').disabled,
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
  assert.match(showPanel({ crafted: true, lastOutcome: 'crafted' }).info,
    /風裂きの剣を装備/);
  assert.match(showPanel({ lastOutcome: 'defeated' }).info,
    /今回の未帰還素材は失った/);
  const risk = showPanel({ phase: 'return', banked: 1, unbanked: 2,
    lastOutcome: 'victory' });
  assert.match(risk.info, /今帰れば牙2個を確保/);
  assert.match(risk.info, /今帰れば鍛冶剣を作れる/);
  assert.match(risk.info, /敗北すると今回の牙2個を失う/);
  assert.match(risk.info, /湿った土にまだ読めない筋がある/);
  assert.match(risk.keepExploring, /気配を追って調べる/);
  const blocked = showPanel({ phase: 'return',
    forestFinds: ['traces', 'shrine'], unbanked: 2 });
  assert.match(blocked.info, /牙を持ち帰り、剣を鍛えれば進めそう/);
  const equipped = showPanel({ phase: 'return', crafted: true,
    forestFinds: ['traces', 'shrine'] });
  assert.match(equipped.info, /鍛えた剣なら進めそう/);
  const explored = showPanel({ phase: 'return',
    forestFinds: ['traces', 'shrine', 'hollow'] });
  assert.doesNotMatch(explored.info, /湿った土にまだ読めない筋がある/);
  assert.match(explored.keepExploring, /森の探索を続ける/);
});
