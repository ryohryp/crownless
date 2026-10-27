'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const G=require('../src/gemini-combat-gesture.js');
test('tap and micro-movements become a punch, not accidental mobility',()=>{
  for(const [x,y] of [[0,0],[6,8],[20,20],[-34,0]]) assert.equal(G.resolve(x,y),'punch');
});
test('both horizontal swipes trigger kick/throw',()=>{
  for(const x of [-80,-36,36,90]) assert.equal(G.resolve(x,0),'kick');
});
test('vertical swipes trigger jump and grab / team ability',()=>{
  assert.equal(G.resolve(0,-60),'jump');
  assert.equal(G.resolve(0,70),'grab');
});
test('clear diagonals are deliberate and invalid coordinates never trigger combat',()=>{
  assert.equal(G.resolve(60,-20),'kick');
  assert.equal(G.resolve(20,-70),'jump');
  assert.equal(G.resolve(-20,70),'grab');
  for(const v of [Infinity,-Infinity,NaN]) assert.equal(G.resolve(v,40),null);
});
test('moving scenery fence is removed and legacy thumb controls only compare below stage',()=>{
  const source=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(source,/src\/gemini-combat-gesture\.js/);
  assert.match(source,/id="gestureActionArea"/);
  assert.match(source,/id="btnToggleInput"/);
  assert.match(source,/id="arcadeActionButtons" class="hidden/);
  assert.match(source,/state\.isSplitDeckLayout = !gestures/);
  assert.doesNotMatch(source,/CrownlessControlBarricade|drawControlBarricade|controlBarricade|木柵の向こうは通れない/);
  assert.doesNotMatch(source,/CrownlessActionBarrierReadout/);
  assert.match(source,/leftTouchPadArea\.addEventListener\('pointerdown'/);
  assert.match(source,/gestureArea\.addEventListener\('pointerdown'/);
  assert.match(source,/touchInput\[flag\] = true/);
});
