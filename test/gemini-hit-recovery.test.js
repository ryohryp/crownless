'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const P=require('../src/gemini-hit-recovery.js');

const hero=()=>({team:0,hitGuardRemaining:0, state:'IDLE'});
const enemy=()=>({team:1,hitGuardRemaining:0,nextStrikeAt:0,isBoss:false});

test('one player hit starts a grace interval longer than recovery, preventing chain-stun',()=>{
  const h=hero();
  assert.equal(P.acceptsHit(h),true);
  P.registerHit(h);
  assert.equal(P.acceptsHit(h),false);
  assert(P.HERO_GRACE_SECONDS>P.HERO_DOWN_SECONDS+0.5,
    'at least half a second of move-and-escape time must remain after knockdown');
  P.step(h,P.HERO_DOWN_SECONDS);
  assert.equal(P.acceptsHit(h),false,'two enemies cannot reset knockdown as hero stands up');
  P.step(h,0.5);
  assert.equal(P.acceptsHit(h),false,'hero can regain input while still invulnerable');
  P.step(h,0.35);
  assert.equal(P.acceptsHit(h),true,'hero is not permanently invulnerable');
});
test('nonplayer opponents still accept player combo hits with original recovery',()=>{
  const e=enemy();
  P.registerHit(e);
  assert.equal(e.hitGuardRemaining,0);
  assert.equal(P.acceptsHit(e),true);
  assert.equal(P.knockdownTime(e),1.35);
  assert.equal(P.knockdownTime(hero()),P.HERO_DOWN_SECONDS);
});
test('attacking enemy must rest at least a second after each strike attempt',()=>{
  for (const e of [enemy(),{...enemy(),isBoss:true}]) {
    assert.equal(P.readyToStrike(e,50),true);
    P.registerEnemyStrike(e,50);
    assert.equal(P.readyToStrike(e,50.35),false);
    assert.equal(P.readyToStrike(e,50.99),false);
    assert.equal(P.readyToStrike(e,51.40),true);
  }
});
test('a crowd cannot cancel the same immunity window and invalid time cannot attack',()=>{
  const h=hero();
  const mob=[enemy(),enemy(),enemy()];
  P.registerHit(h);
  let registered=1;
  for(const e of mob){
    if(P.acceptsHit(h)){P.registerHit(h);registered++;}
    P.registerEnemyStrike(e,100);
    assert.equal(P.readyToStrike(e,100.5),false);
  }
  assert.equal(registered,1,'three hits at once register only once during grace');
  assert.equal(P.readyToStrike(mob[0],Number.NaN),false);
});
test('lab actually applies recovery in enemy AI, hit damage and every fighter update',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/src\/gemini-hit-recovery\.js/);
  assert.match(html,/CrownlessHitRecovery\.readyToStrike\(enemy, nowSec\)/);
  assert.match(html,/CrownlessHitRecovery\.registerEnemyStrike\(enemy, nowSec\)/);
  assert.match(html,/CrownlessHitRecovery\.step\(f, dt\)/);
  assert.match(html,/if \(!window\.CrownlessHitRecovery\.acceptsHit\(target\)\) return false/);
  assert.match(html,/CrownlessHitRecovery\.knockdownTime\(target\)/);
  assert.match(html,/ctx\.globalAlpha = Math\.floor\(f\.hitGuardRemaining/);
});
