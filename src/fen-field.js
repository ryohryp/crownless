/* First walkable star-fen: reed sounds, impassable deep pools,
 * dangerous hidden shoal, optional ghost, and a safe way home. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CrownlessFenField=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const SIZE=5,COUNT=25,START=20,EXIT=24,REEDS=17,SHOAL=12,STAR=7,
   WRAITH=8,HERBS=18;
 const WALLS=Object.freeze([0,1,2,3,4,5,6,10,14,15,19]);
 const inBounds=id=>Number.isInteger(id)&&id>=0&&id<COUNT;
 const coords=id=>inBounds(id)?[id%SIZE,Math.floor(id/SIZE)]:null;
 const touching=(a,b)=>inBounds(a)&&inBounds(b)&&
   Math.abs(a%SIZE-b%SIZE)+Math.abs(Math.floor(a/SIZE)-Math.floor(b/SIZE))===1;
 // The star cannot be reached by walking around the haunted deep water.
 const connected=(a,b)=>{
   if(a===STAR||b===STAR)return a===SHOAL||b===SHOAL;
   if(a===SHOAL||b===SHOAL)return a===REEDS||b===REEDS||a===STAR||b===STAR;
   return true;
 };
 const adjacent=(a,b)=>touching(a,b)&&connected(a,b);
 const neighbors=id=>inBounds(id)?Array.from({length:COUNT},(_,i)=>i).filter(i=>adjacent(id,i)):[];
 const visible=(f,id)=>Boolean(f&&inBounds(id)&&Math.floor(f.seen/2**id)%2);
 const reveal=(seen,id)=>[id,...neighbors(id)].reduce((v,n)=>visible({seen:v},n)?v:v+2**n,seen);
 const initial=()=>({pos:START,seen:reveal(0,START),sound:false,shoal:false,star:false,herbs:false,wraith:false});
 const valid=f=>!!f&&typeof f==='object'&&!Array.isArray(f)&&
   Object.keys(f).every(k=>['pos','seen','sound','shoal','star','herbs','wraith'].includes(k))&&
   inBounds(f.pos)&&!WALLS.includes(f.pos)&&
   Number.isSafeInteger(f.seen)&&f.seen>0&&f.seen<2**COUNT&&visible(f,f.pos)&&
   ['sound','shoal','star','herbs','wraith'].every(k=>typeof f[k]==='boolean')&&
   (!(f.pos===SHOAL||f.pos===STAR)||f.shoal)&&
   (!f.star||f.shoal);
 const canMove=(f,to)=>valid(f)&&inBounds(to)&&!WALLS.includes(to)&&
   adjacent(f.pos,to)&&(to!==SHOAL||f.shoal);
 const move=(f,to)=>canMove(f,to)?{...f,pos:to,seen:reveal(f.seen,to)}:null;
 const uncover=(f,to)=>valid(f)&&f.pos===REEDS&&to===SHOAL&&!f.shoal&&f.sound?
   {...f,shoal:true}:null;
 const kind=id=>{
   if(WALLS.includes(id))return 'water';
   return ({[START]:'start',[EXIT]:'exit',[REEDS]:'reeds',[SHOAL]:'shoal',
     [STAR]:'star',[WRAITH]:'wraith',[HERBS]:'herbs'})[id]||'bank';
 };
 return {SIZE,COUNT,START,EXIT,REEDS,SHOAL,STAR,WRAITH,HERBS,WALLS,
   coords,adjacent,neighbors,visible,initial,valid,canMove,move,uncover,kind};
});
