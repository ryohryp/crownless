const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/slice-engine.js');
const C=require('../src/crypt-field.js');
function start(){
 const s=E.initial();s.mode='demo';s.cleared=['wood','tower'];
 return E.start(E.discover(s,'crypt'),'crypt');
}
function walk(s,...ids){
 return ids.reduce((v,id)=>{
   const n=E.act(v,'crypt-step:'+id);
   assert.notEqual(n,v,'must move one real step: '+id);
   return n;
 },s);
}
function lit(){
 return walk(start(),21,16,17,22,23);
}
test('the existing endgame crypt now has a real fogged floor with solid walls',()=>{
 const s=start(),f=s.expedition.crypt;
 assert.equal(f.pos,C.START);
 assert.equal(C.COUNT,25);
 assert(C.WALLS.length>=10);
 assert(!C.visible(f,C.ARCHIVE));
 assert.equal(E.act(s,'crypt-step:7'),s,'no remote teleport');
 assert.equal(E.act(s,'crypt-step:15'),s,'walls remain solid');
 assert.equal(C.canMove(f,C.SEAL),false);
 assert.equal(E.parse(E.serialize(s)).expedition.crypt.pos,C.START);
 const locked=E.initial();locked.mode='demo';
 const unlocked=E.discover(locked,'crypt');
 assert.equal(E.start(unlocked,'crypt'),unlocked,'two clears still required');
});
test('a cold second brazier gives a clue, but cannot bypass the first',()=>{
 let s=walk(start(),21,22,23);
 assert.equal(s.expedition.crypt.second,false);
 assert.match(s.expedition.log[0],/先に赤き灯/);
 s=walk(s,22,17);
 assert.equal(s.expedition.crypt.first,true);
 assert.equal(s.expedition.crypt.second,false);
 assert.equal(E.act(s,'crypt-step:12'),s,'sealed passage cannot be tapped through');
 s=walk(s,22,23);
 assert.equal(s.expedition.crypt.second,true);
 assert.match(s.expedition.log[0],/封印を裂いた/);
});
test('two torches open a non-navigated corridor and one safe-return epitaph reward',()=>{
 let s=walk(lit(),22,17);
 assert.equal(C.canMove(s.expedition.crypt,C.SEAL),true);
 s=walk(s,12,7);
 assert.equal(s.expedition.crypt.archive,true);
 assert.equal(s.expedition.scrap,5);
 assert.equal(s.expedition.focus,3);
 assert.equal(s.owned.includes('crown'),false);
 const restored=E.parse(E.serialize(s));
 assert(restored,'strict save accepts crypt state');
 assert.equal(restored.expedition.crypt.archive,true);
 const again=walk(restored,12,7);
 assert.equal(again.expedition.scrap,5,'inscription cannot be farmed');
 const home=E.act(again,'return');
 assert.equal(home.expedition,null);
 assert.equal(home.scrap,5,'scrap is only banked on safe return');
 assert.equal(home.owned.includes('crown'),false,'epitaph is not a finished item');
});
test('walking through the arch preserves the existing crypt king and crown ending',()=>{
 let s=walk(lit(),22,17,12,13,14,9,4);
 assert.equal(s.expedition.room,1);
 assert.equal(s.expedition.stage,'path');
 s=E.act(s,'rest');
 assert.equal(s.expedition.room,2);
 s=E.act(s,'careful');
 assert.equal(s.expedition.stage,'fight');
 s.expedition.enemy.hp=1;
 s=E.act(s,'heavy');
 assert.equal(s.expedition.room,3);
 s=E.act(s,'rest');
 assert.equal(s.expedition.room,4);
 s=E.act(s,'careful');
 assert.equal(s.expedition.enemy.kind,'king');
 assert.equal(s.expedition.enemy.elite,true);
 s.expedition.enemy.hp=1;
 s=E.act(s,'heavy');
 assert.equal(s.expedition.stage,'cleared');
 assert(s.expedition.gear.includes('crown'));
 const home=E.act(s,'return');
 assert.equal(home.expedition,null);
 assert(home.owned.includes('crown'));
 assert(home.cleared.includes('crypt'));
});
test('legacy crypt saves without the walkable floor retain their old room-0 route',()=>{
 const s=start();delete s.expedition.crypt;
 const restored=E.parse(E.serialize(s));
 assert(restored);
 assert.equal(restored.expedition.crypt,undefined);
 const legacy=E.act(restored,'careful');
 assert.equal(legacy.expedition.stage,'fight');
 assert.equal(legacy.expedition.enemy.kind,'king');
});
