"use strict";

function resolveWeekendJourney(location) {
  if (!location || !location.regionKey) {
    return {
      state: "unknown",
      title: "旅の気配",
      message: "土地の気配をまだ読めない。"
    };
  }

  const faraway = location.id === "faraway" || location.label === "遠くの地域";

  if (!faraway) {
    return {
      state: "familiar",
      title: "いつもの遠征",
      theme: "近郊の街道",
      encounter: "見慣れた獣道の痕跡",
      message: "知っている土地から、今日の遠征を始める。"
    };
  }

  return {
    state: "journey",
    title: "遠い土地の遠征",
    theme: "灰風の境界地",
    encounter: "旅人の焚き火跡",
    message: `${location.label || "遠い土地"}では、同じ遠征でも景色と気配が少し違う。`,
    rewardMultiplier: 1
  };
}

module.exports = { resolveWeekendJourney };
