'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const B=require('../src/gemini-control-barricade.js');
const view={left:0,top:100,right:360,bottom:700,width:360,height:600};
const buttons=[
  {left:144,right:224,top:526,bottom:612},
  {left:246,right:326,top:570,bottom:663},
  {left:190,right:254,top:532,bottom:604},
  {left:275,right:340,top:528,bottom:610},
];
test('thumb arc defines a lower-right fence matching real button positions',()=>{
  const zone=B.measure(view,buttons,252,420);
  assert(zone);
  assert(zone.left>50 && zone.left<125);
  assert(zone.top>280 && zone.top<310);
  assert.equal(zone.screenWidth,252);
  const f={x:zone.left+36,z:zone.top+31,vx:130,vz:80};
  assert(B.excluded(f,zone));
  B.project(f,zone);
  assert.equal(B.excluded(f,zone),false,'no fighter stands beneath a control button');
});
test('knockback slides along the top rail rather than phasing through it',()=>{
  const zone=B.measure(view,buttons,252,420);
  const entity={x:zone.left+66,z:zone.top+3,vx:210,vz:100};
  assert(B.project(entity,zone));
  assert.equal(entity.z,zone.top);
  assert.equal(entity.vz,0);
  assert.equal(entity.vx,210,'allow lateral combat along the fence');
});
test('approaching from left slides on left barrier rather than stopping depth movement',()=>{
  const zone=B.measure(view,buttons,252,420);
  const entity={x:zone.left+3,z:zone.top+60,vx:100,vz:-120};
  B.project(entity,zone);
  assert.equal(entity.x,zone.left);
  assert.equal(entity.vx,0);
  assert.equal(entity.vz,-120,'allow moving up out of the corner');
});
test('camera follows the hero without creating gaps under screen-fixed buttons',()=>{
  const zone=B.measure(view,buttons,252,420);
  for(const cameraX of [0,80,250,390]){
    const at={x:cameraX+zone.left+50,z:zone.top+25,vx:230,vz:100};
    B.project(at,zone,cameraX);
    assert.equal(B.excluded(at,zone,cameraX),false);
  }
});
test('split deck and nonoverlapping control geometry leave full stage accessible',()=>{
  const outOfStage=buttons.map(b=>({...b,top:b.top+400,bottom:b.bottom+400}));
  assert.equal(B.measure(view,outOfStage,252,420),null);
  assert.equal(B.project({x:200,z:350},null),false);
  assert.equal(B.measure({left:0,top:0,right:0,bottom:0,width:0,height:0},buttons,252,420),null);
});
