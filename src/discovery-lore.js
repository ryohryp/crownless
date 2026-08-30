(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessDiscoveryLore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createDiscoveryLore() {
  "use strict";

  const TERRAIN_ALIASES = Object.freeze({
    water: "water",
    river: "water",
    canal: "water",
    wetland: "water",
    crossing: "crossing",
    bridge: "crossing",
    ford: "crossing",
    woods: "woods",
    wood: "woods",
    forest: "woods",
    grove: "woods",
    park: "woods",
    sacred: "sacred",
    shrine: "sacred",
    temple: "sacred",
    church: "sacred",
    cemetery: "sacred",
    height: "height",
    hill: "height",
    lookout: "height",
    tower: "height",
    settlement: "settlement",
    village: "settlement",
    residential: "settlement",
    urban: "settlement",
    road_hub: "road_hub",
    road: "road_hub",
    junction: "road_hub",
    crossroads: "road_hub"
  });

  const CONTENT_KINDS = new Set(["dungeon", "encounter", "event"]);

  const TERRAIN_LORE = Object.freeze({
    water: {
      discoveries: [
        "水気を含んだ風の向こうに、まだ地図へ書かれていない気配が残っている。",
        "水辺の音だけが妙に近く、足跡の消える場所がひとつ見つかった。",
        "湿った土と古い流れのそばに、誰かが立ち止まった痕跡がある。"
      ],
      rumors: [
        "水面が静かな日ほど、岸ではない方から小さな呼び声がするという。",
        "流れの近くでは、拾った物を数え直す者がいるらしい。",
        "夜明け前だけ、水際に古い灯りがひとつ浮くと噂されている。"
      ],
      threats: ["水難", "足場の悪さ", "人ならぬ気配"],
      rewards: ["古銭", "水除けの札", "流木の薬材"],
      notes: ["足場を確かめられる者を同行させたい。", "雨の後は避けた方がよい。", "灯りより縄を優先した方がよさそうだ。"]
    },
    crossing: {
      discoveries: [
        "向こう岸へ続くはずの道に、渡る者を選ぶような間がある。",
        "人の往来が重なる場所なのに、ひと区画だけ妙に静かだ。",
        "道と道の継ぎ目に、古い通行の名残がこびりついている。"
      ],
      rumors: [
        "渡る前に名を呼ばれても、返事をしてはいけないという。",
        "通り過ぎた者の袋から、同じ形の古銭が見つかることがあるらしい。",
        "誰も番をしていないのに、渡り賃を置く者がいる。"
      ],
      threats: ["待ち伏せ", "足止め", "亡霊"],
      rewards: ["古銭", "旅人の護符", "渡し守の印"],
      notes: ["退路を先に決めてから渡るべきだ。", "荷を軽くして向かいたい。", "単独より二人以上の方がよい。"]
    },
    woods: {
      discoveries: [
        "枝葉の重なる奥で、風とは違う揺れ方をする影が見えた。",
        "人の声が届きにくい緑の陰に、細い踏み跡が残っている。",
        "木立の境で鳥の声が途切れ、奥へ続く気配だけが残った。"
      ],
      rumors: [
        "同じ木を三度見たら、その日は引き返した方がよいという。",
        "木立の奥では、薬草を摘む音だけして姿が見えないことがあるらしい。",
        "夕暮れになると、帰り道だけ一本多くなると噂されている。"
      ],
      threats: ["迷い", "獣", "弱い呪い"],
      rewards: ["薬草", "獣皮", "小護符"],
      notes: ["目印を残せる者が必要だ。", "日暮れ前に引き上げたい。", "火を嫌うものがいるかもしれない。"]
    },
    sacred: {
      discoveries: [
        "古い祈りの名残だけが、周囲の雑音から切り離されている。",
        "誰も手入れしていないはずの場所に、供え物の跡が新しい。",
        "崩れた印のそばで、空気だけが少し冷えている。"
      ],
      rumors: [
        "願いを口にすると、代わりに何か一つ忘れるという。",
        "古い祈りを踏みにじった者は、帰り道で同じ声を聞くらしい。",
        "小さな護符を置くと、翌朝には別の形になっていることがある。"
      ],
      threats: ["弱い呪い", "禁忌", "静かな亡霊"],
      rewards: ["小護符", "祈りの欠片", "清め塩"],
      notes: ["不用意に触れず、まず周囲を調べたい。", "大声を出さない方がよさそうだ。", "持ち帰る物を選ぶ必要がある。"]
    },
    height: {
      discoveries: [
        "風の通る高みから、周囲を見張るための古い場所が見つかった。",
        "見晴らしのよい場所に、長く人が立っていたような痕跡がある。",
        "高所へ続く道の先で、風に混じって金属の鳴る音がした。"
      ],
      rumors: [
        "風の強い日には、誰もいない見張りが火を探しているという。",
        "高みから三度手を振る影を見ても、振り返してはいけないらしい。",
        "晴れた夜だけ、古い見張り火が一瞬戻ると噂されている。"
      ],
      threats: ["高所", "野盗", "崩落"],
      rewards: ["錆びた武具", "見張りの印", "遠見の欠片"],
      notes: ["足場と風を見てから登るべきだ。", "盾より身軽さを優先したい。", "崩れた階段に注意したい。"]
    },
    settlement: {
      discoveries: [
        "人の暮らしが近いのに、使われなくなった一角だけが地図から浮いて見える。",
        "往来のそばに、誰も足を止めない古い目印が残っている。",
        "生活の気配に紛れて、用途の分からない古い印が見つかった。"
      ],
      rumors: [
        "日が落ちると、閉じた戸口から旅人を呼ぶ声がするという。",
        "古い目印の下には、持ち主の戻らない小箱があるらしい。",
        "人通りが途切れる一刻だけ、見慣れない露店が出ると噂されている。"
      ],
      threats: ["盗人", "偽商人", "人混みの死角"],
      rewards: ["古い鍵", "交易札", "小さな工具"],
      notes: ["目立たず短時間で調べたい。", "荷物の管理を厳重にした方がよい。", "人の少ない時間帯を選ぶべきだ。"]
    },
    road_hub: {
      discoveries: [
        "複数の道が重なる場所に、今は使われていない進路の印が残っている。",
        "行き先の多い場所ほど、ひとつだけ誰も選ばない道が目につく。",
        "道の分岐に、削られた古い道標の跡がある。"
      ],
      rumors: [
        "迷った旅人だけが見つける道標があるという。",
        "道を一本間違えると、戻るまでに荷物が一つ増えていることがあるらしい。",
        "真夜中には、消えた隊商の鈴が別の道から聞こえると噂されている。"
      ],
      threats: ["追いはぎ", "迷い道", "不審な隊商"],
      rewards: ["旅券の切れ端", "交易品", "古い道標片"],
      notes: ["帰路の印を先に確認したい。", "荷を増やしすぎない方がよい。", "複数の退路を確保しておきたい。"]
    }
  });

  const CONTENT_LORE = Object.freeze({
    dungeon: {
      rumors: [
        "入口らしき場所はあるが、中から戻った者の話が一致しない。",
        "奥には手つかずの物が残る一方、崩れた場所も多いらしい。",
        "外から見るより深く、途中から古い造りに変わるという。"
      ],
      threats: ["閉所", "崩落", "潜む者"],
      rewards: ["古い装具", "封じられた箱", "刻印片"],
      notes: ["長居せず、戻れる地点を刻みながら進みたい。", "灯りと退路の確保を優先する。", "入口の安全を確かめてから奥へ進むべきだ。"]
    },
    encounter: {
      rumors: [
        "そこでは何かと鉢合わせることが多い、と生還者は口をそろえる。",
        "待つ者がいるのか、通る者を見ている気配が消えないらしい。",
        "短い道のはずなのに、武器を抜いた跡だけが残っているという。"
      ],
      threats: ["奇襲", "敵対者", "逃げ道の不足"],
      rewards: ["落とし物", "戦利品", "手掛かり"],
      notes: ["先手より退路を優先したい。", "疲れた隊は近づかない方がよい。", "短時間で決着できる編成が向く。"]
    },
    event: {
      rumors: [
        "決まった時刻ではなく、条件が揃った時だけ何かが起きるらしい。",
        "通り過ぎるだけなら何もないが、立ち止まると変化があるという。",
        "同じ場所でも、訪れるたびに残っている物が違うと噂されている。"
      ],
      threats: ["予兆不明", "選択の代償", "時間切れ"],
      rewards: ["珍しい手掛かり", "一時的な加護", "交換品"],
      notes: ["余裕のある時に調べたい。", "持ち物に空きを作っておきたい。", "異変が薄ければ深追いしない。"]
    }
  });

  const COMBINATIONS = Object.freeze([
    {
      terrain: ["water", "crossing"],
      contentKind: "encounter",
      discoveries: [
        "水と道が交わる場所で、渡る者を待つような古い気配を見つけた。",
        "流れを越える境目に、足跡だけが不自然に途切れている。"
      ],
      rumors: [
        "渡し賃を払わぬ者を呼び止める声が、水面に混ざるという。",
        "濡れていない古銭を一枚置けば、帰りは静かになるらしい。"
      ],
      threats: ["亡霊", "水難", "足止め"],
      rewards: ["古銭", "川守の印", "旅人の護符"],
      notes: ["夜は避け、退路を確かめてから渡るべきだ。", "雨の後は近づかない方がよい。"]
    },
    {
      terrain: ["woods", "sacred"],
      discoveries: [
        "木立の奥で人の声が途切れ、古い祈りの気配だけが残る場所を見つけた。",
        "枝葉に隠れた古い印の周囲だけ、踏み跡が避けるように曲がっている。"
      ],
      rumors: [
        "人の声が途切れる場所だけ、古い祈りの気配が残っているという。",
        "小さな供え物を動かすと、帰り道の木が一本増えるらしい。"
      ],
      threats: ["迷い", "弱い呪い", "禁忌"],
      rewards: ["薬草", "小護符", "祈りの欠片"],
      notes: ["日暮れ前に調べ、供え物には触れない方がよい。", "道標を残せる者を同行させたい。"]
    },
    {
      terrain: ["height"],
      contentKind: "dungeon",
      discoveries: [
        "高みの崩れた構造物に、まだ奥へ続く暗がりが残っている。",
        "見晴らしのよい廃所で、内部へ降りる古い足場が見つかった。"
      ],
      rumors: [
        "風の強い日には、誰もいない見張りが火を探しているという。",
        "最上部ではなく、その下の暗がりに古い武具が残るらしい。"
      ],
      threats: ["野盗", "高所", "崩落"],
      rewards: ["錆びた武具", "見張りの印", "遠見の欠片"],
      notes: ["風の弱い日に、身軽な隊で入るべきだ。", "登りより下りの退路を先に確かめたい。"]
    }
  ]);

  const FALLBACK = Object.freeze({
    discoveries: [
      "地図にはなかった小さな違和感が、遠征候補として探索録に残った。",
      "見過ごせそうな場所に、Crownlessの世界へ続く気配がひとつ残っている。",
      "ありふれた景色の隙間に、まだ調べていない痕跡を見つけた。"
    ],
    rumors: [
      "近づいた者によって、見えるものが少し違うという。",
      "何もないと言う者ほど、帰りに小さな手掛かりを持っているらしい。",
      "一度で全ては分からず、調べるほど別の顔を見せると噂されている。"
    ],
    threats: ["未知の気配", "足場不明"],
    rewards: ["手掛かり", "古い小物"],
    notes: ["無理に深追いせず、まず周囲を確かめたい。", "余力を残した隊で向かうべきだ。"]
  });

  function cleanText(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function normalizeTerrain(value) {
    const source = Array.isArray(value) ? value : value == null ? [] : [value];
    const normalized = source.map((item) => TERRAIN_ALIASES[cleanText(item).toLowerCase()] || cleanText(item).toLowerCase()).filter(Boolean);
    return [...new Set(normalized)].sort();
  }

  function normalizeContentKind(value) {
    const kind = cleanText(value, "unknown").toLowerCase();
    return CONTENT_KINDS.has(kind) ? kind : kind || "unknown";
  }

  function normalizeState(value) {
    const state = cleanText(value, "discovered").toLowerCase();
    if (state === "cleared" || state === "investigated") return state;
    return "discovered";
  }

  function hashSeed(value) {
    const text = cleanText(value, "crownless");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function pick(list, seed, channel = "") {
    const choices = Array.isArray(list) ? list.filter(Boolean) : [];
    if (!choices.length) return "";
    return choices[hashSeed(`${seed}|${channel}`) % choices.length];
  }

  function unique(values, limit = 3) {
    return [...new Set(values.filter(Boolean))].slice(0, limit);
  }

  function matchesCombination(combo, terrain, contentKind) {
    if (combo.contentKind && combo.contentKind !== contentKind) return false;
    return combo.terrain.every((item) => terrain.includes(item));
  }

  function sourceFor(entry) {
    const terrainInput = entry && Array.isArray(entry.terrain) && entry.terrain.length ? entry.terrain : entry && entry.features;
    const terrain = normalizeTerrain(terrainInput);
    const contentKind = normalizeContentKind(entry && entry.contentKind);
    const state = normalizeState(entry && entry.state);
    const key = cleanText(entry && entry.key, `anonymous:${contentKind}:${terrain.join("+") || "unknown"}`);
    const seed = `${key}|${terrain.join("+") || "unknown"}|${contentKind}`;
    const combo = COMBINATIONS.find((candidate) => matchesCombination(candidate, terrain, contentKind)) || null;
    const terrainSources = terrain.map((item) => TERRAIN_LORE[item]).filter(Boolean);
    const kindSource = CONTENT_LORE[contentKind] || null;
    return { key, seed, terrain, contentKind, state, combo, terrainSources, kindSource };
  }

  function mergedHints(source, field, fallbackField) {
    const comboValues = source.combo && Array.isArray(source.combo[field]) ? source.combo[field] : [];
    const pools = [];
    source.terrainSources.forEach((item) => { if (Array.isArray(item[field])) pools.push(...item[field]); });
    if (source.kindSource && Array.isArray(source.kindSource[field])) pools.push(...source.kindSource[field]);
    if (!comboValues.length && !pools.length) pools.push(...FALLBACK[fallbackField]);

    function ranked(values, channel) {
      return values.map((value, index) => ({ value, rank: hashSeed(`${source.seed}|${field}|${channel}|${index}|${value}`) }))
        .sort((a, b) => a.rank - b.rank)
        .map((item) => item.value);
    }

    const limit = source.state === "discovered" ? 2 : 3;
    const prioritized = comboValues.length
      ? [ranked(comboValues, "combo")[0], ...ranked([...comboValues, ...pools], "all")]
      : ranked(pools, "all");
    return unique(prioritized, limit);
  }

  function textPool(source, field) {
    if (source.combo && Array.isArray(source.combo[field]) && source.combo[field].length) return source.combo[field];
    const terrainPools = source.terrainSources.flatMap((item) => Array.isArray(item[field]) ? item[field] : []);
    const kindPool = source.kindSource && Array.isArray(source.kindSource[field]) ? source.kindSource[field] : [];
    const combined = [...terrainPools, ...kindPool];
    return combined.length ? combined : FALLBACK[field];
  }

  function buildDiscoveryLore(entry) {
    const source = sourceFor(entry || {});
    const discoveryText = pick(textPool(source, "discoveries"), source.seed, "discovery");
    const rumorText = pick(textPool(source, "rumors"), source.seed, "rumor");
    const threatHints = mergedHints(source, "threats", "threats");
    const rewardHints = mergedHints(source, "rewards", "rewards");
    const notePool = textPool(source, "notes");
    const expeditionNote = source.state === "discovered" ? null : pick(notePool, source.seed, "expedition-note");
    const clearedNote = source.state === "cleared"
      ? pick([
        "踏破後、噂は完全には消えなかったが、少なくとも帰路は地図に残せた。",
        "持ち帰った成果より、戻れる道が確かなものになったことの方が大きい。",
        "危険の正体を一つ記録した。次に来る者は、同じ闇を未知とは呼ばない。"
      ], source.seed, "cleared-note")
      : null;

    return {
      discoveryText,
      rumorText,
      threatHints,
      rewardHints,
      expeditionNote,
      clearedNote
    };
  }

  return {
    TERRAIN_ALIASES,
    normalizeTerrain,
    normalizeContentKind,
    normalizeState,
    hashSeed,
    pick,
    buildDiscoveryLore
  };
});
