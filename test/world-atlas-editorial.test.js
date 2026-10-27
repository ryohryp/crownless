const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const N = require('../src/neighborhood.js');
const E = require('../src/slice-engine.js');
const Map = require('../src/nearby-home-view.js');

const render = (state) => Map.render({
  state, N, E, A: {},
  button: (action,label,body,options={}) => '<button data-action="'+action+'" data-value="'+(options.value||'')+'"'+(options.disabled?' disabled':'')+'>'+label+'</button>',
  scouting: () => '<button data-action="gps">場所を確認</button>',
  landmarkFlagPreview: () => '',
  notice: '',
  nav: '<nav class="camp-tabs bottom-navigation"></nav>'
});

test('first phone scene uses a visible world-atlas hierarchy backed by current state', () => {
  const state = E.initial();
  state.mode = 'demo';
  const html = render(state);
  assert.match(html, /CROWNLESS \/ WORLD ATLAS/);
  assert.match(html, /<strong>世界図<\/strong>/);
  assert.match(html, /nearby-atlas-metrics/);
  assert.match(html, /発見 <b>\d+<\/b>/);
  assert.match(html, /開拓 <b>\d+<\/b>/);
  assert.match(html, /SELECTED LAND \/ 01/);
  assert.match(html, /アクション遠征へ/);
  assert.match(html, /nearby-card-actions/);
  assert.match(html, /data-action="nearby-view" data-value="scout"/);
  assert.match(html, /data-action="settings"/);
  assert.equal((html.match(/class="nearby-track-tile/g)||[]).length,25);
  assert.match(html, /nearby-track-road|nearby-track-board/);
});

test('existing real-world discovery and character-specific departures keep their actions', () => {
  let state = E.initial();
  state.mode = 'walk';
  let html=render(state);
  assert.match(html,/現実の散策モード/);
  assert.match(html,/data-action="action-forest-lab"/);
  state = E.switchCharacter(state,1);
  html=render(state);
  assert.match(html,/data-action="action-forest-lab"[^>]*disabled/);
  assert.match(html,/旅人に交代してアクション遠征/);
});

test('stylesheet changes the actual landing atlas after the previous editorial theme', () => {
  const page=fs.readFileSync('expedition.html','utf8');
  const atlas=fs.readFileSync('world-atlas-editorial.css','utf8');
  assert(page.indexOf('editorial-loop.css') < page.indexOf('world-atlas-editorial.css'));
  assert.match(atlas,/\.nearby-map-top/);
  assert.match(atlas,/\.nearby-track-board/);
  assert.match(atlas,/\.nearby-card-actions/);
  assert.match(atlas,/\.camp-tabs\.bottom-navigation/);
  assert.match(atlas,/\.track-fog/);
  assert.match(atlas,/\.nearby-track-road/);
  assert.match(atlas,/\[aria-current="page"\]/);
  assert.match(atlas,/min-height:48px|min-height:50px/);
  assert.match(atlas,/safe-area|One|GPS|topology/);
});
