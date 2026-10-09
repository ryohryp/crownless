const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const E = require('../src/slice-engine.js');
const N = require('../src/neighborhood.js');
const app = fs.readFileSync(path.join(__dirname, '../src/slice-app.js'), 'utf8');

function renderBattle(s) {
  const saved = new Map([['crownless-expedition-mode', 'demo'], ['crownless-expedition-v1-demo', E.serialize(s)]]);
  const elements = {};
  for (const id of ['#game', '#save-status', '#save-label', '#help-toggle', '#help', '#home-name']) {
    elements[id] = { innerHTML:'', hidden:true, textContent:'', addEventListener() {}, setAttribute() {} };
  }
  const context = {
    CrownlessSlice:E, CrownlessNeighborhood:N,
    CrownlessArt:{scene:()=>'<svg></svg>',icon:()=>'<svg></svg>'},
    document:{querySelector:id=>elements[id] || null},
    localStorage:{getItem:k=>saved.get(k) ?? null,setItem:(k,v)=>saved.set(k,v)},
    navigator:{geolocation:{}}, isSecureContext:true, addEventListener() {}, location:{reload() {}}
  };
  context.window = context;
  vm.runInNewContext(app, context);
  return elements['#game'].innerHTML;
}
function choice(html, action) {
  const start = html.indexOf('data-action="' + action + '"');
  assert.ok(start >= 0, action + ' is visible');
  return html.slice(start, html.indexOf('</button>', start) + 9);
}
test('counter action buttons show correct-read payoffs before the player taps', () => {
  const start = E.act(E.start({...E.initial(),mode:'demo'},'wood'),'careful');
  assert.equal(E.intent(start.expedition.enemy).id,'quick');
  assert.ok(choice(renderBattle(start),'guard').includes('受け流し→崩し追撃'));
  assert.ok(choice(renderBattle(start),'guard').includes('気力 +1'));
  assert.ok(!choice(renderBattle(start),'strike').includes('阻止→崩し追撃'));
  const shield = E.initial(); shield.mode='demo'; shield.owned.push('shield');
  shield.equipped='shield'; shield.characters[0].equipped='shield';
  const shieldFight = E.act(E.start(shield,'wood'),'careful');
  const guard = choice(renderBattle(shieldFight),'guard');
  assert.ok(guard.includes('反撃'), 'shield counter stays visible');
  assert.ok(guard.includes('受け流し→崩し追撃'));
  for (const [kind, target] of [['wraith','feint'],['knight','break']]) {
    const s = JSON.parse(JSON.stringify(start));
    let found = false;
    for (let seed=0;seed<1000;seed++) {
      const enemy = {kind,hp:40,maxHp:40,turn:1,depth:1,elite:false,risky:false,seed};
      if (E.intent(enemy).id === target) { s.expedition.enemy = enemy; found=true; break; }
    }
    assert.ok(found, 'seeded ' + target + ' reachable');
    const html = renderBattle(s);
    assert.ok(choice(html,'strike').includes(E.intent(s.expedition.enemy).name + 'を阻止→崩し追撃'));
    assert.ok(!choice(html,'guard').includes('受け流し→崩し追撃'));
  }
  const heavy = E.act(start,'guard');
  assert.equal(E.intent(heavy.expedition.enemy).id,'heavy');
  assert.ok(!choice(renderBattle(heavy),'guard').includes('受け流し→崩し追撃'));
  assert.ok(!choice(renderBattle(heavy),'strike').includes('阻止→崩し追撃'));
});
