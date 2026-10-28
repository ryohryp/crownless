/* Small forest discoveries inside the existing action scene.
 * All rewards are run-local until a living return; never persists GPS or visit logs.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.CrownlessForestDiscoveries=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const spots=Object.freeze([
    Object.freeze({id:'traces',x:800,z:365,label:'獣の痕跡',kind:'material',clue:'湿った土の筋'}),
    Object.freeze({id:'shrine',x:660,z:230,label:'苔むす祠',kind:'healing',clue:'苔の冷気'}),
    Object.freeze({id:'hollow',x:910,z:235,label:'茨の石門',kind:'cache',clue:'茨の軋み'})
  ]);
  const RANGE=54;
  // Cutting salvage free of the thorn gate hurts even with a forged blade.
  // This is the cost of taking fangs instead of choosing the healing herbs.
  const GATE_SALVAGE_DAMAGE=8;
  const GATE_CAUTIOUS_DAMAGE=3;
  function near(player,found){
    if(!player) return null;
    return spots.find(spot=>
      !found.has(spot.id) &&
      Math.hypot(player.x-spot.x,player.z-spot.z)<RANGE
    )||null;
  }
  // The forest render uses world coordinates translated by cameraX.
  // A site occupies more than its tiny base: its name, icon and "tap" label
  // must all be easy to hit by a thumb on the real phone viewport.
  function spotAtTap(point, rect, canvas, cameraX, groundHeightAt) {
    if (!point || !rect || !canvas || !(rect.width>0) || !(rect.height>0) ||
        !(canvas.width>0) || !(canvas.height>0) ||
        !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    const rx=point.x-rect.left, ry=point.y-rect.top;
    if(rx<0 || ry<0 || rx>rect.width || ry>rect.height) return null;
    const worldX=rx*canvas.width/rect.width+cameraX;
    const screenY=ry*canvas.height/rect.height;
    return spots.find(spot=>{
      const ground=spot.z-groundHeightAt(spot.x,spot.z);
      return Math.abs(worldX-spot.x)<=55 &&
        screenY>=ground-108 && screenY<=ground+22;
    })||null;
  }
  // Reading tracks sharpens the player's sense of a distant, still-hidden
  // stone gate. This is only a tactile cue: interaction remains at RANGE,
  // and no route, label, or walkability is revealed early.
  function cueNear(player,found){
    if(!player) return null;
    return spots.find(spot=>
      !found.has(spot.id) &&
      Math.hypot(player.x-spot.x,player.z-spot.z) <
        (spot.id==='hollow' && found.has('traces') ? 90 : RANGE)
    )||null;
  }
  function available(phase){
    return phase==='fight'||phase==='return';
  }
  // A downed or restrained explorer must recover before opening a choice
  // sheet that pauses combat. Rejected taps never consume the find.
  function canInspect(player,phase){
    return Boolean(player && available(phase) &&
      !['DEAD','HURT','DOWN','GRAB','ATTACK','SPECIAL','JUMP'].includes(player.state));
  }
  // Reading the animal tracks reveals firmer footing around the shrine.
  // This optional detour changes the risk, without locking out first-time explorers.
  // Reading the tracks also gives a brief reaction window before the optional guardian closes in.
  // This is not a path reveal or a bypass: the guardian must still be defeated to return.
  function guardianApproachDistance(found){
    return found.has('traces') ? 170 : 105;
  }
  // Reading the tracks also warns of the guardian's first lunge. This only
  // buys a short opening to reposition; it does not skip or weaken the fight.
  function guardianOpeningSeconds(found){
    return found.has('traces') ? 1.8 : 0;
  }
  // Start the earned warning when the guardian is close enough to threaten the
  // player, not while it is still walking in from its distant spawn point.
  // Mark it once: later attack cooldowns must never become fresh scouting cues.
  // Give the player the full reaction window at striking distance; 95 units
  // spent most of the bonus on merely walking into range in real-phone runs.
  // The lateral attack lane matters too: proximity across a different depth
  // must not consume the earned window before a strike is possible.
  const GUARDIAN_WARNING_RANGE=55;
  function armGuardianOpening(enemy,distance,nowSec,inStrikeLane=true){
    if (!enemy || !(enemy.scoutOpeningSeconds>0) || enemy.scoutOpeningArmed ||
        !Number.isFinite(distance) || distance>GUARDIAN_WARNING_RANGE ||
        !inStrikeLane || !Number.isFinite(nowSec)) return false;
    enemy.scoutOpeningArmed=true;
    enemy.scoutOpeningEndsAt=nowSec+enemy.scoutOpeningSeconds;
    enemy.nextStrikeAt=Math.max(enemy.nextStrikeAt||0,enemy.scoutOpeningEndsAt);
    return true;
  }
  // Reading tracks rewards one deliberate hit during the earned opening.
  // Only a landed hit consumes the bonus; no bonus on later cooldowns.
  const GUARDIAN_SCOUT_STRIKE_BONUS=12;
  // An ally can knock the guardian down *after* the warning has started.
  // Ordinary player strikes cannot land during knockdown, so those frames
  // must not burn the one-time earned opening or its enemy strike hold.
  function pauseGuardianOpening(enemy,dt,nowSec){
    if(!enemy || enemy.name!=='苔祠の番人' || !enemy.scoutOpeningArmed ||
       enemy.scoutStrikeClaimed || enemy.state!=='DOWN' ||
       !(dt>0) || !Number.isFinite(nowSec) ||
       !(enemy.scoutOpeningEndsAt>nowSec)) return false;
    enemy.scoutOpeningEndsAt+=dt;
    enemy.nextStrikeAt=Math.max(enemy.nextStrikeAt||0,enemy.scoutOpeningEndsAt);
    return true;
  }
  // Yield only during the *armed* player strike window. Before the
  // explorer approaches, the ally must still defend: otherwise a guardian
  // fighting the ally can stall forever while the player hangs back.
  // After a landed strike, the separate bounded recovery yield gives the
  // guardian time to telegraph once; expiry otherwise resumes normal support.
  function companionYieldsGuardianOpening(enemy,nowSec){
    return Boolean(enemy && enemy.name==='苔祠の番人' &&
      enemy.scoutOpeningSeconds>0 && enemy.scoutOpeningArmed &&
      !enemy.scoutStrikeClaimed && Number.isFinite(nowSec) &&
      enemy.scoutOpeningEndsAt>nowSec);
  }
  // Prevent the ally from killing a downed guardian before its first tell.
  // The yield is bounded and only near an active hero; retreat, incapacity
  // or expiry restores normal ally defense instead of stalling combat.
  function companionYieldsGuardianRecovery(player,enemy,nowSec){
    return Boolean(player && enemy && enemy.name==='苔祠の番人' &&
      enemy.scoutStrikeClaimed && enemy.scoutFirstHitYieldUntil>nowSec &&
      !['DEAD','HURT','DOWN','GRAB'].includes(player.state) &&
      Math.abs(enemy.x-player.x)<120 && Math.abs(enemy.z-player.z)<30);
  }
  // Do not spend the one-time scouting warning while Ginji is locked in an
  // animation, or while the guardian is invulnerable / being grappled.
  // The cue should begin only when the player can choose a fresh strike or dodge.
  function guardianReadyForOpening(player,enemy){
    // A scouting bonus is not actionable while the hero faces away from the
    // guardian. Allow point-blank overlap; turning is meaningless there.
    // Older rule-only callers may omit coordinates, but live fighters have them.
    const facingTarget=!Number.isFinite(player?.x)||!Number.isFinite(enemy?.x)||
      !Number.isFinite(player?.facing)||Math.abs(enemy.x-player.x)<=10||
      Math.sign(enemy.x-player.x)===player.facing;
    return Boolean(player && enemy && facingTarget &&
      !['DEAD','HURT','DOWN','GRAB','ATTACK','SPECIAL','JUMP'].includes(player.state) &&
      !['DEAD','HURT','DOWN','GRAB'].includes(enemy.state) &&
      Math.abs(player.z-enemy.z)<=25);
  }
  // Tracks can reveal a threat approaching from behind, but the earned
  // first-strike timer still waits for a deliberate turn toward the guardian.
  // This cue only exists inside the already-chosen guardian encounter.
  function guardianBehindWarning(player,enemy,found){
    if(!player || !enemy || !found?.has('traces') ||
       enemy.name!=='苔祠の番人' || !(enemy.scoutOpeningSeconds>0) ||
       enemy.scoutOpeningArmed || !(enemy.hp>0) ||
       !Number.isFinite(player.x) || !Number.isFinite(enemy.x) ||
       !Number.isFinite(player.z) || !Number.isFinite(enemy.z) ||
       ![-1,1].includes(player.facing) ||
       ['DEAD','HURT','DOWN','GRAB','ATTACK','SPECIAL','JUMP'].includes(player.state) ||
       ['DEAD','HURT','DOWN','GRAB'].includes(enemy.state)) return false;
    const dx=enemy.x-player.x;
    return Math.abs(dx)>10 && Math.abs(dx)<=95 &&
      Math.abs(enemy.z-player.z)<=25 &&
      Math.sign(dx)!==player.facing;
  }
  // When scouted footsteps are close behind, let the guardian recover and
  // approach instead of letting the ally repeatedly knock it out of earshot.
  // This is proximity-limited, not a distant/indefinite ally ceasefire:
  // turning, losing control, or skipping tracks restores normal protection.
  function companionYieldsGuardianFootsteps(player,enemy,found,ally){
    if(!player || !enemy || !found?.has('traces') ||
       enemy.name!=='苔祠の番人' || !(enemy.scoutOpeningSeconds>0) ||
       enemy.scoutOpeningArmed || enemy.scoutStrikeClaimed || !(enemy.hp>0) ||
       !Number.isFinite(player.x) || !Number.isFinite(enemy.x) ||
       !Number.isFinite(player.z) || !Number.isFinite(enemy.z) ||
       ![-1,1].includes(player.facing) ||
       ['DEAD','HURT','DOWN','GRAB','ATTACK','SPECIAL','JUMP'].includes(player.state)) return false;
    const dx=enemy.x-player.x;
    // The guardian can choose the *ally* as its target while the hero faces
    // away. Never make that ally stand idle inside the guardian's strike lane.
    // Yield only while the guardian is recovering or has not engaged the ally.
    const allyInMelee=ally && ally.hp>0 &&
      Number.isFinite(ally.x) && Number.isFinite(ally.z) &&
      Math.abs(enemy.x-ally.x)<48 && Math.abs(enemy.z-ally.z)<20 &&
      !['DOWN','HURT','GRAB'].includes(enemy.state);
    if(allyInMelee) return false;
    // The ally yields while footsteps are approaching, but resumes protection
    // once the guardian reaches its 48-unit melee range. Ignoring the cue must
    // not leave the companion frozen while the hero is attacked from behind.
    return Math.abs(dx)>48 && Math.abs(dx)<=120 &&
      Math.abs(enemy.z-player.z)<=25 && Math.sign(dx)!==player.facing;
  }
  // The optional shrine guardian should threaten the explorer who chose
  // to search deeper, not spend the entire short fight hitting a nearer ally.
  // Fall back to ordinary nearest-target AI when the hero is down or distant,
  // so companion protection and recovery cannot stall the encounter.
  function guardianTargetsExplorer(enemy,hero){
    return Boolean(enemy && enemy.name==='苔祠の番人' && hero &&
      !['DEAD','DOWN','GRAB'].includes(hero.state) &&
      Number.isFinite(enemy.x) && Number.isFinite(enemy.z) &&
      Number.isFinite(hero.x) && Number.isFinite(hero.z) &&
      Math.hypot(hero.x-enemy.x,hero.z-enemy.z)<=200);
  }
  // Unlike the old per-frame attack lottery, the shrine guardian announces
  // one close-range strike. Stepping out of range or jumping can avoid it;
  // the warning is cancelled if the guardian is stunned or changes target.
  // Other enemies keep their existing attack behavior.
  const GUARDIAN_COUNTER_SECONDS=1.2; // allow a jump dodge to land before the follow-up
  function guardianStrikeTell(enemy,nowSec,inMelee,canAct,ready,targetId){
    if(!enemy || enemy.name!=='苔祠の番人' || !Number.isFinite(nowSec)) return 'none';
    if(enemy.guardianTellUntil>0){
      if(!canAct || enemy.guardianTellTargetId!==targetId){
        enemy.guardianTellUntil=0;
        enemy.guardianTellTargetId=null;
        return 'none';
      }
      if(nowSec<enemy.guardianTellUntil) return 'warning';
      const dodgedTargetId=enemy.guardianTellTargetId;
      enemy.guardianTellUntil=0;
      enemy.guardianTellTargetId=null;
      if(inMelee) return ready ? 'strike' : 'none';
      // The defender really left the attack lane. Only a landed counter
      // from that same defender can claim this one-time bonus.
      enemy.guardianCounterUntil=nowSec+GUARDIAN_COUNTER_SECONDS;
      enemy.guardianCounterTargetId=dodgedTargetId;
      enemy.guardianCounterClaimed=false;
      enemy.nextStrikeAt=Math.max(enemy.nextStrikeAt||0,enemy.guardianCounterUntil);
      return 'evaded';
    }
    if(!inMelee || !canAct || !ready) return 'none';
    enemy.guardianTellUntil=nowSec+0.65;
    enemy.guardianTellTargetId=targetId;
    return 'start';
  }
  // Repeated light hits still deal damage, but cannot erase an announced
  // shrine-guardian lunge. The player must respond to the tell; a killing
  // blow still ends the encounter normally.
  function guardianKeepsTellOnHit(enemy,nowSec){
    return Boolean(enemy && enemy.name==='苔祠の番人' &&
      enemy.hp>0 && enemy.state!=='DEAD' && Number.isFinite(nowSec) &&
      enemy.guardianTellUntil>nowSec);
  }
  const GUARDIAN_COUNTER_BONUS=8;
  function guardianCounterStrikeBonus(enemy,nowSec,attackerId){
    return enemy && enemy.name==='苔祠の番人' &&
      attackerId!=null && enemy.guardianCounterTargetId===attackerId &&
      !enemy.guardianCounterClaimed && Number.isFinite(nowSec) &&
      enemy.guardianCounterUntil>nowSec ? GUARDIAN_COUNTER_BONUS : 0;
  }
  function guardianScoutStrikeBonus(enemy,nowSec){
    return enemy && enemy.name==='苔祠の番人' &&
      enemy.scoutOpeningArmed && !enemy.scoutStrikeClaimed &&
      Number.isFinite(nowSec) && enemy.scoutOpeningEndsAt>nowSec
      ? GUARDIAN_SCOUT_STRIKE_BONUS : 0;
  }
  function shrineRiskDamage(found,crafted){
    return (crafted?6:12)-(found.has('traces')?3:0);
  }
  function uncover(player,found,phase,hp,maxHp,crafted=false,shrineChoice='auto'){
    if(!available(phase)) return {ok:false};
    if(!canInspect(player,phase)) return {ok:false,reason:'busy'};
    const spot=near(player,found);
    if(!spot) return {ok:false};
    if(spot.kind==='cache'){
      if(!found.has('traces')) return {ok:false,reason:'trail',spot};
      // The sword is needed to cut through the thorns for fangs, but an
      // injured explorer can still reach the herbs at the edge of the gate.
      if(!crafted && shrineChoice!=='heal') return {ok:false,reason:'thorns',spot};
    }
    // A discovered stone gate offers a one-time choice: take its materials
    // home or use its herbs to survive. Never award both on the same visit.
    if(spot.kind==='cache' && !['auto','material','heal','cautious'].includes(shrineChoice))
      return {ok:false,reason:'choice',spot};
    if(spot.kind==='cache' && shrineChoice==='heal' && hp>=maxHp)
      return {ok:false,reason:'full',spot};
    const gateDamage=shrineChoice==='cautious'?GATE_CAUTIOUS_DAMAGE:GATE_SALVAGE_DAMAGE;
    if(spot.kind==='cache' && shrineChoice!=='heal' && hp<gateDamage+1)
      return {ok:false,reason:'weak',spot};
    // The shrine offers a deliberate trade-off; a full-HP heal must not waste it.
    // 'auto' preserves existing direct rule callers; the scene passes an explicit choice.
    if(spot.kind==='healing' && shrineChoice==='heal' && hp>=maxHp)
      return {ok:false,reason:'full',spot};
    if(spot.kind==='healing' && !['auto','material','heal','risk'].includes(shrineChoice))
      return {ok:false,reason:'choice',spot};
    // Deep search always carries a guardian fight. During the initial wave,
    // wait until the enemies are cleared rather than awarding unguarded +2 loot.
    if(spot.kind==='healing' && shrineChoice==='risk' && phase!=='return')
      return {ok:false,reason:'clear-first',spot};
    // A forged sword clears the thorns, halving the deep-search wound.
    const riskDamage=shrineRiskDamage(found,crafted);
    if(spot.kind==='healing' && shrineChoice==='risk' && hp<riskDamage+1)
      return {ok:false,reason:'weak',spot};
    const risky=spot.kind==='healing' && shrineChoice==='risk';
    const scavenge=spot.kind==='healing' && (risky || shrineChoice==='material' ||
      (shrineChoice==='auto' && hp>=maxHp));
    found.add(spot.id);
    const gateHeal=spot.kind==='cache' && shrineChoice==='heal';
    const gateSalvage=spot.kind==='cache' && !gateHeal;
    const gateCautious=spot.kind==='cache' && shrineChoice==='cautious';
    return {ok:true,spot,material:risky?2:scavenge?1:spot.kind==='cache'&&!gateHeal?(gateCautious?1:2):spot.kind==='material'?1:0,
      damage:risky?riskDamage:gateSalvage?gateDamage:0,
      heal:gateHeal?Math.min(45,Math.max(0,maxHp-hp)):
        spot.kind==='healing' && !scavenge?Math.min(35,Math.max(0,maxHp-hp)):0};
  }
  return {spots,RANGE,GATE_SALVAGE_DAMAGE,GATE_CAUTIOUS_DAMAGE,near,cueNear,spotAtTap,available,canInspect,guardianApproachDistance,guardianOpeningSeconds,GUARDIAN_WARNING_RANGE,armGuardianOpening,pauseGuardianOpening,guardianScoutStrikeBonus,guardianReadyForOpening,guardianBehindWarning,companionYieldsGuardianOpening,companionYieldsGuardianRecovery,companionYieldsGuardianFootsteps,guardianTargetsExplorer,guardianStrikeTell,guardianKeepsTellOnHit,guardianCounterStrikeBonus,shrineRiskDamage,uncover};
});
