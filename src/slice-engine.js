/* Pure game rules. The browser and node:test use the same deterministic transitions. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CrownlessSlice = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  const PLACES = [
    { id: 'wood', name: '囁きの森', subtitle: '根の下に、誰かの剣が眠る。', terrain: 'FOREST', weapon: 'fang', enemy: 'wolf', reward: '牙の短剣', hint: '回避のあとに、一撃を返す。', color: '#93ae8e' },
    { id: 'tower', name: '鐘なき塔', subtitle: '鳴らない鐘を、今も守る者。', terrain: 'WATCHTOWER', weapon: 'shield', enemy: 'knight', reward: '番人の盾', hint: '守りを固め、敵の隙を待つ。', color: '#c5ad79' },
    { id: 'fen', name: '星沈みの湿原', subtitle: '水面に、消えた星が映る。', terrain: 'WETLAND', weapon: 'bow', enemy: 'wraith', reward: '葦の長弓', hint: '鎧を貫き、狙った獲物を射る。', color: '#91b4bd' },
    { id: 'crypt', name: '灰冠の廟', subtitle: '王冠だけが、主を忘れない。', terrain: 'ROYAL TOMB', weapon: 'crown', enemy: 'king', reward: '灰の王冠', hint: 'この小さな旅の、最初の到達点。', color: '#b1a0ca' },
  ];
  const GEAR = {
    rust: { name: '欠けた鉄剣', short: '鉄剣', text: '攻撃 4。強撃は気力 2 で 8 ダメージ。', attack: 4 },
    fang: { name: '牙の短剣', short: '短剣', text: '攻撃 5。回避後の追撃が +5（通常 +3）。', attack: 5 },
    shield: { name: '番人の盾', short: '剣と盾', text: '攻撃 4。防御で 12 軽減し、3 ダメージを返す。', attack: 4 },
    bow: { name: '葦の長弓', short: '長弓', text: '攻撃 5。強撃が敵の守りを貫通する。', attack: 5 },
    crown: { name: '灰の王冠', short: '王冠', text: '持ち帰った証。すべての装備で最大体力 +6。', attack: 4 },
  };
  const ENEMIES = {
    wolf: { name: '茨牙の狼', hp: 16, pattern: ['quick', 'heavy', 'open'] },
    knight: { name: '鐘守の亡兵', hp: 20, pattern: ['guard', 'heavy', 'open', 'quick'] },
    wraith: { name: '沼灯の亡霊', hp: 17, pattern: ['quick', 'quick', 'open', 'heavy'] },
    king: { name: '灰冠の騎士', hp: 27, pattern: ['guard', 'heavy', 'quick', 'open'] },
  };
  const INTENTS = {
    quick: { name: '薙ぎ払い', damage: 6, help: '防御で受け止める。回避なら追撃の好機。' },
    heavy: { name: '大振り', damage: 12, help: '回避がおすすめ。防御だけでは削られる。' },
    guard: { name: '守りを固める', damage: 0, help: '攻撃を 5 軽減する。防御で気力を整える。' },
    open: { name: '体勢を崩している', damage: 0, help: '攻撃の好機。強撃なら大きく削れる。' },
  };
  const copy = s => JSON.parse(JSON.stringify(s));
  const place = id => PLACES.find(p => p.id === id);
  const initial = () => ({ version: VERSION, mode: null, unlocked: ['wood'], cleared: [], owned: ['rust'], equipped: 'rust', scrap: 0, level: 0, runs: 0, victories: 0, expedition: null, report: null });
  const maxHp = s => 30 + s.level * 5 + (s.owned.includes('crown') ? 6 : 0);
  const upgradeCost = s => 8 + s.level * 6;
  const intent = e => {
    const id = ENEMIES[e.kind].pattern[e.turn % ENEMIES[e.kind].pattern.length];
    return { id, ...INTENTS[id], damage: INTENTS[id].damage ? INTENTS[id].damage + e.depth - 1 + (e.elite ? 2 : 0) : 0 };
  };
  function discover(s, id) {
    if (!place(id) || s.unlocked.includes(id)) return s;
    const n = copy(s); n.unlocked.push(id); return n;
  }
  function start(s, id) {
    if (s.expedition || !s.mode || !s.unlocked.includes(id) || !place(id) || (id === 'crypt' && s.cleared.length < 2)) return s;
    const n = copy(s); n.report = null; n.runs++;
    n.expedition = { place: id, depth: 1, room: 0, hp: maxHp(s), stamina: 3, focus: 0, potions: 2, scrap: 0, gear: [], seals: [], enemy: null, stage: 'path', log: ['火はここで待っている。まずは足跡をたどろう。'] };
    return n;
  }
  function encounter(x, risky) {
    const kind = place(x.place).enemy;
    const elite = x.room === 4;
    const hp = ENEMIES[kind].hp + (x.depth - 1) * 6 + (elite ? 8 : 0) + (risky ? 3 : 0);
    x.enemy = { kind, hp, maxHp: hp, turn: 0, depth: x.depth, elite, risky };
    x.stage = 'fight'; x.stamina = Math.max(2, x.stamina); x.focus = 0;
    x.log = [elite ? '土地の主が、帰り道を塞いだ。' : risky ? '宝の気配を追った。獲物も、こちらを見ている。' : '足音が止んだ。敵の構えをよく見よう。'];
  }
  function finish(s, died) {
    const x = s.expedition;
    const found = x.gear.filter(g => !s.owned.includes(g));
    s.report = { died, place: x.place, depth: x.depth, scrap: x.scrap, gear: [...x.gear], newGear: died ? [] : found, hp: x.hp, cleared: [...x.seals] };
    if (!died) {
      s.scrap += x.scrap; s.owned = [...new Set([...s.owned, ...x.gear])];
      s.cleared = [...new Set([...s.cleared, ...x.seals])]; s.victories++;
    }
    s.expedition = null;
    return s;
  }
  function victory(s) {
    const x = s.expedition, e = x.enemy;
    const loot = (e.elite ? 5 : 2) * x.depth + (e.risky ? 3 : 0);
    x.scrap += loot;
    x.log.push(`討伐。鉄片を ${loot} 個、背嚢へ。生還するまで確定しない。`);
    if (e.elite) {
      const gear = place(x.place).weapon;
      if (!x.gear.includes(gear) && !s.owned.includes(gear)) { x.gear.push(gear); x.log.push(`${GEAR[gear].name}を発見！ 焚き火へ持ち帰ろう。`); }
      else { x.scrap += 4; x.log.push('持っている装備の代わりに、鉄片 +4。'); }
      x.seals.push(x.place); x.stage = 'cleared';
    } else { x.room++; x.stage = 'path'; }
    x.enemy = null;
  }
  function act(s, action) {
    const n = copy(s), x = n.expedition;
    if (!x) return s;
    if (action === 'return' && x.stage !== 'fight') return finish(n, false);
    if (action === 'heal' && x.potions > 0 && x.hp < maxHp(n)) {
      x.potions--; const healed = Math.min(12, maxHp(n) - x.hp); x.hp += healed;
      x.log = [`薬草で体力 +${healed}。${x.stage === 'fight' ? '使う間に敵が動く。' : '息を整えた。'}`];
      if (x.stage !== 'fight') return n;
    } else if (x.stage === 'cleared' && action === 'deeper' && x.depth < 3) {
      x.depth++; x.room = 0; x.stage = 'path'; x.log = ['さらに深く。敵の体力と攻撃、持ち帰れる鉄片が増える。']; return n;
    } else if (x.stage === 'path') {
      if ([1, 3].includes(x.room)) {
        if (!['rest', 'search'].includes(action)) return s;
        if (action === 'rest') { x.hp = Math.min(maxHp(n), x.hp + 6); x.log = ['小さな灯りのそばで休んだ。体力 +6。']; }
        else { x.hp -= 4; x.scrap += 5 * x.depth; x.log = [`茨の中の遺品を拾う。体力 −4 / 鉄片 +${5 * x.depth}。`]; }
        x.room++; if (x.hp <= 0) return finish(n, true); return n;
      }
      if (!['careful', 'risky'].includes(action)) return s;
      encounter(x, action === 'risky'); return n;
    } else if (x.stage === 'fight') {
      if (!['strike', 'heavy', 'guard', 'dodge', 'flee'].includes(action)) return s;
      if ((action === 'heavy' && x.stamina < 2) || (action === 'dodge' && x.stamina < 1)) return s;
      x.log = [];
    } else return s;
    const e = x.enemy, next = intent(e), weapon = GEAR[n.equipped];
    if (action === 'flee') {
      const damage = Math.max(2, next.damage);
      x.hp -= damage;
      return finish(n, x.hp <= 0);
    }
    let damage = 0;
    if (action === 'strike' || action === 'heavy') {
      damage = weapon.attack + (action === 'heavy' ? 4 : 0) + x.focus;
      if (next.id === 'guard' && !(n.equipped === 'bow' && action === 'heavy')) damage = Math.max(0, damage - 5);
      x.stamina = Math.min(3, x.stamina + (action === 'heavy' ? -2 : 1)); x.focus = 0;
    }
    if (action === 'guard') { x.stamina = Math.min(3, x.stamina + 1); if (n.equipped === 'shield' && next.damage > 0) damage = 3; }
    if (action === 'dodge') { x.stamina--; x.focus = n.equipped === 'fang' ? 5 : 3; }
    e.hp = Math.max(0, e.hp - damage);
    if (damage > 0) x.log.push(`こちらの一撃。${damage} ダメージ。`);
    if (e.hp <= 0) { victory(n); return n; }
    const block = action === 'guard' ? (n.equipped === 'shield' ? 12 : 9) : 0;
    const taken = action === 'dodge' ? 0 : Math.max(0, next.damage - block);
    x.hp -= taken;
    x.log.push(action === 'dodge' ? `身をかわした。次の攻撃 +${x.focus}。` : taken ? `${next.name}。体力 −${taken}。` : next.damage ? '攻撃を受け止めた。体力消費なし。' : '敵は攻撃してこない。');
    e.turn++;
    if (x.hp <= 0) return finish(n, true);
    return n;
  }
  function equip(s, id) {
    if (s.expedition || !s.owned.includes(id) || !GEAR[id] || id === 'crown') return s;
    const n = copy(s); n.equipped = id; return n;
  }
  function upgrade(s) {
    if (s.expedition || s.level >= 4 || s.scrap < upgradeCost(s)) return s;
    const n = copy(s); n.scrap -= upgradeCost(s); n.level++; return n;
  }
  // Only explicit, stationary fixes are used. Coordinates exist only in this session object.
  const locationSession = () => ({ anchor: null });
  function observe(session, fix) {
    if (!fix || !Number.isFinite(fix.latitude) || Math.abs(fix.latitude) > 90 || !Number.isFinite(fix.longitude) || Math.abs(fix.longitude) > 180 || !Number.isFinite(fix.accuracy) || fix.accuracy < 0 || fix.accuracy > 60) return { status: 'inaccurate' };
    if (Number.isFinite(fix.speed) && fix.speed > 1.5) return { status: 'moving' };
    if (!session.anchor) { session.anchor = { latitude: fix.latitude, longitude: fix.longitude, accuracy: fix.accuracy }; return { status: 'anchored' }; }
    const a = session.anchor, north = (fix.latitude - a.latitude) * 111320;
    const deltaLongitude = ((fix.longitude - a.longitude + 540) % 360) - 180;
    const east = deltaLongitude * 111320 * Math.cos(a.latitude * Math.PI / 180);
    const distance = Math.hypot(north, east);
    if (distance < 150 + a.accuracy + fix.accuracy) return { status: 'nearby' };
    // Four broad relative regions; no trail, coordinates, compass bearing or grid identifiers are saved.
    const id = Math.abs(north) > Math.abs(east) ? (north > 0 ? 'tower' : 'crypt') : (east > 0 ? 'fen' : 'wood');
    return { status: 'discovered', place: id };
  }
  function serialize(s) { return JSON.stringify(s); }
  function parse(raw) {
    if (!raw) return initial();
    try {
      const s = JSON.parse(raw);
      const ids = PLACES.map(p => p.id), keys = Object.keys(initial());
      const validArray = (a, allowed) => Array.isArray(a) && a.length <= allowed.length && new Set(a).size === a.length && a.every(v => allowed.includes(v));
      const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
      if (s.version !== VERSION || Object.keys(s).some(k => !keys.includes(k)) || ![null, 'demo', 'walk'].includes(s.mode) || !validArray(s.unlocked, ids) || !s.unlocked.includes('wood') || !validArray(s.cleared, ids) || !validArray(s.owned, Object.keys(GEAR)) || !s.owned.includes('rust') || !s.owned.includes(s.equipped) || s.equipped === 'crown' || !int(s.level, 0, 4) || !int(s.scrap, 0, 1e9) || !int(s.runs, 0, 1e9) || !int(s.victories, 0, s.runs)) throw Error('save');
      // Validate the complete live run before restoring it; never silently bank a damaged save.
      if (s.expedition) {
        const x = s.expedition;
        if (Object.keys(x).some(k => !['place','depth','room','hp','stamina','focus','potions','scrap','gear','seals','enemy','stage','log'].includes(k)) || !s.unlocked.includes(x.place) || !int(x.depth,1,3) || !int(x.room,0,4) || !int(x.hp,1,maxHp(s)) || !int(x.stamina,0,3) || ![0,3,5].includes(x.focus) || !int(x.potions,0,2) || !int(x.scrap,0,1000) || !validArray(x.gear,Object.keys(GEAR)) || !Array.isArray(x.seals) || x.seals.length > 3 || !x.seals.every(v => ids.includes(v)) || !['path','fight','cleared'].includes(x.stage) || !Array.isArray(x.log) || x.log.length > 8 || !x.log.every(v => typeof v === 'string' && v.length < 250)) throw Error('run');
        if (x.stage === 'fight') {
          const e = x.enemy;
          if (!e || Object.keys(e).some(k => !['kind','hp','maxHp','turn','depth','elite','risky'].includes(k)) || !ENEMIES[e.kind] || !int(e.maxHp,1,80) || !int(e.hp,1,e.maxHp) || !int(e.turn,0,1e6) || e.depth !== x.depth || typeof e.elite !== 'boolean' || typeof e.risky !== 'boolean') throw Error('enemy');
        } else if (x.enemy !== null) throw Error('enemy');
      }
      if (s.report) {
        const r = s.report;
        if (Object.keys(r).some(k => !['died','place','depth','scrap','gear','newGear','hp','cleared'].includes(k)) || typeof r.died !== 'boolean' || !ids.includes(r.place) || !int(r.depth,1,3) || !int(r.scrap,0,1000) || !validArray(r.gear,Object.keys(GEAR)) || !validArray(r.newGear,Object.keys(GEAR)) || !int(r.hp,-30,80) || !Array.isArray(r.cleared) || r.cleared.length > 3 || !r.cleared.every(v => ids.includes(v))) throw Error('report');
      }
      return s;
    } catch { return null; }
  }
  return { VERSION, PLACES, GEAR, ENEMIES, INTENTS, initial, maxHp, upgradeCost, intent, place, discover, start, act, equip, upgrade, locationSession, observe, serialize, parse };
});
