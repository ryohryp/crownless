((root, factory) => {
  "use strict";

  const api = factory(
    typeof module === "object" && module.exports
      ? {
          NpcLife: require("./npc-life.js"),
          DiscoveryActions: require("./discovery-actions.js"),
          DiscoveryLore: require("./discovery-lore.js")
        }
      : {
          NpcLife: root && root.CrownlessNpcLife,
          DiscoveryActions: root && root.CrownlessDiscoveryActions,
          DiscoveryLore: root && root.CrownlessDiscoveryLore
        }
  );

  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessNpcInteraction = api;
})(typeof window !== "undefined" ? window : globalThis, (deps) => {
  "use strict";

  const ACTION_TYPES = Object.freeze({
    TALK: "talk",
    ASK_INFO: "ask-info",
    PART: "part",
    // Reserved for future extensions (Issue #346 MVP extensibility)
    TRADE: "trade",
    QUEST: "quest",
    RECRUIT: "recruit",
    GIFT: "gift",
    HOSTILE: "hostile"
  });

  const DEFAULT_ACTIONS = Object.freeze([
    Object.freeze({ id: ACTION_TYPES.TALK, label: "話す", type: ACTION_TYPES.TALK }),
    Object.freeze({ id: ACTION_TYPES.ASK_INFO, label: "情報を聞く", type: ACTION_TYPES.ASK_INFO }),
    Object.freeze({ id: ACTION_TYPES.PART, label: "別れる", type: ACTION_TYPES.PART })
  ]);

  function cleanText(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function normalizeContext(context) {
    const raw = context && typeof context === "object" ? context : {};
    const npcId = cleanText(raw.npcId || raw.targetId || raw.id, "unknown");
    const npcName = cleanText(raw.npcName || raw.targetName || raw.name, "旅人");
    const location = cleanText(raw.location || raw.locationId, "");
    const locationLabel = cleanText(raw.locationLabel, "");
    const destinationName = cleanText(raw.destinationName, locationLabel || "街道");
    const discoveryKey = cleanText(raw.discoveryKey, "");
    const isHearth = Boolean(raw.isHearth || location === "grey-hearth" || raw.atHearth);
    const hour = Number.isFinite(Number(raw.hour)) ? Number(raw.hour) : 12;
    const activity = cleanText(raw.activity, "");
    const reunionCount = Math.max(1, Number(raw.reunionCount) || 1);

    return Object.freeze({
      npcId,
      npcName,
      location,
      locationLabel,
      destinationName,
      discoveryKey,
      isHearth,
      hour,
      activity,
      reunionCount
    });
  }

  function getAvailableActions(context, _worldState) {
    const norm = normalizeContext(context);
    // Base actions available for all valid NPCs
    if (!norm.npcId || norm.npcId === "unknown") return [];
    return DEFAULT_ACTIONS;
  }

  function buildTalkText(norm) {
    switch (norm.npcId) {
      case "marco": {
        if (norm.isHearth) {
          if (norm.activity === "荷支度中") {
            return "荷物の紐を締め直しているところだ。灰炉の火で暖をとったら、また北の街道へ出るよ。";
          }
          return "灰炉の火のそばは落ち着くな。仕入れの算段をつけるにはもってこいだ。あんたたちも次の遠征の支度かい？";
        }
        if (norm.reunionCount > 1) {
          return "また会ったな。お互い無事で何よりだ。街道の旅は一寸先が分からねえが、顔なじみに会えると少し息が抜けるよ。";
        }
        return "よお、こんなところで会うとはな。街道は足元が悪いが、商売の荷を運ぶにはこの道しかないのさ。無理に突っ込むなよ、荷が重い時は引き返すのも腕のうちだ。";
      }

      case "mira": {
        if (norm.isHearth) {
          if (norm.activity === "火の番") {
            return "灰炉の火が絶えないように見ているの。夜の冷え込みは傷に障るから、火のそばで暖まっていって。";
          }
          if (norm.activity === "薬瓶を整理中") {
            return "次の遠征用の薬瓶を並べているところよ。怪我をしたら無理せず戻ってきてね。";
          }
          if (norm.activity === "薬草を選り分け中") {
            return "採取してきた薬草を選り分けているの。乾燥させておけば、いざという時の傷薬になるから。";
          }
          return "灰炉の煙を嗅ぐとほっとするわね。遠征隊が無事に戻ってきてくれてよかった。";
        }
        if (norm.reunionCount > 1) {
          return "またここで会えたわね。無事でよかった。ここは薬草がよく育つ場所だけど、周囲の気配には気をつけて。";
        }
        return "このあたりの土は湿っていて、いい薬草が育つの。採取に夢中になって魔物に囲まれないよう、お互い用心しましょう。";
      }

      case "edgar": {
        if (norm.isHearth) {
          return "武器の手入れは怠るなよ。刃こぼれ一つが生死を分けるんだ。炉の火があるうちに研ぎ直しておけ。";
        }
        if (norm.reunionCount > 1) {
          return "また会ったな。得物の調子はどうだ？ 旅先での不調は命取りだからな、異音がしたらすぐに見直せ。";
        }
        return "この先の岩場は得物の消耗が激しいぞ。柄の緩みや甲冑の留め具には気を配っておけ。";
      }

      default: {
        if (norm.isHearth) {
          return "灰炉の温もりはありがたいな。次の旅立ちまで体を休めておくことだ。";
        }
        return "旅路で出会うのも何かの縁だ。気をつけて進みな。";
      }
    }
  }

  function buildAskInfoText(norm, _worldState) {
    const NpcLife = deps && deps.NpcLife;

    switch (norm.npcId) {
      case "marco": {
        if (norm.destinationName && norm.destinationName.includes("渡し場")) {
          return "北の街道の先には古い渡し場がある。川向こうへの渡し舟はとっくに止まってるが、浅瀬なら足場を選べば渡れるはずだ。水音に紛れて近づく影には気をつけろよ。";
        }
        return "街道筋では、少し先の茂みから異変の物音が聞こえることがあるらしい。ただの風か、それとも獲物を待つ獣か……無理に突っ込むなよ。";
      }

      case "mira": {
        if (norm.isHearth && NpcLife && typeof NpcLife.relationshipLines === "function") {
          const lines = NpcLife.relationshipLines(NpcLife.snapshotAt ? NpcLife.snapshotAt(norm.hour) : []);
          const marcoLine = lines.find((l) => l.targetId === "marco");
          if (marcoLine) return marcoLine.text;
        }
        if (norm.location === "riverbank" || (norm.destinationName && norm.destinationName.includes("川"))) {
          return "水辺の湿地帯には青白い葉の毒草が混じっていることがあるの。傷口に触れると熱が出るから、川辺を調べるなら足元をよく見てね。";
        }
        return "古い森の周辺は、日暮れになると深い霧が立ち込める場所があるわ。視界が効かないときは足を止めて、音に耳を澄ませるのが賢明よ。";
      }

      case "edgar": {
        return "古い廃村の周辺には、崩れかけた地下室が残っているらしい。狭い場所で囲まれたら逃げ場がない、長柄の得物より短刀を用意するんだな。";
      }

      default: {
        return "この先の道には気をつけることだな。地図にない分かれ道ほど、危ないものが潜んでいるもんだ。";
      }
    }
  }

  function buildPartText(norm) {
    switch (norm.npcId) {
      case "marco":
        return "じゃあな、道中気をつけてな。またどこかで会おう。";
      case "mira":
        return "気をつけて行ってきてね。無事を祈っているわ。";
      case "edgar":
        return "おう、油断するなよ。生き残ってまた戻ってこい。";
      default:
        return "道中、気をつけてな。";
    }
  }

  function resolveAction(actionId, context, worldState) {
    const norm = normalizeContext(context);
    const cleanId = cleanText(actionId).toLowerCase();

    const actionDef = DEFAULT_ACTIONS.find((a) => a.id === cleanId);
    if (!actionDef) {
      return Object.freeze({
        actionId: cleanId || "unknown",
        actionLabel: "対話",
        npcId: norm.npcId,
        npcName: norm.npcName,
        text: "言葉を交わそうとしたが、言葉が見つからなかった。",
        topic: "unknown",
        isComplete: false
      });
    }

    let text = "";
    let topic = cleanId;

    if (cleanId === ACTION_TYPES.TALK) {
      text = buildTalkText(norm);
      topic = "conversation";
    } else if (cleanId === ACTION_TYPES.ASK_INFO) {
      text = buildAskInfoText(norm, worldState);
      topic = "rumor";
    } else if (cleanId === ACTION_TYPES.PART) {
      text = buildPartText(norm);
      topic = "farewell";
    }

    return Object.freeze({
      actionId: cleanId,
      actionLabel: actionDef.label,
      npcId: norm.npcId,
      npcName: norm.npcName,
      text,
      topic,
      isComplete: cleanId === ACTION_TYPES.PART
    });
  }

  function interactionRecordKey(context) {
    const norm = normalizeContext(context);
    const locKey = norm.discoveryKey || (norm.isHearth ? "grey-hearth" : norm.location || "unknown");
    return norm.npcId ? `${norm.npcId}|${locKey}` : "";
  }

  return Object.freeze({
    ACTION_TYPES,
    DEFAULT_ACTIONS,
    normalizeContext,
    getAvailableActions,
    resolveAction,
    interactionRecordKey
  });
});
