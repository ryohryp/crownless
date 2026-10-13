const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/slice-engine.js');
const T=require('../src/tower-field.js');
function start(){
 const s=E.initial();s.mode='demo';
 return E.start(E.discover(s,'tower'),'tower');
}
function walk(s,...cells){
 return cells.reduce((v,id)=>{
   const n=E.act(v,'tower-step:'+id);
   assert.notEqual(n,v,'expected walk or investigation at '+id);
   return n;
 },s);
}
test('tower has a navigable, fogged stone maze rather than the forest grid',()=>{
 const s=start(),f=s.expedition.tower;
 assert.equal(f.pos,T.START);
 assert.equal(T.COUNT,25);
 assert(T.WALLS.length>=8);
 assert(!T.visible(f,T.RELIC));
 assert(T.visible(f,21));
 assert.equal(E.act(s,'tower-step:7'),s,'remote taps never teleport');
 assert.equal(E.act(s,'tower-step:15'),s,'stone walls are truly blocked');
 assert.equal(E.parse(E.serialize(s)).expedition.tower.pos,T.START);
 assert.equal(T.canMove(f,T.STAIRS),false,'locked upper stairs cannot be bypassed');
});
test('a reflected bell leads to an actual concealed room with craftable resources',()=>{
 let s=walk(start(),21,22,17);
 assert.equal(s.expedition.tower.echo,true);
 assert.match(s.expedition.log[0],/音が壁の向こう/);
 assert.equal(T.canMove(s.expedition.tower,T.SECRET),false,'the crack initially blocks movement');
 const opened=walk(s,12);
 assert.equal(opened.expedition.tower.pos,17,'first tap opens the stone, not a teleport');
 assert(opened.expedition.tower.open);
 assert.match(opened.expedition.log[0],/隠し階段が開いた/);
 const entered=walk(opened,12);
 assert.equal(entered.expedition.tower.pos,12);
 assert.equal(T.adjacent(8,7),false,'guard corridor cannot bypass the secret');
 const reward=walk(entered,7);
 assert.equal(reward.expedition.tower.relic,true);
 assert.equal(reward.expedition.materials.watchIron,1);
 assert.equal(reward.expedition.scrap,4);
 assert.match(reward.expedition.log[0],/秘密の納骨室を発見/);
 const restored=E.parse(E.serialize(reward));
 assert(restored);
 assert.equal(restored.expedition.tower.relic,true);
 const again=walk(restored,12,7);
 assert.equal(again.expedition.materials.watchIron,1,'no infinite relic material');
 assert.equal(again.expedition.scrap,4,'no repeat payout');
 const home=E.act(again,'return');
 assert.equal(home.expedition,null);
 assert.equal(home.materials.watchIron,1,'material only banked on safe return');
 assert.equal(home.scrap,4);
});
test('optional tower guard fights once, returns to the same floor and opens legacy upper expedition',()=>{
 let s=walk(start(),21,22,23,24,19,14);
 assert.equal(E.act(s,'tower-step:4'),s,'upper staircase is not an adjacent skip');
 const foe=walk(s,9);
 assert.equal(foe.expedition.stage,'fight');
 assert.equal(foe.expedition.enemy.kind,'knight');
 assert.equal(foe.expedition.tower.pos,9);
 const near=structuredClone(foe);
 near.expedition.enemy.hp=1;
 const win=E.act(near,'heavy');
 assert.equal(win.expedition.stage,'path','guardian defeat resumes the tower floor');
 assert.equal(win.expedition.tower.pos,9);
 assert.equal(win.expedition.tower.guard,true);
 assert.equal(win.expedition.room,0);
 assert.equal(win.expedition.enemy,null);
 const persisted=E.parse(E.serialize(win));
 assert(persisted);
 const stairs=walk(persisted,4);
 assert.equal(stairs.expedition.room,1,'ascending joins the existing tower expedition');
 assert.equal(stairs.expedition.stage,'path');
 const normal=E.act(stairs,'rest');
 assert.equal(normal.expedition.room,2,'the former higher-floor game path still operates');
});
test('old tower saves without a new field still load and follow their original route',()=>{
 const s=start();delete s.expedition.tower;
 const loaded=E.parse(E.serialize(s));
 assert(loaded);
 assert.equal(loaded.expedition.tower,undefined);
 const legacy=E.act(loaded,'careful');
 assert.equal(legacy.expedition.stage,'fight');
 assert.equal(legacy.expedition.enemy.kind,'knight');
});
