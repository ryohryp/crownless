/* Grey-Crown Crypt: two braziers reveal a sealed corridor. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CrownlessCryptField=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const SIZE=5,COUNT=25,START=20,FIRST=17,SECOND=23,SEAL=12,ARCHIVE=7,EXIT=4;
 const WALLS=Object.freeze([0,1,2,3,5,6,8,10,11,15,18,19]);
 const inBounds=n=>Number.isInteger(n)&&n>=0&&n<COUNT;
 const coords=n=>inBounds(n)?[n%SIZE,Math.floor(n/SIZE)]:null;
 const adjacent=(a,b)=>inBounds(a)&&inBounds(b)&&
   Math.abs(a%SIZE-b%SIZE)+Math.abs(Math.floor(a/SIZE)-Math.floor(b/SIZE))===1;
 const neighbors=n=>inBounds(n)?Array.from({length:COUNT},(_,i)=>i).filter(i=>adjacent(n,i)):[];
 const visible=(f,n)=>Boolean(f&&inBounds(n)&&Math.floor(f.seen/2**n)%2);
 const reveal=(seen,n)=>[n,...neighbors(n)].reduce((v,i)=>visible({seen:v},i)?v:v+2**i,seen);
 const initial=()=>({pos:START,seen:reveal(0,START),first:false,second:false,archive:false});
 const valid=f=>!!f&&typeof f==='object'&&!Array.isArray(f)&&
   Object.keys(f).every(k=>['pos','seen','first','second','archive'].includes(k))&&
   inBounds(f.pos)&&!WALLS.includes(f.pos)&&
   Number.isSafeInteger(f.seen)&&f.seen>0&&f.seen<2**COUNT&&visible(f,f.pos)&&
   ['first','second','archive'].every(k=>typeof f[k]==='boolean')&&
   (!f.second||f.first)&&(!f.archive||(f.first&&f.second))&&
   (![SEAL,ARCHIVE,EXIT].includes(f.pos)||f.first&&f.second);
 const canMove=(f,to)=>valid(f)&&inBounds(to)&&!WALLS.includes(to)&&
   adjacent(f.pos,to)&&(to!==SEAL||f.first&&f.second);
 const move=(f,to)=>canMove(f,to)?{...f,pos:to,seen:reveal(f.seen,to)}:null;
 const kind=n=>WALLS.includes(n)?'wall':({
   [START]:'start',[FIRST]:'first',[SECOND]:'second',[SEAL]:'seal',
   [ARCHIVE]:'archive',[EXIT]:'exit'
 })[n]||'floor';
 return {SIZE,COUNT,START,FIRST,SECOND,SEAL,ARCHIVE,EXIT,WALLS,
   coords,adjacent,neighbors,visible,initial,valid,canMove,move,kind};
});
