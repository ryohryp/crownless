/* Compact first floor of the bell-less tower: movement, fog and secret stair.
 * Built separately from the woodland so every region can have real terrain. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CrownlessTowerField=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const SIZE=5,COUNT=25,START=20,GUARD=9,STAIRS=4,ECHO=17,SECRET=12,RELIC=7,CACHE=13;
  const WALLS=Object.freeze([0,1,2,3,5,6,10,11,15,16]);
  const inBounds=n=>Number.isInteger(n)&&n>=0&&n<COUNT;
  const coords=n=>inBounds(n)?[n%SIZE,Math.floor(n/SIZE)]:null;
  const neighbor=(a,b)=>inBounds(a)&&inBounds(b)&&
    Math.abs(a%SIZE-b%SIZE)+Math.abs(Math.floor(a/SIZE)-Math.floor(b/SIZE))===1;
  // The sealed reliquary is reachable ONLY by finding the cracked stair.
  const linked=(a,b)=>(a===RELIC||b===RELIC)?(a===SECRET||b===SECRET):
    (a===SECRET||b===SECRET)?(a===ECHO||b===ECHO||a===RELIC||b===RELIC):true;
  const adjacent=(a,b)=>neighbor(a,b)&&linked(a,b);
  const neighbors=n=>inBounds(n)?Array.from({length:COUNT},(_,i)=>i).filter(i=>adjacent(n,i)):[];
  const visible=(f,n)=>Boolean(f&&inBounds(n)&&Math.floor(f.seen/(2**n))%2);
  const mark=(seen,n)=>seen+(Math.floor(seen/(2**n))%2?0:2**n);
  // The cracked stair is not a known map tile just because the traveler
  // approaches the bell. It becomes visible only after investigating the echo.
  const reveal=(seen,pos,open=false)=>[pos,...neighbors(pos).filter(n=>open||n!==SECRET)].reduce(mark,seen);
  const initial=()=>({pos:START,seen:reveal(0,START),echo:false,open:false,relic:false,cache:false,guard:false});
  const valid=f=>!!f&&typeof f==='object'&&!Array.isArray(f)&&Object.keys(f).every(k=>
    ['pos','seen','echo','open','relic','cache','guard'].includes(k))&&
    inBounds(f.pos)&&!WALLS.includes(f.pos)&&Number.isSafeInteger(f.seen)&&
    f.seen>0&&f.seen<2**COUNT&&visible(f,f.pos)&&
    ['echo','open','relic','cache','guard'].every(k=>typeof f[k]==='boolean')&&
    (f.pos!==SECRET&&f.pos!==RELIC||f.open);
  const canMove=(f,to)=>valid(f)&&inBounds(to)&&!WALLS.includes(to)&&
    adjacent(f.pos,to)&&(to!==SECRET||f.open)&&(to!==STAIRS||f.guard);
  const move=(f,to)=>canMove(f,to)?{...f,pos:to,seen:reveal(f.seen,to,f.open)}:null;
  const uncover=(f,to)=>valid(f)&&f.pos===ECHO&&to===SECRET&&!f.open?
    {...f,open:true,seen:reveal(f.seen,f.pos,true)}:null;
  function kind(id){
    if(WALLS.includes(id))return 'wall';
    return ({[START]:'start',[GUARD]:'guard',[STAIRS]:'stairs',[ECHO]:'echo',
      [SECRET]:'secret',[RELIC]:'relic',[CACHE]:'cache'})[id]||'floor';
  }
  return {SIZE,COUNT,START,GUARD,STAIRS,ECHO,SECRET,RELIC,CACHE,WALLS,
    coords,adjacent,neighbors,visible,initial,valid,canMove,move,uncover,kind};
});
