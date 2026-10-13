const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const N=require('../src/neighborhood.js');
const E=require('../src/slice-engine.js');
const map=require('../src/nearby-home-view.js');

test('every track segment joins an equal opposite edge on its neighbor',()=>{
  const sites=[
    {x:-3,y:0},{x:2,y:3},{x:0,y:-2},{x:4,y:-1}
  ];
  const edges=map.trackEdges(sites);
  const vectors={N:[0,1,'S'],E:[1,0,'W'],S:[0,-1,'N'],W:[-1,0,'E']};
  for(const [id,dirs] of edges){
    const [x,y]=id.split(',').map(Number);
    for(const dir of dirs){
      const [dx,dy,back]=vectors[dir];
      assert(edges.get((x+dx)+','+(y+dy))?.has(back),id+' -> '+dir+' has a missing counterpart');
    }
  }
  assert(edges.get('0,0')?.size>0,'roads are anchored to the settlement');
});
test('path tiles visibly distinguish bends, straights and blank ground',()=>{
  assert.match(map.roadPath(new Set(['N','E'])),/Q50 50/);
  assert.doesNotMatch(map.roadPath(new Set(['N','S'])),/Q50 50/);
  assert.equal(map.roadPath(new Set()),'');
});
test('the nearby screen has a 5x5 position-correct tile board, accessible destinations and no list pagination',()=>{
  let state=E.initial();
  state.mode='demo';
  state=E.discoverDistrict(state,N.cell(800,0));
  const html=map.render({
    state,N,E,A:{},
    button:(action,title,_body,options={})=>'<button data-action="'+action+'" data-value="'+(options.value||'')+'">'+title+'</button>',
    scouting:()=>'',landmarkFlagPreview:()=>'',notice:'',nav:''
  });
  const tiles=html.match(/class="nearby-track-tile[^"]*"/g)||[];
  assert.equal(tiles.length,25);
  assert.match(tiles[12],/selected/,'selected place is at the center');
  assert.match(html,/nearby-track-road/);
  assert.match(html,/data-action="district"/);
  assert.match(html,/data-action="tab" data-value="home"/);
  assert.match(html,/track-fog/);
  assert.match(html,/前の発見/);
  assert.doesNotMatch(html,/nearby-tile-grid|nearby-pagination/);
});
test('track map CSS is loaded after the old scene styles',()=>{
  const html=fs.readFileSync('expedition.html','utf8');
  assert(html.indexOf('neighborhood-rebuild.css') < html.indexOf('nearby-track-map.css'));
  const css=fs.readFileSync('nearby-track-map.css','utf8');
  assert.match(css,/grid-template-columns:repeat\(5/);
  assert.match(css,/nearby-track-road/);
  assert.match(css,/track-fog/);
});
