/* The first playable local field. Pure, deterministic, and intentionally tiny.
   Coordinates are fantasy grid cells, never GPS fixes or movement history. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  if(root) root.CrownlessField=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const SIZE=5, START=20, EXIT=4, CACHE=16, TRACKS=18, DEN=8;
  const WALLS=Object.freeze([6,11,12]);
  const MAX_SEEN=2**(SIZE*SIZE)-1;
  const inBounds=n=>Number.isInteger(n)&&n>=0&&n<SIZE*SIZE;
  const neighbors=n=>inBounds(n)?[n-SIZE,n+SIZE,n-1,n+1].filter(v=>
    inBounds(v)&&Math.abs(Math.floor(v/SIZE)-Math.floor(n/SIZE))+
      Math.abs(v%SIZE-n%SIZE)===1):[];
  const nextSeen=(mask,pos)=>[pos,...neighbors(pos)].reduce((value,n)=>value|(1<<n),mask);
  const visible=(field,n)=>Boolean(field.seen&(1<<n));
  const adjacent=(a,b)=>neighbors(a).includes(b);
  const initial=()=>({pos:START,seen:nextSeen(0,START),cache:false,tracks:false});
  const valid=f=>f&&typeof f==='object'&&!Array.isArray(f)&&
    Object.keys(f).sort().join(',')==='cache,pos,seen,tracks'&&
    inBounds(f.pos)&&!WALLS.includes(f.pos)&&
    Number.isInteger(f.seen)&&f.seen>0&&f.seen<=MAX_SEEN&&
    visible(f,f.pos)&&typeof f.cache==='boolean'&&typeof f.tracks==='boolean';
  function move(f,to){
    if(!valid(f)||!inBounds(to)||WALLS.includes(to)||!adjacent(f.pos,to))return null;
    return {...f,pos:to,seen:nextSeen(f.seen,to)};
  }
  // The wolf is a diegetic threat: first seen from an adjacent trail,
  // then left behind if the player chooses a different path.
  // This is derived solely from existing field state; no new save keys.
  function wolfAwareness(f){
    if(!valid(f)||!visible(f,DEN))return 'hidden';
    return adjacent(f.pos,DEN)?'alert':'watching';
  }
  function landmark(n){
    if(WALLS.includes(n))return 'wall';
    if(n===EXIT)return 'exit';
    if(n===CACHE)return 'cache';
    if(n===TRACKS)return 'tracks';
    if(n===DEN)return 'den';
    if(n===START)return 'camp';
    return 'trail';
  }
  return {SIZE,START,EXIT,CACHE,TRACKS,DEN,WALLS,initial,valid,move,visible,adjacent,neighbors,landmark,wolfAwareness};
});
