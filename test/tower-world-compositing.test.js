'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const T=require('../src/tower-field.js');

function fakeContext(){
  const composites=[],images=[],rects=[],arcs=[],fills=[];
  const gradient=()=>({addColorStop(){}});
  const ctx=new Proxy({createRadialGradient:gradient,drawImage(image){images.push(image);},
    fillRect(x,y,w,h){rects.push([x,y,w,h]);},arc(x,y,r){arcs.push([x,y,r]);},
    fill(){fills.push(this.fillStyle);}}, {
    get(target,key){return key in target?target[key]:()=>{};},
    set(target,key,value){
      if(key==='globalCompositeOperation')composites.push(value);
      target[key]=value;
      return true;
    }
  });
  return {ctx,composites,images,rects,arcs,fills};
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
  const painted=(x,y)=>floor.rects.some(r=>r[0]===x&&r[1]===y&&r[2]===118&&r[3]===118);
  assert(painted(121,481),'discovered adjacent floor is drawn');
  assert(!painted(241,241),'undiscovered secret has no floor silhouette under soft fog');
  assert(!painted(241,121),'undiscovered reliquary has no floor silhouette under soft fog');
  assert(!painted(1,1),'unseen wall is not disguised as a floor under fog');

  for(let time=220;time<=640&&pending.length;time+=70)pending.shift()(time);
  assert.equal(pending.length,0,'animation stops requesting frames after the step');
  assert.match(worldspace.style.transform,/translate3d/);

  let approaching=T.initial();
  for(const id of [21,22])approaching=T.move(approaching,id);
  assert(T.visible(approaching,T.ECHO),'the bell floor is visible from the next stone tile');
  section.dataset.fieldPos=String(approaching.pos);
  section.dataset.fieldSeen=String(approaching.seen);
  floor.arcs.length=0;
  floor.fills.length=0;
  root.CrownlessTowerWorld.mount({querySelector(selector){
    return selector==='.tower-field'?section:null;
  }});
  assert(floor.arcs.length>0,'the undiscovered bell gives a faint visual pulse');
  assert(!floor.fills.includes('#bda46c'),
    'approaching the echo must not reveal the bell fragment before discovery');

  // Arriving and listening earns the bell silhouette, including on a fresh mount.
  let opened={...T.move(approaching,T.ECHO),echo:true};
  section.dataset.fieldPos=String(opened.pos);
  section.dataset.fieldSeen=String(opened.seen);
  section.dataset.towerEcho='true';
  floor.arcs.length=0;
  floor.fills.length=0;
  root.CrownlessTowerWorld.mount({querySelector(selector){
    return selector==='.tower-field'?section:null;
  }});
  assert(floor.fills.includes('#bda46c'),
    'the discovered bell fragment is drawn after reaching the echo floor');
  const beforePulse=Math.max(...floor.arcs.map(([,,radius])=>radius));
  assert(Number.isFinite(beforePulse),'unopened bell has a visible ripple');
  opened=T.uncover(opened,T.SECRET);
  assert(opened?.open,'deliberate investigation reveals the hidden stair');
  section.dataset.fieldPos=String(opened.pos);
  section.dataset.fieldSeen=String(opened.seen);
  section.dataset.towerOpen='true';
  floor.rects.length=0;
  floor.arcs.length=0;
  root.CrownlessTowerWorld.mount({querySelector(selector){
    return selector==='.tower-field'?section:null;
  }});
  assert(floor.arcs.some(([,,radius])=>radius>beforePulse+8),
    'earned stair discovery produces a visibly stronger bell ripple');
  const firstFrames=floor.arcs.length;
  for(let time=220;time<=1020&&pending.length;time+=80)pending.shift()(time);
  assert(pending.length>0,'earned echo keeps ringing after the walking transition');
  assert(floor.arcs.length>firstFrames,'earned echo redraws, not just its first frame');
  for(let time=1100;time<=1900&&pending.length;time+=80)pending.shift()(time);
  assert.equal(pending.length,0,'earned echo stops drawing after its short celebration');
  assert(painted(241,241),'discovered stair floor becomes visible after investigation');
  assert(!painted(241,121),'reliquary remains hidden until actually approached');
});
