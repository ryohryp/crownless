const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/slice-engine.js');
const M=require('../src/fen-field.js');
function start(){
 const s=E.initial();s.mode='demo';
 return E.start(E.discover(s,'fen'),'fen');
}
function walk(s,...cells){
 return cells.reduce((v,id)=>{
   const n=E.act(v,'fen-step:'+id);
   assert.notEqual(n,v,'expected real step or inspection at '+id);
   return n;
 },s);
}
test('star fen offers walkable shores, actual deep water, and fog in a different biome',()=>{
 const s=start(),f=s.expedition.fen;
 assert.equal(f.pos,M.START);
 assert.equal(M.COUNT,25);
 assert(M.WALLS.length>=8);
 assert(M.visible(f,21));
 assert(!M.visible(f,M.STAR));
 assert.equal(E.act(s,'fen-step:7'),s,'remote discovery is never a teleport');
 assert.equal(E.act(s,'fen-step:15'),s,'deep pools are not walkable');
 assert.equal(M.canMove(f,M.SHOAL),false);
 assert.equal(E.parse(E.serialize(s)).expedition.fen.pos,M.START);
});
test('listening to reeds opens a risky shoal, then reveals the fallen star and bankable marsh fiber',()=>{
 let s=walk(start(),21,16,17);
 assert.equal(s.expedition.fen.sound,true);
 assert.match(s.expedition.log[0],/石を叩く音/);
 assert.equal(M.canMove(s.expedition.fen,M.SHOAL),false);
 const opened=walk(s,12);
 assert.equal(opened.expedition.fen.pos,17,'uncovering is not a teleport');
 assert(opened.expedition.fen.shoal);
 assert.match(opened.expedition.log[0],/体力 −3/);
 assert.equal(M.canMove(opened.expedition.fen,M.SHOAL),true);
 assert.equal(M.visible(opened.expedition.fen,M.STAR),false);
 const across=walk(opened,12);
 assert.equal(across.expedition.hp,s.expedition.hp-3);
 assert(M.visible(across.expedition.fen,M.STAR));
 const found=walk(across,7);
 assert.equal(found.expedition.fen.star,true);
 assert.equal(found.expedition.materials.marshFiber,1);
 assert.equal(found.expedition.scrap,4);
 assert.equal(found.expedition.stage,'path');
 const persisted=E.parse(E.serialize(found));
 assert.equal(persisted.expedition.fen.star,true);
 const revisit=walk(persisted,12,7);
 assert.equal(revisit.expedition.materials.marshFiber,1,'no farming without a new expedition');
 assert.equal(revisit.expedition.scrap,4);
 const banked=E.act(revisit,'return');
 assert.equal(banked.expedition,null);
 assert.equal(banked.materials.marshFiber,1);
 assert.equal(banked.scrap,4);
});
test('shoal cannot force a fatal swamp step when already wounded',()=>{
 const before=walk(start(),21,16,17,12);
 before.expedition.hp=3;
 const refused=E.act(before,'fen-step:12');
 assert.notEqual(refused,before);
 assert.equal(refused.expedition.hp,3);
 assert.equal(refused.expedition.fen.pos,17);
 assert.match(refused.expedition.log[0],/体力が足りない/);
});
test('herb island is one-time, wraith battle once and resumes the same terrain',()=>{
 let s=walk(start(),21,22,23,18);
 assert(s.expedition.fen.herbs);
 assert.equal(s.expedition.potions,3);
 const restored=E.parse(E.serialize(s));
 assert.equal(walk(restored,23,18).expedition.potions,3,'herbs cannot duplicate');
 const scouted=walk(s,13,8);
 assert.equal(scouted.expedition.stage,'path','first tap scouts from shore');
 const foe=walk(E.parse(E.serialize(scouted)),8);
 assert.equal(foe.expedition.stage,'fight');
 assert.equal(foe.expedition.enemy.kind,'wraith');
 assert.equal(foe.expedition.fen.pos,8);
 const near=structuredClone(foe);
 near.expedition.enemy.hp=1;
 const win=E.act(near,'heavy');
 assert.equal(win.expedition.stage,'path');
 assert.equal(win.expedition.fen.pos,8);
 assert.equal(win.expedition.room,0);
 assert.equal(win.expedition.fen.wraith,true);
 const post=walk(E.parse(E.serialize(win)),13,8);
 assert.equal(post.expedition.stage,'path','wraith does not respawn');
 const exit=walk(post,13,18,23,24);
 assert.equal(exit.expedition,null,'dry shoreline banks loot');
 assert(exit.materials.marshFiber>=1);
});
test('old fen save with no walkable field remains compatible with original text-based route',()=>{
 const s=start();delete s.expedition.fen;
 const loaded=E.parse(E.serialize(s));
 assert(loaded);
 const battle=E.act(loaded,'careful');
 assert.equal(battle.expedition.stage,'fight');
 assert.equal(battle.expedition.enemy.kind,'wraith');
});
