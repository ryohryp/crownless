/* Landmark discoveries, not a diary. GPS is transient; only landmark IDs and visit days persist. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof root === 'object') root.CrownlessTravelFootprints = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const VERSION = 3;
  // A deliberately small, curated offline-first pilot. Expand via a validated POI
  // source only after this discovery is enjoyable. Coordinates identify public landmarks,
  // never private player locations. No GPS fixes/route history are persisted.
  const LANDMARKS = Object.freeze([
    {id:'tokyo-tower',realName:'東京タワー',name:'紅蓮の望楼',kind:'塔',seal:'紅蓮の塔印',icon:'🗼',biome:'tower',
      latitude:35.658656,longitude:139.745364,radius:450,description:'霧の向こうに、赤い火を灯す古の望楼が姿を現した。'},
    {id:'tokyo-skytree',realName:'東京スカイツリー',name:'天穿つ白塔',kind:'塔',seal:'天穹の塔印',icon:'🏰',biome:'tower',
      latitude:35.7101,longitude:139.8107,radius:450,description:'空の裂け目へ伸びる白き塔。その頂には誰も見たことのない灯がある。'},
    {id:'osaka-castle',realName:'大阪城天守閣',name:'翠冠の王城',kind:'城',seal:'王城の印',icon:'🏯',biome:'wood',
      latitude:34.68734,longitude:135.526,radius:550,description:'幾度も時代を越えた王城が、深い緑の中に浮かび上がる。'}
  ]);
  // Sources: NGA GEOnames Tokyo Tower, public Skytree coordinates and Nara
  // cultural heritage map for Osaka Castle (see #949).
  const CATALOG = Object.freeze(Object.fromEntries(LANDMARKS.map(l=>[l.id,l])));
  const initial=()=>({version:VERSION,places:[]});
  function dayString(date=new Date()) {
    if (!date || typeof date.getTime!=='function' || !Number.isFinite(date.getTime())) throw Error('invalid date');
    return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  }
  const validDay=day=>typeof day==='string' && /^\d{4}-\d{2}-\d{2}$/.test(day);
  function distance(a,b) {
    const toRad=Math.PI/180, lat1=a.latitude*toRad, lat2=b.latitude*toRad;
    const dlat=(b.latitude-a.latitude)*toRad, dlon=(b.longitude-a.longitude)*toRad;
    const h=Math.sin(dlat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlon/2)**2;
    return 6371000*2*Math.asin(Math.min(1,Math.sqrt(h)));
  }
  function locate(fix) {
    if (!fix || !Number.isFinite(fix.latitude) || Math.abs(fix.latitude)>90 ||
        !Number.isFinite(fix.longitude) || Math.abs(fix.longitude)>180 ||
        !Number.isFinite(fix.accuracy) || fix.accuracy<0 || fix.accuracy>60) return {status:'inaccurate'};
    if (Number.isFinite(fix.speed) && fix.speed>1.5) return {status:'moving'};
    const nearby=LANDMARKS.map(place=>({place,meters:distance(fix,place)}))
      .filter(x=>x.meters+fix.accuracy<=x.place.radius)
      .sort((a,b)=>a.meters-b.meters);
    return nearby.length ? {status:'ok',place:nearby[0].place} : {status:'no-landmark'};
  }
  function parse(raw) {
    if (!raw) return initial();
    try {
      const data=typeof raw==='string'?JSON.parse(raw):raw;
      if (!data || data.version!==VERSION || !Array.isArray(data.places) || data.places.length>LANDMARKS.length) return initial();
      if (!data.places.every(p=>p && Object.hasOwn(CATALOG,p.id) && validDay(p.firstDate) &&
          Array.isArray(p.visits) && p.visits.length>0 && p.visits.length<=10000 &&
          p.visits[0]===p.firstDate && p.visits.every(validDay) &&
          new Set(p.visits).size===p.visits.length) ||
          new Set(data.places.map(p=>p.id)).size!==data.places.length) return initial();
      return data;
    } catch { return initial(); }
  }
  function record(journal,fix,day=dayString()) {
    const result=locate(fix);
    if(result.status!=='ok')return {status:result.status,journal};
    if(!validDay(day))return {status:'invalid-date',journal};
    const landmark=result.place;
    const current=journal.places.find(p=>p.id===landmark.id);
    if(current?.visits.includes(day))return {status:'same-day',journal,place:{...current,...landmark}};
    const saved=current?{...current,visits:[...current.visits,day]}
      : {id:landmark.id,firstDate:day,visits:[day]};
    const places=current?journal.places.map(p=>p.id===saved.id?saved:p):[saved,...journal.places];
    return {status:current?'revisited':'first',journal:{version:VERSION,places},place:{...saved,...landmark}};
  }
  function discovered(journal) {
    return (journal?.places||[]).filter(p=>Object.hasOwn(CATALOG,p.id)).map(p=>({...CATALOG[p.id],...p}));
  }
  return {VERSION,LANDMARKS,initial,dayString,locate,parse,record,discovered};
});
