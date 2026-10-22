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
    Object.freeze({id:'traces',x:800,z:365,label:'獣の痕跡',kind:'material'}),
    Object.freeze({id:'shrine',x:660,z:230,label:'苔むす祠',kind:'healing'})
  ]);
  const RANGE=54;
  function near(player,found){
    if(!player) return null;
    return spots.find(spot=>
      !found.has(spot.id) &&
      Math.hypot(player.x-spot.x,player.z-spot.z)<RANGE
    )||null;
  }
  function available(phase){
    return phase==='fight'||phase==='return';
  }
  function uncover(player,found,phase,hp,maxHp){
    if(!available(phase)) return {ok:false};
    const spot=near(player,found);
    if(!spot) return {ok:false};
    if(spot.kind==='healing'&&!(hp<maxHp)) return {ok:false,reason:'full',spot};
    found.add(spot.id);
    return {ok:true,spot,material:spot.kind==='material'?1:0,
      heal:spot.kind==='healing'?Math.min(35,maxHp-hp):0};
  }
  return {spots,RANGE,near,available,uncover};
});
