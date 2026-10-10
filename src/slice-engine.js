/* Pure game rules. The browser and node:test use the same deterministic transitions. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./neighborhood.js'));
  else root.CrownlessSlice = factory(root.CrownlessNeighborhood);
})(typeof globalThis === 'object' ? globalThis : this, function (N) {
  'use strict';
  const VERSION = 1;
  const PLACES = [
    { id: 'wood', name: '囁きの森', teaser: '霧の中に、折れた枝と獣の足跡が続いている。', subtitle: '根の下に、誰かの剣が眠る。', terrain: 'FOREST', weapon: 'fang', enemy: 'wolf', reward: '狼牙と鍛冶素材', hint: '回避のあとに、一撃を返す。', color: '#93ae8e' },
    { id: 'tower', name: '鐘なき塔', teaser: '霧の向こうから、鳴るはずのない鐘の音がする。', subtitle: '鳴らない鐘を、今も守る者。', terrain: 'WATCHTOWER', weapon: 'shield', enemy: 'knight', reward: '鐘鉄と鍛冶素材', hint: '守りを固め、敵の隙を待つ。', color: '#c5ad79' },
    { id: 'fen', name: '星沈みの湿原', teaser: '水辺の霧の奥で、青い光がゆっくり揺れている。', subtitle: '水面に、消えた星が映る。', terrain: 'WETLAND', weapon: 'bow', enemy: 'wraith', reward: '霧葦と鍛冶素材', hint: '鎧を貫き、狙った獲物を射る。', color: '#91b4bd' },
    { id: 'crypt', name: '灰冠の廟', teaser: '石の下から、乾いた金属音がかすかに響く。', subtitle: '王冠だけが、主を忘れない。', terrain: 'ROYAL TOMB', weapon: 'crown', enemy: 'king', reward: '灰の王冠', hint: 'この小さな旅の、最初の到達点。', color: '#b1a0ca' },
  ];
  const GEAR = {
    rust: { name: '欠けた鉄剣', short: '鉄剣', family: 'rust', trait: 'balanced', attack: 4 },
    fang: { name: '牙の短剣', short: '短剣', family: 'fang', trait: 'fang', attack: 5 },
    fang_blood: { name: '血染めの短剣', short: '血短剣', family: 'fang', trait: 'bloodrush', attack: 5 },
    fang_moon: { name: '月影の短剣', short: '月短剣', family: 'fang', trait: 'moonstep', attack: 5 },
    forged_fang: { name: '鍛ち牙の短剣', short: '鍛ち牙', family: 'fang', trait: 'moonstep', attack: 6 },
    shield: { name: '番人の盾', short: '剣と盾', family: 'shield', trait: 'sentinel', attack: 4 },
    shield_thorn: { name: '返し棘の盾', short: '棘盾', family: 'shield', trait: 'thorn', attack: 4 },
    shield_oath: { name: '誓壁の盾', short: '誓盾', family: 'shield', trait: 'oath', attack: 4 },
    bow: { name: '葦の長弓', short: '長弓', family: 'bow', trait: 'piercer', attack: 5 },
    bow_hunter: { name: '灰羽の長弓', short: '灰羽弓', family: 'bow', trait: 'hunter', attack: 5 },
    bow_recurve: { name: '骨角の短弓', short: '骨角弓', family: 'bow', trait: 'recurve', attack: 5 },
    crown: { name: '灰の王冠', short: '王冠', family: 'crown', trait: 'crown', attack: 4 },
  };
  const GEAR_IDS = Object.freeze(Object.keys(GEAR));
  const UPGRADEABLE = GEAR_IDS.filter(id => id !== 'crown');
  // Only these weapons existed before reinforcement became per-weapon (#577).
  // Post-migration variants must never inherit the old shared `level`.
  const LEGACY_UPGRADEABLE = new Set(['rust', 'fang', 'shield', 'bow']);
  const emptyUpgrades = () => Object.fromEntries(UPGRADEABLE.map(id => [id, 0]));
  const emptyQualities = () => Object.fromEntries(GEAR_IDS.map(id => [id, 0]));
  const QUALITY_STEPS = [
    { max: 10, quality: -1 },
    { max: 65, quality: 0 },
    { max: 90, quality: 1 },
    { max: 98, quality: 2 },
    { max: 100, quality: 3 },
  ];
  const DISMANTLE_SCRAP = 2;
  const LOCAL_HERB_COST = 2;
  // Legacy catalog retained for saved weapon IDs and older test fixtures; no new expedition drops equippable gear.
  const VARIANT_LOOT = {
    wood: ['fang_blood', 'fang_moon'],
    tower: ['shield_thorn', 'shield_oath'],
    fen: ['bow_hunter', 'bow_recurve'],
  };
  const MATERIALS = Object.freeze({
    wolfFang: { name:'狼牙', source:'囁きの森' },
    watchIron: { name:'鐘鉄', source:'鐘なき塔' },
    marshFiber: { name:'霧葦', source:'星沈みの湿原' }
  });
  const MATERIAL_IDS = Object.freeze(Object.keys(MATERIALS));
  const emptyMaterials = () => Object.fromEntries(MATERIAL_IDS.map(id => [id,0]));
  const RECIPES = Object.freeze({
    forged_fang: { materials:{wolfFang:2}, scrap:4, quality:1, origin:'囁きの森' },
    shield: { materials:{watchIron:2}, scrap:4, quality:0, origin:'鐘なき塔' },
    bow: { materials:{marshFiber:2}, scrap:4, quality:0, origin:'星沈みの湿原' }
  });
  // These clients are simulated NPCs. This is NOT a networked player marketplace.
  const COMMISSIONS = Object.freeze({
    wood: { recipe:'forged_fang', requester:'森の斥候', outcome:'斥候が鍛えた短剣で獣道を切り開いた。', reward:6 },
    tower: { recipe:'shield', requester:'塔の見張り', outcome:'見張りが新しい盾で塔への道を守り抜いた。', reward:6 },
    fen: { recipe:'bow', requester:'湿原の案内人', outcome:'案内人が製作された弓で旅人の退路を確保した。', reward:6 }
  });
  const emptyCommission = () => ({ pending:null, completed:0, support:null, lastResult:null });
  const ENEMY_MATERIAL = Object.freeze({ wolf:'wolfFang', forest_hunter:'wolfFang', knight:'watchIron', wraith:'marshFiber' });
  const LOOT_CUES = {
    wood: ['枝の下に鋭い牙の跡がある。鍛冶師なら使えそうだ。', '霧の奥には、より大きな獣の牙が眠る。'],
    tower: ['朽ちた鐘に珍しい鉄の響きがある。', '鎧の残骸に、鍛ち直せる鐘鉄が混じっている。'],
    fen: ['水辺にしなやかな霧葦が群生している。', '奥の亡霊のまわりで、特別な霧葦が揺れる。'],
    crypt: ['王墓には灰冠の記憶が残る。', '王冠以外に武具はないが、帰還のための鉄片が見つかる。']
  };
  const ENEMIES = {
    wolf: { name: '茨牙の狼', art: 'wolf', hp: 16, archetype: '速攻型', patterns: [
      ['quick', 'heavy', 'open'],
      ['quick', 'quick', 'heavy', 'open'],
      ['quick', 'heavy', 'quick', 'open'],
    ], elitePatterns: [
      ['pounce', 'quick', 'open', 'heavy'],
      ['quick', 'pounce', 'heavy', 'open'],
      ['pounce', 'quick', 'pounce', 'open'],
    ] },
    forest_hunter: { name: '苔鎧の狩人', art: 'knight', hp: 18, archetype: '狩人型', patterns: [
      ['guard', 'quick', 'heavy', 'open'],
      ['quick', 'guard', 'heavy', 'quick', 'open'],
      ['guard', 'heavy', 'quick', 'guard', 'open'],
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
    quick: { name: '薙ぎ払い', damage: 6, help: '横薙ぎ。防御で受け流せば反撃の好機。回避では半分受け、追撃できない。' },
    pounce: { name: '飛びかかり', damage: 10, help: '主だけの鋭い踏み込み。回避なら無傷と追撃、防御では少し削られる。' },
    heavy: { name: '大振り', damage: 12, help: '回避がおすすめ。防御だけでは削られる。' },
    guard: { name: '守りを固める', damage: 0, help: '攻撃を 3 軽減する。防御で気力を整える。' },
    open: { name: '体勢を崩している', damage: 0, help: '攻撃の好機。強撃なら大きく削れる。' },
    feint: { name: 'フェイント', damage: 4, help: '回避を誘う牽制。通常攻撃で先手を取れば技を潰して追撃できる。回避すると被弾。' },
    break: { name: '崩し', damage: 7, help: '守りを崩す一撃。通常攻撃で技を潰すか、回避する。防御すると崩される。' },
    intercept: { name: '迎撃', damage: 6, help: '強撃を待ち構える。通常攻撃へ切り替えるか、防御で整えられる。' },
    frenzy: { name: '窮鼠の一撃', damage: 8, help: '手負いの反撃。隙を見せたふりだ。回避なら無傷で追撃、防御なら軽減できる。' },
  };
  const copy = s => JSON.parse(JSON.stringify(s));
  function hydrateKnownRecord(value, defaultsFactory) {
    if (value === undefined) return defaultsFactory();
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    return { ...defaultsFactory(), ...value };
  }
  const place = id => PLACES.find(p => p.id === id);
  function isRoadsideEvent(s, x = s?.expedition) {
    if (!x || x.stage !== 'path' || ![1, 3].includes(x.room)) return false;
    const placeIndex = PLACES.findIndex(p => p.id === x.place);
    return placeIndex >= 0 && (s.runs + x.depth + x.room + placeIndex) % 2 === 1;
  }
  const gearFamily = id => GEAR[id]?.family || id;
  const upgradeKey = id => UPGRADEABLE.includes(id) ? id : null;
  function weaponQuality(s, id = s.equipped) {
    const q = s?.qualities?.[id];
    return Number.isInteger(q) ? Math.max(-1, Math.min(3, q)) : 0;
  }
  function weaponAttack(s, id = s.equipped, qualityOverride = null) {
    const gear = GEAR[id];
    if (!gear) return 0;
    const q = Number.isInteger(qualityOverride) ? Math.max(-1, Math.min(3, qualityOverride)) : weaponQuality(s, id);
    return Math.max(1, gear.attack + q);
  }
  const qualityLabel = q => `品質 ${q > 0 ? '+' : ''}${q}`;
  function rollQuality(s, x, id, salt = 0) {
    if (id === 'crown') return 0;
    const placeIndex = Math.max(0, PLACES.findIndex(p => p.id === x.place));
    const gearIndex = Math.max(0, Object.keys(GEAR).indexOf(id));
    const roll = ((s.runs * 37 + x.depth * 17 + x.room * 13 + placeIndex * 11 + gearIndex * 19 + x.gear.length * 23 + salt * 29) % 100 + 100) % 100;
    return QUALITY_STEPS.find(step => roll < step.max)?.quality ?? 0;
  }
  const startingCharacters = () => [
    { id:'traveler', name:'旅人', role:'adventurer', equipped:'rust', experience:0 },
    { id:'smith', name:'見習い鍛冶師', role:'smith', equipped:'rust', experience:0 },
    { id:'merchant', name:'行商人', role:'merchant', equipped:'rust', experience:0 }
  ];
  const initial = () => ({ version: VERSION, mode: null, unlocked: ['wood'], cleared: [], owned: ['rust'], equipped: 'rust', qualities: emptyQualities(), scrap: 0, materials:emptyMaterials(), characters:startingCharacters(), activeCharacter:0, commission:emptyCommission(), level: 0, upgrades: emptyUpgrades(), runs: 0, victories: 0, grudge: null, maintenance: null, expedition: null, report: null, neighborhood:N.initial() });
  const maxHp = s => 30 + (Number.isInteger(s.level) ? s.level : 0) * 5 + (s.owned.includes('crown') ? 6 : 0) + (s.neighborhood?.buildings.includes('lodge') ? 4 : 0);
  function weaponLevel(s, id = s.equipped) {
    const legacy = LEGACY_UPGRADEABLE.has(id) && Number.isInteger(s?.level)
      ? Math.max(0, Math.min(4, s.level))
      : 0;
    const key = upgradeKey(id);
    const specific = key && Number.isInteger(s?.upgrades?.[key]) ? Math.max(0, Math.min(4, s.upgrades[key])) : 0;
    return Math.max(legacy, specific);
  }
  const upgradeCost = (s, id = s.equipped) => Math.max(2, (id === 'rust' && weaponLevel(s, id) === 0 ? 4 : 8 + weaponLevel(s, id) * 6) - (s.neighborhood?.buildings.includes('forge') ? 2 : 0));
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
  function gearText(s, id, qualityOverride = null) {
    const gear = GEAR[id];
    if (!gear) return '';
    if (id === 'crown') return '持ち帰った証。すべての装備で最大体力 +6。';
    const p = combatProfile(s, id), attack = weaponAttack(s, id, qualityOverride);
    let text = '';
    if (p.family === 'fang') text = `攻撃 ${attack}。回避後の追撃 +${p.dodgeFocus}。`;
    else if (p.family === 'shield') text = `攻撃 ${attack}。防御で ${p.block} 軽減${p.counter ? `・${p.counter} 反撃` : ''}。`;
    else if (p.family === 'bow') text = `攻撃 ${attack}。強撃 ${attack + p.heavyBonus} / 気力 ${p.heavyCost}${p.pierce ? '・守りを貫通' : ''}。`;
    else text = `攻撃 ${attack}。強撃は気力 ${p.heavyCost} で ${attack + p.heavyBonus} ダメージ。`;
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
  const hash01 = (seed, t) => {
    let h = Math.imul((seed + 1) * 2654435761 ^ (t + 1) * 40503, 2246822519);
    h ^= h >>> 13; h = Math.imul(h, 3266489917); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  function proceduralId(e, pattern) {
    if (e.turn === 0) return pattern[0];
    const pools = {
      wolf: ['quick', 'heavy', 'feint', 'open'],
      forest_hunter: ['guard', 'quick', 'feint', 'heavy', 'open'],
      knight: ['guard', 'heavy', 'break', 'intercept', 'quick', 'open'],
      wraith: ['quick', 'feint', 'heavy', 'guard', 'open'],
      king: ['guard', 'heavy', 'break', 'quick', 'open'],
    };
    const pool = pools[e.kind] || pattern;
    const seq = [pattern[0]];
    for (let t = 1; t <= e.turn; t++) {
      const prev = seq[t - 1];
      const prev2 = seq[t - 2];
      const sinceOpen = seq.length - 1 - seq.lastIndexOf('open');
      const weights = pool.map(id => {
        let w = 1.0;
        if (id === 'open') {
          if (prev === 'open' || (sinceOpen < 2 && seq.includes('open'))) w = 0;
          else if (prev === 'heavy' || prev === 'pounce') w = 2.5;
          else if (sinceOpen >= 3 || (!seq.includes('open') && t >= 3)) w = 3.0;
          else w = 0.4;
        }
        if (['heavy', 'pounce', 'guard', 'break', 'intercept'].includes(id) && id === prev) w = 0;
        if (id === prev && id === prev2) w = 0;
        return [id, w];
      });
      const total = weights.reduce((a, [, w]) => a + w, 0);
      let r = hash01(e.seed, t) * total, pick = weights[0][0];
      for (const [id, w] of weights) {
        if (w > 0 && r < w) { pick = id; break; }
        r -= w;
      }
      seq.push(pick);
    }
    return seq[e.turn];
  }
  const intent = e => {
    const enemy = ENEMIES[e.kind];
    const patterns = e.elite && enemy.elitePatterns ? enemy.elitePatterns : enemy.patterns;
    const pattern = patterns[Math.max(0, Math.min(2, e.depth - 1))];
    let id = Number.isInteger(e.seed) ? proceduralId(e, pattern) : pattern[e.turn % pattern.length];
    if (e.frenzy && id === 'open') id = 'frenzy';
    let damage = INTENTS[id].damage ? INTENTS[id].damage + e.depth - 1 + (e.elite ? 2 : 0) : 0;
    const trait = enemyProfile(e).trait?.id;
    if (damage && trait === 'feral') damage += 2;
    if (damage && trait === 'relentless') damage += 1;
    return { id, ...INTENTS[id], damage };
  };
  function lootCue(placeId, depth) {
    const cues = LOOT_CUES[placeId] || LOOT_CUES.crypt;
    if (depth <= 1) return '奥ほど希少素材の気配が濃い。命がけで持ち帰り、職人に託そう。';
    return cues[Math.min(cues.length - 1, depth - 2)];
  }
  function discover(s, id) {
    if (!place(id) || s.unlocked.includes(id)) return s;
    const n = copy(s); n.unlocked.push(id); return n;
  }
  function start(s, id) {
    if (s.activeCharacter !== 0 || s.expedition || !s.mode || !s.unlocked.includes(id) || !place(id) || (id === 'crypt' && s.cleared.length < 2)) return s;
    const n = copy(s); n.report = null; n.runs++;
    // Help earned through a past NPC commission is a one-expedition, same-region benefit.
    const supported = n.commission.support === id;
    if (supported) n.commission.support = null;
    n.commission.lastResult = null;
    n.neighborhood = N.begin(n.neighborhood || N.migrate(n),id);
    const visitorGift = !supported && N.traveler(N.get(n.neighborhood,n.neighborhood.active));
    if (visitorGift) n.neighborhood = N.takeTraveler(n.neighborhood);
    const sharpened = n.maintenance === 'sharp' ? 3 : 0; n.maintenance = null;
    const grudge = n.grudge?.place === id && ENEMIES[n.grudge.enemy] ? { ...n.grudge, used: false } : null;
    const intro = [
      sharpened ? '研いだ刃はまだ鋭い。次の三戦、初撃が強くなる。' : null,
      grudge ? `敗走の記憶が残っている。${ENEMIES[grudge.enemy].name}への一撃に執念を乗せられる。` : null,
      supported ? `${COMMISSIONS[id].requester}の支援で薬草 +1。鍛冶師の納品が帰ってきた。` : null,
      visitorGift ? `${visitorGift.name}（架空NPC）の補給袋を受け取った。薬草 +1。ここからの一度限りの支援。` : null,
    ].filter(Boolean).join(' ') || '火はここで待っている。まずは足跡をたどろう。';
    n.expedition = { place: id, depth: 1, room: 0, hp: maxHp(s), stamina: 3, focus: 0, stagger: false, sharpened, sharpenedApplied: false, potions: (supported || visitorGift) ? 3 : 2, scrap: 0, materials:emptyMaterials(), gear: [], gearQuality: [], seals: [], grudge, enemy: null, stage: 'path', log: [intro] };
    return n;
  }
  // One local trade creates a tangible expedition advantage without new save fields.
  // The selected district must actually contain the woodland herbalist's shop.
  function startWithLocalHerb(s) {
    const d = s?.neighborhood && N.get(s.neighborhood);
    if (!d || d.biome !== 'wood' || N.pointOfInterest(d)?.family !== 'shop' || s.scrap < LOCAL_HERB_COST) return s;
    const n = start(s, 'wood');
    if (n === s) return s;
    // Two separate assistance sources may overlap; never charge for a potion that cannot fit.
    if (n.expedition.potions >= 3) {
      n.expedition.log.unshift('地域の支援で薬草は十分。露店での追加購入は見送った。');
      return n;
    }
    n.scrap -= LOCAL_HERB_COST;
    n.expedition.potions = Math.min(3,n.expedition.potions+1);
    n.expedition.log.unshift('枝角の露店の薬師から、森の薬草を一束買った。鉄片 −2 / 今回の遠征の薬草 +1。');
    return n;
  }
  function encounter(x, risky, runs = 0) {
    const elite = x.room === 4;
    const kind = x.place === 'wood' && x.room === 2 ? 'forest_hunter' : place(x.place).enemy;
    const hp = ENEMIES[kind].hp + (x.depth - 1) * 5 + (elite ? 6 : 0) + (risky ? 3 : 0);
    x.enemy = { kind, hp, maxHp: hp, turn: 0, depth: x.depth, elite, risky };
    if (x.room > 0 && !elite) x.enemy.seed = Math.abs(runs * 7919 + x.depth * 131 + x.room * 17 + (risky ? 5 : 0)) % 99991;
    x.stage = 'fight'; x.stamina = Math.max(2, x.stamina); x.stagger = false; x.sharpenedApplied = false;
    const profile = enemyProfile(x.enemy);
    x.log = [elite ? `土地の主が、帰り道を塞いだ。${profile.trait ? `《${profile.trait.name}》の気配。` : ''}` : risky ? '宝の気配を追った。獲物も、こちらを見ている。' : '足音が止んだ。敵の構えをよく見よう。'];
  }
  function finish(s, died) {
    const x = s.expedition;
    let completedHere = false;
    const gearQuality = Array.isArray(x.gearQuality) ? [...x.gearQuality] : [];
    while (gearQuality.length < x.gear.length) gearQuality.push(0);
    s.report = { died, place: x.place, depth: x.depth, scrap: x.scrap, gear: [...x.gear], gearQuality: [...gearQuality], materials:{...emptyMaterials(),...(x.materials||{})}, newGear: [], duplicates: [], hp: x.hp, cleared: [...x.seals], defeatedBy: died && x.enemy ? x.enemy.kind : null };
    if (died && x.enemy) s.grudge = { place: x.place, enemy: x.enemy.kind };
    if (!died) {
      s.scrap += x.scrap;
      for (const id of MATERIAL_IDS) s.materials[id] += x.materials?.[id] ?? 0;
      const newGear = [];
      const duplicates = [];
      for (let i = 0; i < x.gear.length; i++) {
        const id = x.gear[i], quality = Number.isInteger(gearQuality[i]) ? gearQuality[i] : 0;
        if (id === 'crown') {
          if (!s.owned.includes(id)) { s.owned.push(id); s.qualities[id] = 0; newGear.push(id); }
          continue;
        }
        if (!s.owned.includes(id)) {
          s.owned.push(id); s.qualities[id] = quality; newGear.push(id);
        } else {
          duplicates.push({ id, quality, decision: null });
        }
      }
      // The NPC's report reaches camp only after a safe return to the supplied region.
      if (s.commission.pending === x.place && COMMISSIONS[x.place] && (x.room > 0 || x.stage === 'cleared')) {
        const job = COMMISSIONS[x.place];
        s.commission.pending = null;
        completedHere = true;
        s.commission.completed++;
        s.commission.support = x.place;
        s.commission.lastResult = x.place;
        s.scrap += job.reward;
      }
      s.report.newGear = [...new Set(newGear)];
      s.report.duplicates = duplicates;
      s.cleared = [...new Set([...s.cleared, ...x.seals])]; s.victories++; s.maintenance = 'ready';
    }
    s.neighborhood = N.settle(s.neighborhood || N.migrate(s),x,died,completedHere);
    s.expedition = null;
    return s;
  }
  // New adventures yield raw resources; legacy in-progress gear is still honored by finish().
  function victory(s) {
    const x = s.expedition, e = x.enemy;
    if (!x.materials) x.materials = emptyMaterials(); // Older combat fixtures.
    x.materials = {...emptyMaterials(),...x.materials};
    if (!Array.isArray(x.gearQuality)) x.gearQuality = [];
    while (x.gearQuality.length < x.gear.length) x.gearQuality.push(0);
    const loot = (e.elite ? 5 : 2) * x.depth + (e.risky ? 3 : 0);
    x.scrap += loot;
    x.log.push(`討伐。鉄片を ${loot} 個、背嚢へ。生還するまで確定しない。`);
    const materialId = ENEMY_MATERIAL[e.kind];
    if (materialId) {
      const active = N.get(s.neighborhood,s.neighborhood.active);
      const aided = x.room === 0 && active?.aided && active.biome === x.place;
      const amount = e.elite ? Math.min(3,x.depth+1) : 1;
      x.materials[materialId] += amount + (aided ? 1 : 0);
      if (aided) x.log.push(`${N.trace(active).name}の採集路。最初の戦利品に${MATERIALS[materialId].name} +1。生還するまで未確定。`);
      x.log.push(`${MATERIALS[materialId].name} +${amount}。装備そのものは落ちない。素材を持ち帰って鍛冶師に託そう。`);
    }
    if (e.elite) {
      if (x.depth === 1 && x.place === 'crypt') {
        if (x.gear.includes('crown') || s.owned.includes('crown')) {
          x.scrap += 4;
          x.log.push('灰の王冠はすでに持ち帰った。新たな鉄片 +4。');
        } else {
          x.gear.push('crown'); x.gearQuality.push(0);
          x.log.push('灰の王冠を見つけた。これは装備ではなく、旅の到達を記す遺物だ。');
        }
      } else if (!materialId) {
        x.scrap += 4;
        x.log.push('古い武具はもう使えない。鉄片 +4。');
      }
      x.seals.push(x.place); x.stage = 'cleared';
    } else { x.room++; x.stage = 'path'; }
    x.enemy = null; x.stagger = false; x.focus = 0;
  }
  function attackPreview(s, action) {
    const x = s.expedition;
    if (!x?.enemy || !['strike', 'heavy'].includes(action)) return 0;
    const e = x.enemy, next = api.intent(e), p = combatProfile(s);
    let damage = weaponAttack(s, s.equipped) + x.focus + (action === 'heavy' ? p.heavyBonus : 0);
    if (x.sharpened > 0 && !x.sharpenedApplied) damage += 3;
    if (x.grudge && !x.grudge.used && x.grudge.enemy === e.kind) damage += 3;
    if (x.stagger) damage += weaponAttack(s, s.equipped);
    if (p.lowHpBonus && x.hp <= Math.ceil(maxHp(s) / 2)) damage += p.lowHpBonus;
    if (p.openBonus && next.id === 'open') damage += p.openBonus;
    if (action === 'heavy' && next.id === 'open') damage += 5;
    if (next.id === 'guard' && !(p.pierce && action === 'heavy')) damage = Math.max(0, damage - 3);
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
        const roadside = isRoadsideEvent(n, x);
        if (roadside) {
          if (!['trade', 'pray'].includes(action)) return s;
          if (action === 'trade') {
            if (x.scrap < 3 || x.potions >= 2) return s;
            x.scrap -= 3; x.potions += 1; x.log = ['朽ちた行商人の荷車から、使える薬草を見つけた。鉄片 −3 / 薬草 +1。'];
          } else {
            if (x.hp <= 3) return s;
            x.hp -= 3; x.focus = Math.max(x.focus, 3); x.log = ['古い道標へ血を捧げた。体力 −3 / 次の一撃 +3。'];
          }
        } else {
          if (!['rest', 'search'].includes(action)) return s;
          if (action === 'rest') { x.hp = Math.min(maxHp(n), x.hp + 6); x.log = ['小さな灯りのそばで休んだ。体力 +6。']; }
          else { x.hp -= 4; x.scrap += 5 * x.depth; x.log = [`茨の中の遺品を拾う。体力 −4 / 鉄片 +${5 * x.depth}。`]; }
        }
        x.room++; if (x.hp <= 0) return finish(n, true); return n;
      }
      if (!['careful', 'risky'].includes(action)) return s;
      encounter(x, action === 'risky', n.runs); return n;
    } else if (x.stage === 'fight') {
      if (!['strike', 'heavy', 'guard', 'dodge', 'flee'].includes(action)) return s;
      const p = combatProfile(n);
      if ((action === 'heavy' && x.stamina < p.heavyCost) || (action === 'dodge' && x.stamina < p.dodgeCost)) return s;
      x.log = [];
    } else return s;
    const e = x.enemy, next = api.intent(e), p = combatProfile(n);
    if (action === 'flee') {
      const damage = Math.max(2, next.damage);
      x.hp -= damage;
      return finish(n, x.hp <= 0);
    }
    const followUp = x.stagger;
    // A break is an opening for this choice, not a bonus banked for later.
    // Rejected actions return above, so they cannot consume the opening.
    if (!['strike', 'heavy'].includes(action)) {
      x.stagger = false;
      if (followUp) x.log.push('攻める機会を見送った。敵が体勢を立て直す。');
    }
    let damage = 0;
    if (action === 'strike' || action === 'heavy') {
      damage = attackPreview(n, action);
      if (x.sharpened > 0 && !x.sharpenedApplied) { x.sharpened--; x.sharpenedApplied = true; x.log.push('研ぎ澄まされた刃が走る！ 初撃に勢いが乗った（与えるダメージ +3）。'); }
      if (x.grudge && !x.grudge.used && x.grudge.enemy === e.kind) { x.grudge.used = true; n.grudge = null; x.log.push('敗走の執念を一撃に乗せた。与えるダメージ +3。'); }
      if (action === 'heavy' && p.heavyBonus > 4) { x.log.push(`補強の重み！ 強撃の威力が ${p.heavyBonus - 4} 底上げされた。`); }
      if (x.stagger) { x.stagger = false; x.log.push('崩し追撃！ 体勢の崩れへ必殺の一撃を叩き込んだ。'); }
      if (action === 'heavy' && next.id === 'guard' && p.pierce) { x.stagger = true; x.log.push('守りを貫いた。敵の体勢が崩れた！ 次の一撃が必殺追撃になる。'); }
      x.stamina = Math.min(3, x.stamina + (action === 'heavy' ? -p.heavyCost : 1)); x.focus = 0;
    }
    if (action === 'guard') { x.stamina = Math.min(3, x.stamina + 1); if (p.counter && next.damage > 0) damage = p.counter; }
    if (action === 'dodge') {
      x.stamina -= p.dodgeCost;
      x.focus = next.damage > 0 && !['quick', 'feint'].includes(next.id) ? p.dodgeFocus : 0;
    }
    e.hp = Math.max(0, e.hp - damage);
    if (damage > 0) x.log.push(`こちらの一撃。${damage} ダメージ。`);
    if (e.hp <= 0) { victory(n); return n; }
    if (next.id === 'frenzy') e.frenzy = false;
    else if (!e.frenzy && !e.wounded && e.hp * 2 <= e.maxHp) { e.frenzy = true; e.wounded = true; x.log.push('傷ついた敵が、牙を剥く。次の隙は罠かもしれない。'); }
    // A correct read must do more than save HP: it sets up the next decisive blow.
    // Keep this inside existing stagger/save/UI mechanics; no extra command or resource.
    const interrupted = action === 'strike' && (next.id === 'feint' || next.id === 'break');
    const parried = action === 'guard' && next.id === 'quick';
    if (interrupted || parried) {
      x.stagger = true;
      x.log.push(interrupted
        ? `先手で${next.name}を潰した！ 次の一撃が崩し追撃になる。`
        : '薙ぎ払いを受け流した！ 次の一撃が崩し追撃になる。');
    }
    const block = action === 'guard' ? p.block : 0;
    const taken = interrupted ? 0 : action === 'dodge'
      ? (next.id === 'feint' ? next.damage : next.id === 'quick' ? Math.max(1, Math.ceil(next.damage / 2)) : 0)
      : next.id === 'break' && action === 'guard'
        ? Math.max(2, next.damage - Math.floor(block / 2))
        : next.id === 'intercept' && action === 'heavy'
          ? next.damage + 4 : Math.max(0, next.damage - block);
    x.hp -= taken;
    if (action === 'dodge') {
      if (['quick', 'feint'].includes(next.id)) x.log.push(`${next.name}をかわしきれない。体力 −${taken}。追撃の好機は作れない。`);
      else if (next.damage) {
        if (['heavy', 'pounce'].includes(next.id)) { x.stagger = true; x.log.push(`身をかわした。${next.name}の隙を突き、敵の体勢が崩れた！ 次の一撃が必殺追撃になる。`); }
        else x.log.push(`身をかわした。次の攻撃 +${x.focus}。`);
      }
      else x.log.push('攻撃は来ない。回避に気力を使った。');
    } else {
      x.log.push(taken ? `${next.name}。体力 −${taken}。` : next.damage ? '攻撃を受け止めた。体力消費なし。' : '敵は攻撃してこない。');
    }
    e.turn++;
    if (x.hp <= 0) return finish(n, true);
    return n;
  }
  // A fight is an obstacle on the expedition, not a requirement to tap through
  // a dozen predictable counters. Reuse the exact same rules, loot and death.
  // Call api.act (not the closed-over act) so installed gameplay wrappers apply.
  function resolveFight(s) {
    if (s?.expedition?.stage !== 'fight') return s;
    let current = s, turns = 0;
    const startingHp = s.expedition.hp;
    const startingPotions = s.expedition.potions;
    while (current.expedition?.stage === 'fight' && turns < 48) {
      const x = current.expedition, next = api.intent(x.enemy), p = combatProfile(current);
      const strike = attackPreview(current, 'strike');
      let action;
      if (strike >= x.enemy.hp) action = 'strike';
      else if (x.potions > 0 && x.hp <= maxHp(current) - 12 && x.hp > Math.max(0, next.damage)) action = 'heal';
      else if (x.stagger && (next.damage === 0 || x.hp > next.damage + 7)) action = 'strike';
      else if (['heavy', 'pounce', 'frenzy'].includes(next.id)) action = x.stamina >= p.dodgeCost ? 'dodge' : 'guard';
      else if (next.id === 'quick') action = 'guard';
      else if (['feint', 'break', 'intercept'].includes(next.id)) action = 'strike';
      else if (next.id === 'open' || (next.id === 'guard' && p.pierce))
        action = x.stamina >= p.heavyCost ? 'heavy' : 'strike';
      else action = 'strike';
      const after = api.act(current, action);
      if (after === current) break; // Defensive against invalid or intercepted actions.
      current = after;
      turns++;
    }
    if (current === s) return s;
    if (current.expedition) {
      const x = current.expedition;
      const summary = x.stage === 'fight'
        ? '決着はまだつかない。残りは手動で進めるか撤退できる。'
        : `戦闘をまとめて決着（${turns}手）。体力 ${startingHp} → ${x.hp}、薬草 ${startingPotions} → ${x.potions}。`;
      x.log = [summary, ...x.log].slice(0, 10);
    }
    return current;
  }
  function maintain(s) {
    if (s.expedition || s.maintenance !== 'ready') return s;
    const n = copy(s); n.maintenance = 'sharp'; return n;
  }
  function equip(s, id) {
    if (s.expedition || !s.owned.includes(id) || !GEAR[id] || id === 'crown' || GEAR[id].family === 'relic') return s;
    const n = copy(s); n.equipped = id; n.characters[n.activeCharacter].equipped = id; return n;
  }
  function switchCharacter(s, index) {
    if (s.expedition || s.report || !Number.isInteger(index) || index < 0 || index >= s.characters.length || index === s.activeCharacter) return s;
    const n = copy(s);
    n.characters[n.activeCharacter].equipped = n.equipped;
    n.activeCharacter = index;
    n.equipped = n.characters[index].equipped;
    return n;
  }
  // A smith supplies all new equippable gear; item IDs are unique in this small local prototype.
  function craftItem(s, id) {
    const recipe = RECIPES[id];
    if (!recipe || s.expedition || s.report || s.activeCharacter !== 1 || s.owned.includes(id) || s.scrap < recipe.scrap) return s;
    if (Object.entries(recipe.materials).some(([material,count]) => (s.materials?.[material] ?? 0) < count)) return s;
    const n = copy(s);
    for (const [material,count] of Object.entries(recipe.materials)) n.materials[material] -= count;
    n.scrap -= recipe.scrap;
    n.owned.push(id);
    n.qualities[id] = recipe.quality;
    n.characters[1].experience += 1;
    return n;
  }
  function craftWolfFang(s) { return craftItem(s,'forged_fang'); }
  // Repeatable commission: consumes real materials but produces a simulated NPC's gear,
  // never an extra player-owned copy of the unique equipment ID.
  function supplyCommission(s, placeId) {
    const job = COMMISSIONS[placeId];
    if (!job || !s.unlocked.includes(placeId) || s.expedition || s.report || s.activeCharacter !== 1 || s.commission.pending !== null) return s;
    const recipe = RECIPES[job.recipe];
    if (s.scrap < recipe.scrap || Object.entries(recipe.materials).some(([id,q]) => (s.materials[id] ?? 0) < q)) return s;
    const n = copy(s);
    for (const [id,q] of Object.entries(recipe.materials)) n.materials[id] -= q;
    n.scrap -= recipe.scrap;
    n.characters[1].experience++;
    n.commission.pending = placeId;
    return n;
  }
  function upgrade(s, id = s.equipped) {
    const key = upgradeKey(id);
    if (s.expedition || !key || !s.owned.includes(id)) return s;
    const level = weaponLevel(s, id), cost = upgradeCost(s, id);
    if (level >= 4 || s.scrap < cost) return s;
    const n = copy(s); n.scrap -= cost; n.upgrades[key] = level + 1; return n;
  }
  function resolveDuplicate(s, index, choice) {
    if (s.expedition || !s.report || s.report.died || !['keep','dismantle'].includes(choice)) return s;
    const duplicate = s.report.duplicates?.[index];
    if (!duplicate || duplicate.decision || !s.owned.includes(duplicate.id)) return s;
    const n = copy(s), item = n.report.duplicates[index];
    if (choice === 'keep') n.qualities[item.id] = item.quality;
    else n.scrap += DISMANTLE_SCRAP;
    item.decision = choice;
    return n;
  }
  function locationSession(anchor = null) {
    const latitude = Number(anchor?.latitude), longitude = Number(anchor?.longitude), accuracy = Number(anchor?.accuracy);
    const valid = Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180 && Number.isFinite(accuracy) && accuracy >= 0;
    return { anchor: valid ? { latitude, longitude, accuracy } : null };
  }
  function discoverDistrict(s,d) {
    if (s.expedition || s.report) return s;
    const neighborhood = N.discover(s.neighborhood,d);
    if (neighborhood === s.neighborhood) return s;
    return {...s,neighborhood,unlocked:[...new Set([...s.unlocked,d.biome])]};
  }
  function selectDistrict(s,id) {
    if (s.expedition || s.report) return s;
    const neighborhood = N.select(s.neighborhood,id);
    return neighborhood === s.neighborhood ? s : {...s,neighborhood};
  }
  function buildHome(s,id) {
    if (s.expedition || s.report) return s;
    const neighborhood = N.build(s.neighborhood,id);
    return neighborhood === s.neighborhood ? s : {...s,neighborhood};
  }
  function renameHome(s,name) {
    if (s.expedition || s.report) return s;
    const neighborhood = N.rename(s.neighborhood,name);
    return neighborhood === s.neighborhood ? s : {...s,neighborhood};
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
    const district = N.cell(north,east,a.accuracy+fix.accuracy);
    if (!district) return { status:Math.max(Math.abs(north),Math.abs(east)) > N.RANGE*N.CELL_METERS ? 'faraway' : 'boundary' };
    return { status: 'discovered', place: district.biome, district };
  }
  function serialize(s) { return JSON.stringify(s); }
  function parse(raw) {
    if (!raw) return initial();
    try {
      const s = JSON.parse(raw);
      if (s.version === VERSION && s.neighborhood === undefined) s.neighborhood = N.migrate(s);
      if (s.version === VERSION) s.neighborhood = N.hydrateLegacy(s.neighborhood);
      if (!N.valid(s.neighborhood)) throw Error('neighborhood');
      if (s.version === VERSION) s.upgrades = hydrateKnownRecord(s.upgrades, emptyUpgrades);
      if (s.version === VERSION) s.materials = hydrateKnownRecord(s.materials, emptyMaterials);
      if (s.version === VERSION && s.characters === undefined) { s.characters = startingCharacters(); s.characters[0].equipped = s.equipped; }
      if (s.version === VERSION && s.activeCharacter === undefined) s.activeCharacter = 0;
      if (s.version === VERSION && s.commission === undefined) s.commission = emptyCommission();
      if (s.version === VERSION && s.grudge === undefined) s.grudge = null;
      if (s.version === VERSION && s.maintenance === undefined) s.maintenance = null;
      if (s.version === VERSION) s.qualities = hydrateKnownRecord(s.qualities, emptyQualities);
      if (s.version === VERSION && s.expedition) {
        s.expedition.materials = hydrateKnownRecord(s.expedition.materials, emptyMaterials);
        if (Array.isArray(s.expedition.gear) && s.expedition.gearQuality === undefined) s.expedition.gearQuality = s.expedition.gear.map(() => 0);
        if (s.expedition.sharpened === undefined) s.expedition.sharpened = 0;
        if (s.expedition.sharpenedApplied === undefined) s.expedition.sharpenedApplied = false;
        if (s.expedition.grudge === undefined) s.expedition.grudge = null;
        if (s.expedition.stagger === undefined) s.expedition.stagger = false;
      }
      if (s.version === VERSION && s.report) {
        s.report.materials = hydrateKnownRecord(s.report.materials, emptyMaterials);
        if (Array.isArray(s.report.gear) && s.report.gearQuality === undefined) s.report.gearQuality = s.report.gear.map(() => 0);
        if (s.report.duplicates === undefined) s.report.duplicates = [];
        if (s.report.defeatedBy === undefined) s.report.defeatedBy = null;
      }
      const ids = PLACES.map(p => p.id), keys = Object.keys(initial());
      const validArray = (a, allowed) => Array.isArray(a) && a.length <= allowed.length && new Set(a).size === a.length && a.every(v => allowed.includes(v));
      const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
      const validUpgrades = u => u && typeof u === 'object' && !Array.isArray(u) && Object.keys(u).length === UPGRADEABLE.length && UPGRADEABLE.every(id => Object.prototype.hasOwnProperty.call(u,id) && int(u[id],0,4)) && Object.keys(u).every(id => UPGRADEABLE.includes(id));
      const validQualities = q => q && typeof q === 'object' && !Array.isArray(q) && Object.keys(q).length === GEAR_IDS.length && GEAR_IDS.every(id => Object.prototype.hasOwnProperty.call(q,id) && int(q[id],-1,3)) && Object.keys(q).every(id => Object.prototype.hasOwnProperty.call(GEAR,id));
      const validMaterials = m => m && typeof m === 'object' && !Array.isArray(m) && Object.keys(m).length === MATERIAL_IDS.length && MATERIAL_IDS.every(id => int(m[id],0,1e6)) && Object.keys(m).every(id => Object.hasOwn(MATERIALS,id));
      const validCommission = c => c && typeof c === 'object' && !Array.isArray(c)
        && Object.keys(c).length === 4 && Object.keys(c).every(id => ['pending','completed','support','lastResult'].includes(id))
        && (c.pending === null || Object.hasOwn(COMMISSIONS,c.pending))
        && (c.support === null || Object.hasOwn(COMMISSIONS,c.support))
        && (c.lastResult === null || Object.hasOwn(COMMISSIONS,c.lastResult))
        && int(c.completed,0,1e6);
      const validCharacters = (c,active) => Array.isArray(c) && c.length === 3 && int(active,0,2) && c.every((v,i) => v && typeof v === 'object' && Object.keys(v).length === 5 && v.id === ['traveler','smith','merchant'][i] && v.role === ['adventurer','smith','merchant'][i] && typeof v.name === 'string' && v.name.length < 30 && s.owned.includes(v.equipped) && v.equipped !== 'crown' && int(v.experience,0,1e6));
      const validLoot = (gear, quality) => Array.isArray(gear) && gear.length <= 12 && gear.every(id => Object.prototype.hasOwnProperty.call(GEAR,id)) && Array.isArray(quality) && quality.length === gear.length && quality.every(q => int(q,-1,3));
      const validDuplicates = d => Array.isArray(d) && d.length <= 12 && d.every(item => item && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).length === 3 && Object.keys(item).every(k => ['id','quality','decision'].includes(k)) && Object.prototype.hasOwnProperty.call(GEAR,item.id) && item.id !== 'crown' && int(item.quality,-1,3) && [null,'keep','dismantle'].includes(item.decision));
      const validGrudge = g => g === null || (g && typeof g === 'object' && !Array.isArray(g) && Object.keys(g).length === 2 && ids.includes(g.place) && Object.prototype.hasOwnProperty.call(ENEMIES,g.enemy));
      const validExpeditionGrudge = g => g === null || (g && typeof g === 'object' && !Array.isArray(g) && Object.keys(g).length === 3 && ids.includes(g.place) && Object.prototype.hasOwnProperty.call(ENEMIES,g.enemy) && typeof g.used === 'boolean');
      if (s.version !== VERSION || Object.keys(s).some(k => !keys.includes(k)) || ![null, 'demo', 'walk'].includes(s.mode) || !validArray(s.unlocked, ids) || !s.unlocked.includes('wood') || !validArray(s.cleared, ids) || !validArray(s.owned, Object.keys(GEAR)) || !s.owned.includes('rust') || !s.owned.includes(s.equipped) || s.equipped === 'crown' || !int(s.level, 0, 4) || !validUpgrades(s.upgrades) || !validQualities(s.qualities) || !validGrudge(s.grudge) || ![null,'ready','sharp'].includes(s.maintenance) || !int(s.scrap, 0, 1e9) || !validMaterials(s.materials) || !validCharacters(s.characters,s.activeCharacter) || !validCommission(s.commission) || !int(s.runs, 0, 1e9) || !int(s.victories, 0, s.runs)) throw Error('save');
      if (s.expedition) {
        const x = s.expedition;
        const allowedFocus = gearFamily(s.equipped) === 'fang' ? [0,3,4,5,6,7,8,9] : [0,3];
        if (Object.keys(x).some(k => !['place','depth','room','hp','stamina','focus','stagger','sharpened','sharpenedApplied' ,'potions','scrap','materials','gear','gearQuality','seals','grudge','enemy','stage','log'].includes(k)) || !s.unlocked.includes(x.place) || !int(x.depth,1,3) || !int(x.room,0,4) || !int(x.hp,1,maxHp(s)) || !int(x.stamina,0,3) || !allowedFocus.includes(x.focus) || typeof x.stagger !== 'boolean' || !int(x.sharpened,0,3) || typeof x.sharpenedApplied !== 'boolean' || !validExpeditionGrudge(x.grudge) || !int(x.potions,0,3) || !int(x.scrap,0,1000) || !validMaterials(x.materials) || !validLoot(x.gear,x.gearQuality) || !Array.isArray(x.seals) || x.seals.length > 3 || !x.seals.every(v => ids.includes(v)) || !['path','fight','cleared'].includes(x.stage) || !Array.isArray(x.log) || x.log.length > 10 || !x.log.every(v => typeof v === 'string' && v.length < 250)) throw Error('run');
        if (x.stage === 'fight') {
          const e = x.enemy;
          if (!e || Object.keys(e).some(k => !['kind','hp','maxHp','turn','depth','elite','risky','seed','frenzy','wounded'].includes(k)) || !(e.seed === undefined || int(e.seed,0,99990)) || !(e.frenzy === undefined || typeof e.frenzy === 'boolean') || !(e.wounded === undefined || typeof e.wounded === 'boolean') || !ENEMIES[e.kind] || !int(e.maxHp,1,80) || !int(e.hp,1,e.maxHp) || !int(e.turn,0,1e6) || e.depth !== x.depth || typeof e.elite !== 'boolean' || typeof e.risky !== 'boolean') throw Error('enemy');
        } else if (x.enemy !== null) throw Error('enemy');
      }
      if (s.report) {
        const r = s.report;
        if (Object.keys(r).some(k => !['died','place' ,'depth','scrap','materials','gear','gearQuality','newGear','duplicates','hp','cleared','defeatedBy'].includes(k)) || typeof r.died !== 'boolean' || !ids.includes(r.place) || !int(r.depth,1,3) || !int(r.scrap,0,1000) || !validMaterials(r.materials) || !validLoot(r.gear,r.gearQuality) || !validArray(r.newGear,Object.keys(GEAR)) || !validDuplicates(r.duplicates) || !(r.defeatedBy === null || Object.prototype.hasOwnProperty.call(ENEMIES,r.defeatedBy)) || !int(r.hp,-30,80) || !Array.isArray(r.cleared) || r.cleared.length > 3 || !r.cleared.every(v => ids.includes(v))) throw Error('report');
      }
      if (s.neighborhood.active !== null && (!s.expedition || N.get(s.neighborhood,s.neighborhood.active).biome !== s.expedition.place)) throw Error('district');
      if (s.neighborhood.districts.some(d => !s.unlocked.includes(d.biome))) throw Error('district');
      return s;
    } catch { return null; }
  }
  const api = { VERSION, PLACES, GEAR, ENEMIES, INTENTS, VARIANT_LOOT, MATERIALS, RECIPES, COMMISSIONS, DISMANTLE_SCRAP, LOCAL_HERB_COST, initial, maxHp, gearFamily, weaponLevel, weaponQuality, weaponAttack, qualityLabel, rollQuality, upgradeCost, combatProfile, gearText, enemyProfile, attackPreview, intent, lootCue, place, isRoadsideEvent, discover, start, startWithLocalHerb, act, resolveFight, maintain, equip, switchCharacter, craftItem, craftWolfFang, supplyCommission, upgrade, resolveDuplicate, locationSession, observe, serialize, parse, discoverDistrict,selectDistrict,buildHome,renameHome };
  return api;
});
