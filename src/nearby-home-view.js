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
  function render({state,N,E,A,button,scouting,landmarkFlagPreview,notice,nav,view='map',page=null}) {
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const n=state.neighborhood,d=N.get(n),p=E.place(d.biome),poi=N.pointOfInterest(d);
    const restored=state.designs?.shield_thorn===d.id;
    const materialId=E.REGIONAL_MATERIAL[d.biome],material=materialId&&E.MATERIALS[materialId];
    const locked=d.biome==='crypt'&&state.cleared.length<2,traveler=state.activeCharacter===0;
    // A fixed 5x5 camera is deliberately centered on the selected district.
    // Coordinates are fictional coarse districts, not live GPS or real roads.
    const selectedIndex=Math.max(0,n.districts.findIndex(item=>item.id===d.id));
    const track=trackEdges(n.districts);
    const found=new Map(n.districts.map(place=>[place.id,place]));
    const cells=[];
    for(let y=d.y+2;y>=d.y-2;y--){
      for(let x=d.x-2;x<=d.x+2;x++){
        const id=x+','+y,place=found.get(id),home=x===0&&y===0;
        const directions=track.get(id)||new Set();
        const path=roadPath(directions);
        const road=path?'<svg class="nearby-track-road" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">'+
          '<path class="nearby-track-edge" d="'+path+'"/>'+
          '<path class="nearby-track-earth" d="'+path+'"/>'+
          '<path class="nearby-track-centerline" d="'+path+'"/></svg>':'';
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
        const inner=road+
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
        else cells.push('<div class="'+classes+'" aria-hidden="true">'+inner+'<span class="nearby-track-mist">?</span></div>');
      }
    }
    const previous=n.districts[(selectedIndex-1+n.districts.length)%n.districts.length];
    const next=n.districts[(selectedIndex+1)%n.districts.length];
    const switcher=n.districts.length>1?'<div class="nearby-track-switch">'+
      button('district','‹ 前の発見','',{class:'secondary',value:previous.id})+
      '<span>'+ (selectedIndex+1)+' / '+n.districts.length+'</span>'+
      button('district','次の発見 ›','',{class:'secondary',value:next.id})+'</div>':'';
    const map='<div class="nearby-paper-map nearby-track-map" role="group" aria-label="道がつながる近所のタイル地図">'+
      '<header class="nearby-map-top"><div class="nearby-atlas-heading"><span class="nearby-atlas-overline">CROWNLESS / WORLD ATLAS</span>'+
      '<strong>世界図</strong><small>'+esc(n.name)+' · '+(state.mode==='demo'?'散策体験モード':'現実の散策モード')+'</small></div>'+
      '<div class="nearby-atlas-metrics" aria-label="探索の記録"><span>発見 <b>'+n.districts.length+'</b></span>'+
      '<span>開拓 <b>'+N.claims(n)+'</b></span><span>建物 '+n.buildings.length+'</span></div>'+
      button('nearby-view','＋ 土地を発見','',{class:'nearby-top-action',value:'scout'})+
      button('settings','⚙','',{class:'nearby-map-settings'})+'</header>'+
      '<div class="nearby-track-scape"><div class="nearby-track-board" role="group" aria-label="中心が選択中の土地。道は模式図です。">'+
      cells.join('')+'</div></div>'+
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
      restored?'ユノに会う':poi.family==='event'&&material?'異変を調べる':
      poi.family==='shop'&&material?'店を開く':'土地の情報を見る','',
      {class:'secondary',value:'detail'});
    const mainCard='<div class="nearby-card-copy"><div class="nearby-card-eyebrow"><span class="nearby-card-index">SELECTED LAND / '+
      String(selectedIndex+1).padStart(2,'0')+'</span><small>'+esc(p.name)+' · '+esc(stateLabel)+'</small></div>'+
      '<h2>'+esc(N.title(d))+'</h2><p>'+esc(restored?'鐘が再び鳴る。鐘守の弟子ユノが旅を助ける。':p.teaser)+'</p></div>'+
      '<div class="nearby-card-actions">'+primary+secondary+'</div>';
    const entries=['<section class="nearby-info-piece"><span class="kicker">ABOUT THIS LAND</span>'+
      '<h2>'+esc(N.title(d))+'</h2><p>'+esc(p.name)+' · '+esc(poi.description)+'</p><p>'+
      (d.claimed?'⚑ 開拓済み：帰還すると木材と石材が各 +1。':'未開拓：土地の主を倒し、生還すると領域を得る。')+'</p></section>'];
    if(restored)entries.push('<section class="nearby-info-piece restored-bell-notice"><h3>🔔 鐘が戻った見張り跡</h3>'+
      '<p>亡兵を倒して帰還した夜、鐘が街道に響いた。<strong>鐘守の弟子・ユノ</strong>がこの地を守っている。</p>'+
      '<p>ユノの合図で出発すると、最初の一撃に集中 +3。</p>'+
      button('bell-depart','ユノの鐘の合図で遠征','',{class:'secondary',disabled:!traveler})+'</section>');
    if(material&&poi.family==='event')entries.push('<section class="nearby-info-piece district-poi-card">'+
      '<h3>'+esc(poi.name)+'</h3><p>強敵の手掛かりを追う。討伐すると'+esc(material.name)+
      'を通常より1個多く持ち帰れる。生還できなければ失う。</p>'+
      (d.biome==='tower'&&!state.designs?.shield_thorn?
        '<p>✦ 固有の発見：鐘守の亡兵は「返し棘の盾」の設計図を守る。倒して生還すれば製作解放。森の狼牙も必要。</p>':'')+
      button('poi','強敵の手掛かりを追って出発','',{class:'primary',value:'clue',disabled:!traveler})+'</section>');
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
  return {render,trackEdges,roadPath};
});
