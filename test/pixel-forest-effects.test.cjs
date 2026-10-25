'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const FX = require('../src/pixel-forest-effects.js');

function fakeContext() {
  const calls = {saved:0,restored:0,drawn:0};
  const gradient = {addColorStop() {}};
  const ctx = {
    save(){calls.saved++;},restore(){calls.restored++;},translate(){},
    createRadialGradient(){return gradient;},
    beginPath(){},moveTo(){},lineTo(){},closePath(){},
    fill(){calls.drawn++;},fillRect(){calls.drawn++;},
    set fillStyle(_value){},set globalAlpha(_value){}
  };
  return {ctx,calls};
}
test('Canvas forest FX are presentation-only, reversible and bounded', () => {
  const fx=FX.create({enabled:false});
  const {ctx,calls}=fakeContext();
  const hero={x:235,z:320,y:0}, found=new Set();
  fx.background(ctx,390,10,1000);
  fx.overlay(ctx,10,390,1000,hero,found,false);
  assert.equal(calls.drawn,0,'opt-out must not render');
  assert.equal(fx.burst(240,310,25,'hit',1000),false);
  fx.setEnabled(true);
  fx.background(ctx,390,10,1016);
  fx.overlay(ctx,10,390,1016,hero,found,false);
  assert(calls.drawn>0,'opt-in adds visible scene paint');
  assert.equal(fx.burst(800,365,30,'discovery',1020),true);
  assert.equal(fx.readout().sparks,17);
  fx.burst(535,290,32,'victory',1020);
  fx.burst(600,300,20,'hit',1020);
  fx.burst(610,300,20,'hit',1020);
  assert(fx.readout().sparks<=48,'particles must be capped');
  fx.overlay(ctx,10,390,1080,hero,found,true);
  fx.overlay(ctx,10,390,3000,hero,found,true);
  assert.equal(fx.readout().sparks,0,'particles expire');
  fx.setEnabled(false);
  assert.equal(fx.readout().sparks,0,'disable clears pending flashes');
  assert.equal(calls.saved,calls.restored,'Canvas transform state must be balanced');
  fx.reset();
  assert.equal(fx.readout().lastBurst,'');
});
test('real action forest uses optional rendering module without altering saves or GPS', () => {
  const root=path.resolve(__dirname,'..');
  const html=fs.readFileSync(path.join(root,'gemini-feel-lab.html'),'utf8');
  const css=fs.readFileSync(path.join(root,'pixel-forest.css'),'utf8');
  assert.match(html,/<script src="src\/pixel-forest-effects\.js"><\/script>/);
  assert.match(html,/id="btnForestAtmosphere"/);
  assert.match(html,/forestEffects\.background\(/);
  assert.match(html,/forestEffects\.overlay\(/);
  assert.match(html,/forestEffects\.burst\(target\.x/);
  assert.match(html,/forestEffects\.burst\(discovery\.spot\.x/);
  assert.match(css,/\.forest-atmosphere-toggle/);
  const effectSource=fs.readFileSync(path.join(root,'src/pixel-forest-effects.js'),'utf8');
  assert.doesNotMatch(effectSource,/localStorage|sessionStorage|geolocation|fetch\(/);
});
