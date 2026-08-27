"use strict";

(function expeditionNarrativeModule(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionNarrative = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function expeditionNarrativeFactory() {
  const NARRATIVE_VERSION = "battle-narrative-v1";

  function stableHash(input) {
    let hash = 2166136261;
    for (const ch of String(input)) {
      hash ^= ch.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function pickDeterministic(options, seed, key) {
    if (!options.length) return "";
    return options[stableHash(`${seed}:${key}`) % options.length];
  }

  function companionById(party, id) {
    return party.find((member) => member && member.id === id) || null;
  }

  function hasTrait(member, trait) {
    return Boolean(member && Array.isArray(member.traits) && member.traits.includes(trait));
  }

  function memberForCause(party, cause, fallback) {
    if (cause === "woodsman" || cause === "ranged") return companionById(party, "mira") || party.find((member) => hasTrait(member, "woodsman")) || fallback;
    if (cause === "strong" || cause === "cut") return companionById(party, "ed") || party.find((member) => hasTrait(member, "strong")) || fallback;
    if (cause === "greedy" || cause === "conceal") return companionById(party, "sella") || party.find((member) => hasTrait(member, "greedy") || hasTrait(member, "keen-eye")) || fallback;
    return fallback;
  }

  function defaultActor(party, combat, seed, battleIndex) {
    if (!party.length) return { id: "party", name: "隊", traits: [] };
    const causes = new Set(combat.causes || []);
    const eventNames = new Set((combat.rounds || []).flatMap((round) => round.events || []));
    if ((causes.has("woodsman") || eventNames.has("read-beast") || causes.has("ranged")) && companionById(party, "mira")) return companionById(party, "mira");
    if ((causes.has("strong") || causes.has("brave") || causes.has("cut")) && companionById(party, "ed")) return companionById(party, "ed");
    if ((causes.has("stubborn") || causes.has("conceal")) && companionById(party, "sella")) return companionById(party, "sella");
    return party[stableHash(`${seed}:${battleIndex}:${combat.encounterId}`) % party.length];
  }

  function policyActor(party, policy, fallback) {
    if (policy && policy.id === "cautious") return companionById(party, "mira") || fallback;
    if (policy && policy.id === "greedy") return companionById(party, "sella") || fallback;
    return companionById(party, "ed") || fallback;
  }

  function enemyVerb(combat) {
    return (combat.enemyTags || []).includes("beast") ? "群れ" : "敵";
  }

  function makeEvent({ phase, actor, combat, round, action, reaction, consequence, causes, text }) {
    const source = round || {};
    return {
      phase,
      actorId: actor ? actor.id : null,
      actorName: actor ? actor.name : "隊",
      enemyId: combat.encounterId,
      enemyName: combat.encounterName,
      enemyCountBefore: Number.isFinite(source.enemyCountBefore) ? source.enemyCountBefore : combat.initialEnemyCount,
      remainingEnemyCount: Number.isFinite(source.remainingEnemyCount) ? source.remainingEnemyCount : combat.remainingEnemyCount,
      action,
      reaction,
      consequence,
      hpBefore: Number.isFinite(source.hpBefore) ? source.hpBefore : combat.hpBefore,
      hpAfter: Number.isFinite(source.hpAfter) ? source.hpAfter : combat.hpAfter,
      causes: Array.from(new Set(causes || [])),
      text,
    };
  }

  function openingCause(combat) {
    const first = (combat.rounds || [])[0] || {};
    const events = new Set(first.events || []);
    const causes = new Set(combat.causes || []);
    if (events.has("ranged-opener") || causes.has("ranged")) return "ranged";
    if (events.has("ambush") || causes.has("conceal")) return "conceal";
    if (events.has("read-beast") || causes.has("woodsman")) return "woodsman";
    if (causes.has("strong")) return "strong";
    if (causes.has("cut")) return "cut";
    return "contact";
  }

  function openingText(actor, combat, cause, seed, battleIndex) {
    const name = actor.name;
    const enemy = combat.encounterName;
    if (actor.id === "mira") {
      if (cause === "ranged") return `${name}が先に足を止めた。${enemy}が間合いを詰める前に狩り弓を引き、先頭の動きを崩す。`;
      if (cause === "woodsman") return `${name}が地面と藪の揺れを見て、${enemy}の回り込みを先に読む。包囲される前に、隊を狭い場所へ寄せた。`;
      return `${name}が最初に気配を拾った。${enemy}へ踏み込みすぎず、逃げ道を残したまま構える。`;
    }
    if (actor.id === "ed") {
      if (cause === "cut") return `${name}が古い刃を抜き、一歩前へ出た。${enemy}の視線を自分へ集め、仲間の前に立つ。`;
      return `${name}が一歩前へ出た。${enemy}の勢いを正面から受け止め、仲間の立つ場所を空ける。`;
    }
    if (actor.id === "sella") {
      if (cause === "conceal") return `${name}は敵より先に物陰と逃げ道を見た。${enemy}が気づき切る前に先手を取り、退く線だけは残している。`;
      return `${name}は${enemy}より先に出口と足元を見た。危険を量りながらも、拾えるものがある距離からは離れない。`;
    }
    return pickDeterministic([
      `${name}が${enemy}の気配を捉え、隊が足を止めた。`,
      `${enemy}が道を塞ぐ。${name}が前に立ち、最初の間合いを測る。`,
    ], seed, `opening:${battleIndex}`);
  }

  function pressureText(actor, combat, round) {
    const name = actor.name;
    const enemy = enemyVerb(combat);
    const lost = Math.max(0, round.hpBefore - round.hpAfter + (round.healed || 0));
    if (actor.id === "mira") {
      return lost > 0
        ? `${enemy}の反撃が届き、${name}が一度退く。それでも周囲を見失わず、包囲の薄い側へ隊を寄せ直した。`
        : `${name}は深追いしない。敵の動きが重なる場所を避け、次に崩せる一角だけを見ている。`;
    }
    if (actor.id === "ed") {
      return lost > 0
        ? `反撃を受けても、${name}は前を譲らない。敵の目を自分へ引きつけ、仲間の足場を守った。`
        : `${name}が前へ圧をかけ続ける。敵が下がるたび、逃げ道ではなく仲間のための隙間を作った。`;
    }
    if (actor.id === "sella") {
      return lost > 0
        ? `痛みに顔をしかめた${name}は、出口と落ちた品の位置を見直す。それでも、あと一歩ぶんだけ前へ残った。`
        : `${name}は退ける線を確かめながら、敵が落としたものまで視界から外さない。まだ引く気はない。`;
    }
    return lost > 0 ? `${name}が反撃を受ける。隊列を崩さず、次の隙を待った。` : `${name}が敵の圧を受け止め、隊列を保った。`;
  }

  function turningCause(combat, round) {
    const events = new Set(round.events || []);
    if (events.has("heal")) return "heal";
    if (events.has("ranged-opener")) return "ranged";
    if (events.has("ambush")) return "conceal";
    if (events.has("read-beast")) return "woodsman";
    if (events.has("strong-finish") || (combat.causes || []).includes("strong")) return "strong";
    if ((combat.causes || []).includes("cut")) return "cut";
    return "momentum";
  }

  function turningText(actor, combat, round, cause) {
    const name = actor.name;
    if (cause === "heal") return `${name}が傷を縛り直す。ほんの少し息を取り戻し、崩れかけた足をもう一度前へ向けた。`;
    if (cause === "ranged") return `${name}が距離を保ったまま矢を通す。敵の足並みが乱れ、こちらへ押し切る勢いが鈍った。`;
    if (cause === "conceal") return `${name}が物陰から間合いをずらす。敵が振り向いた時には、こちらが先に次の位置を取っていた。`;
    if (cause === "woodsman") return `${name}が群れの回り込みを読み切る。狭い側へ誘い込み、囲まれるはずだった形をひっくり返した。`;
    if (cause === "strong") return `${name}が正面から押し返した。敵の注意が集まった隙に、隊の呼吸が戻る。`;
    if (cause === "cut") return `${name}が間合いを詰め、刃で道をこじ開ける。敵の列が割れ、押されていた流れが変わった。`;
    if (round.remainingEnemyCount === 1) return `残る気配は一つ。${name}が逃がさないよう間合いを詰め、決着の形を作った。`;
    if (round.enemiesDefeated >= 2) return `${name}の一押しで敵の勢いが目に見えて落ちる。さっきまでの圧が、こちらへ傾き始めた。`;
    return `${name}が敵の綻びを見つけた。小さな隙を逃さず、押されていた流れを少しずつ戻す。`;
  }

  function roundImportance(round, previous, combat) {
    let score = 0;
    const ratio = combat.maxHp ? round.damage / combat.maxHp : 0;
    if (round.remainingEnemyCount === 1) score += 100;
    if ((round.events || []).includes("heal")) score += 90;
    if (ratio >= 0.2) score += 85;
    if (round.enemiesDefeated >= 2) score += 75;
    if ((round.events || []).some((event) => ["ranged-opener", "ambush", "read-beast", "strong-finish"].includes(event))) score += 65;
    if (previous && previous.enemiesDefeated === 0 && round.enemiesDefeated > 0) score += 70;
    if (round.damage > 0) score += Math.min(30, round.damage);
    return score;
  }

  function chooseMiddleRounds(combat) {
    const rounds = combat.rounds || [];
    if (!rounds.length) return [];
    const pressure = [...rounds].filter((round) => round.damage > 0).sort((a, b) => b.damage - a.damage || a.round - b.round)[0] || rounds[0];
    const ranked = rounds
      .map((round, index) => ({ round, score: roundImportance(round, rounds[index - 1], combat) }))
      .sort((a, b) => b.score - a.score || a.round.round - b.round.round);
    const selected = [pressure];
    for (const candidate of ranked) {
      if (selected.some((round) => round.round === candidate.round.round)) continue;
      selected.push(candidate.round);
      if (selected.length >= Math.min(3, rounds.length)) break;
    }
    if (selected.length < 2 && rounds.length > 1) selected.push(rounds.at(-1));
    return selected.sort((a, b) => a.round - b.round);
  }

  function finishText(actor, combat, policy) {
    const name = actor.name;
    if (combat.result === "victory") {
      if (actor.id === "mira") return `最後の動きを読んだ${name}が追い払う。静けさが戻るまで、すぐには構えを解かなかった。`;
      if (actor.id === "ed") return `${name}が最後の抵抗を押し切った。道が開いても、まず仲間の無事を振り返る。`;
      if (actor.id === "sella") return `${name}が最後の抵抗を断つ。息を整えるより先に、落ちた戦利品へ目を走らせた。`;
      return `${name}が最後の敵を退け、ようやく道が開いた。`;
    }
    if (combat.result === "retreat") {
      if (policy && policy.id === "cautious") return `${name}が傷と残る気配を見比べて首を振る。「ここまで」追わずに距離を切り、帰る側へ足を向けた。`;
      if (policy && policy.id === "greedy") return `${name}はまだ先を見ていたが、足がもう応えない。「……今回は持ち帰る」敵から距離を切った。`;
      return `${name}が殿に残り、追ってくる気配を引き受ける。勝ち切るより、全員で帰る道を選んだ。`;
    }
    if (actor.id === "ed") return `${name}が最後まで前に立ったが、隊列は支えきれなかった。道を譲らないまま、ついに膝をつく。`;
    if (actor.id === "mira") return `${name}は退路を探し続けたが、包囲をほどけなかった。判断より先に、隊の足が止まった。`;
    if (actor.id === "sella") return `${name}は出口を見失わなかった。それでも傷が積み重なり、持ち帰るための一歩が残らなかった。`;
    return `${name}が踏みとどまったが、隊列は崩れた。戦いはそこで終わった。`;
  }

  function aftermathText(actor, combat) {
    if (combat.result === "victory" && combat.hpAfter / combat.maxHp <= 0.45) return `勝ちはした。だが${actor.name}たちの足取りは重い。戦利品より先に、帰路の長さが気になった。`;
    if (combat.result === "retreat") return `背後の気配が遠のくまで、誰も足を緩めなかった。生きて戻るための撤退だった。`;
    if (combat.result === "defeat") return `残ったのは、途切れた足跡と散った荷だけだった。灰炉へ戻る道は、助けを待つ側に変わった。`;
    return "";
  }

  function buildBattleNarrative(input) {
    const combat = input && input.combat ? input.combat : null;
    if (!combat || !Array.isArray(combat.rounds)) return null;
    const party = Array.isArray(input.party) ? input.party.filter(Boolean) : [];
    const policy = input.policy || { id: "standard", name: "通常" };
    const seed = Number.isFinite(input.seed) ? input.seed : 0;
    const battleIndex = Number.isFinite(input.battleIndex) ? input.battleIndex : 0;
    const fallback = defaultActor(party, combat, seed, battleIndex);
    const first = combat.rounds[0] || null;
    const cause = openingCause(combat);
    const openingActor = memberForCause(party, cause, fallback);
    const lines = [makeEvent({
      phase: "opening",
      actor: openingActor,
      combat,
      round: first,
      action: cause === "contact" ? "meet-threat" : cause,
      reaction: "enemy-engages",
      consequence: "opening-position",
      causes: cause === "contact" ? [] : [cause],
      text: openingText(openingActor, combat, cause, seed, battleIndex),
    })];

    const middleRounds = chooseMiddleRounds(combat);
    middleRounds.forEach((round, index) => {
      const turnCause = turningCause(combat, round);
      const actor = memberForCause(party, turnCause, fallback);
      const isTurning = round.remainingEnemyCount === 1 || round.enemiesDefeated >= 2 || (round.events || []).includes("heal") || index === middleRounds.length - 1;
      if (!isTurning && round.damage > 0) {
        lines.push(makeEvent({
          phase: "pressure",
          actor,
          combat,
          round,
          action: "hold-under-pressure",
          reaction: "enemy-presses",
          consequence: round.hpAfter / combat.maxHp <= (policy.retreatHpRatio || 0) * 1.15 ? "near-retreat" : "pressure",
          causes: round.events || [],
          text: pressureText(actor, combat, round),
        }));
        return;
      }
      lines.push(makeEvent({
        phase: "turning-point",
        actor,
        combat,
        round,
        action: turnCause,
        reaction: "enemy-loses-momentum",
        consequence: round.remainingEnemyCount === 1 ? "last-enemy" : "momentum-shift",
        causes: Array.from(new Set([turnCause, ...(round.events || [])])).filter((item) => item !== "momentum"),
        text: turningText(actor, combat, round, turnCause),
      }));
    });

    if (!lines.some((line) => line.phase === "pressure") && middleRounds.length) {
      const pressureRound = [...middleRounds].sort((a, b) => b.damage - a.damage)[0];
      lines.splice(1, 0, makeEvent({
        phase: "pressure",
        actor: fallback,
        combat,
        round: pressureRound,
        action: "hold-under-pressure",
        reaction: "enemy-presses",
        consequence: "pressure",
        causes: pressureRound.events || [],
        text: pressureText(fallback, combat, pressureRound),
      }));
    }

    while (lines.filter((line) => line.phase === "pressure" || line.phase === "turning-point").length > 3) {
      const removable = lines.findIndex((line, index) => index > 1 && line.phase === "pressure");
      lines.splice(removable >= 0 ? removable : 2, 1);
    }

    const finishActor = policyActor(party, policy, fallback);
    const last = combat.rounds.at(-1) || first;
    lines.push(makeEvent({
      phase: "finish",
      actor: finishActor,
      combat,
      round: last,
      action: combat.result === "victory" ? "finish-fight" : combat.result === "retreat" ? "withdraw" : "collapse",
      reaction: combat.result === "victory" ? "enemy-breaks" : combat.result === "retreat" ? "party-disengages" : "party-defeated",
      consequence: combat.result,
      causes: [policy.id],
      text: finishText(finishActor, combat, policy),
    }));

    const aftermath = aftermathText(finishActor, combat);
    if (aftermath) lines.push(makeEvent({
      phase: "aftermath",
      actor: finishActor,
      combat,
      round: last,
      action: "aftermath",
      reaction: "battle-settles",
      consequence: combat.result === "victory" ? "cost-of-victory" : combat.result,
      causes: [],
      text: aftermath,
    }));

    return {
      version: NARRATIVE_VERSION,
      encounterId: combat.encounterId,
      encounterName: combat.encounterName,
      outcome: combat.result,
      actorIds: Array.from(new Set(lines.map((line) => line.actorId).filter(Boolean))),
      lines,
    };
  }

  function buildExpeditionNarrative(input) {
    const report = input && input.report ? input.report : null;
    if (!report || !report.combat || !Array.isArray(report.combat.encounters)) return { version: NARRATIVE_VERSION, battles: [] };
    const companions = Array.isArray(input.companions) ? input.companions : [];
    const policies = input.policies || {};
    const party = (report.companionIds || []).map((id) => companionById(companions, id)).filter(Boolean);
    const policy = policies[report.policyId] || { id: report.policyId || "standard", name: report.policyName || "通常", retreatHpRatio: 0.42 };
    return {
      version: NARRATIVE_VERSION,
      expeditionId: report.expeditionId,
      seed: report.seed,
      battles: report.combat.encounters.map((combat, battleIndex) => buildBattleNarrative({ combat, party, policy, seed: report.seed, battleIndex })).filter(Boolean),
    };
  }

  return { NARRATIVE_VERSION, buildBattleNarrative, buildExpeditionNarrative, stableHash };
});
