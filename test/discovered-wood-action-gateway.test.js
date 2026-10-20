'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('../src/slice-engine.js');
const N=require('../src/neighborhood.js');
const Nearby=require('../src/nearby-home-view.js');

function scene(state, view='detail') {
  return Nearby.render({
    state,N,E,A:{},view,
    button:(action,label,body='',options={})=>
      '<button data-action="'+action+'"'+(options.disabled?' disabled':'')+'>'+label+'</button>',
    scouting:()=>'',landmarkFlagPreview:()=>'',notice:'',nav:''
  });
}

test('only a discovered selected woodland advertises an optional action expedition',()=>{
  let state=E.initial(); state.mode='demo';
  assert.equal(N.get(state.neighborhood).biome,'wood');
  assert.match(scene(state),/data-action="action-forest-lab"/);
  assert.match(scene(state),/既存の遠征セーブや倉庫には加算されません/);
  assert.match(scene(state),/アクション遠征へ/);
  state=E.discoverDistrict(state,N.cell(400,0));
  assert.notEqual(N.get(state.neighborhood).biome,'wood');
  assert.doesNotMatch(scene(state),/action-forest-lab/,'different discovered biome must not gain action combat');
  state=E.selectDistrict(state,'-1,0');
  assert.match(scene(state),/action-forest-lab/,'returning to discovered forest restores the optional action');
});

test('forest map primary launches real-time action while legacy exploration is explicit and separate',()=>{
  let state=E.initial();state.mode='demo';
  const forest=scene(state,'map');
  const actions=forest.match(/<div class="nearby-card-actions">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(actions,'selected-land card must show its primary call-to-action');
  assert.match(actions,/data-action="action-forest-lab"[^>]*>.*アクション遠征へ/);
  assert.doesNotMatch(actions,/data-action="depart"/, 'turn-based forest must not be the default');
  const details=scene(state,'detail');
  assert.match(details,/従来の探索遠征（ターン制）/);
  assert.match(details,/data-action="depart"/, 'legacy forest remains playable from details');
  state=E.discoverDistrict(state,N.cell(400,0));
  const tower=scene(state,'map');
  const towerActions=tower.match(/<div class="nearby-card-actions">([\s\S]*?)<\/div>/)?.[1];
  assert.match(towerActions,/data-action="depart"/);
  assert.doesNotMatch(towerActions,/action-forest-lab/);
});

test('smith and active standard expedition may not launch another action run',()=>{
  let state=E.initial(); state.mode='demo';
  let smith={...state,activeCharacter:1};
  assert.match(scene(smith),/data-action="action-forest-lab" disabled/);
  assert.match(scene(smith,'map'),/data-action="action-forest-lab" disabled/);
  const journey=E.start(state,'wood');
  assert.ok(journey.expedition);
  assert.match(scene(journey),/data-action="action-forest-lab" disabled/);
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
  assert.match(source,/CrownlessActionSave/);
  assert.match(source,/saveActionProgress\(\)/);
  assert.match(source,/localStorage\.getItem\('crownless-expedition-mode'\)/);
  assert.doesNotMatch(source,/localStorage\.setItem\('crownless-expedition/);
  assert.doesNotMatch(source,/sessionStorage|geolocation|navigator\.geolocation/);
  assert.doesNotMatch(source,/src\/slice-engine\.js|src\/slice-app\.js/);
});
