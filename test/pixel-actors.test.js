'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
test('layered actors cache parts, keep gameplay immutable and compose held equipment in every pose',()=>{
  let allocations=0;
  const sandbox={document:{createElement(){allocations++;return {getContext(){return {fillRect(){}};}};}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/pixel-actors.js'),'utf8'),sandbox);
  const art=sandbox.CrownlessPixelActors;
  let draws=0,balance=0;
  const ctx={save(){balance++;},restore(){balance--;},scale(){},drawImage(){draws++;},fillRect(){}};
  for(const role of ['traveler','companion','enemy']) {
    for(const state of ['IDLE','WALK','RUN','ATTACK','SPECIAL','HURT','DOWN','DEAD']) {
      const fighter=Object.freeze({state,animTime:1,heldWeapon:null});
      const before=JSON.stringify(fighter);
      draws=0;art.draw(ctx,fighter,{role});const bare=draws;
      draws=0;art.draw(ctx,fighter,{role,crafted:true});
      assert.equal(draws,bare+1,'forged sword is an independent visible layer in '+state);
      assert.equal(JSON.stringify(fighter),before);
      assert.equal(balance,0,'canvas transforms cannot leak into other actors');
    }
  }
  const afterWarmup=allocations;
  for(let frame=0;frame<100;frame++) art.draw(ctx,{state:'RUN',animTime:frame},{role:'traveler',crafted:true});
  assert.equal(allocations,afterWarmup,'animated frames reuse cached pixel parts');
  assert(afterWarmup<40,'part cache stays small across palettes and animation states');
  draws=0;art.draw(ctx,{state:'ATTACK',animTime:1,heldWeapon:{type:'stone'}},{role:'traveler'});
  assert(draws>6,'temporary held items still render');
});
