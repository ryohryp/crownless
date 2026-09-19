(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionRecap = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionRecap() {
  "use strict";

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function recapFromReport(report) {
    const source = report || {};
    const place = clean(source.place) || "名もない土地";
    const died = !!source.died;
    const scrap = Math.max(0, Number(source.scrap) || 0);
    const gear = Array.isArray(source.gear) ? source.gear.map(clean).filter(Boolean) : [];
    const firstGear = gear[0] || "";

    return [
      died ? `${place}で倒れた。それでも、帰る道は覚えている。` : `${place}から生還した。`,
      died
        ? (firstGear ? `${firstGear}を霧の中へ残した。` : `${scrap}鉄片を霧の中へ残した。`)
        : (firstGear ? `${firstGear}を火のもとへ持ち帰った。` : `${scrap}鉄片を持ち帰った。`),
      died ? "次は早めに引くか、装備を変えて挑める。" : "この成果を抱えて、次はもう一段先へ行ける。"
    ];
  }

  return { recapFromReport };
});
