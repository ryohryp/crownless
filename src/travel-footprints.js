/* Private, explicit travel visits. Coordinates are used transiently and never saved. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof root === 'object') root.CrownlessTravelFootprints = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1, METERS = 2000, EARTH = 6378137;
  const THEMES = [
    { name: '霧深き森', seal: '木霊の印', icon: '🌲', biome: 'wood' },
    { name: '忘れられた塔', seal: '鐘の印', icon: '🏰', biome: 'tower' },
    { name: '星の渡し場', seal: '水紋の印', icon: '🌊', biome: 'fen' },
    { name: '古い街道', seal: '旅路の印', icon: '🛤️', biome: 'wood' },
  ];
  const initial = () => ({ version: VERSION, places: [] });
  const dayString = (date = new Date()) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw Error('invalid date');
    return [date.getFullYear(), String(date.getMonth()+1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  };
  const validDay = day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day);
  // Web Mercator gives a stable world-wide grid. Approx. 2 km (smaller on the ground
  // at higher latitudes). Keep only the coarse cell ID, not a GPS fix or route.
  function locate(fix) {
    if (!fix || !Number.isFinite(fix.latitude) || Math.abs(fix.latitude)>85 ||
        !Number.isFinite(fix.longitude) || Math.abs(fix.longitude)>180 ||
        !Number.isFinite(fix.accuracy) || fix.accuracy<0 || fix.accuracy>60) return { status:'inaccurate' };
    if (Number.isFinite(fix.speed) && fix.speed>1.5) return { status:'moving' };
    const x=EARTH*fix.longitude*Math.PI/180;
    const y=EARTH*Math.log(Math.tan(Math.PI/4+fix.latitude*Math.PI/360));
    const cx=Math.floor(x/METERS), cy=Math.floor(y/METERS);
    // Reject borderline GPS observations instead of inventing a precise location.
    const margin=(fix.accuracy+15)/Math.max(0.08,Math.cos(fix.latitude*Math.PI/180));
    const dx=x-cx*METERS, dy=y-cy*METERS;
    if (Math.min(dx,METERS-dx,dy,METERS-dy)<margin) return { status:'boundary' };
    const index=((cx*31+cy*17)%THEMES.length+THEMES.length)%THEMES.length;
    return { status:'ok', id:`f1:${cx}:${cy}`, theme:THEMES[index] };
  }
  function parse(raw) {
    if (!raw) return initial();
    try {
      const data=typeof raw==='string' ? JSON.parse(raw) : raw;
      if (!data || data.version!==VERSION || !Array.isArray(data.places) || data.places.length>5000) return initial();
      if (!data.places.every(p => p && /^f1:-?\d+:-?\d+$/.test(p.id) && typeof p.name==='string' &&
        p.name.length<=60 && typeof p.label==='string' && p.label.length<=60 &&
        typeof p.seal==='string' && typeof p.icon==='string' && typeof p.biome==='string' &&
        validDay(p.firstDate) && Array.isArray(p.visits) && p.visits.length>0 &&
        p.visits.every(v=>validDay(v.date) && typeof v.note==='string' && v.note.length<=180) &&
        new Set(p.visits.map(v=>v.date)).size===p.visits.length)) return initial();
      if (new Set(data.places.map(p=>p.id)).size!==data.places.length) return initial();
      return data;
    } catch { return initial(); }
  }
  function record(journal, fix, day = dayString()) {
    const place=locate(fix);
    if (place.status!=='ok') return { status:place.status, journal };
    if (!validDay(day)) return { status:'invalid-date', journal };
    const current=journal?.places?.find(p=>p.id===place.id);
    if (current?.visits?.some(v=>v.date===day)) return { status:'same-day', journal, place:current };
    const next=current
      ? {...current,visits:[...current.visits,{date:day,note:''}]}
      : {id:place.id,name:place.theme.name,label:'',seal:place.theme.seal,
         icon:place.theme.icon,biome:place.theme.biome,firstDate:day,visits:[{date:day,note:''}]};
    const places=current ? journal.places.map(p=>p.id===next.id?next:p) : [next,...(journal?.places||[])];
    return { status:current?'revisited':'first', journal:{version:VERSION,places}, place:next };
  }
  function annotate(journal,id,date,note) {
    if (!journal?.places?.some(p=>p.id===id) || !validDay(date)) return journal;
    const clean=String(note||'').trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,180);
    return {...journal,places:journal.places.map(p=>p.id===id
      ? {...p,visits:p.visits.map(v=>v.date===date?{...v,note:clean}:v)} : p)};
  }
  function rename(journal,id,label) {
    if (!journal?.places?.some(p=>p.id===id)) return journal;
    const clean=String(label||'').trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,60);
    return {...journal,places:journal.places.map(p=>p.id===id?{...p,label:clean}:p)};
  }
  return {VERSION,METERS,initial,dayString,locate,parse,record,annotate,rename};
});
