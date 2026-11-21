/* Small, deterministic forest foraging encounter.
   Pure rules: UI can present each choice without owning game state. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CrownlessForaging=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const initial=()=>({stage:0,herbs:0,ore:0,health:10,retreated:false,finished:false});
  const options=s=>{
    if(!s||s.finished)return [];
    return s.stage===0?['gather','press','retreat']:['extract','press','retreat'];
  };
  function choose(s,action){
    if(!options(s).includes(action))return null;
    if(action==='retreat')return {...s,retreated:true,finished:true};
    if(action==='gather')return {...s,herbs:s.herbs+2,finished:true};
    if(action==='extract')return {...s,ore:s.ore+1,finished:true};
    if(action==='press'){
      if(s.health<=3)return null;
      return {...s,stage:s.stage+1,health:s.health-3,
        ...(s.stage>=1?{ore:s.ore+2,finished:true}:{})};
    }
    return null;
  }
  return {initial,options,choose};
});
