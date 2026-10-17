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

test('three earned northern towers have distinct silhouettes and honest shop/event cues',()=>{
  let state=E.initial();
  state.mode='demo';
  for(const meters of [400,800,1200])state=E.discoverDistrict(state,N.cell(meters,0));
  const html=render(state);
  const art=html.match(/<svg class="nearby-world-canvas"[^>]*>[\s\S]*?<\/svg>/)?.[0];
  assert.ok(art);
  const towers=[...art.matchAll(/class="world-site world-site-tower world-variant-(\d) world-family-(\w+) world-state-(\w+)"/g)];
  assert.equal(towers.length,3,'three discovered tower locations retain three visible landmarks');
  assert.deepEqual(new Set(towers.map(m=>m[1])).size,3,'different watchtowers do not share one copied silhouette');
  assert.deepEqual(new Set(towers.map(m=>m[2])),new Set(['shop','event']));
  assert.equal((html.match(/class="nearby-track-tile[^"]*"/g)||[]).length,25);
  assert.doesNotMatch(art,/world-site-fen|world-site-crypt/,'no unearned biome appears');

  state.neighborhood.districts.find(d=>d.id==='0,2').claimed=true;
  state.neighborhood.districts.find(d=>d.id==='0,2').aided=true;
  state.neighborhood.districts.find(d=>d.id==='0,1').visitor='supplies';
  state.designs={...state.designs,shield_thorn:'0,3'};
  const changed=render(state);
  assert.match(changed,/world-state-restored/);
  assert.match(changed,/world-bell/);
  assert.match(changed,/world-owned/);
  assert.match(changed,/world-trace/);
  assert.match(changed,/world-parcel/);
  assert.equal((changed.match(/class="nearby-world-canvas"/g)||[]).length,1);
});

test('curved local road arms keep exact shared edge midpoint and do not alter canonical track geometry',()=>{
  const north=field.scenicRoadPath(new Set(['N']),0,1);
  const south=field.scenicRoadPath(new Set(['S']),0,2);
  assert.match(north,/^M50 50 C\d+ 34 50 18 50 0$/);
  assert.match(south,/^M50 50 C\d+ 66 50 82 50 100$/);
  assert.notEqual(field.scenicRoadPath(new Set(['N']),0,1),field.scenicRoadPath(new Set(['N']),0,2));
  assert.equal(field.scenicRoadPath(new Set(),0,0),'');
  assert.equal(field.roadPath(new Set(['N','E'])),'M50 0 Q50 50 100 50');
  assert.equal(field.trackEdges([{x:0,y:3}]).get('0,1').has('N'),true);
});

test('discovery pager has a dedicated unbroken number and phone-safe three-column layout',()=>{
  let state=E.initial();state.mode='demo';
  state=E.discoverDistrict(state,N.cell(400,0));
  const html=render(state);
  assert.match(html,/class="nearby-track-position" aria-label="発見した土地 2 \/ 2"/);
  const css=fs.readFileSync('living-world-canvas.css','utf8');
  assert.match(css,/\.nearby-track-footer \.nearby-track-switch\s*\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1fr\)/);
  assert.match(css,/\.nearby-track-footer \.nearby-track-position\s*\{[\s\S]*?white-space:nowrap/);
  assert.match(css,/\.nearby-track-switch button\s*\{[\s\S]*?min-height:44px/);
  assert.match(html,/前の発見/);
  assert.match(html,/次の発見/);
});
