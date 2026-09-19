(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExplorationVariety = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MOODS = {
    wood: [
      { label: "静かな森", text: "鳥の声が消えている。敵の気配は薄いが、奥で枝が一度だけ鳴った。", cue: "慎重に進む" },
      { label: "獣のざわめき", text: "獣が同じ方角を避けている。強い何かが先にいる気配がする。", cue: "強敵の気配" },
      { label: "残り火", text: "消えかけた焚き火に新しい灰。誰かが武具を置いていった跡がある。", cue: "武具の気配" }
    ],
    tower: [
      { label: "鳴らない鐘", text: "風があるのに鐘だけが動かない。足元には新しい擦り傷が続く。", cue: "仕掛けの気配" },
      { label: "黒い鳥", text: "塔の上を黒い鳥が旋回している。いつもより高い場所に何か光る。", cue: "高所に戦利品" },
      { label: "崩れた足場", text: "石段がさらに崩れている。近道は危険だが、奥が少し見えている。", cue: "危険な近道" }
    ]
  };

  function moodFor(placeId, visitIndex) {
    const moods = MOODS[String(placeId)] || [];
    if (!moods.length) return null;
    const index = Math.abs(Number(visitIndex) || 0) % moods.length;
    return Object.assign({}, moods[index]);
  }

  return { MOODS, moodFor };
});