"use strict";

function resolveTwoPlaceMystery(journey = []) {
  const regions = [...new Set(journey.map((entry) => entry && entry.regionKey).filter(Boolean))];
  const first = journey[0];

  if (!first) {
    return { state: "undiscovered", title: "封じられた碑文", message: "まだ手掛かりは見つかっていない。" };
  }

  if (regions.length < 2) {
    return {
      state: "fragment",
      title: "欠けた碑文",
      clue: "『灰の鐘は――』",
      message: `${first.label || "この土地"}で半分だけ読める碑文を見つけた。別の土地なら続きを読めるかもしれない。`
    };
  }

  const second = journey.find((entry) => entry && entry.regionKey !== first.regionKey);
  return {
    state: "solved",
    title: "灰の鐘の碑文",
    clue: "『灰の鐘は、帰る者のために鳴る』",
    discovery: "灰鐘の道標",
    message: `${first.label || "最初の土地"}の断片が${second.label || "別の土地"}の断片とつながった。新しい道標を発見した。`
  };
}

module.exports = { resolveTwoPlaceMystery };
