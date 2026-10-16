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

test('unresolved tower bell clue is visible on the map and actionable first in details',()=>{
  let state=E.initial();state.mode='demo';
  state=E.discoverDistrict(state,N.cell(400,0));
  const render=view=>map.render({state,N,E,A:{},view,
    button:(action,title,body='',options={})=>'<button data-action="'+action+'" data-value="'+(options.value||'')+'">'+title+(body?' — '+body:'')+'</button>',
    scouting:()=>'',landmarkFlagPreview:()=>'',notice:'',nav:''
  });
  const mapHtml=render('map'),detailHtml=render('detail');
  assert.match(mapHtml,/鐘の謎を調べる/);
  assert.match(mapHtml,/石段の奥に、鍛冶へつながる手掛かり/);
  assert.ok(detailHtml.indexOf('UNRESOLVED \/ 鐘の反響')<detailHtml.indexOf('ABOUT THIS LAND'),
    'bell clue and meaningful departure should appear before generic lore');
  assert.match(detailHtml,/data-action="poi" data-value="clue">鐘の手掛かりを追って出発/);
  assert.match(detailHtml,/生還できなければ失う/);
  assert.doesNotMatch(detailHtml,/generated-watchtower-inkwash|a_wide_atmospheric/, 'unapproved art is never added to runtime');

  state=E.discoverDistrict(state,N.cell(800,0));
  assert.equal(N.pointOfInterest(N.get(state.neighborhood)).family,'shop');
  const shopHtml=render('map');
  assert.doesNotMatch(shopHtml,/鐘の謎を調べる|石段の奥に、鍛冶へつながる手掛かり/);
  state=E.selectDistrict(state,'0,1');
  state={...state,designs:{...state.designs,shield_thorn:'0,1'}};
  assert.doesNotMatch(render('map'),/鐘の謎を調べる/,'restored bell should show its own established action');
  assert.match(render('map'),/ユノに会う/);
});
