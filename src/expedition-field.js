/* Deterministic local fantasy forest. IDs 0–24 keep their original
   five-by-five positions; 25–48 extend the east and south woodland.
   This preserves old saves without recording real-world GPS movement. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  if(root)root.CrownlessField=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const SIZE=7, COUNT=49;
  const START=20, EXIT=4, CACHE=16, TRACKS=18, DEN=8,
    TREASURE=17, SHRINE=7, SECRET=12, GLADE=40, FOX=5, FOX_NEST=0;
  // Dense, actually IMPASSABLE forest around the ordinary winding trails.
  // Shrine 7 is additionally enclosed by rock and reachable ONLY from 12.
  const WALLS=Object.freeze([6,11,25,26,27,28,29,30,31,32,35,36,37,38,42,43,44,45,46]);
  const MAX_SEEN=2**COUNT-1;
  const inBounds=n=>Number.isInteger(n)&&n>=0&&n<COUNT;
  const coords=n=>{
    if(!inBounds(n))return null;
    if(n<25)return [n%5,Math.floor(n/5)];
    if(n<35)return [5+(n-25)%2,Math.floor((n-25)/2)];
    return [(n-35)%7,5+Math.floor((n-35)/7)];
  };
  const lookup=Array.from({length:COUNT},(_,id)=>coords(id));
  const distance=(a,b)=>{
    if(!inBounds(a)||!inBounds(b))return Infinity;
    return Math.abs(lookup[a][0]-lookup[b][0])+Math.abs(lookup[a][1]-lookup[b][1]);
  };
  // Dense rock and bramble banks stop the shrine from being reached
  // by circling around from the wolf den or the northern woodland.
  const connected=(a,b)=>{
    if((a===SHRINE||b===SHRINE))return a===SECRET||b===SECRET;
    if((a===SECRET||b===SECRET))return a===TREASURE||b===TREASURE;
    return true;
  };
  const neighbors=n=>inBounds(n)?Array.from({length:COUNT},(_,i)=>i)
    .filter(v=>distance(n,v)===1&&connected(n,v)):[];
  const adjacent=(a,b)=>neighbors(a).includes(b);
  // 49 cells fit exactly in a safe JS number. Never use 32-bit bitwise
  // operators: that would silently expose/hide cells past index 31.
  // The secret remains under fog until the vines are deliberately investigated.
  const visible=(f,n)=>Boolean(f&&inBounds(n)&&
    (n!==SECRET||f.secret===true)&&Math.floor(f.seen/(2**n))%2);
  const nextSeen=(mask,pos)=>[pos,...neighbors(pos)].reduce((value,n)=>
    value+(Math.floor(value/(2**n))%2?0:2**n),mask);
  const initial=()=>({pos:START,seen:nextSeen(0,START),
    cache:false,tracks:false,treasure:false,wolf:false,secret:false,shrine:false,glade:false,fox:false,foxCache:false,lanternClue:false});
  const valid=f=>f&&typeof f==='object'&&!Array.isArray(f)&&
    Object.keys(f).every(k=>['pos','seen','cache','tracks','treasure','wolf','secret','shrine','glade','fox','foxCache','lanternClue'].includes(k))&&
    ['pos','seen','cache','tracks'].every(k=>Object.prototype.hasOwnProperty.call(f,k))&&
    ['treasure','wolf','secret','shrine','glade','fox','foxCache','lanternClue'].every(k=>f[k]===undefined||typeof f[k]==='boolean')&&
    (f.pos!==SECRET||f.secret===true)&&
    inBounds(f.pos)&&!WALLS.includes(f.pos)&&
    Number.isSafeInteger(f.seen)&&f.seen>0&&f.seen<=MAX_SEEN&&
    visible(f,f.pos)&&typeof f.cache==='boolean'&&typeof f.tracks==='boolean';
  const canMove=(f,to)=>valid(f)&&inBounds(to)&&!WALLS.includes(to)&&
    adjacent(f.pos,to)&&(to!==SECRET||f.secret===true);
  function move(f,to){
    if(!canMove(f,to))return null;
    return {...f,pos:to,seen:nextSeen(f.seen,to)};
  }
  // First tap from the treasure side pulls apart the obstructing vines.
  // The player remains in place. Only the second tap traverses the gap.
  function uncover(f,to){
    if(!valid(f)||to!==SECRET||f.pos!==TREASURE||f.secret===true||
      !adjacent(f.pos,to))return null;
    return {...f,secret:true,seen:nextSeen(f.seen,f.pos)};
  }
  function wolfAwareness(f){
    if(!valid(f))return 'hidden';
    if(f.wolf===true)return 'defeated';
    if(!visible(f,DEN))return 'hidden';
    return adjacent(f.pos,DEN)?'alert':'watching';
  }
  function landmark(n){
    if(WALLS.includes(n))return 'wall';
    if(n===EXIT)return 'exit';
    if(n===CACHE)return 'cache';
    if(n===TRACKS)return 'tracks';
    if(n===DEN)return 'den';
    if(n===TREASURE)return 'treasure';
    if(n===SHRINE)return 'shrine';
    if(n===SECRET)return 'secret';
    if(n===GLADE)return 'glade';
    if(n===FOX)return 'fox';
    if(n===FOX_NEST)return 'fox-nest';
    if(n===START)return 'camp';
    return 'trail';
  }
  return {SIZE,COUNT,START,EXIT,CACHE,TRACKS,DEN,TREASURE,SHRINE,SECRET,GLADE,
    FOX,FOX_NEST,WALLS,coords,initial,valid,move,uncover,canMove,visible,adjacent,neighbors,landmark,wolfAwareness};
});
