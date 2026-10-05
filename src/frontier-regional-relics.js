(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof root === 'object') root.CrownlessRegionalRelics = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  /**
   * Geographic landmark categories mapped to evocative medieval-fantasy relics.
   */
  const RELIC_CATALOG = Object.freeze([
    // --- 神社・寺院・祠 (sacred) ---
    {
      id: 'relic_sacred_exorcist_dagger',
      signal: 'sacred',
      name: '破魔の短剣',
      type: 'dagger',
      quality: 'divine',
      icon: '⛩️',
      statBonus: { attack: 7, evasion: 4 },
      trait: '破魔の光: 霊異や魔物への追撃威力が+8される。',
      flavor: '古社で代々清められ、悪意を払う刃。刃先に微かな朱塗りの銘が残る。',
    },
    {
      id: 'relic_sacred_oak_talisman',
      signal: 'sacred',
      name: '御神木の護符',
      type: 'talisman',
      quality: 'sacred',
      icon: '📿',
      statBonus: { hp: 12, defense: 3 },
      trait: '加護の祈り: 体力が25%以下になった際、一度だけ痛打を防ぐ。',
      flavor: '数百年の風雪に耐えた境内の神木から彫り出された霊符。',
    },

    // --- 水辺・川・橋・港 (water / crossing) ---
    {
      id: 'relic_water_mist_rapier',
      signal: 'water',
      name: '霧裂きの刺剣',
      type: 'dagger',
      quality: 'flowing',
      icon: '🌊',
      statBonus: { attack: 6, evasion: 6 },
      trait: '清流の呼吸: 敵の攻撃を回避した直後、次の行動速度が上がる。',
      flavor: '川霧の立つ渡し場で鍛えられた細身剣。水滴を弾く波紋が刻まれている。',
    },
    {
      id: 'relic_water_scale_shield',
      signal: 'water',
      name: '水妖の鱗盾',
      type: 'shield',
      quality: 'flowing',
      icon: '🛡️',
      statBonus: { defense: 8, hp: 8 },
      trait: '波紋受け: 防御時、受けた衝撃の半分を反撃波として跳ね返す。',
      flavor: '大河の深みに棲む水獣の硬鱗を重ね張りした頑強な円盾。',
    },

    // --- 駅・宿場・主要交差点 (road_hub) ---
    {
      id: 'relic_road_courier_mail',
      signal: 'road_hub',
      name: '駅馬の守護甲冑',
      type: 'armor',
      quality: 'iron',
      icon: '🐎',
      statBonus: { defense: 7, hp: 15 },
      trait: '強行軍: 探索中の消耗を抑え、帰還時の鉄片確保量が+20%増加する。',
      flavor: '街道の飛脚や伝令が身につけた実戦的な鎖帷子。長旅に耐える補強が施されている。',
    },
    {
      id: 'relic_road_twin_daggers',
      signal: 'road_hub',
      name: '旅商の連撃短剣',
      type: 'dagger',
      quality: 'keen',
      icon: '⚔️',
      statBonus: { attack: 8, evasion: 3 },
      trait: '連撃商法: 急所命中に成功した時、鉄片を余分に掠め取る。',
      flavor: '関所の検問をすり抜け、街道の野盗を返り討ちにしてきた商人の護身武器。',
    },

    // --- 森・自然公園・樹林 (woods) ---
    {
      id: 'relic_woods_canopy_bow',
      signal: 'woods',
      name: '剛弓・梢打ち',
      type: 'bow',
      quality: 'verdant',
      icon: '🏹',
      statBonus: { attack: 9, critical: 5 },
      trait: '木隠れの射撃: 敵が構えを取る前に先制の一矢を射込み、出鼻を挫く。',
      flavor: '鬱蒼とした森の梢から標的を射抜くための大弓。しなやかな銘木で作られている。',
    },
    {
      id: 'relic_woods_herbal_cloak',
      signal: 'woods',
      name: '薬草師の厚外套',
      type: 'armor',
      quality: 'verdant',
      icon: '🌿',
      statBonus: { defense: 5, hp: 10 },
      trait: '自生薬草: 探索深度が進むごとに体力が微量に自然回復する。',
      flavor: '森の薬草採取人が羽織る外套。独特の香草の香りが傷を癒やす。',
    },

    // --- 展望・高台・塔・山頂 (height) ---
    {
      id: 'relic_height_gale_greatsword',
      signal: 'height',
      name: '風切りの大剣',
      type: 'dagger', // fits weapon slot
      quality: 'sky',
      icon: '🌪️',
      statBonus: { attack: 11, critical: 8 },
      trait: '高峰の突風: 強打命中時、敵の体勢を大きく崩し反撃を封じる。',
      flavor: '吹き荒れる風を裂くように鍛えられた剛剣。高い峰を見上げた者のみが手にする。',
    },
    {
      id: 'relic_height_eagle_monocle',
      signal: 'height',
      name: '天涯の見張り鏡',
      type: 'talisman',
      quality: 'sky',
      icon: '🦅',
      statBonus: { critical: 10, evasion: 5 },
      trait: '鷹の千里眼: 敵の危険な予兆を事前に完全看破する。',
      flavor: '物見塔の監視兵が愛用した望遠レンズを組み込んだ特殊な単眼鏡。',
    },

    // --- 史跡・城跡・古戦場 (historic) ---
    {
      id: 'relic_historic_warlord_spear',
      signal: 'historic',
      name: '名将の残槍',
      type: 'dagger', // slot
      quality: 'ancient',
      icon: '🏯',
      statBonus: { attack: 12, defense: 4 },
      trait: '陣頭指揮: 拠点の防衛戦において全能力が1.3倍に跳ね上がる。',
      flavor: '往年の合戦で城門を守り抜いた名将が振るったとされる歴戦の槍。',
    },
    {
      id: 'relic_historic_crest_shield',
      signal: 'historic',
      name: '鎮守の家紋大盾',
      type: 'shield',
      quality: 'ancient',
      icon: '🛡️',
      statBonus: { defense: 10, hp: 14 },
      trait: '不落の構え: 致命的な大ダメージを受けた時、体力を1残して耐える。',
      flavor: '落城の悲運を生き延びた家臣が背負い続けた、格式高い紋章が彫られた大盾。',
    },
  ]);

  /**
   * Resolves appropriate relic candidates for a given landmark signal.
   */
  function getRelicsForSignal(signal) {
    const matched = RELIC_CATALOG.filter(item => item.signal === signal);
    return matched.length > 0 ? matched : RELIC_CATALOG;
  }

  /**
   * Creates a persistent instance of a regional relic stamped with real place and date.
   */
  function createRegionalRelicInstance(relicId, landmarkName, coords = null) {
    const template = RELIC_CATALOG.find(item => item.id === relicId) || RELIC_CATALOG[0];
    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

    return {
      instanceId: `inst_${relicId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      relicId: template.id,
      name: template.name,
      type: template.type,
      signal: template.signal,
      quality: template.quality,
      icon: template.icon,
      statBonus: { ...template.statBonus },
      trait: template.trait,
      flavor: template.flavor,
      originPlace: String(landmarkName || '未知の開拓地'),
      discoveredDate: dateStr,
      coordinates: coords ? { lat: Number(coords.lat || coords.latitude || 0), lng: Number(coords.lng || coords.longitude || 0) } : null,
    };
  }

  /**
   * Roll a regional drop based on discovery signal and landmark.
   */
  function rollLandmarkRelic(signal, landmarkName, coords = null, roll = Math.random()) {
    const candidates = getRelicsForSignal(signal);
    const index = Math.floor(roll * candidates.length) % candidates.length;
    return createRegionalRelicInstance(candidates[index].id, landmarkName, coords);
  }

  /**
   * Format display label with origin place.
   */
  function formatRelicDisplay(relic) {
    if (!relic) return '';
    const origin = relic.originPlace ? `【${relic.originPlace}】` : '';
    return `${relic.icon || '⚔️'} ${relic.name} ${origin}`;
  }

  return {
    RELIC_CATALOG,
    getRelicsForSignal,
    createRegionalRelicInstance,
    rollLandmarkRelic,
    formatRelicDisplay,
  };
});
