/* Production neighborhood scene. One renderer owns map, selected card and
   secondary discovery/lore views. No mutation observers or independent saves. */
(function (root, factory) {
  const api=factory(root);
  if (typeof module==='object' && module.exports) module.exports=api;
  if (root) root.CrownlessNearbyHome=api;
})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';
  function render({state,N,E,A,button,scouting,landmarkFlagPreview,notice,nav,view='map',page=null}) {
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const n=state.neighborhood,d=N.get(n),p=E.place(d.biome),poi=N.pointOfInterest(d);
    const restored=state.designs?.shield_thorn===d.id;
    const materialId=E.REGIONAL_MATERIAL[d.biome],material=materialId&&E.MATERIALS[materialId];
    const locked=d.biome==='crypt'&&state.cleared.length<2,traveler=state.activeCharacter===0;
    const pages=Math.max(1,Math.ceil(n.districts.length/6)),selectedIndex=n.districts.findIndex(item=>item.id===d.id),
      currentPage=page===null?Math.floor(Math.max(0,selectedIndex)/6):Math.min(Math.max(0,page),pages-1);
    const visible=n.districts.slice(currentPage*6,(currentPage+1)*6);
    const tiles=visible.map(place=>{
      const site=N.pointOfInterest(place),changed=state.designs?.shield_thorn===place.id;
      const stamp=root.CrownlessMapPixelArt?.sprite?.(site.family)||A.poiStamp?.(place.biome,site.family)||esc(site.icon);
      const trace=N.trace(place);
      const label=changed?'🔔 鐘が戻った':place.claimed?'⚑ あなたの領域':
        N.traveler(place)?'✦ 薬師の荷':trace?'✦ '+trace.name:site.family==='shop'?'◆ 店':'✦ 異変';
      const active=place.id===d.id;
      return '<button type="button" class="nearby-tile biome-'+place.biome+(active?' selected':'')+
        (changed?' restored-bell':'')+'" data-poi-family="'+site.family+'" data-action="district" data-value="'+esc(place.id)+
        '" aria-pressed="'+active+'" aria-label="'+esc(N.title(place)+'、'+label)+'">'+
        '<span class="nearby-tile-stamp" aria-hidden="true">'+stamp+'</span><strong>'+esc(N.title(place))+
        '</strong><small>'+esc(label)+'</small></button>';
    }).join('');
    const map='<div class="nearby-paper-map" role="group" aria-label="発見した土地の地図">'+
      '<div class="nearby-map-top"><div><strong>'+esc(n.name)+'</strong><small>'+
      (state.mode==='demo'?'散策体験モード':'現実の散策モード')+' · 発見 '+n.districts.length+
      ' / 開拓 '+N.claims(n)+(n.buildings.length?' · 建物 '+n.buildings.length:'')+'</small></div>'+
      button('nearby-view','＋ 土地を発見','',{class:'nearby-top-action',value:'scout'})+
      button('settings','⚙','',{class:'nearby-map-settings'})+'</div>'+
      '<div class="nearby-map-art" aria-hidden="true"><span>THE UNWRITTEN LANDS</span></div>'+
      '<div class="nearby-tile-grid">'+tiles+'</div>'+
      (pages>1?'<div class="nearby-pagination">'+
        button('nearby-page','前の土地','',{class:'secondary',value:String(Math.max(0,currentPage-1)),disabled:currentPage===0})+
        '<span>'+(currentPage+1)+' / '+pages+'</span>'+
        button('nearby-page','次の土地','',{class:'secondary',value:String(Math.min(pages-1,currentPage+1)),disabled:currentPage===pages-1})+
        '</div>':'')+
      '<div class="nearby-map-legend">歩いて発見した土地が、ここへ刻まれる。</div></div>';
    const stateLabel=restored?'🔔 鐘が戻った・ユノが滞在中':d.claimed?'⚑ あなたの領域':
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
    const mainCard='<div class="nearby-card-copy"><small>'+esc(stateLabel)+' · '+esc(p.name)+'</small><h2>'+esc(N.title(d))+'</h2>'+
      '<p>'+esc(restored?'鐘が再び鳴る。鐘守の弟子ユノが旅を助ける。':p.teaser)+'</p></div>'+
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
  return {render};
});
