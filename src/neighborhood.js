/* Private, coarse neighborhood progress. No coordinates, timestamps or route history. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CrownlessNeighborhood = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const CELL_METERS = 400, LIMIT = 64, RANGE = 16;
  const BIOMES = ['wood', 'tower', 'fen', 'crypt'];
  const BUILDINGS = {
    forge: { name:'鍛冶小屋', wood:2, stone:1, claims:0, benefit:'すべての武器の補強費が鉄片 2 少なくなる。', story:'火に屋根が掛かり、槌の音が近所に響き始めた。' },
    lodge: { name:'旅人の住居', wood:4, stone:2, claims:1, benefit:'最大体力 +4。開拓した土地に、最初の住人が暮らす。', story:'帰りを待つ窓明かりが一つ増えた。ここは、もう野営地ではない。' },
  };
  const key = (x,y) => `${x},${y}`;
  function terrain(x,y) { return Math.abs(y) > Math.abs(x) ? (y > 0 ? 'tower' : 'crypt') : (x > 0 ? 'fen' : 'wood'); }
  function district(x,y, biome = terrain(x,y)) { return { id:key(x,y), x, y, biome, claimed:false, returns:0 }; }
  const initial = () => ({ name:'最後の焚き火', wood:0, stone:0, buildings:[], districts:[district(-1,0)], selected:'-1,0', active:null, result:null });
  const claims = n => n.districts.filter(d => d.claimed).length;
  const get = (n,id = n.selected) => n.districts.find(d => d.id === id);
  function title(d) {
    const direction = [d.y > 0 ? '北' : d.y < 0 ? '南' : '', d.x > 0 ? '東' : d.x < 0 ? '西' : ''].join('');
    const kind = {wood:'木立',tower:'見張り跡',fen:'水辺',crypt:'石塚'}[d.biome];
    return `${direction}の${kind}${Math.max(Math.abs(d.x),Math.abs(d.y)) > 1 ? ` · ${Math.max(Math.abs(d.x),Math.abs(d.y))}` : ''}`;
  }
  function cell(north,east,uncertainty = 0) {
    const x = Math.round(east/CELL_METERS), y = Math.round(north/CELL_METERS);
    if ((!x && !y) || Math.abs(x)>RANGE || Math.abs(y)>RANGE) return null;
    if (CELL_METERS/2-Math.abs(east-x*CELL_METERS)<=uncertainty || CELL_METERS/2-Math.abs(north-y*CELL_METERS)<=uncertainty) return null;
    return district(x,y);
  }
  function discover(n,d) {
    if (!d || !validDistrict(d)) return n;
    const known = get(n,d.id);
    if (!known && n.districts.length >= LIMIT) return n;
    return {...n, districts:known ? n.districts : [...n.districts,district(d.x,d.y,d.biome)], selected:d.id};
  }
  const POIS = {
    wood: {
      shop: { icon:'♜', name:'枝角の露店', label:'森の行商', description:'猟師と薬師が森の道具を並べている。薬師の薬草は鉄片2個で一束。持って行けば、次の遠征を少し長く戦い抜ける。', action:'gear', actionLabel:'装備を見直す' },
      event: { icon:'✦', name:'囁き樹の噂', label:'土地の噂', description:'古木の根元に、牙の獣を見たという旅人の印が残っている。', action:'depart', actionLabel:'噂を追って遠征する' }
    },
    tower: {
      shop: { icon:'♜', name:'鐘守の鍛冶台', label:'旅の鍛冶屋', description:'塔を巡る旅人が、風に負けない武具の手入れを請け負っている。', action:'gear', actionLabel:'装備を見直す' },
      event: { icon:'✦', name:'鳴らない鐘の刻', label:'小さな異変', description:'鐘のない塔から一度だけ音がした。主の気配が濃くなっている。', action:'depart', actionLabel:'音の正体を探る' }
    },
    fen: {
      shop: { icon:'♜', name:'葦舟の薬売り', label:'水辺の露店', description:'湿地で採れた薬草を束ねる旅商人が、遠征の話を聞かせてくれる。', action:'gear', actionLabel:'旅支度を見直す' },
      event: { icon:'✦', name:'青火の水鏡', label:'土地の異変', description:'日暮れ前なのに、水面へ青い火が映った。湿原の奥へ続いている。', action:'depart', actionLabel:'青火を追う' }
    },
    crypt: {
      shop: { icon:'♜', name:'墓守の古物卓', label:'古物商', description:'石塚から拾われた品を扱う無口な商人が、王墓の噂を知っている。', action:'gear', actionLabel:'装備を見直す' },
      event: { icon:'✦', name:'灰冠の供物跡', label:'古い儀式跡', description:'新しい灰だけが石の前に残る。誰かが今も王へ供物を運んでいる。', action:'depart', actionLabel:'供物跡を調べる' }
    }
  };
  function pointOfInterest(d) {
    if (!d || !BIOMES.includes(d.biome)) return null;
    const family = (Math.abs(d.x) + Math.abs(d.y)) % 2 === 0 ? 'shop' : 'event';
    return { id:`poi:${d.id}`, family, ...POIS[d.biome][family] };
  }
  function select(n,id) { return get(n,id) ? {...n,selected:id} : n; }
  function begin(n,biome) {
    const selected = get(n), target = selected?.biome === biome ? selected : n.districts.find(d => d.biome === biome);
    return {...n, active:target?.id || null, result:null};
  }
  function settle(n,x,died) {
    const d = get(n,n.active);
    if (!d || d.biome !== x.place) return {...n,active:null,result:null};
    const won = !died && x.seals.includes(x.place), loot = !died && x.scrap > 0;
    // Return loot is banked once by the engine. An empty return earns no construction materials.
    const wood = loot ? (d.biome === 'wood' ? 2 : 1) * x.depth + (d.claimed ? 1 : 0) : 0;
    const stone = loot ? (d.biome === 'tower' || d.biome === 'crypt' ? 2 : 1) * x.depth + (d.claimed ? 1 : 0) : 0;
    return {...n, wood:Math.min(1e9,n.wood+wood), stone:Math.min(1e9,n.stone+stone), active:null,
      districts:n.districts.map(v => v.id === d.id ? {...v, claimed:v.claimed || won, returns:Math.min(1e9,v.returns+(loot ? 1 : 0))} : v),
      result:{id:d.id,wood,stone,claimed:won && !d.claimed,died} };
  }
  function canBuild(n,id) {
    const b = BUILDINGS[id];
    return Boolean(b && !n.buildings.includes(id) && n.wood>=b.wood && n.stone>=b.stone && claims(n)>=b.claims);
  }
  function build(n,id) {
    if (!canBuild(n,id)) return n;
    const b = BUILDINGS[id];
    return {...n,wood:n.wood-b.wood,stone:n.stone-b.stone,buildings:[...n.buildings,id]};
  }
  function rename(n,value) {
    const name = String(value || '').trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,16);
    return name ? {...n,name} : n;
  }
  function validDistrict(d) {
    return d && Object.keys(d).sort().join(',') === 'biome,claimed,id,returns,x,y' && Number.isInteger(d.x) && Math.abs(d.x)<=RANGE && Number.isInteger(d.y) && Math.abs(d.y)<=RANGE && (d.x || d.y) && d.id===key(d.x,d.y) && BIOMES.includes(d.biome) && typeof d.claimed==='boolean' && Number.isInteger(d.returns) && d.returns>=0 && d.returns<=1e9;
  }
  function valid(n) {
    const amount = v => Number.isInteger(v) && v>=0 && v<=1e9;
    if (!n || Array.isArray(n) || Object.keys(n).sort().join(',') !== 'active,buildings,districts,name,result,selected,stone,wood' || typeof n.name!=='string' || !n.name.trim() || n.name.length>16 || /[\u0000-\u001f\u007f]/.test(n.name) || !amount(n.wood) || !amount(n.stone)) return false;
    if (!Array.isArray(n.buildings) || n.buildings.length>2 || new Set(n.buildings).size!==n.buildings.length || !n.buildings.every(id => Object.hasOwn(BUILDINGS,id))) return false;
    if (!Array.isArray(n.districts) || !n.districts.length || n.districts.length>LIMIT || !n.districts.every(validDistrict) || new Set(n.districts.map(d => d.id)).size!==n.districts.length || !get(n) || !(n.active===null || get(n,n.active))) return false;
    const r = n.result;
    return r===null || Boolean(r && Object.keys(r).sort().join(',')==='claimed,died,id,stone,wood' && get(n,r.id) && amount(r.wood) && r.wood<=7 && amount(r.stone) && r.stone<=7 && typeof r.claimed==='boolean' && typeof r.died==='boolean' && (!r.died || (!r.claimed && !r.wood && !r.stone)));
  }
  function migrate(state) {
    const n = initial(), positions = {wood:[-1,0],tower:[0,1],fen:[1,0],crypt:[0,-1]};
    n.districts = state.unlocked.filter(id => BIOMES.includes(id)).map(id => district(...positions[id],id));
    // Old biome clears do not claim newly introduced local districts.
    n.active = state.expedition ? n.districts.find(d => d.biome===state.expedition.place)?.id || null : null;
    return n;
  }
  return { CELL_METERS,LIMIT,RANGE,BUILDINGS,POIS,initial,claims,get,title,pointOfInterest,cell,discover,select,begin,settle,canBuild,build,rename,valid,migrate };
});
