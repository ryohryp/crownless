/* Production neighborhood scene. One renderer owns map, selected card and
   secondary discovery/lore views. No mutation observers or independent saves. */
(function (root, factory) {
  const api=factory(root);
  if (typeof module==='object' && module.exports) module.exports=api;
  if (root) root.CrownlessNearbyHome=api;
})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';
  // Each road edge is shared by its two adjacent tiles. Paths cannot visually
  // break at a tile boundary, even when the destination is beyond the viewport.
  function trackEdges(districts){
    const edges=new Map();
    const mark=(x,y,dir)=>{
      const id=x+','+y;
      if(!edges.has(id))edges.set(id,new Set());
      edges.get(id).add(dir);
    };
    const step=(x,y,nx,ny)=>{
      if(nx>x){mark(x,y,'E');mark(nx,ny,'W');}
      else if(nx<x){mark(x,y,'W');mark(nx,ny,'E');}
      else if(ny>y){mark(x,y,'N');mark(nx,ny,'S');}
      else if(ny<y){mark(x,y,'S');mark(nx,ny,'N');}
    };
    for(const target of districts||[]){
      if(!Number.isInteger(target?.x)||!Number.isInteger(target?.y))continue;
      let x=0,y=0;
      const xFirst=(Math.abs(target.x)+Math.abs(target.y))%2===0;
      const walkX=()=>{while(x!==target.x){const next=x+Math.sign(target.x-x);step(x,y,next,y);x=next;}};
      const walkY=()=>{while(y!==target.y){const next=y+Math.sign(target.y-y);step(x,y,x,next);y=next;}};
      if(xFirst){walkX();walkY();}else{walkY();walkX();}
    }
    return edges;
  }
  function roadPath(directions){
    const d=directions||new Set();
    if(!d.size)return '';
    const points={N:'50 0',E:'100 50',S:'50 100',W:'0 50'};
    const active=Object.keys(points).filter(key=>d.has(key));
    if(active.length===2&&!((d.has('N')&&d.has('S'))||(d.has('E')&&d.has('W')))){
      return 'M'+points[active[0]]+' Q50 50 '+points[active[1]];
    }
    return active.map(key=>'M50 50 L'+points[key]).join(' ');
  }
  function landmarkIcon(biome){
    const art={
      wood:'<path d="M15 37l9-15 9 15H15zm7-15 6-11 7 13m-14 14v5m15-6 7-11 7 11h-14m7 0v6"/>',
      tower:'<path d="M20 43V17h27v26M17 17h33v-5H17zM24 23h6m8 0h6M30 43v-11h8v11M15 43h39"/>',
      fen:'<path d="M9 42h45M10 35q9-8 18 0t18 0m-31-12v13m-3-10 3 4 3-6m23-8v23m-4-17 4 3 4-6"/>',
      crypt:'<path d="M13 43h41M18 43v-16l14-15 14 15v16M22 27h20M30 43v-9h7v9M26 19h12"/>'
    }[biome]||'';
    return '<svg viewBox="0 0 64 52" focusable="false" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">'+art+'</g></svg>';
  }
  // Curved segments meet at the exact same mid-edge point, so neighboring
  // fictional roads still connect even though their interior bends vary.
  function scenicRoadPath(directions,x,y){
    const turns={
      N:(v)=>'M50 50 C'+(50+v)+' 34 50 18 50 0',
      S:(v)=>'M50 50 C'+(50-v)+' 66 50 82 50 100',
      E:(v)=>'M50 50 C66 '+(50+v)+' 82 50 100 50',
      W:(v)=>'M50 50 C34 '+(50-v)+' 18 50 0 50'
    };
    const dirs=['N','E','S','W'].filter(dir=>directions?.has(dir));
    const drift=7+Math.abs(x*17+y*11)%7;
    return dirs.map(dir=>turns[dir](((x*31+y*19+dir.charCodeAt(0))%2===0)?drift:-drift)).join(' ');
  }
  // One continuous illustrated surface behind the existing 5x5 discovery
  // hit targets. Only saved, earned fictional biomes receive landmarks.
  // The parchment, hills and stream reveal NO undiscovered place identity.
  function worldCanvas(selected, found, track, getPoi, restoredId) {
    const wood = '<path class="world-tree-mass" d="M-48 40q13-33 28-29t28 8q11-32 25-20t20 37v21h-101z"/>'+
      '<path class="world-tree" d="M-35 42l13-38 13 38m-20-13 7-15 7 15m-7 13v17M5 38l12-43 14 43m-21-13 7-17 8 17m-8 15v16M27 47l11-27 11 27m-17-9 6-9 5 9m-5 11v11"/>';
    const tower = '<path class="world-stone" d="M-33 51v-13h11V-6h43v57h12v7h-66zM-27-6h53v-9h-53z"/>'+
      '<path class="world-detail" d="M-13 51V30q11-17 23 0v21M-15 3h9v14h-9M7 3h9v14H7M-30-15v-7m14 7v-7m14 7v-7m14 7v-7m14 7v-7"/>'+
      '<path class="world-flag" d="M8-23v-21l19 7-19 6z"/>';
    const fen = '<path class="world-water" d="M-54 23q23-26 43-6t35 7q19-10 33-26M-58 38q22-23 44-4t39 5q18-12 32-26"/>'+
      '<path class="world-reed" d="M-34 47v-33m-6 14 6-7 7 9M-12 38V0m-7 14 7-7 7 9M18 51V12m-7 13 7-8 6 8M39 33V-9m-7 13 7-9 8 11"/>';
    const crypt = '<path class="world-hill" d="M-58 50q10-53 55-56t62 56z"/>'+
      '<path class="world-stone" d="M-34 56V6l31-27L31 6v50zM-39 7l36-36L37 7"/>'+
      '<path class="world-detail" d="M-13 56V24q11-22 23 0v32m-53 0h86M-27 14h8m33 0h8"/>';
    // Distinct place silhouettes are earned from the same saved district:
    // coordinate, POI family, ownership, NPC trace, and restored bell state.
    // Variant is deterministic and adds no fictional event to the save.
    const towerShapes=[
      '<path class="world-stone" d="M-37 54V18h11V-4h24v58h9V11h25v43h8v7h-77zM-31-4h36v-7h-36z"/>'+
        '<path class="world-detail" d="M-22 9h10v12h-10m27-1h11v10H5M-18 55V38q8-12 16 0v17M16 55V34q7-11 14 0v21"/>',
      '<path class="world-stone" d="M-28 55V12h9V-13h38v68h12v7h-59zM-25-13h9v-7h8v7h9v-7h8v7h12"/>'+
        '<path class="world-detail" d="M-12-1h8v13h-8m18-13h8v13H6M-7 55V35q8-15 16 0v20M-28 26h46m-44 12h44"/>',
      '<path class="world-stone" d="M-37 55V32h12V4h36v50h20V27h7v35h-75zM-28 4h11v-8h10v8h10v-8h12"/>'+
        '<path class="world-detail" d="M-16 16h9v12h-9m18-12h8v12H2M-22 55V40q8-11 16 0v15M12 53h16M-36 26h12"/>'
    ];
    const props={wood,tower,fen,crypt};
    function siteDrawing(place,col,row){
      const variant=Math.abs(place.x*13+place.y*7)%3;
      const poi=getPoi(place);
      const family=poi?.family==='shop'?'shop':'event';
      const restored=place.id===restoredId;
      const base=place.biome==='tower'?towerShapes[variant]:(props[place.biome]||'');
      const accent=family==='shop'
        ? '<path class="world-trader" d="M-44 52l10-14h18l10 14zm10-14v-6h18v6M-39 52v11m28-11v11"/>'
        : '<path class="world-mystery" d="M35 48l8-23 8 23zM39 43h8M43 25v-7"/>';
      const earned=restored
        ? '<path class="world-bell" d="M-11-26q0-10 11-10t11 10l5 13h-32zM-9-11h18M-3-9q3 6 6 0"/>'+
          '<path class="world-light" d="M-21-22l-9-9m51 9 9-9"/>'
        : place.claimed
          ? '<path class="world-owned" d="M-45-10v-19l20 7-20 6M-45-10v22"/>'
          : '';
      const trace=place.aided?'<path class="world-trace" d="M23 46v-18l13-7v25M23 28h13"/>':'';
      const visitor=place.visitor==='supplies'
        ? '<path class="world-parcel" d="M25 55h23v17H25zM25 55l11 8 12-8m-12 8v9"/>':'';
      const state=restored?'restored':place.claimed?'claimed':place.visitor==='supplies'?'supplied':place.aided?'aided':'unclaimed';
      return '<g class="world-site world-site-'+place.biome+' world-variant-'+variant+
        ' world-family-'+family+' world-state-'+state+'" transform="translate('+
        (col*100+50)+' '+(row*100+50)+')">'+base+accent+earned+trace+visitor+'</g>';
    }
    const marks=[],segments=[];
    for(let row=0;row<5;row++)for(let col=0;col<5;col++){
      const x=selected.x+col-2, y=selected.y+2-row, id=x+','+y;
      const place=found.get(id), directions=track.get(id);
      if(directions?.size)segments.push('<path transform="translate('+(col*100)+' '+(row*100)+')" d="'+scenicRoadPath(directions,x,y)+'"/>');
      if(place&&Object.hasOwn(props,place.biome))marks.push(siteDrawing(place,col,row));
    }
    const roads=segments.join('');
    return '<svg class="nearby-world-canvas" viewBox="0 0 500 500" preserveAspectRatio="none" aria-hidden="true" focusable="false">'+
      '<defs><linearGradient id="crownless-land" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ece7d8"/><stop offset=".56" stop-color="#c6c5b2"/><stop offset="1" stop-color="#ded6c6"/></linearGradient>'+
      '<linearGradient id="crownless-mist" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f6f3e9" stop-opacity=".15"/><stop offset=".55" stop-color="#f8f4e9" stop-opacity=".1"/><stop offset="1" stop-color="#e9e6dc" stop-opacity=".6"/></linearGradient></defs>'+
      '<rect width="500" height="500" fill="url(#crownless-land)"/>'+
      '<g class="world-landmass">'+
        '<path d="M-20 135Q46 28 107 79T243 55T391 99T520 39V0H-20Z"/>'+
        '<path d="M-20 253Q75 139 146 184T309 128T520 167V285Q390 215 303 259T120 230T-20 314Z"/>'+
        '<path d="M-20 440Q70 349 154 397T321 348T520 385V520H-20Z"/></g>'+
      '<g class="world-contour">'+
        '<path d="M-15 154Q46 65 103 112T237 88T394 132T520 64"/>'+
        '<path d="M-12 273Q65 179 158 209T318 170T517 203"/>'+
        '<path d="M-15 461Q69 376 151 427T320 381T518 416"/></g>'+
      '<g class="world-river">'+
        '<path d="M381-25Q317 80 359 132T333 260Q283 318 356 383T321 525"/>'+
        '<path d="M389-25Q325 80 367 133T341 261Q293 317 364 383T329 525"/></g>'+
      '<g class="world-roads nearby-track-road" aria-hidden="true">'+
        '<g class="world-road-edge">'+roads+'</g>'+
        '<g class="world-road-surface">'+roads+'</g>'+
        '<g class="world-road-trail">'+roads+'</g></g>'+
      '<g class="world-earned-sites">'+marks.join('')+'</g>'+
      '<g class="world-wisps">'+
        '<path d="M-15 83Q89 37 169 81T352 69T516 97"/>'+
        '<path d="M-11 335Q88 300 168 329T355 308T514 339"/>'+
        '<path d="M-14 488Q81 446 188 472T364 465T515 486"/></g>'+
      '<rect width="500" height="500" fill="url(#crownless-mist)" pointer-events="none"/></svg>';
  }
  function render({state,N,E,A,button,scouting,landmarkFlagPreview,notice,nav,view='map',page=null}) {
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const n=state.neighborhood,d=N.get(n),p=E.place(d.biome),poi=N.pointOfInterest(d);
    const restored=state.designs?.shield_thorn===d.id;
    const materialId=E.REGIONAL_MATERIAL[d.biome],material=materialId&&E.MATERIALS[materialId];
    const locked=d.biome==='crypt'&&state.cleared.length<2,traveler=state.activeCharacter===0;
    // Only an undisputed tower event has the bell-echo lead. A shop, a
    // restored bell or a different biome must not pretend to offer it.
    const towerMystery=d.biome==='tower'&&poi.family==='event'&&!restored;
    // A fixed 5x5 camera is deliberately centered on the selected district.
    // Coordinates are fictional coarse districts, not live GPS or real roads.
    const selectedIndex=Math.max(0,n.districts.findIndex(item=>item.id===d.id));
    const track=trackEdges(n.districts);
    const found=new Map(n.districts.map(place=>[place.id,place]));
    const cells=[];
    for(let y=d.y+2;y>=d.y-2;y--){
      for(let x=d.x-2;x<=d.x+2;x++){
        const id=x+','+y,place=found.get(id),home=x===0&&y===0;
        const land=place?'<span class="nearby-track-icon" aria-hidden="true">'+landmarkIcon(place.biome)+'</span>':'';
        const changed=Boolean(place&&state.designs?.shield_thorn===place.id);
        const marker=place?(changed?'🔔':place.claimed?'⚑':place.visitor==='supplies'?'✦':place.aided?'✧':''):'';
        const poi=place?N.pointOfInterest(place):null;
        const kind=poi?(poi.family==='shop'?'◆ 店':'✦ 異変'):'';
        const poiStamp=poi?(root.CrownlessMapPixelArt?.sprite?.(poi.family)||
          A.poiStamp?.(place.biome,poi.family)||(poi.family==='shop'?'◆':'✦')):'';
        const classes='nearby-track-tile'+(place?' track-'+place.biome:' track-fog')+
          (id===d.id?' selected':'')+(changed?' restored-bell':'')+(home?' track-home':'')+
          (place?.claimed?' claimed':'');
        const inner=
          (home?'<span class="nearby-track-camp" aria-hidden="true">⌂</span>':'')+
          land+
          (poiStamp?'<span class="nearby-tile-stamp" aria-hidden="true">'+poiStamp+'</span>':'')+
          (marker?'<span class="nearby-track-flag" aria-hidden="true">'+marker+'</span>':'')+
          (place?'<span class="nearby-track-name">'+esc(N.title(place))+'</span>':'')+
          (home?'<span class="nearby-track-home-label">拠点</span>':'');
        if(place)cells.push('<button type="button" class="'+classes+'" data-poi-family="'+poi.family+'" data-action="district" data-value="'+esc(id)+
          '" aria-pressed="'+(id===d.id)+'" aria-label="'+esc(N.title(place)+'、'+kind+
            (changed?'、鐘が戻った':place.visitor==='supplies'?'、薬師の荷':place.claimed?'、開拓済み':''))+'">'+inner+'</button>');
        else if(home)cells.push('<button type="button" class="'+classes+'" data-action="tab" data-value="home" aria-label="拠点を開く">'+inner+'</button>');
        else cells.push('<div class="'+classes+'" aria-hidden="true">'+inner+'</div>');
      }
    }
    const previous=n.districts[(selectedIndex-1+n.districts.length)%n.districts.length];
    const next=n.districts[(selectedIndex+1)%n.districts.length];
    const switcher=n.districts.length>1?'<div class="nearby-track-switch">'+
      button('district','‹ 前の発見','',{class:'secondary',value:previous.id})+
      '<span class="nearby-track-position" aria-label="発見した土地 '+(selectedIndex+1)+' / '+n.districts.length+'">'+(selectedIndex+1)+' / '+n.districts.length+'</span>'+
      button('district','次の発見 ›','',{class:'secondary',value:next.id})+'</div>':'';
    const map='<div class="nearby-paper-map nearby-track-map" role="group" aria-label="道がつながる近所のタイル地図">'+
      '<header class="nearby-map-top"><div class="nearby-atlas-heading"><span class="nearby-atlas-overline">CROWNLESS / WORLD ATLAS</span>'+
      '<strong>世界図</strong><small>'+esc(n.name)+' · '+(state.mode==='demo'?'散策体験モード':'現実の散策モード')+'</small></div>'+
      '<div class="nearby-atlas-metrics" aria-label="探索の記録"><span>発見 <b>'+n.districts.length+'</b></span>'+
      '<span>開拓 <b>'+N.claims(n)+'</b></span><span>建物 '+n.buildings.length+'</span></div>'+
      button('nearby-view','＋ 土地を発見','',{class:'nearby-top-action',value:'scout'})+
      button('settings','⚙','',{class:'nearby-map-settings'})+'</header>'+
      '<div class="nearby-track-scape"><div class="nearby-track-board" role="group" aria-label="中心が選択中の土地。道は模式図です。">'+
      worldCanvas(d,found,track,N.pointOfInterest,state.designs?.shield_thorn)+cells.join('')+'</div></div>'+
      '<div class="nearby-track-footer"><span>未知の土地は霧の向こう · 架空の道の地図</span>'+switcher+'</div></div>';
    const stateLabel=restored?'🔔 鐘が戻った・ユノが滞在中':N.traveler(d)?'✦ 薬師の荷':d.claimed?'⚑ あなたの領域':
      poi.family==='shop'?'未開拓 · ◆ 地域の店':'未開拓 · ✦ '+(material?'異変の手掛かり':'王墓の噂');
    // A crafted item often leaves the smith active. A dead-looking departure
    // button strands the player; make returning to the adventurer one tap.
    const primary=button(traveler?'depart':'depart-as-adventurer',
      locked?'他の土地を2か所踏破':traveler?'この土地へ遠征':'冒険者に交代して遠征',
      !locked&&!traveler?'鍛冶師から切り替えて出発':'',
      {class:'primary',value:p.id,disabled:locked});
    // The summary card never contains duplicate actions from the detail scene.
    // Choosing the contextual action changes the scene; transactions and NPC
    // departures remain in exactly one detail view at a time.
    const secondary=button('nearby-view',
      restored?'ユノに会う':towerMystery?'鐘の謎を調べる':poi.family==='event'&&material?'異変を調べる':
      poi.family==='shop'&&material?'店を開く':'土地の情報を見る','',
      {class:'secondary',value:'detail'});
    const mainCard='<div class="nearby-card-copy"><div class="nearby-card-eyebrow"><span class="nearby-card-index">SELECTED LAND / '+
      String(selectedIndex+1).padStart(2,'0')+'</span><small>'+esc(p.name)+' · '+esc(stateLabel)+'</small></div>'+
      '<h2>'+esc(N.title(d))+'</h2><p>'+esc(restored?'鐘が再び鳴る。鐘守の弟子ユノが旅を助ける。':
        towerMystery?'鐘のない塔から音がする。石段の奥に、鍛冶へつながる手掛かり。':p.teaser)+'</p></div>'+
      '<div class="nearby-card-actions">'+primary+secondary+'</div>';
    const entries=['<section class="nearby-info-piece"><span class="kicker">ABOUT THIS LAND</span>'+
      '<h2>'+esc(N.title(d))+'</h2><p>'+esc(p.name)+' · '+esc(poi.description)+'</p><p>'+
      (d.claimed?'⚑ 開拓済み：帰還すると木材と石材が各 +1。':'未開拓：土地の主を倒し、生還すると領域を得る。')+'</p></section>'];
    if(restored)entries.push('<section class="nearby-info-piece restored-bell-notice"><h3>🔔 鐘が戻った見張り跡</h3>'+
      '<p>亡兵を倒して帰還した夜、鐘が街道に響いた。<strong>鐘守の弟子・ユノ</strong>がこの地を守っている。</p>'+
      '<p>ユノの合図で出発すると、最初の一撃に集中 +3。</p>'+
      button('bell-depart','ユノの鐘の合図で遠征','',{class:'secondary',disabled:!traveler})+'</section>');
    if(material&&poi.family==='event'){
      const clueCard='<section class="nearby-info-piece district-poi-card">'+
        (towerMystery?'<span class="kicker">UNRESOLVED / 鐘の反響</span>':'')+
        '<h3>'+esc(poi.name)+'</h3><p>強敵の手掛かりを追う。討伐すると'+esc(material.name)+
        'を通常より1個多く持ち帰れる。生還できなければ失う。</p>'+
        (d.biome==='tower'&&!state.designs?.shield_thorn?
          '<p>✦ 固有の発見：鐘守の亡兵は「返し棘の盾」の設計図を守る。倒して生還すれば製作解放。森の狼牙も必要。</p>':'')+
        button('poi',towerMystery?'鐘の手掛かりを追って出発':'強敵の手掛かりを追って出発','',
          {class:'primary',value:'clue',disabled:!traveler})+'</section>';
      // Put the actionable mystery above general lore, without introducing a
      // second button or a scroll-heavy new card.
      if(towerMystery)entries.unshift(clueCard);
      else entries.push(clueCard);
    }
    if(material&&poi.family==='shop')entries.push('<section class="nearby-info-piece district-poi-card">'+
      '<h3>交易路を発見：'+esc(poi.name)+'</h3><p>鉄片 '+E.LOCAL_MATERIAL_COST+'で'+esc(material.name)+
      'を1個購入。現在の所持数：'+(state.materials[materialId]||0)+'。</p>'+
      button('poi','この店で'+esc(material.name)+'を買う','',{class:'secondary',value:'trade-material',disabled:state.scrap<E.LOCAL_MATERIAL_COST})+
      (d.biome==='wood'?button('poi','薬草を買って遠征','',{class:'secondary',value:'herb',disabled:!traveler||state.scrap<E.LOCAL_HERB_COST}):'')+
      '</section>');
    const trace=N.trace(d);
    if(trace)entries.push('<section class="nearby-info-piece district-trace"><h3>✦ この土地に残った変化：'+esc(trace.name)+
      '</h3><p>'+esc(trace.story)+'</p><p>'+esc(trace.benefit)+'</p></section>');
    if(N.traveler(d))entries.push('<section class="nearby-info-piece district-trace"><h3>✦ 架空NPCが残したもの：'+esc(N.TRAVELER.parcel)+'</h3>'+
      '<p>'+esc(N.TRAVELER.intro)+'</p><p>'+esc(N.TRAVELER.benefit)+'</p></section>');
    else if(d.visitor==='used')entries.push('<section class="nearby-info-piece"><p>薬師イオの補給袋は受け取った。痕跡だけが残る。</p></section>');
    entries.push(landmarkFlagPreview());
    const secondaryScene=view==='scout'
      ? '<div class="nearby-secondary-content map-home-scouting"><h2>近所を発見する</h2>'+
        '<p>新しい場所が、次の遠征先になる。安全に立ち止まって操作しよう。</p>'+scouting()+'</div>'
      : '<div class="nearby-secondary-content">'+entries.join('')+'</div>';
    const card=view==='map'?mainCard:
      '<div class="nearby-secondary-actions"><strong>'+(view==='scout'?'新しい土地を探す':esc(N.title(d))+'の情報')+'</strong>'+
      button('nearby-view','← 地図に戻る','',{class:'secondary',value:'map'})+
      button('settings','⚙','',{class:'nearby-map-settings'})+'</div>';
    return '<div class="game-layout neighborhood-rebuild living-map-home">'+
      '<section class="nearby-scene'+(view!=='map'?' nearby-scene--reading':'')+'">'+
      (view==='map'?map:secondaryScene)+'</section>'+
      '<section class="nearby-card district-detail" aria-label="選択した土地の操作">'+
      card+(notice?'<p class="nearby-notice" role="status">'+esc(notice)+'</p>':'')+'</section>'+
      nav+'</div>';
  }
  return {render,trackEdges,roadPath,scenicRoadPath};
});
