(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof root === 'object') root.CrownlessFrontierOutpost = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const FACILITY_NAMES = Object.freeze({
    watchtower: '見張り塔',
    forge: '開拓鍛冶場',
    hearth: '旅籠の焚き火',
  });

  const FACILITY_COSTS = Object.freeze({
    watchtower: [0, 8, 16, 28],
    forge: [0, 10, 20, 35],
    hearth: [0, 6, 12, 22],
  });

  const FACILITY_EFFECTS = Object.freeze({
    watchtower: '拠点の防衛度を高め、敵やライバルによる奪還を防ぎやすくする。',
    forge: 'この地で手に入れたご当地武具の威力を底上げする。',
    hearth: '遠征・散策時の回復を助け、定期的に特産素材をもたらす。',
  });

  function createInitialState() {
    return {
      version: 1,
      outposts: {},
    };
  }

  function getOutpost(state, id) {
    if (!state || !state.outposts) return null;
    return state.outposts[id] || null;
  }

  /**
   * Conquers / claims a landmark and establishes a Level 1 Frontier Outpost.
   */
  function claimOutpost(state, id, title = '未開の拠点', signal = 'road_hub') {
    const s = state && state.outposts ? { ...state, outposts: { ...state.outposts } } : createInitialState();
    const existing = s.outposts[id];

    const isRetake = existing && existing.owner === 'rival';
    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

    const outpost = {
      id,
      title,
      signal,
      owner: 'player',
      level: existing ? Math.max(1, existing.level) : 1,
      facilities: existing ? { ...existing.facilities } : { watchtower: 0, forge: 0, hearth: 0 },
      establishedDate: existing ? existing.establishedDate : dateStr,
      lastClaimDate: dateStr,
      history: existing && Array.isArray(existing.history) ? [...existing.history] : [],
      defenseRating: 20,
    };

    const actionText = isRetake
      ? `${title}を奪還し、開拓旗を掲げ直した。`
      : `${title}を開拓拠点として設営した。`;

    outpost.history.push({ date: dateStr, text: actionText });
    outpost.history = outpost.history.slice(-8);

    // recalculate defense rating
    outpost.defenseRating = 20 + (outpost.facilities.watchtower || 0) * 25;

    s.outposts[id] = outpost;
    return s;
  }

  /**
   * Upgrades a facility in an outpost using iron scrap.
   */
  function buildFacility(state, id, facilityType, currentScrap = 0) {
    const s = state && state.outposts ? { ...state, outposts: { ...state.outposts } } : createInitialState();
    const outpost = s.outposts[id];
    if (!outpost || outpost.owner !== 'player') {
      return { state: s, success: false, reason: '拠点が存在しないか、支配下ではありません。', scrapSpent: 0 };
    }

    if (!FACILITY_NAMES[facilityType]) {
      return { state: s, success: false, reason: '無効な施設種別です。', scrapSpent: 0 };
    }

    const currentLvl = Number(outpost.facilities[facilityType] || 0);
    if (currentLvl >= 3) {
      return { state: s, success: false, reason: 'すでに最大レベルまで増築されています。', scrapSpent: 0 };
    }

    const nextLvl = currentLvl + 1;
    const requiredScrap = FACILITY_COSTS[facilityType][nextLvl] || 999;

    if (currentScrap < requiredScrap) {
      return {
        state: s,
        success: false,
        reason: `鉄片が不足しています（必要: ${requiredScrap}、所持: ${currentScrap}）。`,
        scrapSpent: 0,
      };
    }

    const updatedFacilities = {
      ...outpost.facilities,
      [facilityType]: nextLvl,
    };

    // Calculate total level
    const totalFacilities = Object.values(updatedFacilities).reduce((a, b) => a + b, 0);
    const newOutpostLevel = 1 + Math.floor(totalFacilities / 2);

    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
    const facilityName = FACILITY_NAMES[facilityType];

    const updatedOutpost = {
      ...outpost,
      level: newOutpostLevel,
      facilities: updatedFacilities,
      defenseRating: 20 + (updatedFacilities.watchtower || 0) * 25,
      history: [
        ...outpost.history,
        { date: dateStr, text: `${facilityName} を Lv${nextLvl} に増築した。` },
      ].slice(-8),
    };

    s.outposts[id] = updatedOutpost;

    return {
      state: s,
      success: true,
      scrapSpent: requiredScrap,
      outpost: updatedOutpost,
      message: `${outpost.title} の ${facilityName} を Lv${nextLvl} に増築しました！`,
    };
  }

  /**
   * Simulates a rival attempt against the outpost.
   * High watchtower defense rating can repel rival attacks!
   */
  function simulateRivalAttack(state, id, rivalName = '灰鴉', roll = Math.random()) {
    const s = state && state.outposts ? { ...state, outposts: { ...state.outposts } } : createInitialState();
    const outpost = s.outposts[id];
    if (!outpost || outpost.owner !== 'player') return s;

    // Defense calculation: 20 defense = 20% repel, 70 defense = 70% repel
    const repelChance = Math.min(0.85, outpost.defenseRating / 100);
    const isRepelled = roll < repelChance;

    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

    if (isRepelled) {
      // Repelled by watchtower defense!
      const updated = {
        ...outpost,
        history: [
          ...outpost.history,
          { date: dateStr, text: `見張り塔の防衛網が機能し、${rivalName}の襲撃を撃退した！` },
        ].slice(-8),
      };
      s.outposts[id] = updated;
    } else {
      // Outpost captured by rival
      const updated = {
        ...outpost,
        owner: 'rival',
        history: [
          ...outpost.history,
          { date: dateStr, text: `${rivalName}の急襲を受け、拠点を一時奪われた。` },
        ].slice(-8),
      };
      s.outposts[id] = updated;
    }

    return s;
  }

  return {
    FACILITY_NAMES,
    FACILITY_COSTS,
    FACILITY_EFFECTS,
    createInitialState,
    getOutpost,
    claimOutpost,
    buildFacility,
    simulateRivalAttack,
  };
});
