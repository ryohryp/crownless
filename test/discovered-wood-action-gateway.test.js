'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('../src/slice-engine.js');
const N=require('../src/neighborhood.js');
const Nearby=require('../src/nearby-home-view.js');

function detail(state) {
  return Nearby.render({
    state,N,E,A:{},view:'detail',
    button:(action,label,body='',options={})=>
      '<button data-action="'+action+'"'+(options.disabled?' disabled':'')+'>'+label+'</button>',
    scouting:()=>'',landmarkFlagPreview:()=>'',notice:'',nav:''
  });
}

test('only a discovered selected woodland advertises an optional action expedition',()=>{
  let state=E.initial(); state.mode='demo';
  assert.equal(N.get(state.neighborhood).biome,'wood');
  assert.match(detail(state),/data-action="action-forest-lab"/);
  assert.match(detail(state),/既存の遠征セーブや倉庫には加算されません/);
  assert.match(detail(state),/この森でアクション遠征/);
  state=E.discoverDistrict(state,N.cell(400,0));
  assert.notEqual(N.get(state.neighborhood).biome,'wood');
  assert.doesNotMatch(detail(state),/action-forest-lab/,'different discovered biome must not gain action combat');
  state=E.selectDistrict(state,'0,0');
  assert.match(detail(state),/action-forest-lab/,'returning to discovered forest restores the optional action');
});

test('smith and active standard expedition may not launch another action run',()=>{
  let state=E.initial(); state.mode='demo';
  let smith={...state,activeCharacter:1};
  assert.match(detail(smith),/data-action="action-forest-lab" disabled/);
  const journey=E.start(state,'wood');
  assert.ok(journey.expedition);
  assert.match(detail(journey),/data-action="action-forest-lab" disabled/);
});

test('action experiment is a one-way optional switch with no precise location or production save mutation',()=>{
  const app=fs.readFileSync('src/slice-app.js','utf8');
  const source=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(app,/action === 'action-forest-lab'/);
  assert.match(app,/state\.neighborhood\?\.districts\?\.some\(site => site\.id === d\.id\)/);
  assert.match(app,/state\.activeCharacter === 0 && !conflict && !saveBlocked/);
  assert.match(app,/gemini-feel-lab\.html\?from=discovered-wood/);
  assert.match(source,/id="rpgBackToMap"/);
  assert.match(source,/if \(rpg\.phase !== 'camp'/);
  assert.match(source,/window\.location\.assign\('expedition\.html'\)/);
  assert.doesNotMatch(source,/localStorage|sessionStorage|geolocation|navigator\.geolocation/);
  assert.doesNotMatch(source,/src\/slice-engine\.js|src\/slice-app\.js/);
});
