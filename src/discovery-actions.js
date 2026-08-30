(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessDiscoveryActions = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createDiscoveryActions() {
  "use strict";

  const USABLE_STATES = new Set(["discovered", "investigated", "cleared"]);
  const EVENT_TERRAINS = new Set(["crossing", "road_hub", "water", "sacred", "settlement"]);
  const FACILITY_TERRAINS = new Set(["settlement", "road_hub", "crossing"]);
  const NON_EXPEDITION_KINDS = new Set(["rumor", "region-mission"]);
  const NON_FACILITY_KINDS = new Set(["dungeon", "encounter", "region-mission", "rumor"]);

  const MERCHANT_CATALOG = Object.freeze([
    Object.freeze({ id: "merchant-bandage-roll", name: "旅用の包帯束", tags: Object.freeze(["heal"]), priceLoot: 1, note: "傷の手当てに使える。" }),
    Object.freeze({ id: "merchant-grapnel", name: "小さな鉄鉤", tags: Object.freeze(["climb"]), priceLoot: 1, note: "崩れた道や高所で役に立つ。" }),
    Object.freeze({ id: "merchant-smoke-cloak", name: "煤染めの旅外套", tags: Object.freeze(["conceal", "light"]), priceLoot: 1, note: "目立たず動くための軽い外套。" })
  ]);

  const EVENT_LIBRARY = Object.freeze({
    crossing: Object.freeze([
      Object.freeze({ title: "渡し賃のない渡し守", hook: "誰もいないはずの渡し場に、古びた銭受けだけが置かれている。", investigate: "銭受けの底から、別の道へ続く刻印を見つけた。", leave: "水音だけを背にして、その場を離れた。" }),
      Object.freeze({ title: "流された荷札", hook: "濡れた荷札が杭に絡み、同じ印が何枚も下流を向いている。", investigate: "荷札は一つの隊商から剥がれたものらしい。先で何かあったようだ。", leave: "印だけを地図へ写し、深追いはしなかった。" })
    ]),
    road_hub: Object.freeze([
      Object.freeze({ title: "消えた荷駄隊の痕跡", hook: "轍が分かれる場所で、重い荷車の跡だけが脇道へ逸れている。", investigate: "切れた荷縄に煤の印が残っていた。偶然の事故ではなさそうだ。", leave: "轍の向きだけを記録し、今は追わないことにした。" }),
      Object.freeze({ title: "夜だけ立つ道標", hook: "削られた道標の裏に、最近つけられた細い矢印がある。", investigate: "矢印は街道ではなく、地図にない脇道を指していた。", leave: "道標には触れず、位置だけを覚えておいた。" })
    ]),
    water: Object.freeze([
      Object.freeze({ title: "岸辺の灯り", hook: "水際に消えかけた灯りと、まだ温かい灰が残っている。", investigate: "灰の下から古銭を包んでいた布の切れ端が出てきた。", leave: "水位が上がる前に岸を離れた。" }),
      Object.freeze({ title: "水面からの呼び声", hook: "風が止むたび、向こう岸から短い呼び声が聞こえる。", investigate: "声の方角に、使われなくなった渡り跡を見つけた。", leave: "返事はせず、音が消えるまで待った。" })
    ]),
    sacred: Object.freeze([
      Object.freeze({ title: "新しい供え物", hook: "朽ちた祈りの印の前に、今日置かれたような供え物がある。", investigate: "供え物の下に、小さな護符と旅人の印が重ねられていた。", leave: "祈りを乱さず、その場を離れた。" }),
      Object.freeze({ title: "名の消えた祈り", hook: "削られた文字の一部だけが、煤でなぞり直されている。", investigate: "残った文字から、近くの古道に関わる祈りだと分かった。", leave: "読める部分だけを探索録へ写した。" })
    ]),
    settlement: Object.freeze([
      Object.freeze({ title: "閉じた戸口の取引", hook: "人通りの切れ目に、印だけを出した小さな露店が現れている。", investigate: "露店の主は遠征帰りの噂をひとつだけ教えてくれた。", leave: "値踏みされる前に通り過ぎた。" }),
      Object.freeze({ title: "傷ついた旅人", hook: "路地脇で旅人が座り込み、荷袋を抱えたまま周囲を警戒している。", investigate: "手当てをすると、近くで見た武装した一団の話を残した。", leave: "危険を感じ、距離を取った。" })
    ]),
    default: Object.freeze([
      Object.freeze({ title: "地図にない気配", hook: "この地点には、ただ通り過ぎるには気になる痕跡が残っている。", investigate: "痕跡を辿ると、この土地について小さな手掛かりを得た。", leave: "今は手を出さず、探索録に印だけ残した。" })
    ])
  });

  function cleanText(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function terrainOf(entry) {
    const source = Array.isArray(entry && entry.terrain) ? entry.terrain : Array.isArray(entry && entry.features) ? entry.features : [];
    return [...new Set(source.map((item) => cleanText(item)).filter(Boolean))].slice(0, 8);
  }

  function stableHash(value) {
    let hash = 2166136261;
    const text = cleanText(value, "discovery");
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function stableId(entry, kind) {
    return `${kind}:${stableHash(`${cleanText(entry && entry.key, cleanText(entry && entry.name, "discovery"))}:${kind}`).toString(16).padStart(8, "0")}`;
  }

  function hasTerrain(terrain, candidates) {
    return terrain.some((item) => candidates.has(item));
  }

  function isUsable(entry) {
    return Boolean(entry && typeof entry === "object" && USABLE_STATES.has(cleanText(entry.state, "discovered")));
  }

  function canExpedition(entry) {
    if (!isUsable(entry)) return false;
    const kind = cleanText(entry.contentKind, "unknown");
    if (NON_EXPEDITION_KINDS.has(kind)) return false;
    return cleanText(entry.key).startsWith("geo:");
  }

  function canEvent(entry) {
    if (!isUsable(entry)) return false;
    const kind = cleanText(entry.contentKind, "unknown");
    if (kind === "event" || kind === "encounter" || kind === "rumor" || kind === "region-mission") return true;
    return hasTerrain(terrainOf(entry), EVENT_TERRAINS);
  }

  function canFacility(entry) {
    if (!isUsable(entry)) return false;
    const kind = cleanText(entry.contentKind, "unknown");
    if (NON_FACILITY_KINDS.has(kind)) return false;
    return hasTerrain(terrainOf(entry), FACILITY_TERRAINS);
  }

  function buildDiscoveryActions(entry) {
    if (!isUsable(entry)) return [];
    const actions = [];
    if (canExpedition(entry)) {
      actions.push({ kind: "expedition", id: stableId(entry, "expedition"), label: "遠征隊を送る", note: "仲間・道具・方針を決めて送り出す。" });
    }
    if (canEvent(entry)) {
      actions.push({ kind: "event", id: stableId(entry, "event"), label: "この地の事件を調べる", note: "土地に残る出来事や噂へ踏み込む。" });
    }
    if (canFacility(entry)) {
      actions.push({ kind: "facility", facilityKind: "merchant", id: stableId(entry, "merchant"), label: "旅商人を見る", note: "持ち帰った品と旅支度を交換する。" });
    }
    return actions;
  }

  function eventFamily(entry) {
    const terrain = terrainOf(entry);
    return ["crossing", "road_hub", "water", "sacred", "settlement"].find((item) => terrain.includes(item)) || "default";
  }

  function buildLocalEvent(entry) {
    const family = eventFamily(entry);
    const candidates = EVENT_LIBRARY[family] || EVENT_LIBRARY.default;
    const selected = candidates[stableHash(`${cleanText(entry && entry.key, entry && entry.name)}:event`) % candidates.length];
    return {
      id: stableId(entry, "event"),
      family,
      title: selected.title,
      hook: selected.hook,
      choices: [
        { id: "investigate", label: "もう少し調べる", result: selected.investigate },
        { id: "leave", label: "今は立ち去る", result: selected.leave }
      ]
    };
  }

  function merchantStock(entry) {
    if (!canFacility(entry)) return [];
    const offset = stableHash(`${cleanText(entry && entry.key, entry && entry.name)}:merchant`) % MERCHANT_CATALOG.length;
    return [0, 1].map((step) => {
      const item = MERCHANT_CATALOG[(offset + step) % MERCHANT_CATALOG.length];
      return { id: item.id, name: item.name, tags: item.tags.slice(), priceLoot: item.priceLoot, note: item.note };
    });
  }

  return {
    USABLE_STATES,
    MERCHANT_CATALOG,
    terrainOf,
    stableHash,
    stableId,
    isUsable,
    canExpedition,
    canEvent,
    canFacility,
    buildDiscoveryActions,
    buildLocalEvent,
    merchantStock
  };
});
