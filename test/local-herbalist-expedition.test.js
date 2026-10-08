const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../src/slice-engine.js');
const N = require('../src/neighborhood.js');

const shopDistrict = N.cell(0, -800); // west woodland, even parity: the herbalist shop
const forestEvent = N.cell(0, -400); // west woodland, odd parity: a rumor, not a shop
const fenShop = N.cell(0, 800);
const fresh = () => ({ ...E.initial(), mode: 'demo' });

function discovered(district, scrap = 2) {
  const state = E.discoverDistrict(fresh(), district);
  state.scrap = scrap;
  return state;
}

test('herbalist trade is a local, priced alternative to a normal expedition', () => {
  const state = discovered(shopDistrict);
  assert.equal(N.pointOfInterest(N.get(state.neighborhood)).family, 'shop');
  assert.equal(N.get(state.neighborhood).biome, 'wood');
  const ordinary = E.start(state, 'wood');
  assert.equal(ordinary.expedition.potions, 2);
  assert.equal(ordinary.scrap, 2);

  const boosted = E.startWithLocalHerb(state);
  assert.notEqual(boosted, state);
  assert.equal(boosted.scrap, 0, 'cost is paid from secured scrap once');
  assert.equal(boosted.expedition.potions, 3);
  assert.equal(boosted.neighborhood.active, shopDistrict.id, 'correct discovered district is used');
  assert.match(boosted.expedition.log[0], /枝角の露店.*薬草.*鉄片/);
  assert.equal(state.scrap, 2, 'caller state remains unmodified');
  assert.equal(state.expedition, null);
  assert.deepEqual(E.parse(E.serialize(boosted)), boosted, 'three supplies survive reload');
});

test('herbalist does not sell from unvisited places, other biomes, with no funds, or during a run', () => {
  const unfunded = discovered(shopDistrict, 1);
  assert.equal(E.startWithLocalHerb(unfunded), unfunded);
  const unvisited = fresh();
  unvisited.scrap = 50;
  assert.equal(E.startWithLocalHerb(unvisited), unvisited);
  const event = discovered(forestEvent, 50);
  assert.equal(E.startWithLocalHerb(event), event);
  const fen = discovered(fenShop, 50);
  assert.equal(N.pointOfInterest(N.get(fen.neighborhood)).family, 'shop');
  assert.equal(E.startWithLocalHerb(fen), fen);
  const inRun = E.start(discovered(shopDistrict, 50), 'wood');
  assert.equal(E.startWithLocalHerb(inRun), inRun);
  const invalidMode = discovered(shopDistrict, 50);
  invalidMode.mode = null;
  assert.equal(E.startWithLocalHerb(invalidMode), invalidMode);
});

test('purchased herb behaves like an ordinary consumable and ends with that expedition', () => {
  let boosted = E.startWithLocalHerb(discovered(shopDistrict, 5));
  boosted.expedition.hp -= 8;
  const healed = E.act(boosted, 'heal');
  assert.equal(healed.expedition.potions, 2);
  assert.equal(healed.expedition.hp, E.maxHp(healed));
  assert.deepEqual(E.parse(E.serialize(healed)), healed);
  const returned = E.act(healed, 'return');
  assert.equal(returned.expedition, null);
  assert.equal(returned.scrap, 3);
  assert.equal(returned.report.died, false);
  const afterReport = {...returned, report: null};
  const again = E.start(afterReport, 'wood');
  assert.equal(again.expedition.potions, 2, 'the bonus is not a permanent upgrade');
});

test('discovered shop shows the trade action and spending starts the boosted run in the browser', () => {
  const state = discovered(shopDistrict, 3), store = new Map([
    ['crownless-expedition-mode','demo'],
    ['crownless-expedition-v1-demo', E.serialize(state)]
  ]);
  const el = {};
  for (const name of ['#game','#save-status','#save-label','#help-toggle','#help','#home-name']) {
    el[name] = {innerHTML:'',hidden:true,textContent:'',value:'',addEventListener(type,fn){this[type]=fn;},setAttribute(){}};
  }
  const context = {
    CrownlessSlice:E, CrownlessNeighborhood:N,
    CrownlessArt:{scene:()=>'<svg></svg>',icon:()=>'<svg></svg>'},
    isSecureContext:true, document:{querySelector:q=>el[q] || null},
    localStorage:{getItem:q=>store.get(q)??null,setItem:(q,v)=>store.set(q,v)},
    navigator:{geolocation:null},addEventListener(){},location:{reload(){}}
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','src/slice-app.js'),'utf8'),context);
  assert.match(el['#game'].innerHTML,/枝角の露店/);
  assert.match(el['#game'].innerHTML,/data-action="poi" data-value="herb"/);
  assert.match(el['#game'].innerHTML,/鉄片 2 \/ 薬草 \+1/);
  el['#game'].click({target:{closest:()=>({dataset:{action:'poi',value:'herb'},disabled:false})}});
  const saved = E.parse(store.get('crownless-expedition-v1-demo'));
  assert.equal(saved.scrap, 1);
  assert.equal(saved.expedition.potions, 3);
  assert.match(el['#game'].innerHTML,/薬草を使う（残り 3）/);
  assert.doesNotMatch(el['#game'].innerHTML,/data-value="herb"/);
});
