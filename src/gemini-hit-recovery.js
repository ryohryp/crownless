/* Isolated action-lab pacing: enemies remain dangerous, but the heroes
 * must regain control after a hit. The original player combo physics is intact.
 */
(function (root, factory) {
  const api=factory();
  if (typeof module==='object' && module.exports) module.exports=api;
  if (root) root.CrownlessHitRecovery=api;
})(typeof globalThis==='object'?globalThis:this,function() {
  'use strict';
  const HERO_GRACE_SECONDS=1.45;
  const HERO_DOWN_SECONDS=0.65;
  const ENEMY_ATTACK_INTERVAL=1.1;
  function step(fighter,dt) {
    if (!fighter || !(dt>0)) return;
    fighter.hitGuardRemaining=Math.max(0,(fighter.hitGuardRemaining||0)-dt);
  }
  function acceptsHit(fighter) {
    return Boolean(fighter && (fighter.team!==0 || (fighter.hitGuardRemaining||0)<=0));
  }
  function registerHit(fighter) {
    if (fighter && fighter.team===0) fighter.hitGuardRemaining=HERO_GRACE_SECONDS;
  }
  function knockdownTime(fighter) {
    return fighter?.team===0 ? HERO_DOWN_SECONDS : 1.35;
  }
  function readyToStrike(enemy,nowSec) {
    return Number.isFinite(nowSec) && nowSec>=(enemy?.nextStrikeAt||0);
  }
  function registerEnemyStrike(enemy,nowSec) {
    enemy.nextStrikeAt=nowSec+ENEMY_ATTACK_INTERVAL*(enemy.isBoss?1.2:1);
  }
  return {
    HERO_GRACE_SECONDS,HERO_DOWN_SECONDS,ENEMY_ATTACK_INTERVAL,
    step,acceptsHit,registerHit,knockdownTime,readyToStrike,registerEnemyStrike,
  };
});
