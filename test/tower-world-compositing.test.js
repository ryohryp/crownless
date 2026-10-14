'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const T=require('../src/tower-field.js');

function fakeContext(){
  const composites=[],images=[];
  const gradient=()=>({addColorStop(){}});
  const ctx=new Proxy({createRadialGradient:gradient,drawImage(image){images.push(image);}}, {
    get(target,key){return key in target?target[key]:()=>{};},
    set(target,key,value){
      if(key==='globalCompositeOperation')composites.push(value);
      target[key]=value;
      return true;
    }
  });
  return {ctx,composites,images};
}

test('tower fog clears only its overlay and drawing goes idle after a step',()=>{
  const floor=fakeContext(),fog=fakeContext();
  const pending=[];
  let overlayCount=0;
  const overlay={width:0,height:0,getContext(type){
    assert.equal(type,'2d');return fog.ctx;
  }};
  const canvas={isConnected:true,getContext(type){
    assert.equal(type,'2d');return floor.ctx;
  }};
  const worldspace={clientWidth:390,style:{}};
  const field=T.initial();
  const section={
    dataset:{fieldPos:String(field.pos),fieldSeen:String(field.seen)},
    classList:{add(){}},
    querySelector(selector){
      if(selector==='.forest-world-canvas')return canvas;
      if(selector==='.field-worldspace')return worldspace;
      return null;
    }
  };
  const root={
    CrownlessTowerField:T,
    document:{createElement(type){
      assert.equal(type,'canvas');overlayCount++;return overlay;
    }},
    performance:{now:()=>100},
    matchMedia:()=>({matches:false}),
    requestAnimationFrame(callback){pending.push(callback);return pending.length;},
    cancelAnimationFrame(){}
  };
  const source=fs.readFileSync(path.join(__dirname,'../src/tower-world.js'),'utf8');
  vm.runInNewContext(source,{window:root},{filename:'tower-world.js'});
  root.CrownlessTowerWorld.mount({
    querySelector(selector){return selector==='.tower-field'?section:null;}
  });

  assert.equal(overlayCount,1,'one fog layer is composed per mount');
  assert(fog.composites.includes('destination-out'),'visible cells clear the fog layer');
  assert(!floor.composites.includes('destination-out'),'fog never erases the stone floor');
  assert(floor.images.includes(overlay),'fog is drawn over the stone floor');

  for(let time=220;time<=640&&pending.length;time+=70)pending.shift()(time);
  assert.equal(pending.length,0,'animation stops requesting frames after the step');
  assert.match(worldspace.style.transform,/translate3d/);
});
