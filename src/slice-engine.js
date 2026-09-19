/* Pure game rules. The browser and node:test use the same deterministic transitions. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CrownlessSlice = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  const PLACES = [
    { id: 'wood', name: '囁きの森', teaser: '霧の中に、折れた枝と獣の足跡が続いている。', subtitle: '根の下に、誰かの剣が眠る。', terrain: 'FOREST', weapon: 'fang', enemy: 'wolf', reward: '牙の短剣', hint: '回避のあとに、一撃を返す。', color: '#93ae8e' },
    { id: 'tower', name: '鐘なき塔', teaser: '霧の向こうから、鳴るはずのない鐘の音がする。', subtitle: '鳴らない鐘を、今も守る者。', terrain: 'WATCHTOWER', weapon: 'shield', enemy: 'knight', reward: '番人の盾', hint: '守りを固め、敵の隙を待つ。', color: '#c5ad79' },
    { id: 'fen', name: '星沈みの湿原', teaser: '水辺の霧の奥で、青い光がゆっくり揺れている。', subtitle: '水面に、消えた星が映る。', terrain: 'WETLAND', weapon: 'bow', enemy: 'wraith', reward: '葦の長弓', hint: '鎧を貫き、狙った獲物を射る。', color: '#91b4bd' },
    { id: 'crypt', name: '灰冠の廟', teaser: '石の下から、乾いた金属音がかすかに響く。', subtitle: '王冠だけが、主を忘れない。', terrain: 'ROYAL TOMB', weapon: 'crown', enemy: 'king', reward: '灰の王冠', hint: 'この小さな旅の、最初の到達点。', color: '#b1a0ca' },
  ];
  const GEAR = {
    rust: { name: '欠けた鉄剣', short: '鉄剣', family: 'rust', trait: 'balanced', attack: 4 },
    fang: { name: '牙の短剣', short: '短剣', family: 'fang', trait: 'fang', attack: 5 },
    fang_blood: { name: '血染めの短剣', short: '血短剣', family: 'fang', trait: 'bloodrush', attack: 5 },
    fang_moon: { name: '月影の短剣', short: '月短剣', family: 'fang', trait: 'moonstep', attack: 5 },
    shield: { name: '番人の盾', short: '剣と盾', family: 'shield', trait: 'sentinel', attack: 4 },
    shield_thorn: { name: '返し棘の盾', short: '棘盾', family: 'shield', trait: 'thorn', attack: 4 },
    shield_oath: { name: '誓壁の盾', short: '誓盾', family: 'shield', trait: 'oath', attack: 4 },
    bow: { name: '葦の長弓', short: '長弓', family: 'bow', trait: 'piercer', attack: 5 },
    bow_hunter: { name: '灰羽の長弓', short: '灰羽弓', family: 'bow', trait: 'hunter', attack: 5 },
    bow_recurve: { name: '骨角の短弓', short: '骨角弓', family: 'bow', trait: 'recurve', attack: 5 },
    crown: { name: '灰の王冠', short: '王冠', family: 'crown', trait: 'crown', attack: 4 },
  };
  const UPGRADEABLE = Object.keys(GEAR).filter(id => id !== 'crown');
  // Only these weapons existed before reinforcement became per-weapon (#577).
  // Post-migration variants must never inherit the old shared `level`.
  const LEGACY_UPGRADEABLE = new Set(['rust', 'fang', 'shield', 'bow']);
  const emptyUpgrades = () => Object.fromEntries(UPGRADEABLE.map(id => [id, 0]));
  const VARIANT_LOOT = {
    wood: ['fang_blood', 'fang_moon'],
    tower: ['shield_thorn', 'shield_oath'],
    fen: ['bow_hunter', 'bow_recurve'],
  };
  const LOOT_CUES = {
    wood: ['細身の刃が、根の隙間で一瞬だけ光った。', '赤黒い染みのある刃と、月色の柄が見える。'],
    tower: ['古い紋章入りの盾が、崩れた壁の奥に立てかけられている。', '縁に棘のある盾と、白い誓印の盾影が見える。'],
    fen: ['普通の葦弓とは違う弦鳴りが、霧の奥から返ってくる。', '灰色の羽根と骨角の弓身が、水面の向こうに見える。'],
    crypt: ['王墓の奥から、鉄ではない乾いた響きが返る。', '灰冠の主の近くに、まだ何かが残されている気配がある。'],
  };
  const ENEMIES = {
    wolf: { name: '茨牙の狼', hp: 16, archetype: '速攻型', patterns: [
      ['quick', 'heavy', 'open'],
      ['quick', 'quick', 'heavy', 'open'],
      ['quick', 'heavy', 'quick', 'open'],
    ] },
    knight: { name: '鐘守の亡兵', hp: 20, archetype: '防御型', patterns: [
      ['guard', 'heavy', 'open', 'quick'],
      ['guard', 'quick', 'heavy', 'guard', 'open'],
      ['guard', 'heavy', 'quick', 'guard', 'heavy', 'open'],
    ] },
    wraith: { name: '沼灯の亡霊', hp: 17, archetype: '狩人型', patterns: [
      ['quick', 'quick', 'open', 'heavy'],
      ['quick', 'open', 'heavy', 'quick', 'guard'],
      ['quick', 'heavy', 'quick', 'guard', 'open'],
    ] },
    king: { name: '灰冠の騎士', hp: 27, archetype: '重装型', patterns: [
      ['guard', 'heavy', 'quick', 'open'],
      ['guard', 'quick', 'heavy', 'quick', 'open'],
      ['guard', 'heavy', 'quick', 'guard', 'heavy', 'open'],
    ] },
  };
  const INTENTS = {
    quick: { name: '薙ぎ払い', damage: 6, help: '横薙ぎ。防御なら安定。回避しても半分は受け、追撃の好機は作れない。' },
    heavy: { name: '大振り', damage: 12, help: '回避がおすすめ。防御だけでは削られる。' },
    guard: { name: '守りを固める', damage: 0, help: '攻撃を 5 軽減する。防御で気力を整える。' },
    open: { name: '体勢を崩している', damage: 0, help: '攻撃の好機。強撃なら大きく削れる。' },
  };
  const copy = s => JSON.parse(JSON.stringify(s));
  const place = id => PLACES.find(p => p.id === id);
  const gearFamily = id => GEAR[id]?.family || id;
  const upgradeKey = id => UPGRADEABLE.includes(id) ? id : null;
  const initial = () => ({ version: VERSION, mode: null, unlocked: ['wood'], cleared: [], owned: ['rust'], equipped: 'rust', scrap: 0, level: 0, upgrades: emptyUpgrades(), runs: 0, victories: 0, expedition: null, report: null });
  const maxHp = s => 30 + (Number.isInteger(s.level) ? s.level : 0) * 5 + (s.owned.includes('crown') ? 6 : 0);
  function weaponLevel(s, id = s.equipped) {
    const legacy = LEGACY_UPGRADEABLE.has(id) && Number.isInteger(s?.level)
      ? Math.max(0, Math.min(4, s.level))
      : 0;
    const key = upgradeKey(id);
    const specific = key && Number.isInteger(s?.upgrades?.[key]) ? Math.max(0, Math.min(4, s.upgrades[key])) : 0;
    return Math.max(legacy, specific);
  }
  const upgradeCost = (s, id = s.equipped) => 8 + weaponLevel(s, id) * 6;
  function combatProfile(s, id = s.equipped) {
    const gear = GEAR[id];
    const family = gearFamily(id);
    const level = weaponLevel(s, id);
    const p = {
      family,
      heavyBonus: 4 + (family === 'bow' || family === 'rust' ? level : 0),
      dodgeFocus: family === 'fang' ? 5 + level : 3,
      block: family === 'shield' ? 12 + Math.ceil(level / 2) : 9,
      counter: family === 'shield' ? 3 + Math.floor(level / 2) : 0,
      pierce: family === 'bow',
      heavyCost: 2,
      dodgeCost: 1,
      lowHpBonus: 0,
      openBonus: 0,
    };
    if (!gear) return p;
    if (gear.trait === 'bloodrush') p.lowHpBonus = 2;
    if (gear.trait === 'moonstep') { p.dodgeCost = 0; p.dodgeFocus = 4 + level; }
    if (gear.trait === 'thorn') { p.block -= 2; p.counter += 3; }
    if (gear.trait === 'oath') { p.block += 3; p.counter = 0; }
    if (gear.trait === 'hunter') p.openBonus = 3;
    if (gear.trait === 'recurve') { p.heavyCost = 1; p.pierce = false; p.heavyBonus = 3 + level; }
    return p;
  }
  function gearText(s, id) {
    const gear = GEAR[id];
    if (!gear) return '';
    if (id === 'crown') return '持ち帰った証。すべての装備で最大体力 +6。';
    const p = combatProfile(s, id);
    let text = '';
    if (p.family === 'fang') text = `攻撃 ${gear.attack}。回避後の追撃 +${p.dodgeFocus}。`;
    else if (p.family === 'shield') text = `攻撃 ${gear.attack}。防御で ${p.block} 軽減${p.counter ? `・${p.counter} 反撃` : ''}。`;
    else if (p.family === 'bow') text = `攻撃 ${gear.attack}。強撃 ${gear.attack + p.heavyBonus} / 気力 ${p.heavyCost}${p.pierce ? '・守りを貫通' : ''}。`;
    else text = `攻撃 ${gear.attack}。強撃は気力 ${p.heavyCost} で ${gear.attack + p.heavyBonus} ダメージ。`;
    if (gear.trait === 'bloodrush') text += ' 体力半分以下で攻撃 +2。';
    if (gear.trait === 'moonstep') text += ' 回避の気力消費 0。';
    if (gear.trait === 'thorn') text += ' 受けは薄いが反撃が強い。';
    if (gear.trait === 'oath') text += ' 反撃を捨てて受けに特化。';
    if (gear.trait === 'hunter') text += ' 敵が隙を見せた時、攻撃 +3。';
    if (gear.trait === 'recurve') text += ' 強撃が軽い代わりに守りは貫けない。';
    return text;
  }
  function enemyProfile(e) {
    const archetype = ENEMIES[e.kind]?.archetype || '不明';
    let trait = null;
    if (e.elite && e.depth >= 2) {
      if (e.kind === 'wolf') trait = { id: 'feral', name: '猛攻', help: '薙ぎ払いと大振りの威力 +2。' };
      else if (e.kind === 'knight' || e.kind === 'king') trait = { id: 'ironhide', name: '鉄皮', help: '通常攻撃を 2 軽減。強撃・貫通には無効。' };
      else if (e.kind === 'wraith') trait = { id: 'relentless', name: '執念', help: '攻撃行動の威力 +1。' };
    }
    return { archetype, trait };
  }
  const intent = e => {
    const enemy = ENEMIES[e.kind];
    const pattern = enemy.patterns[Math.max(0, Math.min(2, e.depth - 1))];
    const id = pattern[e.turn % pattern.length];
    let damage = INTENTS[id].damage ? INTENTS[id].damage + e.depth - 1 + (e.elite ? 2 : 0) : 0;
    const trait = enemyProfile(e).trait?.id;
    if (damage && trait === 'feral') damage += 2;
    if (damage && trait === 'relentless') damage += 1;
    return { id, ...INTENTS[id], damage };
  };
  function lootCue(placeId, depth) {
    const cues = LOOT_CUES[placeId] || LOOT_CUES.crypt;
    if (depth <= 1) return '奥ほど鉄の気配が濃い。何が残っているかは、まだ分からない。';
    return cues[Math.min(cues.length - 1, depth - 2)];
  }
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
    const profile = enemyProfile(x.enemy);
    x.log = [elite ? `土地の主が、帰り道を塞いだ。${profile.trait ? `《${profile.trait.name}》の気配。` : ''}` : risky ? '宝の気配を追った。獲物も、こちらを見ている。' : '足音が止んだ。敵の構えをよく見よう。'];
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
  function variantDrop(s, x, e) {
    if (x.depth < 2) return null;
    const pool = VARIANT_LOOT[x.place] || [];
    const available = pool.filter(id => !s.owned.includes(id) && !x.gear.includes(id));
    if (!available.length) return null;
    if (!e.elite) {
      if (!e.risky) return null;
      const roll = (s.runs + x.depth + x.room + PLACES.findIndex(p => p.id === x.place)) % 2;
      if (roll !== 0) return null;
    }
    return available[(s.runs + x.depth + x.room) % available.length];
  }
  function victory(s) {
    const x = s.expedition, e = x.enemy;
    const loot = (e.elite ? 5 : 2) * x.depth + (e.risky ? 3 : 0);
    x.scrap += loot;
    x.log.push(`討伐。鉄片を ${loot} 個、背嚢へ。生還するまで確定しない。`);
    const variant = variantDrop(s, x, e);
    if (variant) {
      x.gear.push(variant);
      x.log.push(`${GEAR[variant].name}を発見！ まだ未帰還。今なら帰って確定できる。`);
    }
    if (e.elite) {
      if (x.depth === 1) {
        const gear = place(x.place).weapon;
        if (!x.gear.includes(gear) && !s.owned.includes(gear)) { x.gear.push(gear); x.log.push(`${GEAR[gear].name}を発見！ 焚き火へ持ち帰ろう。`); }
        else { x.scrap += 4; x.log.push('持っている装備の代わりに、鉄片 +4。'); }
      } else if (!variant) { x.scrap += 4; x.log.push('珍しい武具は見つからず、鉄片 +4。'); }
      x.seals.push(x.place); x.stage = 'cleared';
    } else { x.room++; x.stage = 'path'; }
    x.enemy = null;
  }
  function attackPreview(s, action) {
    const x = s.expedition;
    if (!x?.enemy || !['strike', 'heavy'].includes(action)) return 0;
    const e = x.enemy, next = intent(e), weapon = GEAR[s.equipped], p = combatProfile(s);
    let damage = weapon.attack + x.focus + (action === 'heavy' ? p.heavyBonus : 0);
    if (p.lowHpBonus && x.hp <= Math.ceil(maxHp(s) / 2)) damage += p.lowHpBonus;
    if (p.openBonus && next.id === 'open') damage += p.openBonus;
    if (next.id === 'guard' && !(p.pierce && action === 'heavy')) damage = Math.max(0, damage - 5);
    if (enemyProfile(e).trait?.id === 'ironhide' && action === 'strike' && !p.pierce) damage = Math.max(0, damage - 2);
    return damage;
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
      x.depth++; x.room = 0; x.stage = 'path'; x.log = [`さらに深く。${lootCue(x.place, x.depth)}`]; return n;
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
      const p = combatProfile(n);
      if ((action === 'heavy' && x.stamina < p.heavyCost) || (action === 'dodge' && x.stamina < p.dodgeCost)) return s;
      x.log = [];
    } else return s;
    const e = x.enemy, next = intent(e), p = combatProfile(n);
    if (action === 'flee') {
      const damage = Math.max(2, next.damage);
      x.hp -= damage;
      return finish(n, x.hp <= 0);
    }
    let damage = 0;
    if (action === 'strike' || action === 'heavy') {
      damage = attackPreview(n, action);
      x.stamina = Math.min(3, x.stamina + (action === 'heavy' ? -p.heavyCost : 1)); x.focus = 0;
    }
    if (action === 'guard') { x.stamina = Math.min(3, x.stamina + 1); if (p.counter && next.damage > 0) damage = p.counter; }
    if (action === 'dodge') {
      x.stamina -= p.dodgeCost;
      x.focus = next.damage > 0 && next.id !== 'quick' ? p.dodgeFocus : 0;
    }
    e.hp = Math.max(0, e.hp - damage);
    if (damage > 0) x.log.push(`こちらの一撃。${damage} ダメージ。`);
    if (e.hp <= 0) { victory(n); return n; }
    const block = action === 'guard' ? p.block : 0;
    const taken = action === 'dodge'
      ? (next.id === 'quick' ? Math.max(1, Math.ceil(next.damage / 2)) : 0)
      : Math.max(0, next.damage - block);
    x.hp -= taken;
    if (action === 'dodge') {
      if (next.id === 'quick') x.log.push(`${next.name}をかわしきれない。体力 −${taken}。追撃の好機は作れない。`);
      else if (next.damage) x.log.push(`身をかわした。次の攻撃 +${x.focus}。`);
      else x.log.push('攻撃は来ない。回避に気力を使った。');
    } else {
      x.log.push(taken ? `${next.name}。体力 −${taken}。` : next.damage ? '攻撃を受け止めた。体力消費なし。' : '敵は攻撃してこない。');
    }
    e.turn++;
    if (x.hp <= 0) return finish(n, true);
    return n;
  }
  function equip(s, id) {
    if (s.expedition || !s.owned.includes(id) || !GEAR[id] || id === 'crown') return s;
    const n = copy(s); n.equipped = id; return n;
  }
  function upgrade(s, id = s.equipped) {
    const key = upgradeKey(id);
    if (s.expedition || !key || !s.owned.includes(id)) return s;
    const level = weaponLevel(s, id), cost = upgradeCost(s, id);
    if (level >= 4 || s.scrap < cost) return s;
    const n = copy(s); n.scrap -= cost; n.upgrades[key] = level + 1; return n;
  }
  function locationSession(anchor = null) {
    const latitude = Number(anchor?.latitude), longitude = Number(anchor?.longitude), accuracy = Number(anchor?.accuracy);
    const valid = Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180 && Number.isFinite(accuracy) && accuracy >= 0;
    return { anchor: valid ? { latitude, longitude, accuracy } : null };
  }
  function observe(session, fix) {
    if (!fix || !Number.isFinite(fix.latitude) || Math.abs(fix.latitude) > 90 || !Number.isFinite(fix.longitude) || Math.abs(fix.longitude) > 180 || !Number.isFinite(fix.accuracy) || fix.accuracy < 0 || fix.accuracy > 60) return { status: 'inaccurate' };
    if (Number.isFinite(fix.speed) && fix.speed > 1.5) return { status: 'moving' };
    if (!session.anchor) { session.anchor = { latitude: fix.latitude, longitude: fix.longitude, accuracy: fix.accuracy }; return { status: 'anchored' }; }
    const a = session.anchor, north = (fix.latitude - a.latitude) * 111320;
    const deltaLongitude = ((fix.longitude - a.longitude + 540) % 360) - 180;
    const east = deltaLongitude * 111320 * Math.cos(a.latitude * Math.PI / 180);
    const distance = Math.hypot(north, east);
    if (distance < 150 + a.accuracy + fix.accuracy) return { status: 'nearby' };
    const id = Math.abs(north) > Math.abs(east) ? (north > 0 ? 'tower' : 'crypt') : (east > 0 ? 'fen' : 'wood');
    return { status: 'discovered', place: id };
  }
  function serialize(s) { return JSON.stringify(s); }
  function parse(raw) {
    if (!raw) return initial();
    try {
      const s = JSON.parse(raw);
      if (s.version === VERSION && s.upgrades === undefined) s.upgrades = emptyUpgrades();
      else if (s.version === VERSION && s.upgrades && typeof s.upgrades === 'object' && !Array.isArray(s.upgrades)) s.upgrades = {...emptyUpgrades(), ...s.upgrades};
      const ids = PLACES.map(p => p.id), keys = Object.keys(initial());
      const validArray = (a, allowed) => Array.isArray(a) && a.length <= allowed.length && new Set(a).size === a.length && a.every(v => allowed.includes(v));
      const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
      const validUpgrades = u => u && typeof u === 'object' && !Array.isArray(u) && Object.keys(u).length === UPGRADEABLE.length && UPGRADEABLE.every(id => Object.prototype.hasOwnProperty.call(u,id) && int(u[id],0,4)) && Object.keys(u).every(id => UPGRADEABLE.includes(id));
      if (s.version !== VERSION || Object.keys(s).some(k => !keys.includes(k)) || ![null, 'demo', 'walk'].includes(s.mode) || !validArray(s.unlocked, ids) || !s.unlocked.includes('wood') || !validArray(s.cleared, ids) || !validArray(s.owned, Object.keys(GEAR)) || !s.owned.includes('rust') || !s.owned.includes(s.equipped) || s.equipped === 'crown' || !int(s.level, 0, 4) || !validUpgrades(s.upgrades) || !int(s.scrap, 0, 1e9) || !int(s.runs, 0, 1e9) || !int(s.victories, 0, s.runs)) throw Error('save');
      if (s.expedition) {
        const x = s.expedition;
        const allowedFocus = gearFamily(s.equipped) === 'fang' ? [0,3,4,5,6,7,8,9] : [0,3];
        if (Object.keys(x).some(k => !['place','depth','room','hp','stamina','focus','potions','scrap','gear','seals','enemy','stage','log'].includes(k)) || !s.unlocked.includes(x.place) || !int(x.depth,1,3) || !int(x.room,0,4) || !int(x.hp,1,maxHp(s)) || !int(x.stamina,0,3) || !allowedFocus.includes(x.focus) || !int(x.potions,0,2) || !int(x.scrap,0,1000) || !validArray(x.gear,Object.keys(GEAR)) || !Array.isArray(x.seals) || x.seals.length > 3 || !x.seals.every(v => ids.includes(v)) || !['path','fight','cleared'].includes(x.stage) || !Array.isArray(x.log) || x.log.length > 10 || !x.log.every(v => typeof v === 'string' && v.length < 250)) throw Error('run');
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
  return { VERSION, PLACES, GEAR, ENEMIES, INTENTS, VARIANT_LOOT, initial, maxHp, gearFamily, weaponLevel, upgradeCost, combatProfile, gearText, enemyProfile, attackPreview, intent, lootCue, place, discover, start, act, equip, upgrade, locationSession, observe, serialize, parse };
});
