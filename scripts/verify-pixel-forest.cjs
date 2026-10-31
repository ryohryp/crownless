'use strict';
// Real Chromium input only: never set actor positions, HP, discovery or save state.
// The read-only probe helps the driver aim at visible-world coordinates.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa/browser');
const read = page => page.evaluate(() => window.CrownlessForestReadout());

function listen(server) {
  return new Promise((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error('server start timeout')), 10000);
    server.stdout.on('data', data => {
      out += data.toString();
      const found = out.match(/http:\/\/localhost:(\d+)/);
      if (found) { clearTimeout(timer); resolve(Number(found[1])); }
    });
    server.once('error', err => { clearTimeout(timer); reject(err); });
    server.once('exit', code => { clearTimeout(timer); reject(new Error('server exited: ' + code)); });
  });
}

async function keys(page, held, wanted) {
  for (const key of held) if (!wanted.includes(key)) { await page.keyboard.up(key); held.delete(key); }
  for (const key of wanted) if (!held.has(key)) { await page.keyboard.down(key); held.add(key); }
}

async function walkTo(page, x, z) {
  const held = new Set();
  const start = Date.now();
  try {
    while (Date.now() - start < 18000) {
      const s = await read(page);
      assert(s.player.hp > 0 && s.phase !== 'camp', 'walking must happen in a living expedition');
      const dx = x - s.player.x, dz = z - s.player.z;
      if (Math.hypot(dx, dz) < 18) return s;
      const wanted = [];
      if (Math.abs(dx) > 10) wanted.push(dx > 0 ? 'd' : 'a');
      if (Math.abs(dz) > 10) wanted.push(dz > 0 ? 's' : 'w');
      await keys(page, held, wanted);
      await page.waitForTimeout(55);
    }
    throw new Error('walk timeout: ' + JSON.stringify(await read(page)));
  } finally { await keys(page, held, []); }
}

// Prove the scouted footsteps cue with actual keyboard movement, not by
// injecting fighter coordinates or invoking the HUD formatter in isolation.
async function hearGuardianBehind(page) {
  const held=new Set();
  const start=Date.now();
  const trace=[];
  let withinListeningDistance=false;
  try {
    while (Date.now()-start<7000) {
      // Sample the world and its HUD in one browser turn. Separate protocol
      // calls can straddle a frame at the 95-unit sound threshold.
      const {s,hint}=await page.evaluate(()=>({
        s:window.CrownlessForestReadout(),
        hint:document.getElementById('forestExploreHint')?.textContent||''
      }));
      const guardian=s.enemies.find(e=>e.name==='苔祠の番人' && e.hp>0 && e.state!=='DEAD');
      assert(guardian && s.phase==='fight' && s.player.hp>0,
        'guardian must be alive while listening for footsteps: '+JSON.stringify({s,trace}));
      const dx=guardian.x-s.player.x, dz=guardian.z-s.player.z;
      if (hint.includes('背後に足音')) {
        // The cue was computed in the preceding animation tick; allow at
        // most one frame of movement, not a distant/hidden threat.
        assert(Math.abs(dx)>10 && Math.abs(dx)<=99 && Math.abs(dz)<=25 &&
          Math.sign(dx)!==s.player.facing,
          'footsteps require a real nearby threat behind the hero: '+JSON.stringify({s,trace}));
        assert.equal(guardian.scoutOpeningActive,false,
          'the first-strike timer must wait until the player turns around');
        assert.match(hint,/未帰還の牙 [0-9]+個/,
          'the audible cue must keep unsecured loot at stake');
        return {gap:Math.round(Math.hypot(dx,dz)),facing:s.player.facing,hint};
      }
      if (trace.length<40) trace.push({ms:Date.now()-start,gap:Math.round(Math.hypot(dx,dz)),
        facing:s.player.facing,hero:s.player.state,guardian:guardian.state,hint:hint.slice(0,50)});
      const wanted=[];
      if (Math.abs(dz)>12) wanted.push(dz>0?'s':'w');
      // Reach the sound radius once, then stop and face away. Alternating
      // toward/away at the 95-unit threshold kept the hero facing the enemy
      // whenever the guardian recovered from the ally's hitstun.
      if (Math.abs(dx)<=85) withinListeningDistance=true;
      if (!withinListeningDistance) wanted.push(dx>0?'d':'a');
      else if (Math.sign(dx)===s.player.facing) wanted.push(dx>0?'a':'d');
      await keys(page,held,wanted);
      await page.waitForTimeout(55);
    }
    throw new Error('real-input footsteps cue did not appear: '+JSON.stringify({state:await read(page),trace}));
  } finally { await keys(page,held,[]); }
}

// A player may ignore the earned footstep warning. In the actual 390px
// encounter the threat must then advance into melee or combat must resume;
// a permanently paused ally/guardian is not a meaningful risk choice.
async function ignoreGuardianFootsteps(page) {
  const start=Date.now();
  const before=await read(page);
  const initial=before.enemies.find(e=>e.name==='苔祠の番人' && e.hp>0);
  assert(initial,'the ignored cue needs a living guardian');
  const trace=[];
  while (Date.now()-start<5000) {
    await page.waitForTimeout(120);
    const s=await read(page);
    const guardian=s.enemies.find(e=>e.name==='苔祠の番人' && e.hp>0);
    assert(guardian && s.phase==='fight' && s.player.hp>0,
      'ignoring the warning must remain a playable encounter: '+JSON.stringify({s,trace}));
    const gap=Math.hypot(guardian.x-s.player.x,guardian.z-s.player.z);
    assert.equal(guardian.scoutOpeningActive,false,
      'facing away must not start the earned strike countdown');
    assert.equal(guardian.scoutStrikeClaimed,false,
      'no automatic first-strike reward for ignoring the warning');
    if (trace.length<30) trace.push({ms:Date.now()-start,gap:Math.round(gap),
      hero:s.player.state,guardian:guardian.state,guardianHp:Math.ceil(guardian.hp)});
    if (gap<=48 || guardian.hp<initial.hp || s.player.hp<before.player.hp) {
      return {seconds:Math.round((Date.now()-start)/100)/10,gap:Math.round(gap),trace};
    }
  }
  throw new Error('ignored footsteps left the guardian encounter without visible pressure: '+
    JSON.stringify({state:await read(page),trace}));
}

// Exercise the real touch gesture handler, not a keyboard shortcut or a
// direct call to fireGesture(). A phone player must be able to act on the
// 0.65-second guardian warning using the advertised upward swipe.
async function swipeJump(page,touch,bounds) {
  assert(bounds && bounds.width>=80 && bounds.height>=100,
    'the right-hand swipe zone must be touch-reachable');
  const before=await page.evaluate(()=>window.CrownlessGestureReadout());
  assert.equal(before.mode,'gesture','the dodge hint promises a gesture');
  const x=bounds.x+bounds.width*.65,y=bounds.y+bounds.height*.70;
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-72}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const after=await page.evaluate(()=>window.CrownlessGestureReadout());
  assert.equal(after.lastAction,'jump','an actual upward touch swipe must resolve to jump');
  assert.equal(after.count,before.count+1,'one swipe must trigger exactly one combat action');
}

// After the earned counter, act on the HUD's "追撃はタップ／退避は左パッド" using the
// actual phone movement pad. Measure the real retreat instead of assuming
// that a successful dodge automatically prevents later damage.
async function retreatAfterCounter(page,touch) {
  const before=await read(page);
  const guardian=before.enemies.find(e=>e.name==='苔祠の番人' && e.hp>0 && e.state!=='DEAD');
  assert(guardian && before.phase==='fight','retreat needs a living guardian');
  const away=guardian.x>=before.player.x?-1:1;
  const pad=await page.locator('#leftTouchPadArea').boundingBox();
  assert(pad && pad.width>100,'counter retreat must use the visible phone movement pad');
  const x=pad.x+pad.width*.5,y=pad.y+pad.height*.72;
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  try {
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+away*38,y}]});
    await page.waitForTimeout(520);
  } finally {
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  const after=await read(page);
  const moved=(after.player.x-before.player.x)*away;
  const gap=s=>Math.hypot(s.enemies.find(e=>e.name==='苔祠の番人')?.x-s.player.x||0,
    s.enemies.find(e=>e.name==='苔祠の番人')?.z-s.player.z||0);
  assert(moved>10,'the counter cue must allow a real thumb retreat: '+
    JSON.stringify({before:before.player,after:after.player,moved}));
  assert(gap(after)>gap(before)+10,
    'the real phone retreat must widen the guardian gap, not just move the hero');
  assert.equal(after.player.hp,before.player.hp,
    'the earned reposition window must protect the player while moving away');
  return {moved:Math.round(moved),gapBefore:Math.round(gap(before)),
    gapAfter:Math.round(gap(after)),hpLost:Math.max(0,before.player.hp-after.player.hp)};
}

// Real-input proof of the tactical promise: a scouted hit, a visible tell,
// an actual jump at the strike moment, and a landed +8 counter. Never write
// actor positions, combat flags or HP from the test.
async function jumpCounterGuardian(page) {
  const held=new Set();
  const started=Date.now();
  let stage='first-hit',jumpSeen=false,dodgeSeen=false,phoneCueSeen=false,attackLockedCueSeen=false,airCounterCueSeen=false;
  const trace=[];
  const startingState=await read(page);
  const startingHp=startingState.player.hp;
  const startingFangs=startingState.unbanked;
  assert(startingState.found.includes('traces'),
    'a counter fang requires tracks inspected by a real site tap');
  let previousHp=startingHp;
  const damageEvents=[];
  // Prepare the CDP touch channel before the short warning starts. Opening
  // a new session during the 0.65s tell could consume the dodge window.
  const bounds=await page.locator('#gestureActionArea').boundingBox();
  const touch=await page.context().newCDPSession(page);
  try {
    while(Date.now()-started<14000) {
      const {s,gestureCue,gestureText,hud}=await page.evaluate(()=>({
        s:window.CrownlessForestReadout(),
        gestureCue:document.getElementById('gestureHint')?.classList.contains('guardian-dodge-cue')
          ? document.getElementById('gestureHint').textContent : '',
        gestureText:document.getElementById('gestureHint')?.textContent||'',
        hud:document.getElementById('forestExploreHint')?.textContent||''
      }));
      const enemy=s.enemies.find(e=>e.name==='苔祠の番人' && e.hp>0 && e.state!=='DEAD');
      assert(enemy && s.phase==='fight' && s.player.hp>0,
        'the real jump counter must remain a living encounter: '+JSON.stringify({stage,trace,s}));
      const dx=enemy.x-s.player.x,dz=enemy.z-s.player.z;
      const gap=Math.hypot(dx,dz);
      if(s.player.hp<previousHp) damageEvents.push({
        ms:Date.now()-started,stage,damage:previousHp-s.player.hp,
        hpAfter:s.player.hp,guardianState:enemy.state,
        tellActive:enemy.guardianTellUntil>s.nowSec,
        counterActive:enemy.guardianCounterUntil>s.nowSec
      });
      previousHp=s.player.hp;
      if(stage==='first-hit' && enemy.scoutStrikeClaimed) stage='wait-tell';
      if(stage==='wait-tell' && enemy.guardianTellUntil>s.nowSec) stage='tell';
      // Observe the live control throughout the target's tell, including the
      // final actionable 0.2s. The old narrow sampling window could miss a
      // valid instruction even when the actual swipe and counter succeeded.
      if(enemy.guardianTellUntil>s.nowSec &&
          enemy.guardianTellTargetId===s.player.id) {
        if(gestureCue.includes('↑スワイプで跳躍回避')) phoneCueSeen=true;
        if(['ATTACK','SPECIAL'].includes(s.player.state) &&
            gestureText.includes('攻撃中は跳べない')) attackLockedCueSeen=true;
      }
      if(stage==='jump' && s.player.state==='JUMP') jumpSeen=true;
      if(stage==='jump' && enemy.guardianCounterUntil>s.nowSec) {
        assert(jumpSeen,'the counter must follow a genuine touch-swipe jump');
        if(s.player.state==='JUMP') {
          assert(hud.includes('空中タップで反撃'),
            'the real 390px HUD must explain the aerial counter while the hero is airborne');
          airCounterCueSeen=true;
        }
        dodgeSeen=true;
        stage='counter';
      }
      if(stage==='counter' && enemy.guardianCounterClaimed) {
        assert.equal(s.unbanked,startingFangs+1,
          'a landed guardian dodge-counter must earn exactly one unsecured fang');
        assert(dodgeSeen && jumpSeen,'counter must follow the visible jump dodge');
        assert(phoneCueSeen,'the real phone control must show the targeted jump instruction; '+
          JSON.stringify({attackLockedCueSeen,trace:trace.slice(-40)}));
        // The earned 0.9s recovery must be legible in the live 390px HUD,
        // not just in a pure-function test or a transient floating popup.
        await page.waitForFunction(() => {
          const hud=document.getElementById('forestExploreHint')?.textContent||'';
          return hud.includes('追撃はタップ／退避は左パッド') &&
            hud.includes('牙は獲得済み');
        },null,{timeout:650});
        const retreat=await retreatAfterCounter(page,touch);
        return {jumpSeen,dodgeSeen,phoneCueSeen,attackLockedCueSeen,airCounterCueSeen,repositionCueSeen:true,counterClaimed:true,
          hpAtStart:startingHp,hpAtCounter:s.player.hp,retreat,damageEvents,
          seconds:Math.round((Date.now()-started)/100)/10,trace};
      }
      if(trace.length<110) trace.push({ms:Date.now()-started,stage,
        gap:Math.round(gap),hero:s.player.state,enemy:enemy.state,
        tell:Math.round(Math.max(0,enemy.guardianTellUntil-s.nowSec)*100)/100,
        counter:Math.round(Math.max(0,enemy.guardianCounterUntil-s.nowSec)*100)/100,
        claimed:enemy.guardianCounterClaimed});
      if(stage==='tell' && enemy.guardianTellUntil-s.nowSec<0.5 &&
          enemy.guardianTellUntil-s.nowSec>0.1 &&
          ['IDLE','WALK','RUN'].includes(s.player.state)) {
        // Capture the exact visible control when the real swipe is issued;
        // never infer a visible cue from the internal guardian state alone.
        const cueAtSwipe=await page.locator('#gestureHint').innerText();
        if(cueAtSwipe.includes('↑スワイプで跳躍回避')) phoneCueSeen=true;
        await swipeJump(page,touch,bounds);
        stage='jump';
      }
      const wanted=[];
      if(stage==='first-hit' || stage==='counter' && s.player.state!=='JUMP') wanted.push('k');
      // Keep the hero in the guardian's actual melee lane. During the tell,
      // stop moving so the test cannot fake a jump dodge by simply retreating.
      if(stage==='first-hit' || stage==='wait-tell' || stage==='counter') {
        if(Math.abs(dx)>37 || (Math.abs(dx)>8 && Math.sign(dx)!==s.player.facing))
          wanted.push(dx>0?'d':'a');
        if(Math.abs(dz)>12) wanted.push(dz>0?'s':'w');
      }
      await keys(page,held,wanted);
      await page.waitForTimeout(45);
    }
    throw new Error('jump→evade→landed counter not reached: '+
      JSON.stringify({stage,jumpSeen,dodgeSeen,trace,state:await read(page)}));
  } finally {
    try { await keys(page,held,[]); } finally { await touch.detach(); }
  }
}

// The guardian may be occupied with the ally. A player must deliberately
// close the gap to earn the player-specific warning; waiting in place is not play.
async function approachGuardianWarning(page) {
  const held=new Set();
  const start=Date.now();
  try {
    while (Date.now()-start<7000) {
      const s=await read(page);
      const guardian=s.enemies.find(e=>e.name==='苔祠の番人' && e.hp>0 && e.state!=='DEAD');
      assert(guardian && s.phase==='fight' && s.player.hp>0,
        'guardian must still be alive when the player approaches: '+JSON.stringify(s));
      if (guardian.scoutOpeningActive) return s;
      const dx=guardian.x-s.player.x, dz=guardian.z-s.player.z;
      const wanted=[];
      // Turning toward the guardian is part of earning a usable opening.
      if (Math.abs(dx)>40 || (Math.abs(dx)>10 && Math.sign(dx)!==s.player.facing))
        wanted.push(dx>0?'d':'a');
      if (Math.abs(dz)>12) wanted.push(dz>0?'s':'w');
      await keys(page,held,wanted);
      await page.waitForTimeout(55);
    }
    throw new Error('player could not approach the earned guardian warning: '+JSON.stringify(await read(page)));
  } finally { await keys(page,held,[]); }
}

// Compare attack-only and timed jump with the same forged equipment on
// separate real expeditions. No HP, positions, combat flags or rewards are
// injected; report the starting HP so different prior damage stays visible.
async function clearWave(page,{attackOnlyGuardian=false,preferScoutedOpening=false}={}) {
  const held = new Set();
  const start = Date.now();
  const before = await read(page);
  let minimumHp = before.player.hp;
  let scoutedFirstHit = false;
  let openingObserved = false;
  let scoutAttackCueSeen = false;
  let gateFirstFeedbackSeen = false;
  let guardianTellSeen = false;
  let guardianCounterClaimed = false;
  let previousHp=before.player.hp;
  const damageEvents=[];
  const scoutTrace = [];
  try {
    while (Date.now() - start < 75000) {
      // Read the real phone HUD in the same frame as the combat state.
      // This is observation only: no fighter, reward, or save injection.
      const {s,hud,attackCue} = await page.evaluate(() => {
        const s=window.CrownlessForestReadout();
        const gestureMode=!document.getElementById('gestureActionArea').classList.contains('hidden');
        const cue=gestureMode?document.getElementById('gestureHint'):document.getElementById('btnPunch');
        const action=gestureMode?document.getElementById('gestureActionArea'):cue;
        const actionRect=action?.getBoundingClientRect();
        const cueRect=cue?.getBoundingClientRect();
        const bounds=r=>r&&{left:r.left,top:r.top,right:r.right,bottom:r.bottom};
        return {
          s,
          hud:document.getElementById('forestExploreHint')?.textContent||'',
          attackCue:{
            active:!!cue?.classList.contains('guardian-scout-cue'),
            mode:gestureMode?'gesture':'buttons',
            text:document.getElementById('gestureHint')?.textContent||'',
            rect:bounds(actionRect),cueRect:bounds(cueRect),
            width:innerWidth,height:innerHeight
          }
        };
      });
      if(attackCue.active) {
        assert(s.enemies.some(e => e.name==='苔祠の番人' &&
          e.scoutOpeningActive && !e.scoutStrikeClaimed),
          'the attack button must not advertise an unearned or spent +12 opening');
        assert.match(attackCue.text,attackCue.mode==='gesture'
          ? /先手の好機！右側をタップで\+12/ : /先手の好機！右下の攻撃で\+12/,
          'the visible cue must name the input for the selected control mode');
        const r=attackCue.rect,c=attackCue.cueRect;
        const inside=b=>b && b.left>=0 && b.top>=0 &&
          b.right<=attackCue.width+1 && b.bottom<=attackCue.height+1;
        assert(inside(c) && c.right>c.left && c.bottom>c.top &&
          inside(r) && r.right-r.left>=44 && r.bottom-r.top>=44,
          'the earned cue and actual touch target must be on-screen: '+JSON.stringify(attackCue));
        scoutAttackCueSeen=true;
      }
      minimumHp = Math.min(minimumHp, s.player.hp);
      gateFirstFeedbackSeen ||= s.enemies.some(e =>
        e.name==='苔祠の番人' && e.scoutOpeningSeconds>1.8 &&
        e.scoutStrikeClaimed) && hud.includes('石門の観察が効いた');
      scoutedFirstHit ||= s.enemies.some(e => e.name === '苔祠の番人' && e.scoutStrikeClaimed);
      openingObserved ||= s.enemies.some(e => e.name === '苔祠の番人' && e.scoutOpeningActive);
      guardianTellSeen ||= s.enemies.some(e => e.name === '苔祠の番人' && e.guardianTellUntil>s.nowSec);
      guardianCounterClaimed ||= s.enemies.some(e => e.name === '苔祠の番人' && e.guardianCounterClaimed);
      if(s.player.hp<previousHp) {
        const guardian=s.enemies.find(e=>e.name==='苔祠の番人');
        damageEvents.push({ms:Date.now()-start,damage:previousHp-s.player.hp,
          hpAfter:s.player.hp,guardianState:guardian?.state||null,
          tellActive:Boolean(guardian?.guardianTellUntil>s.nowSec),
          counterActive:Boolean(guardian?.guardianCounterUntil>s.nowSec),
          counterClaimed:Boolean(guardian?.guardianCounterClaimed)});
      }
      previousHp=s.player.hp;
      if (s.phase === 'return') return { seconds: Math.round((Date.now()-start)/100)/10,
        minimumHp, hpLost:before.player.hp-minimumHp, scoutedFirstHit, openingObserved,
        scoutAttackCueSeen,gateFirstFeedbackSeen,attackOnlyGuardian, guardianTellSeen, guardianCounterClaimed,
        damageEvents,scoutTrace, after:s };
      assert(s.phase === 'fight' && s.player.hp > 0,
        'real-input combat ended in defeat: ' + JSON.stringify(s));
      assert(Array.isArray(s.enemies), 'read-only probe must expose enemy positions');
      const target = s.enemies.filter(e => e.hp > 0 && e.state !== 'DEAD')
        .sort((a,b) => Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z))[0];
      // Use the real grab/throw input when the guardian closes in, rather
      // than relying on an unbroken kick hold against its stronger attacks.
      // Normal enemies retain the baseline kick-only screening path.
      // A cautious gate detour only matters if the hero actually gets to use
      // the earned opening. Approach and face the guardian without holding an
      // attack that would lock the hero out of arming the one-shot warning.
      // Once observed, attempt the strike; never wait indefinitely for a
      // second warning if the first one expires or the player misses.
      const waitForOpening=preferScoutedOpening && target?.name==='苔祠の番人' &&
        target.scoutOpeningSeconds>0 && !target.scoutStrikeClaimed && !openingObserved;
      const grappleGuardian=!waitForOpening && !attackOnlyGuardian &&
        target?.name==='苔祠の番人' && !target.scoutOpeningActive &&
        Math.abs(target.x-s.player.x)<42 && Math.abs(target.z-s.player.z)<20;
      const wanted = waitForOpening ? [] : [grappleGuardian?'l':'k'];
      if (target?.name === '苔祠の番人' && scoutTrace.length < 35) {
        scoutTrace.push({ms:Date.now()-start, gap:Math.round(Math.hypot(target.x-s.player.x,target.z-s.player.z)),
          hero:s.player.state, guardian:target.state, guardianHp:Math.ceil(target.hp),
          opening:target.scoutOpeningActive, claimed:target.scoutStrikeClaimed, input:wanted[0]||'approach'});
      }
      if (target) {
        const dx=target.x-s.player.x, dz=target.z-s.player.z;
        // Walk into the same depth lane, stop within reach, and face the target.
        if (Math.abs(dx)>44 || (Math.abs(dx)>6 && Math.sign(dx)!==s.player.facing)) wanted.push(dx>0?'d':'a');
        if (Math.abs(dz)>12) wanted.push(dz>0?'s':'w');
      }
      await keys(page,held,wanted);
      await page.waitForTimeout(95);
    }
    throw new Error('real-input combat exceeded 75s: ' + JSON.stringify(await read(page)));
  } finally { await keys(page,held,[]); }
}

async function tapSite(page, id) {
  const point = await page.evaluate(id => {
    const s=window.CrownlessForestReadout();
    const site=window.CrownlessForestDiscoveries.spots.find(v=>v.id===id);
    const c=document.querySelector('#gameCanvas');
    const r=c.getBoundingClientRect();
    const bridge=site.x>=430&&site.x<=730&&site.z>=235&&site.z<=345
      ? Math.max(0,Math.cos((site.x-580)/150*Math.PI/2)*46):0;
    return {x:r.left+(site.x-s.cameraX)*r.width/s.viewport.width,
      y:r.top+(site.z-bridge-42)*r.height/s.viewport.height};
  }, id);
  await page.touchscreen.tap(point.x,point.y);
  await page.waitForTimeout(200);
}

// The clue must change the *actual* next choice, not only a rule test or hint.
async function verifyTracksShrineRisk(page, crafted, {dodgeGuardian=false}={}) {
  const foundTracks=await read(page);
  assert(foundTracks.found.includes('traces'),'the detour must be discovered by real touch first');
  assert(!foundTracks.found.includes('shrine'),'the shrine is still unspent');
  assert.equal(foundTracks.crafted,crafted,'compare starter gear and the forged sword');
  const shrinePulseCount=()=>page.evaluate(() =>
    window.__forestHapticPatterns.filter(p=>Array.isArray(p)&&p.join(',')==='18,65,36').length);
  const cueBefore=await shrinePulseCount();
  await walkTo(page,660,230);
  assert.equal(await shrinePulseCount(),cueBefore+1,
    'the untouched shrine gives one distinct cool two-beat cue on a phone');
  await page.waitForTimeout(200);
  assert.equal(await shrinePulseCount(),cueBefore+1,
    'standing near the shrine must not repeat the sensory cue');
  assert(!(await read(page)).found.includes('shrine'),
    'the new cue must not automatically reveal or consume the shrine');
  const before=await read(page);
  assert(Math.hypot(before.player.x-660,before.player.z-230)<54,
    'the player must physically reach the shrine before touching it');
  await tapSite(page,'shrine');
  assert.equal(await page.locator('#forestShrineChoice').isVisible(),true,
    'the real shrine touch opens the decision');
  const cost=crafted?3:9;
  const risk=page.locator('#forestShrineRisk');
  assert(before.player.hp>=cost+1,'the real run must have enough HP to test this risk');
  assert.equal(await risk.isEnabled(),true);
  assert.match(await risk.innerText(),new RegExp('HP -'+cost),
    'reading tracks must reduce the visible cost with and without crafted gear');
  assert.match(await risk.innerText(),new RegExp('→残り'+Math.floor(before.player.hp-cost)),
    'the shrine previews the actual remaining HP before committing');
  assert.match(await risk.innerText(),/足跡を読んで負傷 -3/,
    'the UI must explain why the risk is reduced');
  assert.match(await risk.innerText(),/接近する物音を早く察知/,
    'the decision should explain the scouting benefit before commitment');
  const wasClear=before.phase==='return';
  const pulsesBefore=await page.evaluate(() =>
    window.__forestHapticPatterns.filter(p=>Array.isArray(p)&&p.join(',')==='20,45,20').length);
  if (wasClear) assert.match(await risk.innerText(),/奥に気配・追加戦闘あり・撃退まで帰還不可/,
    'post-victory extra loot must warn about a real guardian before tapping');
  // Spoiler boundary: the choice warns of an unavoidable fight but does not name its foe.
  const preChoice=await page.locator('#forestShrineChoice').innerText();
  assert.doesNotMatch(preChoice,/苔祠の番人|番人/,
    'the player should discover the guardian identity only after choosing the danger');
  if (wasClear) assert.match(preChoice,/追加戦闘あり・撃退まで帰還不可/,
    'the surprise must not conceal the real cost of choosing the risky route');
  await risk.click();
  const after=await read(page);
  assert(after.found.includes('shrine'),'the selected branch consumes the shrine');
  assert.equal(after.unbanked,before.unbanked+2,
    'the dangerous search grants exactly two unsecured fangs');
  assert.equal(after.player.hp,before.player.hp-cost,
    'the displayed HP cost must match the real health loss');
  if (wasClear) {
    assert.equal(after.phase,'fight',
      'deep search after victory starts a new encounter before loot can be banked');
    const awake=after.enemies.filter(e=>e.hp>0 && e.state!=='DEAD');
    assert.equal(awake.length,1,
      'only one optional guardian is awakened, not a mandatory full wave');
    assert.equal(awake[0].name,'苔祠の番人',
      'the optional shrine threat must be a distinct guardian, not a generic wave enemy');
    assert.equal(awake[0].maxHp,180,
      'the optional guardian must survive longer than a normal 95 HP enemy');
    const distance=Math.hypot(awake[0].x-after.player.x,awake[0].z-after.player.z);
    assert(distance>=120 && distance<=190,
      'reading tracks must provide extra reaction distance before the guardian reaches the player: '+distance);
    assert.equal(await page.locator('#rpgOpenResults').isVisible(),false,
      'the player cannot immediately bank the risky extra materials');
    await page.waitForFunction(()=>
      document.getElementById('forestExploreHint')?.textContent?.includes('倒すまで帰還不可'));
    const guardianHint=await page.locator('#forestExploreHint').innerText();
    assert.match(guardianHint,/番人HP \d+\/180/,
      'the active guardian must replace stale discovery cues with live HP');
    assert(guardianHint.includes('未帰還の牙 '+after.unbanked+'個'),
      'the guardian hint must show the actual unsecured materials');
    // First hear the guardian behind the hero, then deliberately turn to
    // claim the still-unused first-strike window on a 390px phone viewport.
    const behindCue=await hearGuardianBehind(page);
    const behindBounds=await page.locator('#forestExploreHint').boundingBox();
    const behindViewport=page.viewportSize();
    assert(behindBounds && behindBounds.x>=0 && behindBounds.y>=0 &&
      behindBounds.x+behindBounds.width<=behindViewport.width &&
      behindBounds.y+behindBounds.height<=behindViewport.height,
      'the real footsteps cue must fit inside the phone viewport');
    await page.screenshot({path:path.join(output,
      'pixel-forest-guardian-footsteps-'+(crafted?'forged':'starter')+'-390.png')});
    // The forged revisit tests the alternative of *not* responding immediately.
    // The starter run still checks the direct turn-and-strike path.
    const ignoredCue=crafted ? await ignoreGuardianFootsteps(page) : null;
    await approachGuardianWarning(page);
    await page.waitForFunction(() =>
      document.getElementById('forestExploreHint')?.textContent?.includes('足跡の先読み'),
      null,{timeout:2000});
    const openingHint=await page.locator('#forestExploreHint').innerText();
    assert(behindCue.gap<=99 && !openingHint.includes('背後に足音'),
      'turning toward the guardian must replace footsteps with the earned opening');
    assert.match(openingHint,/足跡の先読み 残り[0-9]+\.[0-9]秒/,
      'real approaching guardian must grant a visible, timed scouting opening');
    assert.match(openingHint,/攻撃\+12か回避/,
      'the actual 390px warning must offer the earned attack bonus or a retreat choice');
    assert.equal(await page.evaluate(() =>
      window.__forestHapticPatterns.filter(p=>Array.isArray(p)&&p.join(',')==='20,45,20').length),
      pulsesBefore+1,'the real guardian approach triggers exactly one distinct haptic cue');
    const bounds=await page.locator('#forestExploreHint').boundingBox();
    const viewport=page.viewportSize();
    assert(bounds && bounds.x>=0 && bounds.y>=0 &&
      bounds.x+bounds.width<=viewport.width && bounds.y+bounds.height<=viewport.height,
      'the live guardian warning must fit inside the phone viewport');
    await page.screenshot({path:path.join(output,
      'pixel-forest-guardian-warning-'+(crafted?'forged':'starter')+'-390.png')});
  }
  // The starter run verifies the earned first strike and survival. Reserve
  // the timing-sensitive jump/counter proof for the explicit forged-dodge
  // comparison below, where it is asserted against the attack-only route.
  // Forcing it here as well let an AI ally finish the starter guardian while
  // the test waited for another tell; that did not measure the new gate choice.
  const counterEvidence=wasClear && dodgeGuardian ? await jumpCounterGuardian(page) : null;
  // Respond to the short opening before testing a repeat tap. The latter
  // used to spend the earned warning while the browser waited on input.
  // Both forged strategies finish with the same normal attacks. The only
  // tactical difference is whether the player jumps through the tell first.
  const guardian=wasClear?await clearWave(page,{attackOnlyGuardian:crafted}):null;
  if (guardian) {
    if (dodgeGuardian) assert(counterEvidence?.counterClaimed,
      'the forged dodge strategy must land its earned counter in real Chromium');
    if (crafted && !dodgeGuardian) assert.equal(guardian.guardianCounterClaimed,false,
      'the forged attack-only strategy must not earn a dodge counter');
    assert.equal(guardian.after.phase,'return',
      'defeating the guardian resumes ordinary exploration and safe return');
    // Reading the tracks must now produce an actual first-hit payoff in
    // real touch/keyboard combat, not just a visible but unusable warning.
    // Keep the trace on failure so AI timing or input issues can be diagnosed.
    assert.equal(guardian.scoutedFirstHit,true,
      'scouted player must land the earned +12 strike; trace='+
      JSON.stringify(guardian.scoutTrace));
    assert.equal(await page.evaluate(() =>
      window.__forestHapticPatterns.filter(p=>Array.isArray(p)&&p.join(',')==='20,45,20').length),
      pulsesBefore+1,'later guardian attacks must not repeat the opening vibration');
    assert(guardian.after.unbanked>=after.unbanked,
      'guardian combat may add ordinary enemy-drop materials to the unsecured bag');
    await page.waitForFunction(()=>
      !document.getElementById('forestExploreHint')?.textContent?.includes('倒すまで帰還不可'));
  }
  const beforeRepeat=await read(page);
  await tapSite(page,'shrine');
  assert.equal((await read(page)).unbanked,beforeRepeat.unbanked,
    'repeat touches cannot duplicate the shrine reward');
  return {crafted,cost,dodgeGuardian,hpBefore:before.player.hp,hpAfter:after.player.hp,
    provisionalBefore:before.unbanked,
    provisionalAfter:guardian?guardian.after.unbanked:after.unbanked,
    guardian:guardian&&{seconds:guardian.seconds,minimumHp:guardian.minimumHp,
      hpAtStart:after.player.hp,hpAtEnd:guardian.after.player.hp,
      hpLostFromRisk:Math.max(0,after.player.hp-guardian.after.player.hp),
      hpLost:guardian.hpLost,attackOnlyGuardian:guardian.attackOnlyGuardian,
      guardianTellSeen:guardian.guardianTellSeen,
      guardianCounterClaimed:guardian.guardianCounterClaimed,
      damageEvents:guardian.damageEvents},
    counterEvidence:counterEvidence&&{jumpSeen:counterEvidence.jumpSeen,
      dodgeSeen:counterEvidence.dodgeSeen,phoneCueSeen:counterEvidence.phoneCueSeen,
      airCounterCueSeen:counterEvidence.airCounterCueSeen,
      repositionCueSeen:counterEvidence.repositionCueSeen,
      counterClaimed:counterEvidence.counterClaimed,retreat:counterEvidence.retreat,
      hpAtStart:counterEvidence.hpAtStart,
      hpAtCounter:counterEvidence.hpAtCounter,
      damageEvents:counterEvidence.damageEvents,
      seconds:counterEvidence.seconds}};
}

async function main() {
  const {chromium}=require('playwright');
  const server=spawn(process.execPath,['scripts/serve-slice.cjs'],{
    cwd:root,env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe'],
  });
  server.stderr.pipe(process.stderr);
  let browser;
  const report={kind:'real-browser-input',gameStateMutatedByTest:false,viewports:[],loop:null};
  try {
    const port=await listen(server);
    browser=await chromium.launch({headless:true});
    await fs.mkdir(output,{recursive:true});
    for(const width of [360,390,430]) {
      const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:width===390?2:1});
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      // Capture calls to the Vibration API without claiming that a physical
      // phone motor has been tested by headless Chromium.
      await page.addInitScript(() => {
        window.__forestHapticPatterns=[];
        Object.defineProperty(navigator,'vibrate',{configurable:true,value:pattern=>{
          window.__forestHapticPatterns.push(pattern);
          return true;
        }});
      });
      try {
        await page.goto('http://127.0.0.1:'+port+'/expedition.html',{waitUntil:'domcontentloaded'});
        await page.locator('[data-action="mode"][data-value="demo"]').click();
        const saveBefore=await page.evaluate(()=>localStorage.getItem('crownless-expedition-v1-demo'));
        await page.locator('[data-action="action-forest-lab"]').first().click();
        await page.waitForURL('**/gemini-feel-lab.html?from=discovered-wood');
        await page.waitForFunction(()=>window.CrownlessForestReadout?.().assetsReady,{timeout:20000});
        assert.equal((await read(page)).art,'pixel','new forest renderer is the playable default');
        const layout=await page.evaluate(()=>{
          const c=document.querySelector('#gameCanvas'), r=c.getBoundingClientRect();
          return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
            sourceWidth:c.width,sourceHeight:c.height,width:r.width,height:r.height,
            scaleX:r.width/c.width,scaleY:r.height/c.height};
        });
        assert(layout.scrollWidth<=width+1,'no horizontal overflow: '+JSON.stringify(layout));
        assert(Math.abs(layout.scaleX-layout.scaleY)<0.003,'canvas pixels retain uniform aspect: '+JSON.stringify(layout));
        assert(layout.height>=180,'playable canvas remains tall enough on phone');
        assert(layout.sourceHeight>=layout.height-1,'canvas must not enlarge a low-resolution whole scene');
        if(width===390) assert(layout.sourceHeight>=layout.height*1.9,'high-density phones retain source-art and text detail');
        await page.screenshot({path:path.join(output,'pixel-forest-'+width+'.png')});
        await page.locator('#btnToggleArtPreview').click();
        assert.equal((await read(page)).art,'classic');
        await page.locator('#btnToggleArtPreview').click();
        assert.equal((await read(page)).art,'pixel');
        // Real touch drag on the left movement pad, through Chromium's input path.
        const pad=await page.locator('#leftTouchPadArea').boundingBox();
        assert(pad && pad.width>100,'left movement pad remains reachable');
        const touch=await context.newCDPSession(page);
        const beforeMove=await read(page);
        const x=pad.x+pad.width*.35,y=pad.y+pad.height*.72;
        await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
        await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+38,y}]});
        await page.waitForTimeout(300);
        await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        const afterMove=await read(page);
        assert(afterMove.player.x>beforeMove.player.x+15,'touch joystick must move the actual hero');
        await touch.detach();
        const action=await page.locator('#gestureActionArea').boundingBox();
        await page.touchscreen.tap(action.x+action.width*.7,action.y+action.height*.75);
        assert.equal(await page.evaluate(()=>window.CrownlessGestureReadout().lastAction),'punch','real touch attacks');
        report.viewports.push({width,layout,touchDistance:Math.round(afterMove.player.x-beforeMove.player.x)});
        if(width===360) {
          // Before reading tracks, the real shrine choice must allow a
          // reversible detour. Do not reveal the guardian or award anything
          // for opening and canceling the panel.
          await clearWave(page);
          await walkTo(page,660,230);
          assert(!(await read(page)).found.includes('traces'),
            'the detour must begin with genuinely unread tracks');
          const beforeDetour=await read(page);
          await tapSite(page,'shrine');
          const sheet=page.locator('#forestShrineChoice');
          assert(await sheet.isVisible(),'an unscouted shrine must remain inspectable');
          const stakes=await page.locator('#forestShrineStakes').innerText();
          assert.match(stakes,/足元の筋は未調査。今は引き返して探す手もある。/,
            'the actual phone choice suggests a reversible investigation');
          assert.match(stakes,/素材は生還時だけ倉庫に残る/,
            'the unscouted choice retains the real loss condition');
          assert.doesNotMatch(stakes,/苔祠の番人/,
            'the risky guardian is still a surprise');
          const box=await sheet.locator(':scope > div').boundingBox();
          assert(box && box.y>=0 && box.y+box.height<=page.viewportSize().height,
            'the additional clue must fit the 360px phone viewport');
          await page.screenshot({path:path.join(output,'pixel-forest-unscouted-shrine-detour-360.png')});
          // Stress the same real choice sheet at a short phone height. The
          // cancel action must stay reachable without scrolling the game page.
          await page.setViewportSize({width,height:420});
          const compact=await page.evaluate(()=>{
            const sheet=document.querySelector('#forestShrineChoice > div');
            const rect=sheet.getBoundingClientRect();
            return {top:rect.top,bottom:rect.bottom,scrollHeight:sheet.scrollHeight,
              clientHeight:sheet.clientHeight,viewport:innerHeight,
              pageScroll:document.documentElement.scrollHeight};
          });
          assert(compact.top>=0 && compact.bottom<=compact.viewport+1 &&
            compact.scrollHeight>compact.clientHeight,
            'short-phone shrine sheet must scroll within the viewport: '+JSON.stringify(compact));
          await page.locator('#forestShrineCancel').scrollIntoViewIfNeeded();
          const compactCancel=await page.locator('#forestShrineCancel').boundingBox();
          assert(compactCancel && compactCancel.y>=0 &&
            compactCancel.y+compactCancel.height<=420,
            'the one-time choice can be declined after scrolling on a short phone');
          await page.locator('#forestShrineCancel').click();
          await page.setViewportSize({width,height:844});
          const deferred=await read(page);
          assert(!deferred.found.includes('shrine') &&
            deferred.unbanked===beforeDetour.unbanked,
            'declining the risk cannot consume the find or mint materials');
          await walkTo(page,800,365);
          await tapSite(page,'traces');
          assert((await read(page)).found.includes('traces'),
            'the player must deliberately inspect the clue');
          await page.screenshot({path:path.join(output,'pixel-forest-fork-360.png')});
          await walkTo(page,660,230);
          await tapSite(page,'shrine');
          assert.doesNotMatch(await page.locator('#forestShrineStakes').innerText(),
            /足元の筋は未調査/,'the old warning clears after actual investigation');
          assert.match(await page.locator('#forestShrineRisk').innerText(),
            /足跡を読んで負傷 -3/,'reading tracks changes the real risk');
          await page.locator('#forestShrineCancel').click();
          assert(!(await read(page)).found.includes('shrine'),
            'reopening and declining must still preserve the one-time choice');
          report.unscoutedShrineDetour={width,tracksInspected:true,shrineUnspent:true};
        }
        if(width===390) {
          const first=await clearWave(page);
          assert(first.after.unbanked>=3,'three actual enemies provide crafting materials');
          assert.equal(await page.locator('#rpgPanel').isVisible(),false,'victory leaves forest playable');
          const returnButton=page.locator('#rpgOpenResults');
          assert.equal(await returnButton.isVisible(),true,'the return choice stays available after combat');
          assert.match(await returnButton.innerText(),new RegExp('牙'+first.after.unbanked+'）'),
            'the return button shows the current unsecured loot');
          await returnButton.click();
          const returnDecision=await page.locator('#rpgInfo').innerText();
          assert.match(returnDecision,new RegExp('今帰れば牙'+first.after.unbanked+'個を確保'),
            'the decision states the actual reward from returning alive');
          assert.match(returnDecision,/今帰れば鍛冶剣を作れる/,
            'the first victory gives a concrete reason to bank materials');
          assert.match(returnDecision,new RegExp('敗北すると今回の牙'+first.after.unbanked+'個を失う'),
            'the alternative must name the actual unsecured loss');
          assert.match(returnDecision,/湿った土にまだ読めない筋がある。/,
            'victory must offer a sensory cue for an unexamined discovery');
          assert.match(await page.locator('#rpgKeepExploring').innerText(),/気配を追って調べる/,
            'the existing continue button should invite investigation without naming the location');
          assert.match(await page.locator('#rpgPush').innerText(),
            new RegExp('HP '+Math.ceil(first.after.player.hp)+'/'+first.after.player.maxHp+
              '・未帰還の牙 '+first.after.unbanked+'個'),
            'the real phone next-wave button must preview current HP and unsecured materials');
          const returnBounds=await page.locator('#rpgPanel > div').boundingBox();
          assert(returnBounds && returnBounds.y>=0 &&
            returnBounds.y+returnBounds.height<=page.viewportSize().height,
            'the return decision with its cue must fit the 390px phone viewport');
          await page.screenshot({path:path.join(output,'pixel-forest-return-cue-390.png')});
          await page.locator('#rpgKeepExploring').click();
          assert.equal(await page.locator('#rpgPanel').isVisible(),false,
            'declining the return decision resumes exploration');
          assert.equal((await read(page)).unbanked,first.after.unbanked,
            'opening and closing the choice must not bank or duplicate loot');
          await walkTo(page,580,280);
          // After combat, the player sees exactly what is at stake before
          // choosing to search farther or return alive with materials.
          const returnHint=await page.locator('#forestExploreHint').innerText();
          assert.match(returnHint,new RegExp('未帰還の牙 '+first.after.unbanked+'個'),
            'the return decision shows actual unbanked materials, not a fixed count');
          assert.match(returnHint,/探索を続けるか、生還して確定/,
            'the player can see the choice to keep exploring or bank the loot');
          await page.screenshot({path:path.join(output,'pixel-forest-bridge-390.png')});
          const trackCueBefore=await page.evaluate(() => window.__forestHapticPatterns.filter(p=>p===34).length);
          await walkTo(page,800,365);
          await page.waitForFunction(()=>document.getElementById('forestExploreHint')?.textContent?.includes('湿った土に細い筋がある'));
          assert.equal(await page.evaluate(() => window.__forestHapticPatterns.filter(p=>p===34).length),trackCueBefore+1,
            'entering the unexamined tracks once gives one tactile clue without auto-collecting');
          await page.waitForTimeout(200);
          assert.equal(await page.evaluate(() => window.__forestHapticPatterns.filter(p=>p===34).length),trackCueBefore+1,
            'standing near the same clue must not vibrate every frame');
          // Attacking near tracks must not silently collect one-time materials.
          const beforeClue=await read(page);
          await page.keyboard.down('k');
          await page.waitForTimeout(220);
          await page.keyboard.up('k');
          await page.waitForTimeout(150);
          const afterPunch=await read(page);
          assert(!afterPunch.found.includes('traces'),'punch must not auto-discover');
          assert.equal(afterPunch.unbanked,beforeClue.unbanked,'punch cannot grant clue loot');
          // A real jump + site touch must not open an inspection or bank a
          // reward midair. This covers the live input path, not only the VM
          // rule test; the same untouched clue remains available on landing.
          await page.keyboard.press('Space');
          await page.waitForFunction(() => window.CrownlessForestReadout?.().player.state==='JUMP',
            null,{timeout:2000});
          const airborne=await read(page);
          assert.equal(airborne.player.state,'JUMP','the browser must actually be airborne before the touch');
          await tapSite(page,'traces');
          const afterAirborneTap=await read(page);
          assert(!afterAirborneTap.found.includes('traces'),
            'a real touch during a jump must not discover the clue');
          assert.equal(afterAirborneTap.unbanked,airborne.unbanked,
            'a real midair clue touch must not grant unsecured materials');
          assert.equal(await page.locator('#forestShrineChoice').isVisible(),false,
            'blocked touch must not pause combat with a shrine choice');
          assert.equal(await page.locator('#forestGateChoice').isVisible(),false,
            'blocked touch must not pause combat with a gate choice');
          await page.waitForFunction(() => ['IDLE','WALK'].includes(
            window.CrownlessForestReadout?.().player.state),null,{timeout:3000});
          await tapSite(page,'traces');
          const afterTracks=await read(page);
          assert(afterTracks.found.includes('traces'),'walking and touching discovers tracks');
          assert.equal(await page.evaluate(() => window.__forestHapticPatterns.filter(p=>p===34).length),trackCueBefore+1,
            'inspecting an already-pulsed clue must not trigger another proximity pulse');
          assert.match(await returnButton.innerText(),new RegExp('牙'+afterTracks.unbanked+'）'),
            'the return choice updates even when the clue hint takes priority');
          await page.waitForFunction(()=>document.getElementById('forestExploreHint')?.textContent?.includes('足跡は二手に分かれ、途切れた'));
          assert.ok((await page.locator('#forestExploreHint').innerText()).includes('どちらを追う？（調査負傷 -3）'),
            'discovering tracks should immediately reveal the safer next choice');
          // Capture the actual phone canvas with the earned fork in view;
          // this is visual evidence, not a claim that the signs are readable.
          await page.screenshot({path:path.join(output,'pixel-forest-fork-390.png')});
          // Inspect the earned early cue *before* the shrine guardian can
          // pull the hero near the gate and legitimately trigger it.
          const gateCueBefore=await page.evaluate(() => window.__forestHapticPatterns.filter(p=>Array.isArray(p) && p.join(',')==='28,45,28').length);
          await walkTo(page,850,260);
          const earlyGate=await read(page);
          assert(Math.hypot(earlyGate.player.x-910,earlyGate.player.z-235)>54,
            'the earned gate pulse must precede the normal touch radius');
          assert.equal(await page.evaluate(() => window.__forestHapticPatterns.filter(p=>Array.isArray(p) && p.join(',')==='28,45,28').length),
            gateCueBefore+1,'reading tracks gives one distinctive early gate vibration');
          assert(!earlyGate.found.includes('hollow'),'the vibration cannot auto-discover the gate');
          const gateNearPulseBefore=await page.evaluate(() => window.__forestHapticPatterns.filter(p=>p===34).length);
          await walkTo(page,910,235);
          assert.equal(await page.evaluate(() => window.__forestHapticPatterns.filter(p=>p===34).length),
            gateNearPulseBefore+1,'reaching the still-unexamined gate confirms the earlier two-beat cue once');
          await page.waitForTimeout(200);
          assert.equal(await page.evaluate(() => window.__forestHapticPatterns.filter(p=>p===34).length),
            gateNearPulseBefore+1,'staying by the gate must not repeat the confirmation');
          assert(!(await read(page)).found.includes('hollow'),
            'neither the distant nor near haptic may auto-discover the hidden gate');
          const shrineBeforeForge=await verifyTracksShrineRisk(page,false);
          assert.match(await returnButton.innerText(),new RegExp('牙'+shrineBeforeForge.provisionalAfter+'）'),
            'the shrine reward is reflected in the still-available return choice');
          const pulsesBeforeGate=await page.evaluate(() => window.__forestHapticPatterns.length);
          await walkTo(page,910,235);
          assert.equal(await page.evaluate(() => window.__forestHapticPatterns.length),
            pulsesBeforeGate,'approaching the actual gate cannot repeat its early cue');
          const lockedBefore=await read(page);
          const gateHint=await page.locator('#forestExploreHint').innerText();
          assert.match(gateHint,/茨の奥で何かが軋む/,'the gate first offers a sensory clue');
          assert.doesNotMatch(gateHint,/風裂きの剣|鍛冶/,'the gate must be inspected before spoiling its solution');
          await tapSite(page,'hollow');
          const unarmedGate=page.locator('#forestGateChoice');
          assert(await unarmedGate.isVisible(),
            'without a sword, inspecting the gate offers the reachable herbs instead of a dead end');
          assert.equal(await page.locator('#forestGateMaterial').isDisabled(),true,
            'unforged explorers cannot take the thorn-blocked two-fang reward');
          const barehandChoice=page.locator('#forestGateCautious');
          assert.equal(await barehandChoice.isEnabled(),true,
            'without a sword the player may risk six HP for one unsecured fang');
          assert.match(await barehandChoice.innerText(),/素手で慎重に牙を拾う.*HP -6.*未帰還素材 \+1/,
            'the phone must preview the real barehand wound and reward');
          const barehandBounds=await barehandChoice.boundingBox();
          assert(barehandBounds && barehandBounds.width>=44 && barehandBounds.height>=44,
            'the new swordless alternative must be thumb-sized');
          assert.equal(await page.locator('#forestGateHeal').isEnabled(),true,
            'a wounded explorer can use the herbs without forging a sword');
          const unarmedGateBounds=await page.locator('#forestGateChoice > div').boundingBox();
          assert(unarmedGateBounds && unarmedGateBounds.y>=0 &&
            unarmedGateBounds.y+unarmedGateBounds.height<=page.viewportSize().height,
            'the swordless herb choice fits the 390px phone viewport');
          await page.screenshot({path:path.join(output,'pixel-forest-unforged-gate-herbs-390.png')});
          await page.locator('#forestGateCancel').click();
          const locked=await read(page);
          assert(!locked.found.includes('hollow'),'declining the swordless herb choice keeps the gate unspent');
          assert.equal(locked.unbanked,lockedBefore.unbanked,'locked hollow grants no material');
          await page.screenshot({path:path.join(output,'pixel-forest-hollow-locked.png')});
          // Complete the swordless herb alternative through actual phone input.
          // Declining once leaves the gate available; taking herbs must not
          // also grant the optional, injury-costly barehand fang.
          await tapSite(page,'hollow');
          assert.equal(await unarmedGate.isVisible(),true,
            'canceling the gate decision must allow a later real inspection');
          const beforeSwordlessHerbs=await read(page);
          assert.equal(beforeSwordlessHerbs.crafted,false);
          assert(beforeSwordlessHerbs.player.hp<beforeSwordlessHerbs.player.maxHp,
            'the real shrine risk must leave a wound that herbs can heal');
          const herbs=page.locator('#forestGateHeal');
          const herbsBounds=await herbs.boundingBox();
          assert(herbsBounds && herbsBounds.width>=44 && herbsBounds.height>=44 &&
            herbsBounds.y>=0 && herbsBounds.y+herbsBounds.height<=page.viewportSize().height,
            'the swordless herb action must remain thumb-sized and visible');
          await page.touchscreen.tap(herbsBounds.x+herbsBounds.width/2,
            herbsBounds.y+herbsBounds.height/2);
          const afterSwordlessHerbs=await read(page);
          assert(afterSwordlessHerbs.found.includes('hollow'),
            'swordless healing must spend the gate choice once');
          assert.equal(afterSwordlessHerbs.unbanked,beforeSwordlessHerbs.unbanked,
            'herbs must not bypass the sword requirement to award fangs');
          assert.equal(afterSwordlessHerbs.player.hp,
            Math.min(beforeSwordlessHerbs.player.maxHp,beforeSwordlessHerbs.player.hp+45),
            'real swordless herb touch must heal at most 45 HP');
          assert.equal(await unarmedGate.isVisible(),false,
            'the choice sheet closes after using the herbs');
          await tapSite(page,'hollow');
          assert.equal((await read(page)).unbanked,afterSwordlessHerbs.unbanked,
            'a second gate tap cannot farm the blocked reward');
          assert.equal(await unarmedGate.isVisible(),false,
            'a consumed gate cannot offer another herb or material choice');
          await page.screenshot({path:path.join(output,'pixel-forest-swordless-herbs-used-390.png')});
          await page.locator('#rpgOpenResults').click();
          await page.locator('#rpgReturn').click();
          const returned=await read(page);
          assert.equal(returned.phase,'camp');
          assert.equal(returned.unbanked,0);
          assert.equal(await returnButton.isVisible(),false,'the return choice disappears after banking loot');
          assert(returned.banked>=4,'real safe return banks combat and discovery materials');
          await page.locator('#rpgForge').click();
          const forged=await read(page);
          assert.equal(forged.crafted,true);
          assert.equal(forged.banked,returned.banked-3);
          const revisitLabel=await page.locator('#rpgDepart').innerText();
          assert.match(revisitLabel,/もう一度、森へ遠征/,
            'after using the swordless gate herbs, camp must not promise an undiscovered destination');
          assert.doesNotMatch(revisitLabel,/足跡の先を確かめ|石門|隠し道|開通/,
            'the next-trip action must not treat an already inspected gate as an undiscovered secret');
          const departBounds=await page.locator('#rpgDepart').boundingBox();
          assert(departBounds && departBounds.x>=0 &&
            departBounds.x+departBounds.width<=page.viewportSize().width &&
            departBounds.y+departBounds.height<=page.viewportSize().height,
            'the earned next-trip action remains reachable on a 390px phone');
          await page.screenshot({path:path.join(output,'pixel-forest-forged.png')});
          await page.locator('#rpgDepart').click();
          const second=await clearWave(page);
          assert.equal(await page.locator('#rpgPanel').isVisible(),false,'victory leaves forest playable');
          await walkTo(page,800,365);
          await tapSite(page,'traces');
          const shrineAfterForge=await verifyTracksShrineRisk(page,true);
          await walkTo(page,910,235);
          const hollowBefore=await read(page);
          await tapSite(page,'hollow');
          const gatePanel=page.locator('#forestGateChoice');
          assert(await gatePanel.isVisible(),'the crafted gate offers an explicit reward-or-healing choice');
          const gateStakes=await page.locator('#forestGateStakes').innerText();
          assert.match(gateStakes,/生還時だけ倉庫に残り/,
            'the gate choice explains that loot is still unsecured');
          const temperCost=await page.evaluate(()=>window.CrownlessRpgLoop.TEMPER_COST);
          if(hollowBefore.banked>=temperCost) {
            assert.match(gateStakes,/倉庫の牙だけで剣を研ぎ直せる/,
              'already-banked materials must be distinguished from risky new loot');
          } else if(hollowBefore.banked+hollowBefore.unbanked>=temperCost) {
            assert.match(gateStakes,/生還すれば剣の研ぎ直し素材が揃う（今は未帰還）/,
              'a full provisional bag must still require safe return');
          } else {
            const need=temperCost-hollowBefore.banked-hollowBefore.unbanked;
            assert.match(gateStakes,new RegExp('剣の研ぎ直しまで牙あと'+need+'個'),
              'the gate must show the actual remaining upgrade requirement');
          }
          const gateStakesBounds=await page.locator('#forestGateChoice > div').boundingBox();
          assert(gateStakesBounds && gateStakesBounds.y>=0 &&
            gateStakesBounds.y+gateStakesBounds.height<=page.viewportSize().height,
            'the real upgrade warning must fit the phone before a choice is tapped');
          await page.screenshot({path:path.join(output,'pixel-forest-gate-upgrade-stakes-390.png')});
          await page.locator('#forestGateCancel').click();
          assert(!(await read(page)).found.includes('hollow'),'declining the gate does not spend its one visit');
          await tapSite(page,'hollow');
          const gateMaterial=page.locator('#forestGateMaterial');
          const gateCautious=page.locator('#forestGateCautious');
          assert.equal(await gateCautious.isEnabled(),hollowBefore.player.hp>=4,
            'cautious salvage must be nonlethal and available before the costly route');
          assert.match(await gateCautious.innerText(),/HP -3.*未帰還素材 \+1/,
            'the real phone panel must explain the one-fang safer alternative');
          assert.equal(await gateMaterial.isEnabled(),hollowBefore.player.hp>=9,
            'material salvage must require at least one surviving HP');
          assert.match(await gateMaterial.innerText(),/HP -8.*未帰還素材 \+2/,
            'the actual phone choice must disclose the thorn wound before tapping');
          await gateMaterial.click();
          const unlocked=await read(page);
          assert(unlocked.found.includes('hollow'),'crafted sword opens a real revisitable discovery');
          assert.equal(unlocked.unbanked,hollowBefore.unbanked+2,'gate materials remain at risk until return');
          assert.equal(unlocked.player.hp,hollowBefore.player.hp-8,
            'choosing the extra materials must pay the visible thorn wound');
          await tapSite(page,'hollow');
          assert.equal((await read(page)).unbanked,unlocked.unbanked,'same-run discovery cannot duplicate materials');
          await page.screenshot({path:path.join(output,'pixel-forest-hollow-open.png')});
          await page.locator('#rpgOpenResults').click();
          await page.locator('#rpgReturn').click();
          const banked=await read(page);
          await page.reload({waitUntil:'domcontentloaded'});
          await page.waitForFunction(()=>window.CrownlessForestReadout?.().assetsReady);
          const restored=await read(page);
          assert.equal(restored.crafted,true,'actual forged weapon survives reload');
          assert.equal(restored.banked,banked.banked,'actual safely returned materials survive reload');
          assert.equal(restored.unbanked,0);
          assert.equal(await page.evaluate(()=>localStorage.getItem('crownless-expedition-v1-demo')),saveBefore,
            'action loop must preserve the main location-game save');
          // The other gate choice must be genuinely playable, not merely a
          // rule-unit success. Reload deliberately begins a fresh fight while
          // retaining banked materials and the forged sword. Earn an injury
          // through real input, then trade the gate's two fangs for its herbs.
          assert.equal(restored.phase,'fight',
            'reloading a saved camp starts a fresh expedition with no unsecured loot');
          await clearWave(page);
          await walkTo(page,800,365);
          await tapSite(page,'traces');
          const forgedDodge=await verifyTracksShrineRisk(page,true,{dodgeGuardian:true});
          assert.equal(shrineAfterForge.crafted,forgedDodge.crafted,
            'both tactical comparisons use the same forged equipment');
          assert.equal(shrineAfterForge.cost,forgedDodge.cost,
            'both tactical comparisons pay the same scouted shrine risk');
          assert.equal(shrineAfterForge.guardian.attackOnlyGuardian,true);
          assert.equal(forgedDodge.guardian.attackOnlyGuardian,true);
          assert.equal(shrineAfterForge.guardian.guardianCounterClaimed,false);
          assert.equal(forgedDodge.guardian.guardianCounterClaimed,true);
          // Separate damage before the earned counter from damage after it.
          // A successful swipe alone must not be reported as damage prevention.
          const dodgeLossBeforeCounter=Math.max(0,
            forgedDodge.guardian.hpAtStart-forgedDodge.counterEvidence.hpAtCounter);
          const dodgeLossAfterCounter=Math.max(0,
            forgedDodge.counterEvidence.hpAtCounter-forgedDodge.guardian.hpAtEnd);
          assert.equal(dodgeLossBeforeCounter+dodgeLossAfterCounter,
            forgedDodge.guardian.hpLostFromRisk,
            'the real HP delta must reconcile across the dodge/counter boundary');
          report.guardianStrategyComparison={
            attackOnly:{hpLost:shrineAfterForge.guardian.hpLostFromRisk,
              damageEvents:shrineAfterForge.guardian.damageEvents},
            dodgeCounter:{hpLost:forgedDodge.guardian.hpLostFromRisk,
              hpLostBeforeCounter:dodgeLossBeforeCounter,
              hpLostAfterCounter:dodgeLossAfterCounter,
              retreat:forgedDodge.counterEvidence.retreat,
              damageBeforeCounter:forgedDodge.counterEvidence.damageEvents,
              damageAfterCounter:forgedDodge.guardian.damageEvents},
            note:'Separate expeditions; HP/AI timing may differ. No fun claim.'
          };
          await walkTo(page,910,235);
          const beforeGateHeal=await read(page);
          assert(beforeGateHeal.player.hp<beforeGateHeal.player.maxHp,
            'a real risky shrine investigation leaves a wound to heal');
          await tapSite(page,'hollow');
          assert(await page.locator('#forestGateChoice').isVisible(),
            'the third expedition can deliberately revisit the gate');
          assert.equal(await page.locator('#forestGateHeal').isDisabled(),false,
            'injured adventurers can choose the gate herbs');
          const gateBounds=await page.locator('#forestGateChoice > div').boundingBox();
          assert(gateBounds && gateBounds.y>=0 &&
            gateBounds.y+gateBounds.height<=page.viewportSize().height,
            'the healing-or-material choice remains touch-reachable on a 390px phone');
          await page.screenshot({path:path.join(output,'pixel-forest-gate-healing-choice-390.png')});
          await page.locator('#forestGateHeal').click();
          const afterGateHeal=await read(page);
          assert(afterGateHeal.found.includes('hollow'),'using the herbs consumes the gate for this expedition');
          assert.equal(afterGateHeal.unbanked,beforeGateHeal.unbanked,
            'healing never grants the alternative provisional material');
          assert(Math.abs(afterGateHeal.player.hp-
            Math.min(beforeGateHeal.player.maxHp,beforeGateHeal.player.hp+45))<0.01,
            'real touch heals up to 45 HP, never beyond max HP');
          await tapSite(page,'hollow');
          assert.equal((await read(page)).unbanked,beforeGateHeal.unbanked,
            'the used gate cannot be tapped again to claim its alternative reward');
          await page.locator('#rpgOpenResults').click();
          await page.locator('#rpgReturn').click();
          const gateHealedReturn=await read(page);
          assert.equal(gateHealedReturn.phase,'camp');
          assert.equal(gateHealedReturn.banked,banked.banked+beforeGateHeal.unbanked,
            'safe return banks only the actually gathered materials');
          await page.reload({waitUntil:'domcontentloaded'});
          await page.waitForFunction(()=>window.CrownlessForestReadout?.().assetsReady);
          assert.equal((await read(page)).banked,gateHealedReturn.banked,
            'materials from the healing route survive a real save/reload');
          // Complete the newly added cautious route with genuine phone touches:
          // no state injection, no free banked material, and no duplicate pickup.
          const afterHealingReload=await read(page);
          assert.equal(afterHealingReload.phase,'fight',
            'the current save restarts combat without restoring unsecured loot');
          await clearWave(page);
          await walkTo(page,800,365);
          await tapSite(page,'traces');
          await walkTo(page,910,235);
          const beforeCautious=await read(page);
          assert(beforeCautious.player.hp>=4,
            'cautious salvage needs enough HP to survive its visible 3-point cost');
          await tapSite(page,'hollow');
          const cautiousButton=page.locator('#forestGateCautious');
          assert(await cautiousButton.isEnabled(),'the cautious option is actionable on a real 390px phone');
          const cautiousBounds=await cautiousButton.boundingBox();
          assert(cautiousBounds && cautiousBounds.width>=44 && cautiousBounds.height>=44,
            'cautious salvage needs a thumb-sized touch target');
          assert(cautiousBounds.y>=0 &&
            cautiousBounds.y+cautiousBounds.height<=page.viewportSize().height,
            'the cautious choice must fit inside the phone viewport');
          await page.screenshot({path:path.join(output,'pixel-forest-gate-cautious-choice-390.png')});
          await page.touchscreen.tap(cautiousBounds.x+cautiousBounds.width/2,
            cautiousBounds.y+cautiousBounds.height/2);
          const afterCautious=await read(page);
          assert(afterCautious.found.includes('hollow'),'a cautious salvage consumes the gate once');
          assert.equal(afterCautious.unbanked,beforeCautious.unbanked+1,
            'one cautious touch grants exactly one provisional fang');
          assert.equal(afterCautious.player.hp,beforeCautious.player.hp-3,
            'the cautious option must charge the advertised HP cost');
          await tapSite(page,'hollow');
          assert.equal((await read(page)).unbanked,afterCautious.unbanked,
            'repeat taps cannot farm cautious materials');
          await page.locator('#rpgOpenResults').click();
          await page.locator('#rpgReturn').click();
          const cautiousReturn=await read(page);
          assert.equal(cautiousReturn.phase,'camp');
          assert.equal(cautiousReturn.unbanked,0,'safe return clears the provisional bag');
          assert.equal(cautiousReturn.banked,gateHealedReturn.banked+beforeCautious.unbanked+1,
            'only the actual cautious material and earned combat loot reach the warehouse');
          // Complete the existing sword-tempering progression with actual
          // phone input, not only a synthetic localStorage fixture. The five
          // fangs must be banked before the smith can consume them.
          assert(cautiousReturn.banked>=5,'the completed expeditions earned tempering materials');
          const temperButton=page.locator('#rpgTemper');
          assert.equal(await temperButton.isEnabled(),true,
            'the smith can temper only after a living return with enough fangs');
          await temperButton.scrollIntoViewIfNeeded();
          const temperBounds=await temperButton.boundingBox();
          assert(temperBounds && temperBounds.width>=44 && temperBounds.height>=44 &&
            temperBounds.x>=0 && temperBounds.y>=0 &&
            temperBounds.x+temperBounds.width<=page.viewportSize().width &&
            temperBounds.y+temperBounds.height<=page.viewportSize().height,
            'the smith upgrade remains touch-reachable inside the 390px camp sheet');
          await page.screenshot({path:path.join(output,'pixel-forest-temper-choice-390.png')});
          await page.touchscreen.tap(temperBounds.x+temperBounds.width/2,
            temperBounds.y+temperBounds.height/2);
          const temperedCamp=await read(page);
          assert.equal(temperedCamp.tempered,true,'a real smith touch completes the upgrade');
          assert.equal(temperedCamp.crafted,true,'tempering preserves the forged sword');
          assert.equal(temperedCamp.banked,cautiousReturn.banked-5,
            'tempering spends exactly five safely returned fangs');
          assert.equal(temperedCamp.unbanked,0,'the smith never consumes provisional materials');
          assert.equal(await temperButton.isVisible(),false,
            'the one-time upgrade cannot be purchased again');
          await page.reload({waitUntil:'domcontentloaded'});
          await page.waitForFunction(()=>window.CrownlessForestReadout?.().assetsReady);
          const cautiousRestored=await read(page);
          assert.equal(cautiousRestored.banked,temperedCamp.banked,
            'cautious loot less the real smith expense survives reload');
          assert.equal(cautiousRestored.unbanked,0,'reload never duplicates unsecured materials');
          assert.equal(cautiousRestored.crafted,true,'the forged sword survives the cautious route');
          assert.equal(cautiousRestored.tempered,true,'the smith upgrade survives reload');
          assert.equal(cautiousRestored.player.punchPower,19,
            'the next real expedition gets the tempered punch bonus');
          assert.equal(cautiousRestored.player.kickPower,21,
            'the next real expedition gets the tempered kick bonus');
          assert.equal(await page.evaluate(()=>localStorage.getItem('crownless-expedition-v1-demo')),
            saveBefore,'the unrelated location-game save stays untouched');
          // Prove the smith upgrade changes a *later* expedition, not only
          // a static rule preview. Reach the same gate with the saved sword,
          // deliberately choose the risky +2 route and bring the loot home.
          assert.equal(cautiousRestored.phase,'fight',
            'a tempered camp reload starts a new expedition with no unsecured loot');
          await clearWave(page);
          await walkTo(page,800,365);
          await tapSite(page,'traces');
          await walkTo(page,910,235);
          const beforeTemperedGate=await read(page);
          assert(beforeTemperedGate.player.hp>=5,
            'the tempered risky route needs at least five HP to remain nonlethal');
          await tapSite(page,'hollow');
          const temperedGatePanel=page.locator('#forestGateChoice');
          assert(await temperedGatePanel.isVisible(),
            'the upgraded sword opens the same deliberate gate choice on revisit');
          const temperedStakes=await page.locator('#forestGateStakes').innerText();
          assert.match(temperedStakes,/研ぎ直した剣で負傷軽減/,
            'the phone explains why the tempered blade reduces risk');
          assert.doesNotMatch(temperedStakes,/慎重に牙 \+1（|強引に牙 \+2（/,
            'the compact stakes do not repeat costs already visible on the two touch buttons');
          const temperedCautious=page.locator('#forestGateCautious');
          assert(await temperedCautious.isEnabled(),
            'tempered cautious salvage remains available at the real phone decision');
          assert.match(await temperedCautious.innerText(),/負傷なし.*未帰還素材 \+1/,
            'the cautious phone button must not claim an injury that the rules avoid');
          assert.match(temperedStakes,/生還時だけ倉庫に残り/,
            'even a tempered blade cannot bank provisional materials at the gate');
          const temperedMaterial=page.locator('#forestGateMaterial');
          assert(await temperedMaterial.isEnabled(),
            'the reduced-cost risky choice is actually actionable');
          assert.match(await temperedMaterial.innerText(),/HP -4.*未帰還素材 \+2/,
            'the actual tap target advertises the same cost as the rules');
          const temperedBounds=await temperedMaterial.boundingBox();
          assert(temperedBounds && temperedBounds.width>=44 && temperedBounds.height>=44 &&
            temperedBounds.y>=0 &&
            temperedBounds.y+temperedBounds.height<=page.viewportSize().height,
            'the upgraded gate choice stays reachable on a 390px phone');
          await page.screenshot({path:path.join(output,'pixel-forest-tempered-gate-choice-390.png')});
          await page.touchscreen.tap(temperedBounds.x+temperedBounds.width/2,
            temperedBounds.y+temperedBounds.height/2);
          const afterTemperedGate=await read(page);
          assert(afterTemperedGate.found.includes('hollow'),
            'the upgraded risky salvage consumes this expedition gate');
          assert.equal(afterTemperedGate.player.hp,beforeTemperedGate.player.hp-4,
            'the upgraded sword saves four HP on the actual later expedition');
          assert.equal(afterTemperedGate.unbanked,beforeTemperedGate.unbanked+2,
            'the upgraded sword does not duplicate the two provisional fangs');
          await tapSite(page,'hollow');
          assert.equal((await read(page)).unbanked,afterTemperedGate.unbanked,
            'the upgraded gate cannot be harvested twice in one expedition');
          await page.locator('#rpgOpenResults').click();
          await page.locator('#rpgReturn').click();
          const temperedReturn=await read(page);
          assert.equal(temperedReturn.phase,'camp');
          assert.equal(temperedReturn.banked,
            cautiousRestored.banked+beforeTemperedGate.unbanked+2,
            'only a living return banks the upgraded gate reward and combat finds');
          assert.equal(temperedReturn.unbanked,0);
          await page.reload({waitUntil:'domcontentloaded'});
          await page.waitForFunction(()=>window.CrownlessForestReadout?.().assetsReady);
          const temperedRestored=await read(page);
          assert.equal(temperedRestored.tempered,true,
            'the upgraded sword survives another complete return and reload');
          assert.equal(temperedRestored.banked,temperedReturn.banked,
            'the safely banked tempered-gate loot survives reload without duplication');
          assert.equal(temperedRestored.unbanked,0);
          assert.equal(await page.evaluate(()=>localStorage.getItem('crownless-expedition-v1-demo')),
            saveBefore,'the unrelated location-game save remains untouched');
          // Revisit once more with the same saved tempered sword, this time
          // taking the *safe* one-fang choice by a real phone touch. This
          // distinguishes its outcome from the already-tested risky +2 route.
          assert.equal(temperedRestored.phase,'fight',
            'the previous living return can launch another genuine expedition');
          await clearWave(page);
          await walkTo(page,800,365);
          await tapSite(page,'traces');
          await walkTo(page,910,235);
          const beforeTemperedCautious=await read(page);
          await tapSite(page,'hollow');
          const safeChoice=page.locator('#forestGateCautious');
          assert(await safeChoice.isEnabled(),
            'the sharpened sword opens the safe one-fang route on the next expedition');
          assert.match(await safeChoice.innerText(),/負傷なし.*未帰還素材 \+1/,
            'the live choice advertises zero HP loss before the tap');
          const safeBounds=await safeChoice.boundingBox();
          assert(safeBounds && safeBounds.width>=44 && safeBounds.height>=44 &&
            safeBounds.y>=0 && safeBounds.y+safeBounds.height<=page.viewportSize().height,
            'the safe tempered choice is touch-reachable on the 390px phone');
          await page.screenshot({path:path.join(output,'pixel-forest-tempered-safe-choice-390.png')});
          await page.touchscreen.tap(safeBounds.x+safeBounds.width/2,
            safeBounds.y+safeBounds.height/2);
          const afterTemperedCautious=await read(page);
          assert(afterTemperedCautious.found.includes('hollow'),
            'the safe choice consumes the gate only once');
          assert.equal(afterTemperedCautious.player.hp,beforeTemperedCautious.player.hp,
            'the actual safe tempered salvage causes no injury');
          assert.equal(afterTemperedCautious.unbanked,beforeTemperedCautious.unbanked+1,
            'the safe route grants exactly one unsecured fang');
          await tapSite(page,'hollow');
          assert.equal((await read(page)).unbanked,afterTemperedCautious.unbanked,
            'the safe tempered route cannot be repeated for free loot');
          await page.locator('#rpgOpenResults').click();
          await page.locator('#rpgReturn').click();
          const safeReturn=await read(page);
          assert.equal(safeReturn.phase,'camp');
          assert.equal(safeReturn.banked,
            temperedRestored.banked+beforeTemperedCautious.unbanked+1,
            'safe return banks the actual one-fang reward, not the risky two-fang amount');
          assert.equal(safeReturn.unbanked,0);
          await page.reload({waitUntil:'domcontentloaded'});
          await page.waitForFunction(()=>window.CrownlessForestReadout?.().assetsReady);
          const safeRestored=await read(page);
          assert.equal(safeRestored.banked,safeReturn.banked,
            'safe tempered salvage survives reload without duplication');
          assert.equal(safeRestored.tempered,true);
          assert.equal(safeRestored.unbanked,0);
          assert.equal(await page.evaluate(()=>localStorage.getItem('crownless-expedition-v1-demo')),
            saveBefore,'the separate location-game save stays untouched');
          // A later expedition must also prove the tempered sword's *shrine*
          // payoff in the real 390px scene, not just the isolated damage rule.
          // Travel and fight normally; never inject HP, position, loot or saves.
          await clearWave(page);
          await walkTo(page,800,365);
          await tapSite(page,'traces');
          await walkTo(page,660,230);
          const beforeTemperedShrine=await read(page);
          assert.equal(beforeTemperedShrine.phase,'return');
          assert.equal(beforeTemperedShrine.crafted,true);
          assert.equal(beforeTemperedShrine.tempered,true);
          assert(beforeTemperedShrine.found.includes('traces') &&
            !beforeTemperedShrine.found.includes('shrine'));
          await tapSite(page,'shrine');
          const temperedShrineRisk=page.locator('#forestShrineRisk');
          assert(await temperedShrineRisk.isEnabled(),
            'tempered shrine risk must be actionable after the ordinary wave');
          assert.match(await temperedShrineRisk.innerText(),/HP -1.*未帰還素材 \+2/,
            'scouting and tempering must preview the real one-HP wound');
          assert.match(await temperedShrineRisk.innerText(),/追加戦闘あり・撃退まで帰還不可/,
            'the one-HP risk still requires a guardian victory');
          const shrineBounds=await temperedShrineRisk.boundingBox();
          assert(shrineBounds && shrineBounds.width>=44 && shrineBounds.height>=44 &&
            shrineBounds.y>=0 &&
            shrineBounds.y+shrineBounds.height<=page.viewportSize().height,
            'tempered shrine choice must fit the 390px touch viewport');
          await page.screenshot({path:path.join(output,'pixel-forest-tempered-shrine-choice-390.png')});
          await page.touchscreen.tap(shrineBounds.x+shrineBounds.width/2,
            shrineBounds.y+shrineBounds.height/2);
          const afterTemperedShrine=await read(page);
          assert(afterTemperedShrine.found.includes('shrine'),
            'the real touch consumes the one-time shrine choice');
          assert.equal(afterTemperedShrine.player.hp,beforeTemperedShrine.player.hp-1,
            'the tempered and scouted shrine must cost exactly one HP');
          assert.equal(afterTemperedShrine.unbanked,beforeTemperedShrine.unbanked+2,
            'the shrine gives two provisional fangs, never banked loot');
          assert.equal(afterTemperedShrine.phase,'fight',
            'even the tempered blade cannot bypass the optional guardian');
          assert.equal(afterTemperedShrine.enemies.find(e=>e.name==='苔祠の番人')?.scoutOpeningSeconds,1.8,
            'real shrine-first encounter keeps the ordinary scouted 1.8s warning');
          const temperedGuardian=await clearWave(page);
          assert.equal(temperedGuardian.after.phase,'return',
            'guardian victory returns to ordinary exploration');
          await tapSite(page,'shrine');
          assert.equal((await read(page)).unbanked,temperedGuardian.after.unbanked,
            'repeated shrine taps cannot duplicate the reward');
          await page.locator('#rpgOpenResults').click();
          await page.locator('#rpgReturn').click();
          const temperedShrineReturn=await read(page);
          assert.equal(temperedShrineReturn.phase,'camp');
          assert.equal(temperedShrineReturn.banked,
            safeRestored.banked+temperedGuardian.after.unbanked,
            'only the living return banks the entire provisional bag');
          assert.equal(temperedShrineReturn.unbanked,0);
          await page.reload({waitUntil:'domcontentloaded'});
          await page.waitForFunction(()=>window.CrownlessForestReadout?.().assetsReady);
          const temperedShrineRestored=await read(page);
          assert.equal(temperedShrineRestored.tempered,true);
          assert.equal(temperedShrineRestored.banked,temperedShrineReturn.banked,
            'tempered shrine loot must survive reload without duplication');
          assert.equal(temperedShrineRestored.unbanked,0);
          assert.equal(await page.evaluate(()=>localStorage.getItem('crownless-expedition-v1-demo')),
            saveBefore,'the unrelated location save must remain untouched');
          report.temperedShrine={before:beforeTemperedShrine,after:afterTemperedShrine,
            guardian:{hpAfter:temperedGuardian.after.player.hp,
              scoutedFirstHit:temperedGuardian.scoutedFirstHit},
            returned:temperedShrineReturn,restored:temperedShrineRestored};
          // Real 390px gate-first comparison: deliberately inspect the thorn
          // lead before choosing the optional shrine fight. The same tempered
          // sword is used as in the shrine-first run above; no test-only
          // teleport, reward injection, or save edits are permitted.
          assert.equal(temperedShrineRestored.phase,'fight');
          await clearWave(page);
          await walkTo(page,800,365);
          await tapSite(page,'traces');
          await walkTo(page,910,235);
          const gateFirstBefore=await read(page);
          assert(!gateFirstBefore.found.includes('hollow') &&
            !gateFirstBefore.found.includes('shrine'),
            'both fork destinations remain unclaimed before the detour');
          await tapSite(page,'hollow');
          const gateFirstPreview=await page.locator('#forestGateStakes').innerText();
          assert(gateFirstPreview.includes('先手の猶予 +0.6秒'),
            '390px gate-first choice must disclose its earned later reaction advantage before the tap');
          assert(gateFirstPreview.includes('強引な回収・薬草なら効果なし'),
            '390px phone must distinguish cautious scouting from forceful loot and healing');
          assert.doesNotMatch(gateFirstPreview,/苔祠|番人|右|左/,
            'the preview must not spoil the unseen destination or its guardian');
          const gateFirstCautious=page.locator('#forestGateCautious');
          assert(await gateFirstCautious.isEnabled(),
            'the tempered sword opens the nonlethal thorn investigation');
          assert.match(await gateFirstCautious.innerText(),/負傷なし.*未帰還素材 \+1/,
            'the player sees the cost and provisional reward before choosing');
          await gateFirstCautious.click();
          const gateFirstAfter=await read(page);
          assert(gateFirstAfter.found.includes('hollow'),
            'real phone touch, not a cue, discovers the thorn gate');
          assert(gateFirstAfter.found.includes('hollow-scout'),
            'only the actual thorn-salvage tap earns the guardian scouting advantage');
          assert.equal(gateFirstAfter.player.hp,gateFirstBefore.player.hp,
            'the tempered cautious gate detour costs no HP');
          assert.equal(gateFirstAfter.unbanked,gateFirstBefore.unbanked+1,
            'the gate gives one provisional fang, not free banked loot');
          await walkTo(page,660,230);
          await tapSite(page,'shrine');
          const gateFirstStakes=await page.locator('#forestShrineStakes').innerText();
          assert.match(gateFirstStakes,/石門の茨の手がかりで先手の猶予 \+0\.6秒/,
            'the phone choice explains the earned gate-first tactical advantage');
          assert.doesNotMatch(gateFirstStakes,/苔祠の番人/,
            'the choice still conceals the guardian identity');
          await page.screenshot({path:path.join(output,'pixel-forest-gate-first-shrine-390.png')});
          const beforeGateFirstRisk=await read(page);
          await page.locator('#forestShrineRisk').click();
          const gateFirstRisk=await read(page);
          assert.equal(gateFirstRisk.phase,'fight',
            'the tactical advantage cannot bypass the optional guardian');
          assert.equal(gateFirstRisk.enemies.find(e=>e.name==='苔祠の番人')?.scoutOpeningSeconds,2.4,
            'real gate-first encounter earns 2.4s rather than shrine-first 1.8s');
          assert.equal(gateFirstRisk.unbanked,beforeGateFirstRisk.unbanked+2,
            'the shrine reward remains unsecured until survival');
          const gateFirstGuardian=await clearWave(page,{preferScoutedOpening:true});
          assert.equal(gateFirstGuardian.openingObserved,true,
            'cautious gate-first detour must open a real player-actionable warning; trace='+
            JSON.stringify(gateFirstGuardian.scoutTrace));
          assert.equal(gateFirstGuardian.scoutAttackCueSeen,true,
            'the earned 2.4s opening must visibly highlight a reachable phone attack button');
          assert.equal(gateFirstGuardian.scoutedFirstHit,true,
            'cautious gate-first detour must land the earned +12 strike, not just lengthen an unused timer; trace='+
            JSON.stringify(gateFirstGuardian.scoutTrace));
          assert.equal(gateFirstGuardian.gateFirstFeedbackSeen,true,
            'landed gate-first strike must show its earned consequence on the live 390px HUD');
          assert.equal(gateFirstGuardian.after.phase,'return',
            'the gate-first guardian victory returns to ordinary exploration');
          await page.locator('#rpgOpenResults').click();
          await page.locator('#rpgReturn').click();
          const gateFirstReturn=await read(page);
          assert.equal(gateFirstReturn.phase,'camp');
          assert.equal(gateFirstReturn.banked,
            temperedShrineRestored.banked+gateFirstGuardian.after.unbanked,
            'the living return banks only the real provisional materials');
          assert.equal(gateFirstReturn.unbanked,0);
          await page.reload({waitUntil:'domcontentloaded'});
          await page.waitForFunction(()=>window.CrownlessForestReadout?.().assetsReady);
          const gateFirstRestored=await read(page);
          assert.equal(gateFirstRestored.banked,gateFirstReturn.banked,
            'gate-first material banking survives reload without duplication');
          assert.equal(gateFirstRestored.unbanked,0);
          report.forkOrderBrowser={
            shrineFirstWarningSeconds:afterTemperedShrine.enemies.find(e=>e.name==='苔祠の番人').scoutOpeningSeconds,
            gateFirstWarningSeconds:gateFirstRisk.enemies.find(e=>e.name==='苔祠の番人').scoutOpeningSeconds,
            gateBefore:gateFirstBefore,gateAfter:gateFirstAfter,
            returned:gateFirstReturn,restored:gateFirstRestored,
            scoutedFirstHit:gateFirstGuardian.scoutedFirstHit,
            gateFirstFeedbackSeen:gateFirstGuardian.gateFirstFeedbackSeen,
            note:'Both 390px routes used real movement and touch. CI is not a human fun verdict.'
          };
          // Herb-first is the other real decision at the fork. Earn a wound
          // from the ordinary opening wave (never inject HP), then spend the
          // gate on healing before taking the shrine's optional guardian risk.
          // This must NOT award the salvage-only extra 0.6s warning.
          const herbFightStart=await read(page);
          assert.equal(herbFightStart.phase,'fight');
          const woundKeys=new Set();
          let herbWound=null;
          try {
            const woundStarted=Date.now();
            while(Date.now()-woundStarted<18000) {
              const s=await read(page);
              if(s.player.hp<herbFightStart.player.hp) {
                herbWound={before:herbFightStart.player.hp,after:s.player.hp};
                break;
              }
              assert(s.phase==='fight' && s.player.hp>0,
                'herb-first route must earn its injury during a living fight');
              const target=s.enemies.filter(e=>e.hp>0 && e.state!=='DEAD')
                .sort((a,b)=>Math.hypot(a.x-s.player.x,a.z-s.player.z)-
                  Math.hypot(b.x-s.player.x,b.z-s.player.z))[0];
              assert(target,'an ordinary enemy must remain to inflict the wound');
              const dx=target.x-s.player.x,dz=target.z-s.player.z;
              const wanted=[];
              if(Math.abs(dx)>26) wanted.push(dx>0?'d':'a');
              if(Math.abs(dz)>12) wanted.push(dz>0?'s':'w');
              await keys(page,woundKeys,wanted);
              await page.waitForTimeout(90);
            }
          } finally { await keys(page,woundKeys,[]); }
          assert(herbWound,'a real enemy hit must create the herb-first trade-off');
          await clearWave(page);
          await walkTo(page,800,365);
          await tapSite(page,'traces');
          await walkTo(page,910,235);
          const herbBefore=await read(page);
          assert(herbBefore.player.hp<herbBefore.player.maxHp,
            'healing requires an actual combat wound, not an injected state');
          assert(!herbBefore.found.includes('shrine') &&
            !herbBefore.found.includes('hollow'),
            'both choices are still unspent before healing');
          await tapSite(page,'hollow');
          const herbPreview=await page.locator('#forestGateStakes').innerText();
          assert.match(herbPreview,/薬草なら効果なし/,
            'the phone warns that healing forfeits the extra scouting time');
          const herbButton=page.locator('#forestGateHeal');
          assert(await herbButton.isEnabled(),'the real wound enables gate herbs');
          const herbBounds=await herbButton.boundingBox();
          assert(herbBounds && herbBounds.width>=44 && herbBounds.height>=44 &&
            herbBounds.y>=0 && herbBounds.y+herbBounds.height<=page.viewportSize().height,
            'the herb-first choice is touch-reachable on a 390px phone');
          await page.screenshot({path:path.join(output,'pixel-forest-herb-first-choice-390.png')});
          await page.touchscreen.tap(herbBounds.x+herbBounds.width/2,
            herbBounds.y+herbBounds.height/2);
          const herbAfter=await read(page);
          assert(herbAfter.found.includes('hollow') &&
            !herbAfter.found.includes('hollow-scout'),
            'herbs consume the gate but do not grant salvage scouting');
          assert.equal(herbAfter.unbanked,herbBefore.unbanked,
            'herbs cannot also grant provisional fangs');
          assert.equal(herbAfter.player.hp,
            Math.min(herbBefore.player.maxHp,herbBefore.player.hp+45),
            'the chosen herbs restore only the promised HP');
          await walkTo(page,660,230);
          await tapSite(page,'shrine');
          const herbShrineStakes=await page.locator('#forestShrineStakes').innerText();
          assert.doesNotMatch(herbShrineStakes,/石門の茨の手がかりで先手の猶予/,
            'healing cannot claim the other fork\'s combat preparation');
          await page.locator('#forestShrineRisk').click();
          const herbGuardianStart=await read(page);
          assert.equal(herbGuardianStart.phase,'fight');
          assert.equal(herbGuardianStart.enemies.find(e=>e.name==='苔祠の番人')?.scoutOpeningSeconds,1.8,
            'real herb-first guardian warning stays 1.8s, not 2.4s');
          const herbGuardian=await clearWave(page);
          assert.equal(herbGuardian.after.phase,'return',
            'herb-first guardian victory returns to exploration');
          await page.locator('#rpgOpenResults').click();
          await page.locator('#rpgReturn').click();
          const herbReturned=await read(page);
          assert.equal(herbReturned.banked,
            gateFirstRestored.banked+herbGuardian.after.unbanked,
            'only surviving the herb-first route banks its gathered fangs');
          assert.equal(herbReturned.unbanked,0);
          await page.reload({waitUntil:'domcontentloaded'});
          await page.waitForFunction(()=>window.CrownlessForestReadout?.().assetsReady);
          const herbRestored=await read(page);
          assert.equal(herbRestored.banked,herbReturned.banked,
            'herb-first materials persist across reload without duplication');
          assert.equal(herbRestored.unbanked,0);
          report.herbFirstBrowser={wound:herbWound,before:herbBefore,after:herbAfter,
            guardianWarningSeconds:herbGuardianStart.enemies.find(e=>e.name==='苔祠の番人').scoutOpeningSeconds,
            returned:herbReturned,restored:herbRestored,
            note:'Real 390px movement, enemy injury and touch; not evidence of fun.'};
          // Forceful gate-first is a distinct real phone choice: it earns two
          // provisional fangs at an HP cost, but must NOT grant the cautious
          // gate's extra 0.6-second warning. Revisit from a real saved camp;
          // never inject health, loot, position or discovery flags.
          assert.equal(herbRestored.phase,'fight',
            'the forceful comparison starts as a genuine new expedition');
          await clearWave(page);
          await walkTo(page,800,365);
          await tapSite(page,'traces');
          await walkTo(page,910,235);
          const forcefulBefore=await read(page);
          assert.equal(forcefulBefore.tempered,true,
            'forceful and cautious comparison both use the earned tempered sword');
          assert(forcefulBefore.player.hp>=6,
            'the forceful gate and optional shrine must both remain survivable');
          await tapSite(page,'hollow');
          const forcefulStakes=await page.locator('#forestGateStakes').innerText();
          assert.match(await page.locator('#forestGateMaterial').innerText(),/HP -4.*未帰還素材 \+2/,
            'the real phone action button warns of the extra wound for two unsecured fangs');
          assert.match(forcefulStakes,/強引な回収・薬草なら効果なし/,
            'the forceful route explicitly forfeits cautious scouting');
          const forcefulButton=page.locator('#forestGateMaterial');
          assert(await forcefulButton.isEnabled(),
            'the forceful option is available with a crafted sword');
          const forcefulBounds=await forcefulButton.boundingBox();
          assert(forcefulBounds && forcefulBounds.width>=44 && forcefulBounds.height>=44 &&
            forcefulBounds.y>=0 &&
            forcefulBounds.y+forcefulBounds.height<=page.viewportSize().height,
            'the forceful action is reachable on a 390px touch screen');
          await page.screenshot({path:path.join(output,'pixel-forest-forceful-gate-choice-390.png')});
          await page.touchscreen.tap(forcefulBounds.x+forcefulBounds.width/2,
            forcefulBounds.y+forcefulBounds.height/2);
          const forcefulAfter=await read(page);
          assert(forcefulAfter.found.includes('hollow') &&
            !forcefulAfter.found.includes('hollow-scout'),
            'forceful salvage claims the gate but never the cautious scouting flag');
          assert.equal(forcefulAfter.player.hp,forcefulBefore.player.hp-4,
            'the two-fang route pays its advertised real HP cost');
          assert.equal(forcefulAfter.unbanked,forcefulBefore.unbanked+2,
            'forceful salvage grants exactly two provisional fangs');
          assert.equal(forcefulAfter.banked,forcefulBefore.banked,
            'unsecured loot must not enter the warehouse before safe return');
          await tapSite(page,'hollow');
          assert.equal((await read(page)).unbanked,forcefulAfter.unbanked,
            'repeated forceful gate taps cannot duplicate the two fangs');
          await walkTo(page,660,230);
          await tapSite(page,'shrine');
          const forcefulShrineStakes=await page.locator('#forestShrineStakes').innerText();
          assert.doesNotMatch(forcefulShrineStakes,/石門の茨の手がかりで先手の猶予/,
            'forceful salvage cannot claim the cautious combat advantage');
          await page.locator('#forestShrineRisk').click();
          const forcefulGuardianStart=await read(page);
          assert.equal(forcefulGuardianStart.phase,'fight',
            'forceful salvage never bypasses the chosen guardian fight');
          assert.equal(forcefulGuardianStart.enemies.find(e=>e.name==='苔祠の番人')?.scoutOpeningSeconds,1.8,
            'real forceful gate-first combat keeps 1.8s, not cautious 2.4s');
          const forcefulGuardian=await clearWave(page);
          assert.equal(forcefulGuardian.after.phase,'return',
            'guardian victory returns to ordinary exploration');
          await page.locator('#rpgOpenResults').click();
          await page.locator('#rpgReturn').click();
          const forcefulReturned=await read(page);
          assert.equal(forcefulReturned.phase,'camp');
          assert.equal(forcefulReturned.banked,
            herbRestored.banked+forcefulGuardian.after.unbanked,
            'only a living return banks the forceful route and guardian loot');
          assert.equal(forcefulReturned.unbanked,0);
          await page.reload({waitUntil:'domcontentloaded'});
          await page.waitForFunction(()=>window.CrownlessForestReadout?.().assetsReady);
          const forcefulRestored=await read(page);
          assert.equal(forcefulRestored.banked,forcefulReturned.banked,
            'the forceful haul survives save/reload without duplication');
          assert.equal(forcefulRestored.unbanked,0);
          assert.equal(await page.evaluate(()=>localStorage.getItem('crownless-expedition-v1-demo')),
            saveBefore,'the unrelated location save remains untouched');
          report.forcefulGateFirstBrowser={
            before:forcefulBefore,after:forcefulAfter,
            guardianWarningSeconds:forcefulGuardianStart.enemies.find(e=>e.name==='苔祠の番人').scoutOpeningSeconds,
            returned:forcefulReturned,restored:forcefulRestored,
            note:'390px real movement/touch, two-fang trade-off and safe return; not a fun verdict.'
          };
          // Separate fresh-phone expedition: prove the new *unforged* gate
          // alternative with a real touch and a living return. The long
          // crafted/tempered loop above cannot exercise this starter-only choice.
          const barehandContext=await browser.newContext({
            viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2
          });
          try {
            const barehandPage=await barehandContext.newPage();
            const barehandErrors=[];
            barehandPage.on('pageerror',error=>barehandErrors.push(error.message));
            await barehandPage.goto('http://127.0.0.1:'+port+'/expedition.html',
              {waitUntil:'domcontentloaded'});
            await barehandPage.locator('[data-action="mode"][data-value="demo"]').click();
            await barehandPage.locator('[data-action="action-forest-lab"]').first().click();
            await barehandPage.waitForURL('**/gemini-feel-lab.html?from=discovered-wood');
            await barehandPage.waitForFunction(()=>window.CrownlessForestReadout?.().assetsReady,
              null,{timeout:20000});
            await clearWave(barehandPage);
            await walkTo(barehandPage,800,365);
            await tapSite(barehandPage,'traces');
            await walkTo(barehandPage,910,235);
            const beforeBarehand=await read(barehandPage);
            assert.equal(beforeBarehand.crafted,false,
              'fresh starter has no sword before the risky gate choice');
            assert(beforeBarehand.player.hp>=7,
              'real starter must be able to survive the six-point thorn wound');
            await tapSite(barehandPage,'hollow');
            assert.equal(await barehandPage.locator('#forestGateChoice button').first().getAttribute('id'),
              'forestGateCautious',
              'on a real phone the first gate choice must be usable without a forged sword');
            assert.equal(await barehandPage.locator('#forestGateMaterial').isEnabled(),false,
              'the later two-fang route remains a visible but locked smithing goal');
            // Inspect the same live decision at the narrowest supported phone width.
            // Restore 390px before the real touch/return loop to isolate layout
            // regression from movement and combat behavior.
            await barehandPage.setViewportSize({width:360,height:800});
            const narrowGate=barehandPage.locator('#forestGateChoice > div');
            const narrowPanel=await narrowGate.boundingBox();
            assert(narrowPanel && narrowPanel.y>=0 &&
              narrowPanel.y+narrowPanel.height<=800,
              '360px gate stakes and all choices must fit one phone viewport');
            for(const id of ['forestGateCautious','forestGateMaterial',
              'forestGateHeal','forestGateCancel']) {
              const button=barehandPage.locator('#'+id);
              const bounds=await button.boundingBox();
              assert(bounds && bounds.width>=44 && bounds.height>=44 &&
                bounds.x>=0 && bounds.x+bounds.width<=360 &&
                bounds.y>=0 && bounds.y+bounds.height<=800,
                '360px choice must remain visible and touch-sized: '+id);
            }
            assert.equal(await barehandPage.locator('#forestGateCautious').isEnabled(),true,
              '360px starter can still choose the achievable one-fang route');
            assert.equal(await barehandPage.locator('#forestGateMaterial').isEnabled(),false,
              '360px starter sees the future two-fang route without taking it');
            await barehandPage.screenshot({
              path:path.join(output,'pixel-forest-barehand-choice-360.png')
            });
            // A short handset must still allow the player to review the
            // unbanked-loot warning and reach Cancel without scrolling the
            // entire game or accidentally accepting the thorn injury.
            await barehandPage.setViewportSize({width:360,height:420});
            const compactGate=await barehandPage.evaluate(()=>{
              const sheet=document.querySelector('#forestGateChoice > div');
              const rect=sheet.getBoundingClientRect();
              return {top:rect.top,bottom:rect.bottom,scrollHeight:sheet.scrollHeight,
                clientHeight:sheet.clientHeight,viewport:innerHeight};
            });
            assert(compactGate.top>=0 && compactGate.bottom<=compactGate.viewport+1 &&
              compactGate.scrollHeight>compactGate.clientHeight,
              'short-phone gate must scroll inside its sheet: '+JSON.stringify(compactGate));
            await barehandPage.locator('#forestGateCancel').scrollIntoViewIfNeeded();
            const compactGateCancel=await barehandPage.locator('#forestGateCancel').boundingBox();
            assert(compactGateCancel && compactGateCancel.y>=0 &&
              compactGateCancel.y+compactGateCancel.height<=420 &&
              compactGateCancel.height>=44,
              'short-phone gate Cancel must stay touch-reachable after local scroll');
            assert.equal(await barehandPage.locator('#forestGateCautious').isEnabled(),true,
              'scrolling the choice sheet must not consume the one-time salvage choice');
            // A real postponement must leave HP/loot untouched and reopening
            // must start at the decision, not at the old scroll position.
            await barehandPage.locator('#forestGateCancel').click();
            assert.equal(await barehandPage.locator('#forestGateChoice').isVisible(),false,
              'short-phone Cancel returns to exploration without accepting a wound');
            const postponed=await read(barehandPage);
            assert.equal(postponed.player.hp,beforeBarehand.player.hp,
              'postponement must not consume HP');
            assert.equal(postponed.unbanked,beforeBarehand.unbanked,
              'postponement must not grant provisional fangs');
            assert.equal(postponed.found.includes('hollow'),false,
              'postponement must leave the one-time gate available');
            await barehandPage.setViewportSize({width:390,height:844});
            await tapSite(barehandPage,'hollow');
            assert.equal(await barehandPage.locator('#forestGateChoice').isVisible(),true,
              'the postponed gate can be investigated again');
            await barehandPage.setViewportSize({width:360,height:420});
            const reopenedSheet=barehandPage.locator('#forestGateChoice > div');
            assert.equal(await reopenedSheet.evaluate(node=>node.scrollTop),0,
              'reopened short-phone sheet starts at the first choice');
            const reopenedFirst=await barehandPage.locator('#forestGateCautious').boundingBox();
            assert(reopenedFirst && reopenedFirst.y>=0 &&
              reopenedFirst.y+reopenedFirst.height<=420,
              'first viable choice is immediately visible after reopening');
            await barehandPage.setViewportSize({width:390,height:844});
            const forgeCost=await barehandPage.evaluate(()=>window.CrownlessRpgLoop.COST);
            const gateCraftHint=await barehandPage.locator('#forestGateStakes').innerText();
            const stillNeeded=Math.max(0,forgeCost-beforeBarehand.banked-beforeBarehand.unbanked);
            if(beforeBarehand.banked>=forgeCost) {
              assert.match(gateCraftHint,/倉庫の牙だけで鍛冶剣を作れる/,
                'banked materials already afford a first sword without any gate injury');
            } else if(stillNeeded===0) {
              assert.match(gateCraftHint,/生還すれば鍛冶剣の素材が揃う/,
                'the phone must disclose when taking more gate damage is unnecessary for the first sword');
            } else if(stillNeeded===1) {
              assert.match(gateCraftHint,/ここで牙を1個拾って生還すれば、鍛冶剣を作れる/,
                'the real +1 gate choice should visibly complete the first sword recipe');
            } else {
              assert.match(gateCraftHint,new RegExp('鍛冶剣まで牙あと'+stillNeeded+'個'),
                'the swordless gate must show the actual remaining smithing need');
            }
            assert.doesNotMatch(gateCraftHint,/\+2なら残り/,
              'without a sword the gate must not advertise inaccessible two-fang salvage');
            const gateHintBounds=await barehandPage.locator('#forestGateChoice > div').boundingBox();
            assert(gateHintBounds && gateHintBounds.y>=0 &&
              gateHintBounds.y+gateHintBounds.height<=barehandPage.viewportSize().height,
              'first-sword consequence and choices fit the 390px phone viewport');
            const barehandButton=barehandPage.locator('#forestGateCautious');
            assert.equal(await barehandButton.isEnabled(),true);
            assert.match(await barehandButton.innerText(),/素手で慎重に牙を拾う.*HP -6.*未帰還素材 \+1/);
            const barehandTap=await barehandButton.boundingBox();
            assert(barehandTap && barehandTap.height>=44 &&
              barehandTap.y>=0 &&
              barehandTap.y+barehandTap.height<=barehandPage.viewportSize().height,
              'actual swordless salvage touch fits the 390px viewport');
            await barehandPage.screenshot({
              path:path.join(output,'pixel-forest-barehand-choice-390.png')
            });
            await barehandPage.touchscreen.tap(barehandTap.x+barehandTap.width/2,
              barehandTap.y+barehandTap.height/2);
            const afterBarehand=await read(barehandPage);
            assert(afterBarehand.found.includes('hollow'),
              'real barehand tap must consume the one-time gate choice');
            assert.equal(afterBarehand.player.hp,beforeBarehand.player.hp-6,
              'real barehand salvage must pay the advertised six HP');
            assert.equal(afterBarehand.unbanked,beforeBarehand.unbanked+1,
              'real barehand salvage grants exactly one provisional fang');
            await tapSite(barehandPage,'hollow');
            assert.equal((await read(barehandPage)).unbanked,afterBarehand.unbanked,
              'touching a consumed gate cannot duplicate the barehand fang');
            assert.equal(await barehandPage.locator('#forestGateChoice').isVisible(),false);
            await barehandPage.locator('#rpgOpenResults').click();
            await barehandPage.locator('#rpgReturn').click();
            const barehandReturn=await read(barehandPage);
            assert.equal(barehandReturn.phase,'camp');
            assert.equal(barehandReturn.banked,afterBarehand.unbanked,
              'living return must bank the exact provisional bag, including barehand loot');
            await barehandPage.reload({waitUntil:'domcontentloaded'});
            await barehandPage.waitForFunction(()=>window.CrownlessForestReadout?.().assetsReady,
              null,{timeout:20000});
            const barehandRestored=await read(barehandPage);
            assert.equal(barehandRestored.banked,barehandReturn.banked,
              'the swordless salvage reward survives reload');
            assert.equal(barehandRestored.unbanked,0,
              'reload never duplicates provisional fangs');
            assert.deepEqual(barehandErrors,[],'swordless touch path has no browser errors');
            report.barehandGate={before:beforeBarehand,after:afterBarehand,
              returned:barehandReturn,restored:barehandRestored};
          } catch(error) {
            const pages=barehandContext.pages();
            if(pages[0]) await pages[0].screenshot({
              path:path.join(output,'pixel-forest-barehand-failure-390.png')
            }).catch(()=>{});
            throw error;
          } finally { await barehandContext.close(); }
          report.loop={first,shrineBeforeForge,locked,gateHerbsBeforeForge:{before:beforeSwordlessHerbs,after:afterSwordlessHerbs},returned,forged,second,shrineAfterForge,forgedDodge,unlocked,banked,restored,
            gateHealing:{before:beforeGateHeal,after:afterGateHeal,returned:gateHealedReturn},
            gateCautious:{before:beforeCautious,after:afterCautious,returned:cautiousReturn,restored:cautiousRestored},
            temperedCamp,temperedGate:{before:beforeTemperedGate,after:afterTemperedGate,returned:temperedReturn,restored:temperedRestored},
            temperedSafeGate:{before:beforeTemperedCautious,after:afterTemperedCautious,returned:safeReturn,restored:safeRestored}};
        }
        assert.deepEqual(errors,[],'no browser runtime errors');
      } catch(error) {
        await page.screenshot({path:path.join(output,'pixel-forest-failure-'+width+'.png')}).catch(()=>{});
        throw error;
      } finally { await context.close(); }
    }
    report.passed=true;
    await fs.writeFile(path.join(output,'pixel-forest-report.json'),JSON.stringify(report,null,2)+'\n');
    console.log('Pixel forest: 360/390/430px aspect + touch; real combat → discovery → swordless gate herbs → return → forge → revisit → hollow (material/heal/cautious) → temper → revisited gate (-4 HP/+2 fangs) → safe tempered gate (0 HP/+1 fang) → return/reload PASS');
    console.log(JSON.stringify(report,null,2));
  } finally {
    if(browser) await browser.close();
    server.kill();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
