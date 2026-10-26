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
    const spot=near(player,found);
    if(!spot) return {ok:false};
    if(spot.kind==='cache'){
      if(!found.has('traces')) return {ok:false,reason:'trail',spot};
      if(!crafted) return {ok:false,reason:'thorns',spot};
    }
    // A discovered stone gate offers a one-time choice: take its materials
    // home or use its herbs to survive. Never award both on the same visit.
    if(spot.kind==='cache' && !['auto','material','heal'].includes(shrineChoice))
      return {ok:false,reason:'choice',spot};
    if(spot.kind==='cache' && shrineChoice==='heal' && hp>=maxHp)
      return {ok:false,reason:'full',spot};
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
    return {ok:true,spot,material:risky?2:scavenge?1:spot.kind==='cache'&&!gateHeal?2:spot.kind==='material'?1:0,
      damage:risky?riskDamage:0,
      heal:gateHeal?Math.min(45,Math.max(0,maxHp-hp)):
        spot.kind==='healing' && !scavenge?Math.min(35,Math.max(0,maxHp-hp)):0};
  }
  return {spots,RANGE,near,cueNear,spotAtTap,available,guardianApproachDistance,guardianOpeningSeconds,GUARDIAN_WARNING_RANGE,armGuardianOpening,guardianScoutStrikeBonus,shrineRiskDamage,uncover};
});
