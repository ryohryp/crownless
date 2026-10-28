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
  let stage='first-hit',jumpSeen=false,dodgeSeen=false,phoneCueSeen=false;
  const trace=[];
  const startingHp=(await read(page)).player.hp;
  let previousHp=startingHp;
  const damageEvents=[];
  // Prepare the CDP touch channel before the short warning starts. Opening
  // a new session during the 0.65s tell could consume the dodge window.
  const bounds=await page.locator('#gestureActionArea').boundingBox();
  const touch=await page.context().newCDPSession(page);
  try {
    while(Date.now()-started<14000) {
      const {s,gestureCue}=await page.evaluate(()=>({
        s:window.CrownlessForestReadout(),
        gestureCue:document.getElementById('gestureHint')?.classList.contains('guardian-dodge-cue')
          ? document.getElementById('gestureHint').textContent : ''
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
      if(stage==='tell' && enemy.guardianTellUntil-s.nowSec>0.2 &&
          gestureCue.includes('↑スワイプで跳躍回避')) phoneCueSeen=true;
      if(stage==='jump' && s.player.state==='JUMP') jumpSeen=true;
      if(stage==='jump' && enemy.guardianCounterUntil>s.nowSec) {
        assert(jumpSeen,'the counter must follow a genuine touch-swipe jump');
        dodgeSeen=true;
        stage='counter';
      }
      if(stage==='counter' && enemy.guardianCounterClaimed) {
        assert(dodgeSeen && jumpSeen,'counter must follow the visible jump dodge');
        assert(phoneCueSeen,'the real phone control must show the targeted jump instruction');
        // The earned 0.9s recovery must be legible in the live 390px HUD,
        // not just in a pure-function test or a transient floating popup.
        await page.waitForFunction(() =>
          document.getElementById('forestExploreHint')?.textContent?.includes('追撃はタップ／退避は左パッド'),
          null,{timeout:650});
        const retreat=await retreatAfterCounter(page,touch);
        return {jumpSeen,dodgeSeen,phoneCueSeen,repositionCueSeen:true,counterClaimed:true,
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
async function clearWave(page,{attackOnlyGuardian=false}={}) {
  const held = new Set();
  const start = Date.now();
  const before = await read(page);
  let minimumHp = before.player.hp;
  let scoutedFirstHit = false;
  let guardianTellSeen = false;
  let guardianCounterClaimed = false;
  let previousHp=before.player.hp;
  const damageEvents=[];
  const scoutTrace = [];
  try {
    while (Date.now() - start < 75000) {
      const s = await read(page);
      minimumHp = Math.min(minimumHp, s.player.hp);
      scoutedFirstHit ||= s.enemies.some(e => e.name === '苔祠の番人' && e.scoutStrikeClaimed);
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
        minimumHp, hpLost:before.player.hp-minimumHp, scoutedFirstHit,
        attackOnlyGuardian, guardianTellSeen, guardianCounterClaimed,
        damageEvents,scoutTrace, after:s };
      assert(s.phase === 'fight' && s.player.hp > 0,
        'real-input combat ended in defeat: ' + JSON.stringify(s));
      assert(Array.isArray(s.enemies), 'read-only probe must expose enemy positions');
      const target = s.enemies.filter(e => e.hp > 0 && e.state !== 'DEAD')
        .sort((a,b) => Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z))[0];
      // Use the real grab/throw input when the guardian closes in, rather
      // than relying on an unbroken kick hold against its stronger attacks.
      // Normal enemies retain the baseline kick-only screening path.
      const grappleGuardian=!attackOnlyGuardian && target?.name==='苔祠の番人' && !target.scoutOpeningActive &&
        Math.abs(target.x-s.player.x)<42 && Math.abs(target.z-s.player.z)<20;
      const wanted = [grappleGuardian?'l':'k'];
      if (target?.name === '苔祠の番人' && scoutTrace.length < 35) {
        scoutTrace.push({ms:Date.now()-start, gap:Math.round(Math.hypot(target.x-s.player.x,target.z-s.player.z)),
          hero:s.player.state, guardian:target.state, guardianHp:Math.ceil(target.hp),
          opening:target.scoutOpeningActive, claimed:target.scoutStrikeClaimed, input:wanted[0]});
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
  // The starter encounter must demonstrate the actual input-driven
  // jump→evade→landed counter, not only isolated rules and HUD wiring.
  const counterEvidence=wasClear && (!crafted || dodgeGuardian) ? await jumpCounterGuardian(page) : null;
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
          await page.waitForFunction(()=>document.getElementById('forestExploreHint')?.textContent?.includes('足跡は右奥へ続いている'));
          assert.match(await page.locator('#forestExploreHint').innerText(),/安全な足場を発見（危険な調査の負傷 -3）/,
            'discovering tracks should immediately reveal the safer next choice');
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
          assert.equal(await page.locator('#forestGateCautious').isDisabled(),true,
            'unforged explorers cannot take the thorn-blocked cautious reward');
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
          // Complete the swordless alternative through actual phone input.
          // Declining once leaves herbs available; taking them must not grant
          // the fang reward locked behind the crafted sword.
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
          assert.match(temperedStakes,/慎重に牙 \+1（負傷なし）、強引に牙 \+2（HP -4）／研ぎ直した剣で負傷軽減/,
            'the phone offers a genuine no-wound vs two-fang risk choice after tempering');
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
          report.loop={first,shrineBeforeForge,locked,gateHerbsBeforeForge:{before:beforeSwordlessHerbs,after:afterSwordlessHerbs},returned,forged,second,shrineAfterForge,forgedDodge,unlocked,banked,restored,
            gateHealing:{before:beforeGateHeal,after:afterGateHeal,returned:gateHealedReturn},
            gateCautious:{before:beforeCautious,after:afterCautious,returned:cautiousReturn,restored:cautiousRestored},
            temperedCamp,temperedGate:{before:beforeTemperedGate,after:afterTemperedGate,returned:temperedReturn,restored:temperedRestored}};
        }
        assert.deepEqual(errors,[],'no browser runtime errors');
      } catch(error) {
        await page.screenshot({path:path.join(output,'pixel-forest-failure-'+width+'.png')}).catch(()=>{});
        throw error;
      } finally { await context.close(); }
    }
    report.passed=true;
    await fs.writeFile(path.join(output,'pixel-forest-report.json'),JSON.stringify(report,null,2)+'\n');
    console.log('Pixel forest: 360/390/430px aspect + touch; real combat → discovery → swordless gate herbs → return → forge → revisit → hollow (material/heal/cautious) → temper → revisited gate (-4 HP/+2 fangs) → safe return/reload PASS');
    console.log(JSON.stringify(report,null,2));
  } finally {
    if(browser) await browser.close();
    server.kill();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
