"use strict";

const REGION_GEAR = Object.freeze({
  "wind-cut-highland": Object.freeze({
    region: "風切りの高地",
    cue: "風に磨かれた細身の武具が目につく。",
    favored: Object.freeze(["bow", "dagger"]),
    character: "軽快・遠間"
  }),
  "ashen-marsh": Object.freeze({
    region: "灰の湿地",
    cue: "泥と湿気に耐える重い金具が残されている。",
    favored: Object.freeze(["shield", "dagger"]),
    character: "堅牢・近接"
  }),
  "red-cliff-road": Object.freeze({
    region: "赤崖の街道",
    cue: "旅人と護衛が残した実用的な武具の気配がある。",
    favored: Object.freeze(["dagger", "shield"]),
    character: "実用・護衛"
  })
});

function regionalGearCharacter(horizonId, availableGear = []) {
  const profile = REGION_GEAR[horizonId];
  if (!profile) return null;

  const gear = availableGear.filter((item) => item && item.id);
  const favored = gear.filter((item) => profile.favored.includes(item.type));
  const other = gear.filter((item) => !profile.favored.includes(item.type));

  return {
    horizonId,
    region: profile.region,
    cue: profile.cue,
    character: profile.character,
    // This is a tendency, not a guaranteed drop: favored candidates are surfaced first.
    candidates: [...favored, ...other],
    favoredTypes: [...profile.favored]
  };
}

module.exports = { REGION_GEAR, regionalGearCharacter };
