/* Walkable star-fen: a dangerous shoal and a skill-gated forgotten causeway.
 * The second route becomes real terrain only when the traveler reads its tracks. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CrownlessFenField=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const SIZE=5,COUNT=25,START=20,EXIT=24,REEDS=17,SHOAL=12,STAR=7,
   WRAITH=8,HERBS=18,APPROACH=11,CAUSEWAY=6;
 const WALLS=Object.freeze([0,1,2,3,4,5,6,10,14,15,19]);
 const inBounds=id=>Number.isInteger(id)&&id>=0&&id<COUNT;
 const coords=id=>inBounds(id)?[id%SIZE,Math.floor(id/SIZE)]:null;
 const touching=(a,b)=>inBounds(a)&&inBounds(b)&&
   Math.abs(a%SIZE-b%SIZE)+Math.abs(Math.floor(a/SIZE)-Math.floor(b/SIZE))===1;
 // Only a newly uncovered causeway or the known shoal reaches the star.
 // canMove enforces whether the causeway has actually been discovered.
 const connected=(a,b)=>{
   if(a===STAR||b===STAR)return a===SHOAL||b===SHOAL||a===CAUSEWAY||b===CAUSEWAY;
   if(a===SHOAL||b===SHOAL)return a===REEDS||b===REEDS||a===STAR||b===STAR;
   return true;
 };
 const adjacent=(a,b)=>touching(a,b)&&connected(a,b);
 const neighbors=id=>inBounds(id)?Array.from({length:COUNT},(_,i)=>i).filter(i=>adjacent(id,i)):[];
 const visible=(f,id)=>Boolean(f&&inBounds(id)&&Math.floor(f.seen/2**id)%2);
 const reveal=(seen,id)=>[id,...neighbors(id)].reduce((v,n)=>visible({seen:v},n)?v:v+2**n,seen);
 const initial=()=>({pos:START,seen:reveal(0,START),sound:false,shoal:false,star:false,herbs:false,wraith:false,trail:false});
 const valid=f=>!!f&&typeof f==='object'&&!Array.isArray(f)&&
   Object.keys(f).every(k=>['pos','seen','sound','shoal','star','herbs','wraith','trail'].includes(k))&&
   inBounds(f.pos)&&(!WALLS.includes(f.pos)||f.pos===CAUSEWAY)&&
   (f.pos!==CAUSEWAY||f.trail===true)&&
   Number.isSafeInteger(f.seen)&&f.seen>0&&f.seen<2**COUNT&&visible(f,f.pos)&&
   ['sound','shoal','star','herbs','wraith'].every(k=>typeof f[k]==='boolean')&&
   (f.trail===undefined||typeof f.trail==='boolean')&&
   (!(f.pos===SHOAL||f.pos===STAR)||f.shoal||f.trail===true)&&
   (!f.star||f.shoal||f.trail===true);
 const canMove=(f,to)=>valid(f)&&inBounds(to)&&
   (!WALLS.includes(to)||(to===CAUSEWAY&&f.trail===true))&&
   adjacent(f.pos,to)&&(to!==SHOAL||f.shoal);
 const move=(f,to)=>canMove(f,to)?{...f,pos:to,seen:reveal(f.seen,to)}:null;
 const uncover=(f,to,trailReading=false)=>{
   if(!valid(f))return null;
   if(f.pos===REEDS&&to===SHOAL&&!f.shoal&&f.sound)return {...f,shoal:true};
   if(f.pos===APPROACH&&to===CAUSEWAY&&trailReading===true&&!f.trail)
     return {...f,trail:true};
   return null;
 };
 const kind=id=>{
   if(id===CAUSEWAY)return 'causeway';
   if(WALLS.includes(id))return 'water';
   return ({[START]:'start',[EXIT]:'exit',[REEDS]:'reeds',[SHOAL]:'shoal',
     [STAR]:'star',[WRAITH]:'wraith',[HERBS]:'herbs'})[id]||'bank';
 };
 return {SIZE,COUNT,START,EXIT,REEDS,SHOAL,STAR,WRAITH,HERBS,APPROACH,CAUSEWAY,WALLS,
   coords,adjacent,neighbors,visible,initial,valid,canMove,move,uncover,kind};
});
