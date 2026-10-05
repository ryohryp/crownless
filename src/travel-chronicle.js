(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof root === 'object') root.CrownlessTravelChronicle = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const SIGNAL_SEALS = Object.freeze({
    sacred: { icon: '⛩️', sealName: '天満の神印', badge: '神域' },
    water: { icon: '🌊', sealName: '水妖の波紋印', badge: '水系' },
    road_hub: { icon: '🐎', sealName: '宿場関所の鉄印', badge: '街道' },
    woods: { icon: '🌲', sealName: '深緑の木霊印', badge: '原生' },
    height: { icon: '🌪️', sealName: '天涯の風輪印', badge: '高嶺' },
    historic: { icon: '🏯', sealName: '古城の武威印', badge: '史跡' },
  });

  function createInitialChronicle() {
    return {
      version: 1,
      stamps: [],
      cards: [],
      collectedRelics: [],
    };
  }

  function parseChronicle(raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 1 && Array.isArray(parsed.stamps)) {
        return parsed;
      }
    } catch (_) {}
    return createInitialChronicle();
  }

  function todayString() {
    const now = new Date();
    return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  }

  /**
   * Records a landmark visit and stamps the passport.
   */
  function recordVisitAndStamp(chronicle, landmarkName, signal = 'road_hub', coords = null) {
    const s = chronicle ? { ...chronicle, stamps: [...(chronicle.stamps || [])] } : createInitialChronicle();
    const name = String(landmarkName || '未知の地');
    const existing = s.stamps.find(stamp => stamp.landmarkName === name);

    const sealInfo = SIGNAL_SEALS[signal] || SIGNAL_SEALS.road_hub;
    const dateStr = todayString();

    if (!existing) {
      const newStamp = {
        id: `stamp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        landmarkName: name,
        signal,
        sealName: sealInfo.sealName,
        icon: sealInfo.icon,
        badge: sealInfo.badge,
        date: dateStr,
        visitCount: 1,
        coordinates: coords ? { lat: coords.lat, lng: coords.lng } : null,
      };
      s.stamps.push(newStamp);
    } else {
      existing.visitCount = (existing.visitCount || 1) + 1;
      existing.lastVisitDate = dateStr;
    }

    return s;
  }

  /**
   * Adds an expedition memory card to the chronicle album.
   */
  function recordExpeditionCard(chronicle, { landmarkName, signal = 'road_hub', summary, relicName = null, facilityBuilt = null }) {
    const s = chronicle ? { ...chronicle, cards: [...(chronicle.cards || [])] } : createInitialChronicle();
    const dateStr = todayString();
    const sealInfo = SIGNAL_SEALS[signal] || SIGNAL_SEALS.road_hub;

    const card = {
      id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: dateStr,
      landmarkName: String(landmarkName || '遠征先'),
      signal,
      icon: sealInfo.icon,
      summary: String(summary || '土地の探索を完了した。'),
      relicName: relicName || null,
      facilityBuilt: facilityBuilt || null,
    };

    s.cards = [card, ...s.cards].slice(0, 30); // keep recent 30
    return s;
  }

  /**
   * Registers a collected regional relic in the passport codex.
   */
  function recordCollectedRelic(chronicle, relicInstance) {
    if (!relicInstance || !relicInstance.name) return chronicle;
    const s = chronicle ? { ...chronicle, collectedRelics: [...(chronicle.collectedRelics || [])] } : createInitialChronicle();

    const exists = s.collectedRelics.some(r => r.relicId === relicInstance.relicId && r.originPlace === relicInstance.originPlace);
    if (!exists) {
      s.collectedRelics.push({
        relicId: relicInstance.relicId,
        name: relicInstance.name,
        type: relicInstance.type,
        signal: relicInstance.signal,
        icon: relicInstance.icon || '⚔️',
        originPlace: relicInstance.originPlace,
        trait: relicInstance.trait,
        discoveredDate: relicInstance.discoveredDate || todayString(),
      });
    }

    return s;
  }

  /**
   * Summary metrics for the travel chronicle.
   */
  function getChronicleStats(chronicle) {
    const stamps = (chronicle && chronicle.stamps) || [];
    const relics = (chronicle && chronicle.collectedRelics) || [];
    const cards = (chronicle && chronicle.cards) || [];

    const signalsCount = {};
    for (const st of stamps) {
      signalsCount[st.signal] = (signalsCount[st.signal] || 0) + 1;
    }

    return {
      totalStamps: stamps.length,
      totalRelics: relics.length,
      totalCards: cards.length,
      signalsCount,
    };
  }

  return {
    SIGNAL_SEALS,
    createInitialChronicle,
    parseChronicle,
    recordVisitAndStamp,
    recordExpeditionCard,
    recordCollectedRelic,
    getChronicleStats,
  };
});
