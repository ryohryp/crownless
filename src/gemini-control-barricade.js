/* Mobile action fighting: the thumb button cluster owns the lower-right scene
 * footprint. A visible barricade excludes fighters without reducing touch sizes.
 * Pure geometry for browser smoke and Node tests; no save or GPS coupling.
 */
(function(root, factory) {
  const api=factory();
  if (typeof module==='object' && module.exports) module.exports=api;
  if(root) root.CrownlessControlBarricade=api;
})(typeof globalThis==='object'?globalThis:this,function() {
  'use strict';
  function measure(view, buttons, virtualWidth, virtualHeight) {
    if (!view || !(view.width>0) || !(view.height>0) || !buttons?.length) return null;
    // A separate control deck below the game must NOT reduce the playable map.
    const overlapping=buttons.filter(b=>b.right>view.left && b.left<view.right &&
      b.bottom>view.top && b.top<view.bottom);
    if(!overlapping.length) return null;
    const minLeft=Math.min(...overlapping.map(b=>b.left));
    const minTop=Math.min(...overlapping.map(b=>b.top));
    const left=Math.max(0,(minLeft-view.left-20)/view.width*virtualWidth);
    const top=Math.max(0,(minTop-view.top-12)/view.height*virtualHeight);
    if(left>=virtualWidth-12 || top>=virtualHeight-12) return null;
    return {left,top,screenWidth:virtualWidth,screenHeight:virtualHeight};
  }
  function project(entity, zone, cameraX=0) {
    if(!zone || !entity) return false;
    const xEdge=cameraX+zone.left;
    const zEdge=zone.top;
    if(entity.x < xEdge || entity.z < zEdge) return false;
    // Preserve tangential movement: approaching from the side slides along
    // the side; approaching from above slides along the upper wooden rail.
    if(entity.x-xEdge < entity.z-zEdge) {
      entity.x=xEdge;
      if(entity.vx>0) entity.vx=0;
    } else {
      entity.z=zEdge;
      if(entity.vz>0) entity.vz=0;
    }
    return true;
  }
  function excluded(entity, zone, cameraX=0) {
    return Boolean(zone && entity.x>cameraX+zone.left && entity.z>zone.top);
  }
  return {measure,project,excluded};
});
