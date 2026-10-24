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
  function available(phase){
    return phase==='fight'||phase==='return';
  }
  function uncover(player,found,phase,hp,maxHp,crafted=false){
    if(!available(phase)) return {ok:false};
    const spot=near(player,found);
    if(!spot) return {ok:false};
    if(spot.kind==='cache'){
      if(!found.has('traces')) return {ok:false,reason:'trail',spot};
      if(!crafted) return {ok:false,reason:'thorns',spot};
    }
    // A healthy explorer can scavenge once instead of saving the shrine's healing.
    // Both outcomes consume the same run-local discovery; loot is still unbanked.
    const scavenge=spot.kind==='healing' && !(hp<maxHp);
    found.add(spot.id);
    return {ok:true,spot,material:scavenge?1:spot.kind==='cache'?2:spot.kind==='material'?1:0,
      heal:spot.kind==='cache'?Math.min(45,Math.max(0,maxHp-hp)):
        spot.kind==='healing'?Math.min(35,maxHp-hp):0};
  }
  return {spots,RANGE,near,spotAtTap,available,uncover};
});
