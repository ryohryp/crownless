const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');
const fresh = () => ({...E.initial(), mode:'demo'});
function safeAction(s) {
  const x = s.expedition;
  if (x.stage === 'cleared') return 'return';
  if (x.stage === 'path') return [1,3].includes(x.room) ? 'rest' : 'careful';
  const i = E.intent(x.enemy);
  const attack = E.attackPreview(s,'strike');
  if (x.enemy.hp <= attack && i.id !== 'guard') return 'strike';
  if (['heavy','pounce'].includes(i.id) && x.stamina >= E.combatProfile(s).dodgeCost) return 'dodge';
  if (i.id === 'quick') return 'guard';
  if (i.id === 'guard') return 'guard';
  return x.stamina >= E.combatProfile(s).heavyCost ? 'heavy' : 'strike';
}
function complete(s,id) {
  s = E.start(s,id); assert.ok(s.expedition);
  for (let i=0; i<150 && s.expedition; i++) {
    s = E.act(s,safeAction(s));
    assert.deepEqual(E.parse(E.serialize(s)),s,'every checkpoint resumes exactly');
  }
  assert.equal(s.expedition,null); assert.equal(s.report.died,false); return s;
}
test('complete first loop banks signature gear; a second expedition uses its own upgrade', () => {
  let s = complete(fresh(),'wood');
  assert.ok(s.owned.includes('fang')); assert.equal(s.scrap,9); assert.deepEqual(s.cleared,['wood']);
  s = E.equip(s,'fang'); s = E.upgrade(s,'fang');
  assert.equal(s.scrap,1); assert.equal(E.weaponLevel(s,'fang'),1); assert.equal(E.weaponLevel(s,'rust'),0); assert.equal(E.maxHp(s),30);
  s = E.start(s,'wood'); s = E.act(s,'careful'); s = E.act(s,'guard'); s = E.act(s,'dodge');
  assert.equal(s.expedition.focus,6); assert.equal(s.expedition.hp,30);
  const before = s.expedition.enemy.hp;
  s = E.act(s,'strike'); assert.equal(before-s.expedition.enemy.hp,11);
});
test('starter weapon level 0 reinforcement costs 4 scraps so first safe return allows immediate progression', () => {
  let s = fresh();
  assert.equal(E.weaponLevel(s, 'rust'), 0);
  assert.equal(E.upgradeCost(s, 'rust'), 4);
  s.scrap = 4;
  s = E.upgrade(s, 'rust');
  assert.equal(s.scrap, 0);
  assert.equal(E.weaponLevel(s, 'rust'), 1);
  assert.equal(E.upgradeCost(s, 'rust'), 14);
});
test('reinforcement is per individual weapon, including loot variants', () => {
  let s=fresh(); s.scrap=100; s.owned.push('fang','fang_blood','shield','bow');
  s=E.equip(s,'fang_blood'); s=E.upgrade(s,'fang_blood');
  assert.equal(E.weaponLevel(s,'fang_blood'),1);
  assert.equal(E.weaponLevel(s,'fang'),0);
  assert.equal(E.weaponLevel(s,'shield'),0);
  assert.equal(E.weaponLevel(s,'bow'),0);
  assert.equal(E.combatProfile(s,'fang_blood').dodgeFocus,6);
  assert.equal(E.combatProfile(s,'shield').block,12);
  s=E.equip(s,'shield'); s=E.upgrade(s,'shield');
  assert.equal(E.weaponLevel(s,'shield'),1);
  assert.equal(E.combatProfile(s,'shield').block,13);
  assert.match(E.gearText(s,'fang_blood'),/体力半分以下で攻撃 \+2/);
});
test('three weapon families have multiple hand-authored variants with different combat decisions', () => {
  let s=fresh(); s.owned.push('fang','fang_blood','fang_moon','shield','shield_thorn','shield_oath','bow','bow_hunter','bow_recurve');
  assert.equal(E.gearFamily('fang_moon'),'fang');
  assert.equal(E.combatProfile(s,'fang_moon').dodgeCost,0);
  assert.ok(E.combatProfile(s,'shield_thorn').counter > E.combatProfile(s,'shield').counter);
  assert.ok(E.combatProfile(s,'shield_oath').block > E.combatProfile(s,'shield').block);
  assert.equal(E.combatProfile(s,'shield_oath').counter,0);
  assert.equal(E.combatProfile(s,'bow_recurve').heavyCost,1);
  assert.equal(E.combatProfile(s,'bow_recurve').pierce,false);
  assert.equal(E.combatProfile(s,'bow_hunter').openBonus,3);
});
test('legacy shared reinforcement remains only on weapons that existed before per-weapon upgrades', () => {
  const old={...fresh(),level:2}; delete old.upgrades;
  const s=E.parse(JSON.stringify(old));
  assert.ok(s); assert.equal(s.upgrades.rust,0); assert.equal(s.upgrades.fang_blood,0); assert.equal(s.upgrades.bow_recurve,0);
  assert.equal(E.weaponLevel(s,'rust'),2); assert.equal(E.maxHp(s),40);
  s.owned.push('fang','shield','bow','fang_blood','shield_oath','bow_recurve');
  assert.equal(E.weaponLevel(s,'fang'),2);
  assert.equal(E.weaponLevel(s,'shield'),2);
  assert.equal(E.weaponLevel(s,'bow'),2);
  assert.equal(E.weaponLevel(s,'fang_blood'),0);
  assert.equal(E.weaponLevel(s,'shield_oath'),0);
  assert.equal(E.weaponLevel(s,'bow_recurve'),0);
});

test('newly acquired variant starts unreinforced even when legacy journey level is maxed', () => {
  let s=fresh();
  s.level=4;
  s.owned.push('shield','shield_oath');
  s.upgrades.shield=4;
  assert.equal(E.weaponLevel(s,'shield'),4);
  assert.equal(E.weaponLevel(s,'shield_oath'),0);
  s=E.equip(s,'shield_oath');
  assert.equal(E.weaponLevel(s),0);
  assert.equal(E.combatProfile(s).block,15);
});
test('all destinations lead to an achievable crown ending and permanent health bonus', () => {
  let s = fresh();
  for (const id of ['wood','tower','fen','crypt']) {
    s = E.discover(s,id); s = complete(s,id);
    if(id==='wood') s = E.equip(s,'fang');
    if(id==='tower') s = E.equip(s,'shield');
    if(id==='fen') s = E.equip(s,'bow');
  }
  assert.equal(s.cleared.length,4); assert.ok(s.owned.includes('crown'));
  assert.equal(E.maxHp(s),36);
});
test('loot and clearing are unbanked until extraction; dying preserves owned gear and currency', () => {
  let s = fresh(); s.scrap=10;
  s = E.start(s,'wood'); s = E.act(s,'careful');
  while(s.expedition?.stage === 'fight') s = E.act(s,safeAction(s));
  assert.equal(s.scrap,10); assert.equal(s.expedition.scrap,2);
  s = E.act(s,'search'); s = E.act(s,'risky');
  while (s.expedition) s = E.act(s,s.expedition.stage==='fight' ? 'strike' : s.expedition.stage==='cleared' ? 'deeper' : [1,3].includes(s.expedition.room) ? 'search' : 'risky');
  assert.equal(s.report.died,true); assert.equal(s.scrap,10); assert.deepEqual(s.owned,['rust']); assert.deepEqual(s.cleared,[]);
});
test('deep elites drop unbanked weapon variants and extraction banks them', () => {
  let s=fresh(); s.owned.push('shield'); s=E.equip(s,'shield'); s.upgrades.shield=4;
  s=E.start(s,'wood');
  while(s.expedition.stage!=='cleared') s=E.act(s,safeAction(s));
  s=E.act(s,'deeper');
  while(s.expedition.stage!=='cleared') s=E.act(s,safeAction(s));
  assert.equal(s.expedition.depth,2);
  assert.ok(s.expedition.gear.some(g=>['fang_blood','fang_moon'].includes(g)));
  const found=s.expedition.gear.find(g=>g.startsWith('fang_'));
  assert.ok(found); assert.ok(!s.owned.includes(found));
  const saved=E.parse(E.serialize(s)); assert.ok(saved.expedition.gear.includes(found));
  s=E.act(s,'return'); assert.ok(s.owned.includes(found)); assert.ok(s.report.newGear.includes(found));
});
test('loot cues tease weapon families without naming the exact drop', () => {
  const cue2=E.lootCue('wood',2), cue3=E.lootCue('tower',3);
  assert.match(cue2,/刃/); assert.doesNotMatch(cue2,/血染めの短剣|月影の短剣/);
  assert.match(cue3,/盾/); assert.doesNotMatch(cue3,/返し棘の盾|誓壁の盾/);
});
test('whispering wood changes enemy archetype mid-expedition and gives its guardian a unique opener', () => {
  let s=E.start(fresh(),'wood');

  s=E.act(s,'careful');
  assert.equal(s.expedition.enemy.kind,'wolf');
  assert.equal(E.enemyProfile(s.expedition.enemy).archetype,'速攻型');
  while(s.expedition.stage==='fight') s=E.act(s,safeAction(s));

  assert.equal(s.expedition.room,1);
  s=E.act(s,'rest');
  s=E.act(s,'careful');
  assert.equal(s.expedition.enemy.kind,'forest_hunter');
  assert.equal(E.ENEMIES.forest_hunter.name,'苔鎧の狩人');
  assert.equal(E.enemyProfile(s.expedition.enemy).archetype,'狩人型');
  assert.equal(E.intent(s.expedition.enemy).id,'guard');
  while(s.expedition.stage==='fight') s=E.act(s,safeAction(s));

  assert.equal(s.expedition.room,3);
  s=E.act(s,'rest');
  s=E.act(s,'careful');
  assert.equal(s.expedition.enemy.kind,'wolf');
  assert.equal(s.expedition.enemy.elite,true);
  assert.equal(E.intent(s.expedition.enemy).id,'pounce');
  assert.equal(E.intent(s.expedition.enemy).name,'飛びかかり');
});

test('normal wolf keeps its original opener while the guardian pattern is separate', () => {
  const normal={kind:'wolf',hp:16,maxHp:16,turn:0,depth:1,elite:false,risky:false};
  const guardian={...normal,hp:24,maxHp:24,elite:true};
  assert.equal(E.intent(normal).id,'quick');
  assert.equal(E.intent(guardian).id,'pounce');
  assert.match(E.intent(guardian).help,/主だけ/);
});

test('enemy archetypes change patterns by depth and elites gain hand-authored traits', () => {
  const shallow={kind:'wolf',hp:20,maxHp:20,turn:1,depth:1,elite:false,risky:false};
  const deep={...shallow,depth:2,elite:true,turn:0};
  assert.equal(E.intent(shallow).id,'heavy');
  assert.equal(E.intent(deep).id,'quick');
  assert.equal(E.enemyProfile(deep).archetype,'速攻型');
  assert.equal(E.enemyProfile(deep).trait.name,'猛攻');
  assert.ok(E.intent(deep).damage > E.INTENTS.quick.damage);
  const iron={kind:'knight',hp:30,maxHp:30,turn:0,depth:2,elite:true,risky:false};
  assert.equal(E.enemyProfile(iron).trait.name,'鉄皮');
});
test('ironhide rewards heavy attacks while hunter bow rewards enemy openings', () => {
  let s=fresh(); s.owned.push('bow_hunter'); s=E.equip(s,'bow_hunter'); s=E.discover(s,'tower');
  s=E.start(s,'tower'); s.expedition.depth=2; s.expedition.room=4; s=E.act(s,'careful');
  assert.equal(E.enemyProfile(s.expedition.enemy).trait.name,'鉄皮');
  const strike=E.attackPreview(s,'strike'), heavy=E.attackPreview(s,'heavy');
  assert.ok(heavy > strike);
  s.expedition.enemy.turn=4;
  assert.equal(E.intent(s.expedition.enemy).id,'open');
  assert.equal(E.attackPreview(s,'strike'),E.GEAR.bow_hunter.attack+3);
});
test('early return is safe and idempotent; escaping pays the advertised attack once', () => {
  let s = E.start(fresh(),'wood'); s.expedition.scrap=5;
  s = E.act(s,'return'); assert.equal(s.scrap,5);
  assert.deepEqual(E.act(s,'return'),s);
  s = E.start(s,'wood'); s = E.act(s,'careful'); s.expedition.scrap=3;
  s = E.act(s,'flee'); assert.equal(s.report.hp,24); assert.equal(s.scrap,8);
});
test('insufficient stamina, unowned gear and locked destinations cannot be used', () => {
  let s=fresh(); assert.equal(E.start(s,'tower'),s);
  s=E.discover(s,'crypt'); assert.equal(E.start(s,'crypt'),s);
  assert.equal(E.equip(s,'fang'),s); assert.equal(E.upgrade(s,'fang'),s);
  s=E.act(E.start(s,'wood'),'careful'); s.expedition.stamina=0;
  assert.equal(E.act(s,'heavy'),s); assert.equal(E.act(s,'dodge'),s); assert.equal(E.act(s,'return'),s);
});
test('healing in combat consumes an enemy turn; healing on a path does not', () => {
  let s=E.start(fresh(),'wood'); s.expedition.hp=10;
  s=E.act(s,'heal'); assert.equal(s.expedition.hp,22); assert.equal(s.expedition.potions,1);
  s=E.act(s,'careful'); s=E.act(s,'heal');
  assert.equal(s.expedition.hp,24); assert.equal(s.expedition.enemy.turn,1); assert.equal(s.expedition.potions,0);
  assert.equal(E.act(s,'heal'),s);
});
test('sweep favors guard while heavy still rewards dodge', () => {
  let s=E.act(E.start(fresh(),'wood'),'careful');
  assert.equal(E.intent(s.expedition.enemy).id,'quick');
  const dodged=E.act(s,'dodge');
  assert.equal(dodged.expedition.hp,27);
  assert.equal(dodged.expedition.focus,0);
  assert.match(dodged.expedition.log.join(' '),/かわしきれない/);
  const guarded=E.act(s,'guard');
  assert.equal(guarded.expedition.hp,30);

  s=guarded;
  assert.equal(E.intent(s.expedition.enemy).id,'heavy');
  const heavyDodged=E.act(s,'dodge');
  assert.equal(heavyDodged.expedition.hp,30);
  assert.equal(heavyDodged.expedition.focus,3);
  const heavyGuarded=E.act(s,'guard');
  assert.equal(heavyGuarded.expedition.hp,27);
});

test('dodging when no attack is coming spends stamina without banking focus', () => {
  let s=E.act(E.start(fresh(),'wood'),'careful');
  s=E.act(s,'guard');
  s=E.act(s,'dodge');
  assert.equal(E.intent(s.expedition.enemy).id,'open');
  const after=E.act(s,'dodge');
  assert.equal(after.expedition.focus,0);
  assert.match(after.expedition.log.join(' '),/攻撃は来ない/);
});

test('shield counters and bow pierces guarded enemies', () => {
  let s=fresh(); s.owned.push('shield','bow'); s=E.equip(s,'shield');
  s=E.act(E.start(s,'wood'),'careful'); s=E.act(s,'guard');
  assert.equal(s.expedition.hp,30); assert.equal(s.expedition.enemy.hp,13);
  s=fresh(); s.owned.push('bow'); s=E.equip(s,'bow'); s=E.discover(s,'tower');
  s=E.act(E.start(s,'tower'),'careful'); s=E.act(s,'heavy'); assert.equal(s.expedition.enemy.hp,11);
});
test('deeper layers keep risk, change enemy behavior and stop at depth three', () => {
  let s=fresh(); s.owned.push('shield'); s=E.equip(s,'shield'); s.upgrades.shield=4; s=E.start(s,'wood');
  for(let depth=1;depth<=3;depth++) {
    let count=0;
    while(s.expedition.stage!=='cleared' && count++<150) s=E.act(s,safeAction(s));
    assert.equal(s.expedition.stage,'cleared');
    const hp=s.expedition.hp, loot=s.expedition.scrap;
    const next=E.act(s,'deeper');
    if(depth===3) assert.equal(next,s);
    else { assert.equal(next.expedition.depth,depth+1); assert.equal(next.expedition.hp,hp); assert.equal(next.expedition.scrap,loot); s=next; }
  }
});
test('stationary location samples reveal spatial regions, never step-count rewards', () => {
  const session=E.locationSession(), fix={latitude:35,longitude:139,accuracy:10,speed:0};
  assert.equal(E.observe(session,fix).status,'anchored');
  assert.equal(E.observe(session,{...fix,latitude:35.0005}).status,'nearby');
  assert.equal(E.observe(session,{...fix,latitude:35.003}).place,'tower');
  assert.equal(E.observe(session,{...fix,longitude:139.004}).place,'fen');
  assert.equal(E.observe(session,{...fix,latitude:34.997}).place,'crypt');
  assert.equal(E.observe(session,{...fix,longitude:138.996}).place,'wood');
  let s=E.discover(fresh(),E.observe(session,{...fix,latitude:35.003}).place);
  assert.equal(E.discover(s,'tower'),s); assert.equal(s.scrap,0);
  assert.doesNotMatch(E.serialize(s),/latitude|longitude|accuracy|coords|35\.003|139/);
});
test('GPS uncertainty, invalid fixes and motion cannot create discoveries or change anchor', () => {
  const session=E.locationSession(), fix={latitude:35,longitude:139,accuracy:10};
  for(const patch of [{accuracy:100},{accuracy:NaN},{latitude:91},{longitude:Infinity},{speed:3}]) assert.notEqual(E.observe(session,{...fix,...patch}).status,'anchored');
  assert.equal(session.anchor,null); E.observe(session,fix);
  const anchor={...session.anchor};
  assert.equal(E.observe(session,{...fix,latitude:35.01,accuracy:100}).status,'inaccurate');
  assert.equal(E.observe(session,{...fix,latitude:35.01,speed:2}).status,'moving');
  assert.deepEqual(session.anchor,anchor);
});
test('malformed and foreign saves are rejected, with no silent reset or reward grants', () => {
  assert.deepEqual(E.parse(null),E.initial()); assert.equal(E.parse('{broken'),null);
  for(const patch of [{version:2},{equipped:'crown'},{scrap:-1},{owned:['rust','unknown']},{upgrades:{rust:9,fang:0,shield:0,bow:0}},{latitude:35},{report:{}}]) assert.equal(E.parse(JSON.stringify({...fresh(),...patch})),null);
  let s=E.act(E.start(fresh(),'wood'),'careful'); s.expedition.enemy.hp=NaN;
  assert.equal(E.parse(E.serialize(s)),null);
});

test('heavy attack against open enemy deals bonus damage and enemy guard reduces 3', () => {
  let s = E.act(E.start(fresh(), 'wood'), 'careful');
  // wolf pattern: quick(0), heavy(1), open(2)
  s.expedition.enemy.turn = 2; // open
  assert.equal(E.intent(s.expedition.enemy).id, 'open');
  // rust weapon attack = 4, heavyBonus = 4, openBonus = +3 -> 11 damage
  assert.equal(E.attackPreview(s, 'heavy'), 11);
  assert.equal(E.attackPreview(s, 'strike'), 4);

  // Set intent to guard
  s.expedition.place = 'tower';
  s.expedition.enemy.kind = 'knight';
  s.expedition.enemy.turn = 0; // knight turn 0 is guard
  assert.equal(E.intent(s.expedition.enemy).id, 'guard');
  // strike attack 4 - 3 = 1 damage
  assert.equal(E.attackPreview(s, 'strike'), 1);
  // heavy attack (4 + 4) - 3 = 5 damage
  assert.equal(E.attackPreview(s, 'heavy'), 5);
});

