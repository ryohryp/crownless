const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');
const N = require('../src/neighborhood.js');
const towerEvent = N.cell(400,0);
const towerShop = N.cell(800,0);
const demo = () => ({...E.initial(),mode:'demo'});
const startEvent = () => E.discoverDistrict(demo(),towerEvent);

test('revealing an event unlocks a saved, harder clue hunt with real crafting material', () => {
  const found = startEvent();
  const regular = E.act(E.start(found,'tower'),'risky');
  const hunt = E.startWithLocalClue(found);
  assert.equal(hunt.expedition.stage,'fight');
  assert.equal(hunt.expedition.enemy.clue,true);
  assert.equal(hunt.expedition.enemy.maxHp,regular.expedition.enemy.maxHp+4);
  assert.equal(hunt.expedition.place,'tower');
  assert.deepEqual(E.parse(E.serialize(hunt)),hunt,'clue survives save/reload');
  hunt.expedition.enemy.hp=1; // Fast combat, normal defeat and bank transitions.
  const won=E.act(hunt,'strike');
  assert.equal(won.expedition.materials.watchIron,2);
  assert.match(won.expedition.log.join(' '),/手掛かり/);
  assert.equal(found.materials.watchIron,0,'discovery alone is not a free resource');
  assert.equal(won.materials.watchIron,0,'unreturned crafting materials remain at risk');
  const safe=E.act(won,'return');
  assert.equal(safe.materials.watchIron,2);
  assert.deepEqual(E.parse(E.serialize(safe)),safe);
  assert.equal(safe.report.died,false);
  assert.equal(safe.scrap,5,'the encounter banks its actual harder-fight scrap');
});
test('retreat, unrelated shops and other characters cannot counterfeit clue rewards', () => {
  const found=startEvent();
  assert.equal(E.startWithLocalClue({...found,activeCharacter:1}),found.activeCharacter===1 ? found : E.startWithLocalClue({...found,activeCharacter:1}));
  const plain=E.start(found,'tower');
  assert.equal(E.startWithLocalClue(plain),plain,'no nested expedition');
  const withdrawn=E.act(plain,'return');
  assert.equal(withdrawn.materials.watchIron,0);
  const shop=E.discoverDistrict(found,towerShop);
  assert.equal(E.startWithLocalClue(shop),shop,'shop is not a clue encounter');
});
test('a discovered shop trades banked scrap for the local material, not free gear', () => {
  let s=E.discoverDistrict(startEvent(),towerShop);
  s={...s,scrap:7};
  assert.equal(E.tradeLocalMaterial(s).scrap,4);
  const traded=E.tradeLocalMaterial(s);
  assert.equal(traded.scrap,4);
  assert.equal(traded.materials.watchIron,1);
  assert.deepEqual(E.parse(E.serialize(traded)),traded);
  assert.equal(s.materials.watchIron,0);
  const second=E.tradeLocalMaterial(traded);
  assert.equal(second.scrap,1);
  assert.equal(second.materials.watchIron,2);
  assert.equal(E.tradeLocalMaterial(second),second,'insufficient scrap blocks further trade');
  assert.equal(E.tradeLocalMaterial(E.start(second,'tower')).expedition?.place,'tower','trading cannot occur during battle');
  const smith=E.switchCharacter({...second,scrap:4},1);
  const crafted=E.craftItem(smith,'shield');
  assert.ok(crafted.owned.includes('shield'),'locally traded ingredients become crafted gear only through smithing');
  assert.equal(crafted.materials.watchIron,0);
});
