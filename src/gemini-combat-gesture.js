/* Tiny, deterministic gesture classifier for the right-hand combat area.
 * Left-hand movement and the original fighter/combo state machine are untouched.
 */
(function (root, factory) {
  const api=factory();
  if (typeof module==='object' && module.exports) module.exports=api;
  if (root) root.CrownlessCombatGesture=api;
})(typeof globalThis==='object'?globalThis:this,function() {
  'use strict';
  const SWIPE_PX=36;
  function resolve(dx,dy) {
    if (!Number.isFinite(dx)||!Number.isFinite(dy)) return null;
    if (Math.hypot(dx,dy)<SWIPE_PX) return 'punch';
    if (Math.abs(dx)>=Math.abs(dy)*1.15) return 'kick';
    return dy<0?'jump':'grab';
  }
  return {resolve,SWIPE_PX};
});
