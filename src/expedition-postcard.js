(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CrownlessExpeditionPostcard = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  function createExpeditionPostcard({ location, journey, loot, event } = {}) {
    const region = location && location.label ? location.label : "名もなき地域";
    const journeyTheme = journey && journey.theme ? journey.theme : "未知の街道";

    return {
      title: "遠征の記録",
      region,
      journeyTheme,
      keepsake: loot || "名もなき欠片",
      memory: event || (journey && journey.encounter) || "静かな旅路",
      message: `${region}での冒険が、一枚の記録になった。`
    };
  }

  return { createExpeditionPostcard };
});
