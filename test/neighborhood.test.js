const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');
const N = require('../src/neighborhood.js');
const fs = require('node:fs');
const path = require('node:path');
const fresh = () => ({...E.initial(),mode:'demo'});
function clear(s) {
  s = E.start(s,'wood');
  for (let i=0; i<80 && s.expedition?.stage!=='cleared'; i++) {
    const x = s.expedition;
    if (x.stage==='path') s = E.act(s,[1,3].includes(x.room) ? E.isRoadsideEvent(s,x) ? 'pray' : 'rest' : 'careful');
    else {
      const intent=E.intent(x.enemy);
      const action = x.hp<13 && x.potions ? 'heal' : ['heavy','frenzy','pounce','break'].includes(intent.id) ? (x.stamina>=1 ? 'dodge' : 'guard') : ['quick','feint','intercept','guard'].includes(intent.id) ? 'guard' : x.stamina>=2 ? 'heavy' : 'strike';
      s=E.act(s,action);
    }
  }
  assert.equal(s.expedition?.stage,'cleared');
  return s;
}
test('same geographic cell has one persistent identity; another cell in same biome is independent', () => {
  const session=E.locationSession({latitude:35,longitude:139,accuracy:10});
  const fix={latitude:35,longitude:138.995,accuracy:10,speed:0};
  const result=E.observe(session,fix);
  let s=E.discoverDistrict(fresh(),result.district);
  s=E.discoverDistrict(s,E.observe(session,{...fix,longitude:138.9949}).district);
  assert.equal(s.neighborhood.districts.length,1);
  const other=E.observe(session,{...fix,longitude:138.990}).district;
  s=E.discoverDistrict(s,other);
  assert.equal(s.neighborhood.districts.length,2);
  assert.equal(other.biome,'wood');
  assert.notEqual(other.id,result.district.id);
  assert.deepEqual(E.parse(E.serialize(s)),s);
  assert.equal(N.cell(0,0),null);
  assert.equal(N.cell(0,9000),null);
  assert.equal(N.cell(0,590,20),null,'GPS noise at a cell boundary cannot manufacture a new district');
  assert.equal(N.cell(0,610,20),null);
  assert.equal(N.cell(0,800,20).id,'2,0');
});
test('boss defeat remains unclaimed until safe return; only that individual district is claimed', () => {
  let s=E.discoverDistrict(fresh(),N.cell(0,-800));
  s=clear(s);
  assert.equal(N.claims(s.neighborhood),0);
  assert.deepEqual(E.parse(E.serialize(s)),s);
  s=E.act(s,'return');
  assert.equal(N.get(s.neighborhood,'-2,0').claimed,true);
  assert.equal(N.get(s.neighborhood,'-1,0').claimed,false);
  assert.equal(s.neighborhood.result.claimed,true);
  assert.equal(s.neighborhood.wood,2);
  assert.equal(s.neighborhood.stone,1);
  assert.equal(s.neighborhood.active,null);
  assert.deepEqual(E.parse(E.serialize(s)),s);
  assert.equal(E.act(s,'return'),s,'report cannot bank materials twice');
});
test('empty return and death bank no materials or territory; existing home survives', () => {
  const empty=E.act(E.start(fresh(),'wood'),'return');
  assert.equal(empty.neighborhood.wood,0);
  let s=fresh(); s.neighborhood.wood=2; s.neighborhood.stone=1;
  s=E.buildHome(s,'forge');
  s=clear(s); s=E.act(s,'deeper'); s=E.act(s,'careful');
  s.expedition.hp=1; s.expedition.enemy.turn=1;
  s=E.act(s,'strike');
  assert.equal(s.report.died,true);
  assert.equal(s.neighborhood.wood,0);
  assert.equal(N.claims(s.neighborhood),0);
  assert.deepEqual(s.neighborhood.buildings,['forge']);
  assert.deepEqual(E.parse(E.serialize(s)),s);
});
test('construction spends banked materials once and changes actual reinforcement and starting health', () => {
  let s=E.act(clear(fresh()),'return'); s.report=null;
  const normal=E.upgradeCost(s);
  s=E.buildHome(s,'forge');
  assert.equal(s.neighborhood.wood,0); assert.equal(s.neighborhood.stone,0);
  assert.equal(E.buildHome(s,'forge'),s);
  assert.equal(E.upgradeCost(s),normal-2);
  const iron=s.scrap; s=E.upgrade(s);
  assert.equal(s.scrap,iron-(normal-2));
  s.neighborhood.wood=4; s.neighborhood.stone=2;
  s=E.buildHome(s,'lodge');
  assert.equal(E.maxHp(s),34);
  s=E.start(s,'wood');
  assert.equal(s.expedition.hp,34);
  assert.deepEqual(E.parse(E.serialize(s)),s);
  assert.equal(E.buildHome(s,'lodge'),s,'construction is camp-only');
});
test('house requires local ownership; rejected construction and discovery do not spend state', () => {
  const s=fresh(); s.neighborhood.wood=10; s.neighborhood.stone=10;
  assert.equal(E.buildHome(s,'lodge'),s);
  assert.equal(E.buildHome(s,'unknown'),s);
  const running=E.start(s,'wood');
  assert.equal(E.discoverDistrict(running,N.cell(400,0)),running);
  assert.equal(E.renameHome(running,'new'),running);
});
test('old saves migrate without awarding territory for global biome clears; malformed district state is rejected', () => {
  const old=fresh(); delete old.neighborhood;
  old.unlocked.push('tower'); old.cleared.push('wood');
  const loaded=E.parse(JSON.stringify(old));
  assert.ok(loaded);
  assert.equal(loaded.neighborhood.districts.length,2);
  assert.equal(N.claims(loaded.neighborhood),0);
  for (const patch of [{wood:-1},{active:'missing'},{buildings:['forge','forge']},{latitude:35},{selected:'missing'},{name:'x'.repeat(17)}]) {
    assert.equal(E.parse(JSON.stringify({...loaded,neighborhood:{...loaded.neighborhood,...patch}})),null);
  }
  const duplicated={...loaded,neighborhood:{...loaded.neighborhood,districts:[...loaded.neighborhood.districts,loaded.neighborhood.districts[0]]}};
  assert.equal(E.parse(JSON.stringify(duplicated)),null);
  assert.ok(!E.serialize(loaded).includes('latitude'));
});
test('renamed home and replayed claimed district preserve ownership and cannot claim a second time', () => {
  let s=E.act(clear(fresh()),'return'); s.report=null;
  s=E.renameHome(s,'  旅人の村  ');
  assert.equal(s.neighborhood.name,'旅人の村');
  s=E.act(clear(s),'return');
  assert.equal(N.claims(s.neighborhood),1);
  assert.equal(s.neighborhood.result.claimed,false);
  assert.equal(N.get(s.neighborhood).returns,2);
  assert.equal(s.neighborhood.wood,5,'claimed territory improves actively returned construction loot');
  assert.equal(s.neighborhood.stone,3);
  assert.deepEqual(E.parse(E.serialize(s)),s);
});


test('neighborhood visual shell keeps stronghold status compact and map landmarks unboxed', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'neighborhood.css'), 'utf8');
  assert.match(css, /stronghold-status\{display:grid/);
  assert.match(css, /district-pin>\.district-landmark\{[^}]*border:0/);
  assert.match(css, /district-detail\{[^}]*border-radius:2px/);
  assert.match(css, /neighborhood-field::-webkit-scrollbar\{display:none\}/);
  assert.match(css, /scrollbar-width:none/);
});
