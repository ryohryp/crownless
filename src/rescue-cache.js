/* Rescue Cache: a defeat leaves one bounded recovery incentive at the same game location. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.CrownlessRescueCache = api;
    const engine = root.CrownlessSlice;
    if (engine?.start && !engine.__rescueCachePatched) {
      const originalStart = engine.start;
      engine.start = function startWithRescueCache(state, placeId) {
        const lost = api.cacheFromReport(state?.report, placeId);
        const next = originalStart(state, placeId);
        return next === state ? next : api.applyToExpedition(next, lost);
      };
      engine.__rescueCachePatched = true;
    }
  }
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  function cacheFromReport(report, placeId) {
    if (!report?.died || report.place !== placeId) return null;
    const gear = Array.isArray(report.gear) && report.gear.length ? report.gear[0] : null;
    const scrap = Math.min(8, Math.floor(Math.max(0, Number(report.scrap) || 0) / 2));
    if (!gear && scrap === 0) return null;
    return { gear, scrap };
  }

  function applyToExpedition(state, cache) {
    if (!cache || !state?.expedition) return state;
    const next = JSON.parse(JSON.stringify(state));
    const x = next.expedition;
    if (cache.gear && !x.gear.includes(cache.gear)) x.gear.push(cache.gear);
    x.scrap += cache.scrap;
    const parts = [];
    if (cache.gear) parts.push('失った武具を1つ');
    if (cache.scrap) parts.push(`鉄片 ${cache.scrap}`);
    x.log = [`前回の敗走跡を見つけた。${parts.join('と')}を背嚢へ戻した。生還するまで確定しない。`];
    return next;
  }

  return { cacheFromReport, applyToExpedition };
});
