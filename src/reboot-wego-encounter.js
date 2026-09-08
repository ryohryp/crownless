(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CrownlessRebootWegoEncounter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'crownless.reboot.wego.v1';
  const ENCOUNTER_ID = 'roadside_bandits';
  const MAX_ROUNDS = 3;

  const ACTIONS = Object.freeze({
    PRESS: 'press',
    GUARD: 'guard',
    MANEUVER: 'maneuver',
    RETREAT: 'retreat'
  });

  const GEAR = Object.freeze({
    LONG_SPEAR: Object.freeze({
      id: 'long_spear',
      label: '長槍',
      note: '接近してくる前衛へのpressが強い。詰め切れない相手には重い。'
    }),
    ROUND_SHIELD: Object.freeze({
      id: 'round_shield',
      label: '丸盾',
      note: '射撃兆候へのguardが強い。守りながら次の意図を読みやすい。'
    }),
    LIGHT_KIT: Object.freeze({
      id: 'light_kit',
      label: '軽装・素手',
      note: 'maneuverとretreatが強い。正面から押し切る力はない。'
    })
  });

  const GEAR_BY_ID = Object.freeze(Object.fromEntries(Object.values(GEAR).map((gear) => [gear.id, gear])));
  const VALID_RESULTS = new Set(['cleared', 'retreated', 'forced_retreat']);
  const VALID_INJURIES = new Set([null, 'arrow_graze', 'wrenched_knee', 'bruised_ribs']);
  const VALID_PLACE_STATES = new Set(['road_cleared', 'bandits_alerted', 'bandits_hold_road']);

  const PLANS = Object.freeze({
    probe_shot: Object.freeze({
      id: 'probe_shot',
      exact: '前衛が間合いを詰め、弓兵は崩れ石の陰で矢を番えた。',
      partial: '弓兵が矢を番えた。もう一人は正面から距離を詰めているようだ。',
      vague: '二つの人影が左右に離れた。片方が何かを持ち上げた。',
      tags: Object.freeze(['closing', 'shot'])
    }),
    brace_flank: Object.freeze({
      id: 'brace_flank',
      exact: '前衛は足を止めて槍先を受ける構え。弓兵が横へ回って射線を作る。',
      partial: '正面の男は待ち構えた。もう一人が横へ消えた。',
      vague: '正面の人影が止まり、もう一人が視界の端へ動いた。',
      tags: Object.freeze(['brace', 'shot', 'flank'])
    }),
    advance_reposition: Object.freeze({
      id: 'advance_reposition',
      exact: '前衛が盾越しの様子見を嫌って踏み込み、弓兵は次の射線へ走る。',
      partial: '前衛が踏み込む。後ろの一人は場所を変えようとしている。',
      vague: '一人が近づき、もう一人が石陰を離れた。',
      tags: Object.freeze(['closing', 'reposition'])
    }),
    cutoff_volley: Object.freeze({
      id: 'cutoff_volley',
      exact: '前衛が退路側へ回り込み、弓兵は開けた場所へ二射目を合わせている。',
      partial: '弓兵の射線が通った。前衛は正面ではなく横へ動く。',
      vague: '左右から挟むように二人の位置が変わった。',
      tags: Object.freeze(['cutoff', 'shot'])
    }),
    break_and_cover: Object.freeze({
      id: 'break_and_cover',
      exact: '前衛の足が下がった。弓兵は仲間を逃がすために一射だけ残している。',
      partial: '正面の男が下がる。後ろの一人はまだこちらを見ている。',
      vague: '二人の足並みが崩れたが、まだ退いたわけではない。',
      tags: Object.freeze(['wavering', 'shot'])
    }),
    close_trap: Object.freeze({
      id: 'close_trap',
      exact: '前衛が退路を塞ぎ、弓兵は逃げ道へ射線を重ねた。ここで読み違えると押し戻される。',
      partial: '退路側へ前衛が回った。弓兵もこちらの逃げ道を見ている。',
      vague: '二人が距離を詰め、背後の道が狭く見える。',
      tags: Object.freeze(['cutoff', 'shot', 'closing'])
    })
  });

  const EFFECTS = Object.freeze({
    probe_shot: Object.freeze({
      press: Object.freeze({ advantage: 1, pressure: 1, text: '矢が放たれる前に前衛へ踏み込み、二人の連携を一度切った。' }),
      guard: Object.freeze({ advantage: 0, pressure: -1, text: '矢筋を受け流しながら、前衛と弓兵が交互に動く癖を読んだ。' }),
      maneuver: Object.freeze({ advantage: 1, pressure: 0, text: '崩れ石へ位置を変え、弓兵の射線と前衛の直線を同時に外した。' })
    }),
    brace_flank: Object.freeze({
      press: Object.freeze({ advantage: -1, pressure: 2, text: '待ち構えた前衛へ押し込み、横へ回った弓兵に射線を渡してしまった。' }),
      guard: Object.freeze({ advantage: 1, pressure: 0, text: '正面を固めたまま横の射線を追い、包囲を完成させなかった。' }),
      maneuver: Object.freeze({ advantage: 2, pressure: 0, text: '待ち構える前衛を捨て、弓兵側へ軸をずらして二人の間を裂いた。' })
    }),
    advance_reposition: Object.freeze({
      press: Object.freeze({ advantage: 2, pressure: 1, text: '踏み込んできた前衛へ逆に間合いを詰め、弓兵が位置を作る時間を奪った。' }),
      guard: Object.freeze({ advantage: 0, pressure: 0, text: '踏み込みを止めたが、弓兵には次の射線を選ぶ時間を与えた。' }),
      maneuver: Object.freeze({ advantage: 1, pressure: 0, text: '前衛の進路を石へ引っ掛け、弓兵が移る先を先回りした。' })
    }),
    cutoff_volley: Object.freeze({
      press: Object.freeze({ advantage: 0, pressure: 2, text: '前衛を追う間に退路が狭まり、弓兵の二射目を受ける形になった。' }),
      guard: Object.freeze({ advantage: 2, pressure: -1, text: '射撃をやり過ごし、退路へ回る前衛の足を止めて包囲を崩した。' }),
      maneuver: Object.freeze({ advantage: -1, pressure: 1, text: 'さらに位置を変えたが、敵も同じ方向へ回り込み、開けた場所へ追い出された。' })
    }),
    break_and_cover: Object.freeze({
      press: Object.freeze({ advantage: 2, pressure: 1, text: '下がる前衛へ一気に詰め、弓兵が仲間を覆う前に追い払った。' }),
      guard: Object.freeze({ advantage: 0, pressure: 0, text: '最後の一射は防いだが、二人に退く間を与えた。' }),
      maneuver: Object.freeze({ advantage: 1, pressure: 0, text: '逃げ道へ回って圧を掛けたが、決着にはもう一押し足りない。' })
    }),
    close_trap: Object.freeze({
      press: Object.freeze({ advantage: -1, pressure: 2, text: '狭められた間合いへ正面から入り、退路ごと押さえ込まれた。' }),
      guard: Object.freeze({ advantage: 1, pressure: 0, text: '退路を背に守りを固め、包囲が閉じる瞬間だけは遅らせた。' }),
      maneuver: Object.freeze({ advantage: 2, pressure: 0, text: '塞がれる直前に石壁の切れ目へ抜け、二人を同じ側へ追いやった。' })
    })
  });

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeClues(input) {
    if (!Array.isArray(input)) return Object.freeze([]);
    return Object.freeze([...new Set(input.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))]);
  }

  function knowledgeLevel(cluesInput) {
    const clues = normalizeClues(cluesInput);
    if (clues.length >= 3) return 2;
    if (clues.length >= 1) return 1;
    return 0;
  }

  function knownInformation(cluesInput) {
    const clues = normalizeClues(cluesInput);
    const facts = [];
    if (clues.length) facts.push('足跡と街道の乱れから、待ち伏せが偶然ではないと分かっている。');
    if (clues.some((clue) => /石|防柵|関門|轍/.test(clue))) facts.push('崩れ石と荷車跡は遮蔽にも退路にも使える。');
    if (clues.some((clue) => /見張り|人|袋|矢|羽/.test(clue))) facts.push('少なくとも一人は正面で殴り合う役ではなく、距離を取る役だ。');
    if (!facts.length) facts.push('敵の人数以外は分からない。地形も役割も、その場で読むしかない。');
    return Object.freeze(facts);
  }

  function normalizeGearId(value) {
    return Object.prototype.hasOwnProperty.call(GEAR_BY_ID, value) ? value : GEAR.ROUND_SHIELD.id;
  }

  function createEncounter(options) {
    const config = options && typeof options === 'object' ? options : {};
    const clues = normalizeClues(config.clues);
    return Object.freeze({
      encounterId: ENCOUNTER_ID,
      status: 'active',
      result: null,
      round: 1,
      advantage: 0,
      pressure: 0,
      injury: null,
      gear: normalizeGearId(config.gear),
      clues,
      knowledge: knowledgeLevel(clues),
      readIntent: false,
      lastAction: null,
      lastResolution: '前衛1、弓兵1。ここから先は、敵も同じ瞬間に動く。',
      intel: Object.freeze(['前衛1人', '弓兵1人'])
    });
  }

  function enemyPlan(state) {
    if (!state || state.status !== 'active') return null;
    if (state.round <= 1) return PLANS.probe_shot;
    if (state.round === 2) {
      if (state.lastAction === ACTIONS.PRESS) return PLANS.brace_flank;
      if (state.lastAction === ACTIONS.GUARD) return PLANS.advance_reposition;
      return PLANS.cutoff_volley;
    }
    return state.advantage >= 2 ? PLANS.break_and_cover : PLANS.close_trap;
  }

  function intentPresentation(state) {
    const plan = enemyPlan(state);
    if (!plan) return '';
    if (state.readIntent || state.knowledge >= 2) return plan.exact;
    if (state.knowledge >= 1) return plan.partial;
    return plan.vague;
  }

  function gearDefinition(gearId) {
    return GEAR_BY_ID[normalizeGearId(gearId)];
  }

  function gearBonus(state, plan, action) {
    let advantage = 0;
    let pressure = 0;
    let note = '';
    if (state.gear === GEAR.LONG_SPEAR.id && action === ACTIONS.PRESS && plan.tags.includes('closing') && !plan.tags.includes('brace')) {
      advantage += 1;
      note = '長槍で踏み込む前衛の間合いそのものを潰した。';
    }
    if (state.gear === GEAR.ROUND_SHIELD.id && action === ACTIONS.GUARD && plan.tags.includes('shot')) {
      advantage += 1;
      pressure -= 1;
      note = '丸盾が射線を消し、守るだけでなく敵の役割まで見えた。';
    }
    if (state.gear === GEAR.LIGHT_KIT.id && action === ACTIONS.MANEUVER) {
      advantage += 1;
      pressure -= 1;
      note = '軽装なので石と轍の間を先に取れた。';
    }
    return { advantage, pressure, note };
  }

  function explorationBonus(state, action) {
    if (state.round !== 1) return { advantage: 0, pressure: 0, note: '' };
    if (state.knowledge >= 2 && action === ACTIONS.MANEUVER) {
      return { advantage: 1, pressure: -1, note: '探索で見ていた崩れ石を、最初から遮蔽として使えた。' };
    }
    if (state.knowledge >= 1 && action === ACTIONS.GUARD) {
      return { advantage: 0, pressure: -1, note: '街道の痕跡を知っていたぶん、最初の射線を早く見つけた。' };
    }
    return { advantage: 0, pressure: 0, note: '' };
  }

  function addIntel(existing, plan) {
    const next = [...(Array.isArray(existing) ? existing : [])];
    if (plan.tags.includes('shot')) next.push('弓兵は崩れ石から射線を作る');
    if (plan.tags.includes('cutoff')) next.push('前衛は退路を塞ぐ役を持つ');
    if (plan.tags.includes('brace')) next.push('前衛は連続した正面攻勢を待ち構える');
    return Object.freeze([...new Set(next)]);
  }

  function injuryFor(state, plan, pressure, action) {
    if (state.injury) return state.injury;
    if (pressure < 3) return null;
    if (state.gear === GEAR.ROUND_SHIELD.id && action === ACTIONS.GUARD && plan.tags.includes('shot')) return null;
    if (plan.tags.includes('shot')) return 'arrow_graze';
    return 'wrenched_knee';
  }

  function placeStateForResult(result) {
    if (result === 'cleared') return 'road_cleared';
    if (result === 'retreated') return 'bandits_alerted';
    return 'bandits_hold_road';
  }

  function terminalState(state, result, injury, resolution, intel) {
    return Object.freeze({
      ...state,
      status: 'resolved',
      result,
      injury: injury || null,
      lastResolution: resolution,
      intel: Object.freeze([...new Set(intel || state.intel)])
    });
  }

  function resolveRetreat(state) {
    const plan = enemyPlan(state);
    const intel = addIntel(state.intel, plan);
    const hardExit = state.pressure >= 2 && state.gear !== GEAR.LIGHT_KIT.id;
    const injury = state.injury || (hardExit ? 'bruised_ribs' : null);
    const gearText = state.gear === GEAR.LIGHT_KIT.id
      ? '軽装のまま石壁の切れ目へ抜け、追撃を受けずに距離を切った。'
      : hardExit
        ? '敵に背を見せないよう下がったが、最後の押し合いで脇腹を強く打った。'
        : '間合いを保ったまま街道を離れ、二人の役割を覚えて生還した。';
    return terminalState(state, 'retreated', injury, `${gearText} 敵は街道に残る。`, intel);
  }

  function resolveRound(inputState, action) {
    if (!inputState || inputState.status !== 'active') throw new Error('active encounter is required');
    if (!Object.values(ACTIONS).includes(action)) throw new Error('invalid WEGO action');
    if (action === ACTIONS.RETREAT) return resolveRetreat(inputState);

    const plan = enemyPlan(inputState);
    const effect = EFFECTS[plan.id][action];
    const gear = gearBonus(inputState, plan, action);
    const knowledge = explorationBonus(inputState, action);
    const advantage = clamp(inputState.advantage + effect.advantage + gear.advantage + knowledge.advantage, -2, 6);
    const pressure = clamp(inputState.pressure + effect.pressure + gear.pressure + knowledge.pressure, 0, 4);
    const injury = injuryFor(inputState, plan, pressure, action);
    const intel = addIntel(inputState.intel, plan);
    const notes = [effect.text, gear.note, knowledge.note].filter(Boolean);
    if (injury && !inputState.injury) notes.push(injury === 'arrow_graze' ? '矢が腕を浅く裂いた。' : '足を捻り、踏み込みが鈍った。');

    if (advantage >= 4) {
      return terminalState(inputState, 'cleared', injury, `${notes.join(' ')} 二人は連携を保てず、街道から退いた。`, intel);
    }

    if (inputState.round >= MAX_ROUNDS) {
      const forcedInjury = injury || 'bruised_ribs';
      return terminalState(inputState, 'forced_retreat', forcedInjury, `${notes.join(' ')} 三度目の応酬で退路を優先し、押し戻されながら生還した。`, intel);
    }

    return Object.freeze({
      ...inputState,
      round: inputState.round + 1,
      advantage,
      pressure,
      injury,
      readIntent: action === ACTIONS.GUARD,
      lastAction: action,
      lastResolution: notes.join(' '),
      intel
    });
  }

  function persistentRecord(state) {
    if (!state || state.status !== 'resolved' || !VALID_RESULTS.has(state.result)) return null;
    return Object.freeze({
      version: 1,
      encounterId: ENCOUNTER_ID,
      result: state.result,
      injury: VALID_INJURIES.has(state.injury) ? state.injury : null,
      placeState: placeStateForResult(state.result),
      intel: Object.freeze([...new Set((state.intel || []).filter((value) => typeof value === 'string'))])
    });
  }

  function normalizePersistentRecord(input) {
    if (!input || input.encounterId !== ENCOUNTER_ID || !VALID_RESULTS.has(input.result)) return null;
    const placeState = VALID_PLACE_STATES.has(input.placeState) ? input.placeState : placeStateForResult(input.result);
    const injury = VALID_INJURIES.has(input.injury) ? input.injury : null;
    return Object.freeze({
      version: 1,
      encounterId: ENCOUNTER_ID,
      result: input.result,
      injury,
      placeState,
      intel: Object.freeze([...new Set((Array.isArray(input.intel) ? input.intel : []).filter((value) => typeof value === 'string'))])
    });
  }

  function serializePersistentRecord(stateOrRecord) {
    const record = stateOrRecord && stateOrRecord.status === 'resolved'
      ? persistentRecord(stateOrRecord)
      : normalizePersistentRecord(stateOrRecord);
    if (!record) throw new Error('resolved encounter record is required');
    return JSON.stringify(record);
  }

  function parsePersistentRecord(raw) {
    if (!raw) return null;
    try { return normalizePersistentRecord(JSON.parse(raw)); }
    catch (_error) { return null; }
  }

  function injuryLabel(injury) {
    return ({
      arrow_graze: '腕の浅い矢傷',
      wrenched_knee: '捻った足',
      bruised_ribs: '脇腹の打撲'
    })[injury] || '負傷なし';
  }

  function presentationForPersistent(input) {
    const record = normalizePersistentRecord(input);
    if (!record) return null;
    if (record.result === 'cleared') {
      return Object.freeze({
        mark: '追い剥ぎ排除',
        title: '街道に通れる隙間が戻った',
        text: `前衛と弓兵は退いた。${record.injury ? `${injuryLabel(record.injury)}を負ったが、` : ''}崩れ関門の手前は一度静かになった。`,
        tone: 'cleared'
      });
    }
    if (record.result === 'retreated') {
      return Object.freeze({
        mark: '敵を把握・撤退',
        title: '追い剥ぎは街道に残っている',
        text: `${record.injury ? `${injuryLabel(record.injury)}を抱えて` : ''}生還した。前衛と弓兵の役割は分かったため、次は装備を変えて戻れる。`,
        tone: 'retreated'
      });
    }
    return Object.freeze({
      mark: '敵支配が強まる',
      title: '街道は二人に押さえられた',
      text: `${injuryLabel(record.injury)}を持ち帰った。追い剥ぎは退路まで使う相手だと分かり、この道へ次に入る準備が変わる。`,
      tone: 'forced_retreat'
    });
  }

  return Object.freeze({
    STORAGE_KEY,
    ENCOUNTER_ID,
    MAX_ROUNDS,
    ACTIONS,
    GEAR,
    PLANS,
    normalizeClues,
    knowledgeLevel,
    knownInformation,
    gearDefinition,
    createEncounter,
    enemyPlan,
    intentPresentation,
    resolveRound,
    persistentRecord,
    normalizePersistentRecord,
    serializePersistentRecord,
    parsePersistentRecord,
    injuryLabel,
    presentationForPersistent
  });
});