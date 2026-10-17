const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const N=require('../src/neighborhood.js');
const E=require('../src/slice-engine.js');
const field=require('../src/nearby-home-view.js');

const render=(state)=>field.render({
  state,N,E,A:{},
  button:(action,title,help,opts={})=>'<button data-action="'+action+'" data-value="'+(opts.value||'')+'">'+title+'</button>',
  scouting:()=>'',landmarkFlagPreview:()=>'',notice:'',nav:''
});

test('unexplored fog does not expose hidden biomes or reveal extra destinations',()=>{
  let state=E.initial();state.mode='demo';
  let html=render(state);
  const art=html.match(/<svg class="nearby-world-canvas"[^>]*>[\s\S]*?<\/svg>/)?.[0];
  assert.ok(art,'one continuous world canvas is rendered');
  assert.equal((html.match(/class="nearby-track-tile[^"]*"/g)||[]).length,25);
  assert.match(art,/world-landmass/);
  assert.match(art,/world-river/);
  assert.match(art,/world-road-surface/);
  assert.match(art,/world-site-wood/);
  assert.doesNotMatch(art,/world-site-tower|world-site-fen|world-site-crypt/);
  assert.doesNotMatch(html,/nearby-track-mist/,'no repeating question-mark carpet');
  state=E.discoverDistrict(state,N.cell(400,0));
  html=render(state);
  assert.match(html,/world-site-tower/,'newly earned biome now paints its real landmark');
  assert.match(html,/data-action="district"/);
  assert.match(html,/data-action="depart"/);
});

test('discovery navigation is a separate row, not a floating overlay on southern POIs',()=>{
  const page=fs.readFileSync('expedition.html','utf8');
  const css=fs.readFileSync('living-world-canvas.css','utf8');
  const html=render(E.initial());
  assert.ok(html.indexOf('nearby-track-board')<html.indexOf('nearby-track-footer'));
  assert.match(css,/Connected landscape v2/);
  const rules=css.slice(css.indexOf('/* Connected landscape v2'));
  assert.match(rules,/\.nearby-track-map\s*\{\s*grid-template-rows:auto minmax\(0,1fr\) auto/);
  assert.match(rules,/\.nearby-track-footer\s*\{[\s\S]*?position:relative/);
  assert.match(rules,/\.nearby-track-tile\.track-fog::after\s*\{display:none\}/);
  assert.match(rules,/\.nearby-world-canvas\s*\{[\s\S]*?pointer-events:none/);
  assert.match(rules,/button\.nearby-track-tile:focus-visible/);
  assert.match(rules,/min-height:44px/);
  assert(page.indexOf('world-atlas-editorial.css')<page.indexOf('living-world-canvas.css'));
});

test('new canvas never adds GPS tracking, movement actions, or an unearned POI',()=>{
  const html=render({...E.initial(),mode:'walk'});
  assert.match(html,/現実の散策モード/);
  assert.match(html,/data-action="nearby-view" data-value="scout"/);
  assert.match(html,/道は模式図/);
  assert.doesNotMatch(html,/data-action="move|data-action="walk-to|geolocation\.watchPosition/);
  assert.equal((html.match(/class="nearby-world-canvas"/g)||[]).length,1);
});
