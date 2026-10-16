const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const N=require('../src/neighborhood.js');
const E=require('../src/slice-engine.js');
const view=require('../src/nearby-home-view.js');

function render(state){
  return view.render({state,N,E,A:{},
    button:(action,title,body,opts={})=>'<button data-action="'+action+'" data-value="'+(opts.value||'')+'">'+title+'</button>',
    scouting:()=>'<button data-action="gps">現在地を発見</button>',
    landmarkFlagPreview:()=>'',notice:'',nav:'<nav class="camp-tabs bottom-navigation"></nav>'
  });
}

test('one continuous ink illustration sits behind 25 earned-destination hit targets',()=>{
  const state=E.initial();
  state.mode='demo';
  const html=render(state);
  const tiles=html.match(/class="nearby-track-tile[^"]*"/g)||[];
  const world=html.match(/class="nearby-world-canvas"/g)||[];
  assert.equal(tiles.length,25);
  assert.equal(world.length,1,'the landscape is painted as one SVG, not 25 tiled scenes');
  assert.doesNotMatch(html,/class="nearby-terrain-wash"/);
  assert.match(tiles[12],/selected/);
  assert.match(html,/nearby-track-road/);
  assert.match(html,/world-road-surface/);
  assert.match(html,/world-landmass/);
  assert.match(html,/track-fog/);
  assert.match(html,/data-action="district"/);
  assert.match(html,/data-action="nearby-view" data-value="scout"/);
  assert.match(html,/data-action="depart" data-value="wood"/);
  assert.match(html,/data-action="settings"/);
  assert.match(html,/この土地へ遠征/);
  assert.match(html,/道は模式図/);
});
test('same scenic field still renders the normal detail and real-world scouting views',()=>{
  const state=E.initial();
  state.mode='walk';
  const map=render(state);
  assert.match(map,/現実の散策モード/);
  assert.match(map,/土地を発見/);
  const detail=view.render({state,N,E,A:{},
    button:(action,title)=>'<button data-action="'+action+'">'+title+'</button>',
    scouting:()=>'',landmarkFlagPreview:()=>'',notice:'',nav:'',view:'detail'});
  assert.match(detail,/nearby-scene--reading/);
  assert.match(detail,/nearby-secondary-content/);
  assert.match(detail,/地図に戻る/);
});
test('full-bleed map is declared after atlas styling with visible, reachable controls',()=>{
  const html=fs.readFileSync('expedition.html','utf8');
  const css=fs.readFileSync('living-world-canvas.css','utf8');
  assert(html.indexOf('world-atlas-editorial.css')<html.indexOf('living-world-canvas.css'));
  assert.match(css,/\.nearby-track-board\s*\{[\s\S]*?width:100%;[\s\S]*?height:100%;[\s\S]*?aspect-ratio:auto;/);
  assert.match(css,/\.nearby-world-canvas/);
  assert.match(css,/\.world-river/);
  assert.match(css,/\.world-stone/);
  assert.match(css,/\.nearby-track-road/);
  assert.match(css,/\.nearby-card-actions button/);
  assert.match(css,/\.bottom-navigation-item\.active/);
  assert.match(css,/min-height:48px/);
  assert.match(css,/safe-area|height:100%/);
  assert.doesNotMatch(css,/pointer-events:none[^}]*\.nearby-track-tile/);
});
