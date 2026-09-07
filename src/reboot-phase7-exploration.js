(function (root, factory) {
  const api = factory(
    root && root.CrownlessRebootPhase3State,
    root && root.CrownlessRebootPhase4State,
    root && root.CrownlessRebootPhase6Location
  );
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./reboot-phase3-state.js'),
      require('./reboot-phase4-state.js'),
      require('./reboot-phase6-location.js')
    );
  }
  if (root) root.CrownlessRebootPhase7Exploration = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (p3, p4, locationModel) {
  'use strict';
  if (!p3 || !p4 || !locationModel) throw new Error('Crownless Reboot Phase 6 location model is required');

  const TREND_THRESHOLD_METERS = 8;

  const CLUE_DEFINITIONS = Object.freeze({
    [p4.SALT_CHAPEL]: Object.freeze({
      noticed: Object.freeze(['鈍い鐘の音']),
      near: Object.freeze(['湿った石と蝋の匂い', '人が息を潜める気配'])
    }),
    [p4.RUINED_GATE]: Object.freeze({
      noticed: Object.freeze(['車輪と石を打つ音']),
      near: Object.freeze(['崩れた石壁', '誰かが道を塞ぐ気配'])
    })
  });

  const STAGE_RANK = Object.freeze({ far: 0, noticed: 1, near: 2, discovered: 3 });

  const FIELD_SECTORS = Object.freeze([
    'north',
    'north_east',
    'east',
    'south_east',
    'south',
    'south_west',
    'west',
    'north_west'
  ]);

  const FIELD_SECTOR_LABELS = Object.freeze({
    north: '北',
    north_east: '北東',
    east: '東',
    south_east: '南東',
    south: '南',
    south_west: '南西',
    west: '西',
    north_west: '北西'
  });

  const FIELD_STAGE_RANK = Object.freeze({ unseen: 0, faint: 1, trace: 2, encounter: 3 });
  const FIELD_STAGE_LABELS = Object.freeze({ unseen: '未接触', faint: '気配', trace: '痕跡', encounter: '遭遇' });

  const FIELD_THREADS = Object.freeze({
    north: Object.freeze({
      title: '高みの煙',
      faint: Object.freeze({ text: '風の上に、焚き火とは違う細い煙が混じった。', clue: '冷たい煙' }),
      trace: Object.freeze({ text: '煙の下で、石を三つ積んだ見張り印を見つけた。誰かが遠くを見ている。', clue: '石積みの見張り印' }),
      encounter: Object.freeze({ text: '崩れた見張り台に着いた。火は消えたばかりで、遠方へ向けた矢印だけが灰に残っている。', clue: '消えたばかりの見張り火' })
    }),
    north_east: Object.freeze({
      title: '黒羽の伝令',
      faint: Object.freeze({ text: '草の間に、濡れていない黒い羽が一枚だけ落ちている。', clue: '黒い羽' }),
      trace: Object.freeze({ text: '細い革紐と封蝋の欠片が続いている。伝令が何かを落としたらしい。', clue: '切れた伝令紐' }),
      encounter: Object.freeze({ text: '倒れた伝令袋を見つけた。中身は抜かれているが、丘の印だけが泥に押し付けられている。', clue: '空の伝令袋' })
    }),
    east: Object.freeze({
      title: '逃げた獣',
      faint: Object.freeze({ text: '低い藪が一方向だけ折れ、土が新しく抉れている。', clue: '折れた藪' }),
      trace: Object.freeze({ text: '蹄の跡に細い血が混じる。追われた家畜か、荷を捨てた騎馬が通った。', clue: '血の混じる蹄跡' }),
      encounter: Object.freeze({ text: '縄を引きずる痩せた山羊が石陰にいる。首輪には知らない家の焼印が残っている。', clue: '焼印のある逃げ山羊' })
    }),
    south_east: Object.freeze({
      title: '水を隠す者',
      faint: Object.freeze({ text: '乾いた地面に、そこだけ湿った土の匂いがある。', clue: '湿った土' }),
      trace: Object.freeze({ text: '桶を引きずった跡が草へ消える。道から見えない場所へ水を運んでいる。', clue: '桶を引いた跡' }),
      encounter: Object.freeze({ text: '石板で隠された浅い井戸を見つけた。縁には「兵に見せるな」と古い刻みがある。', clue: '隠された井戸' })
    }),
    south: Object.freeze({
      title: '名のない墓標',
      faint: Object.freeze({ text: '風に乾いた香草の匂いが混じる。誰かが最近ここへ置いたものだ。', clue: '乾いた香草' }),
      trace: Object.freeze({ text: '道端に小石が並び、踏まれないよう半円を作っている。', clue: '半円の石並び' }),
      encounter: Object.freeze({ text: '名のない墓標に着いた。新しい土の上に、王兵と自由民の印が一つずつ置かれている。', clue: '二つの印がある墓標' })
    }),
    south_west: Object.freeze({
      title: '谷の灯',
      faint: Object.freeze({ text: '谷側から、風に消されかけた硬い音が一度だけ届く。', clue: '谷の硬い響き' }),
      trace: Object.freeze({ text: '湿った石と蝋の匂いが濃くなる。人が声を抑えて集まっている。', clue: '湿った石と蝋' }),
      encounter: Object.freeze({ text: '低い石壁の向こうに、人影と吊られた鐘が見える。ここにも丘の選択が先回りしている。', clue: '人影と吊られた鐘' })
    }),
    west: Object.freeze({
      title: '崩れ街道',
      faint: Object.freeze({ text: '乾いた土埃の向こうで、木と石がぶつかる音がする。', clue: '木と石の乾いた音' }),
      trace: Object.freeze({ text: '荷車の轍が途中で乱れ、崩れた石を急いで積み直した跡がある。', clue: '乱れた轍と積み石' }),
      encounter: Object.freeze({ text: '崩れた関門の手前に人が集まっている。丘から届いた情報が、ここで誰かを動かしている。', clue: '人が集まる崩れ関門' })
    }),
    north_west: Object.freeze({
      title: '消えた野営',
      faint: Object.freeze({ text: '灰の匂いだけが残り、煙はもう見えない。', clue: '冷えた灰の匂い' }),
      trace: Object.freeze({ text: '草を伏せた寝床が複数ある。皆、同じ方向へ急に立ち去っている。', clue: '急に捨てられた寝床' }),
      encounter: Object.freeze({ text: '空になった野営地に着いた。鍋だけが残り、その底に街道の紋が煤で描かれている。', clue: '街道の紋がある鍋' })
    })
  });

  function createClueMemory() {
    return Object.freeze({
      [p4.SALT_CHAPEL]: Object.freeze([]),
      [p4.RUINED_GATE]: Object.freeze([])
    });
  }

  function normalizeMemory(input) {
    const next = {};
    for (const placeId of [p4.SALT_CHAPEL, p4.RUINED_GATE]) {
      const values = input && Array.isArray(input[placeId]) ? input[placeId] : [];
      next[placeId] = Object.freeze([...new Set(values.filter((value) => typeof value === 'string'))]);
    }
    return Object.freeze(next);
  }

  function trendForDistance(previousDistance, currentDistance) {
    if (!Number.isFinite(Number(previousDistance))) return 'unknown';
    const delta = Number(previousDistance) - Number(currentDistance);
    if (delta > TREND_THRESHOLD_METERS) return 'closer';
    if (delta < -TREND_THRESHOLD_METERS) return 'farther';
    return 'steady';
  }

  function trendLabel(trend) {
    return ({
      closer: '近づいた',
      farther: '遠のいた',
      steady: 'ほぼ変わらない',
      unknown: 'まだ比べられない'
    })[trend] || 'まだ比べられない';
  }

  function cluesUnlocked(placeId, strength) {
    const definition = CLUE_DEFINITIONS[placeId] || {};
    const rank = STAGE_RANK[strength] || 0;
    const clues = [];
    if (rank >= STAGE_RANK.noticed) clues.push(...(definition.noticed || []));
    if (rank >= STAGE_RANK.near) clues.push(...(definition.near || []));
    return clues;
  }

  function remember(memoryInput, senses) {
    const memory = normalizeMemory(memoryInput);
    const next = {};
    for (const placeId of [p4.SALT_CHAPEL, p4.RUINED_GATE]) {
      const sense = senses.find((item) => item.placeId === placeId);
      next[placeId] = Object.freeze([
        ...new Set([
          ...(memory[placeId] || []),
          ...cluesUnlocked(placeId, sense ? sense.strength : 'far')
        ])
      ]);
    }
    return Object.freeze(next);
  }

  function movementNote(senses) {
    const valley = senses.find((item) => item.placeId === p4.SALT_CHAPEL);
    const road = senses.find((item) => item.placeId === p4.RUINED_GATE);
    if (!valley || !road || valley.trend === 'unknown' || road.trend === 'unknown') {
      return '少し動いて、二つの気配がどう変わるか確かめる。';
    }

    if (valley.trend === 'closer' && road.trend === 'closer') {
      return '二つの気配がともに濃くなった。分岐の間へ入り込んでいる。';
    }
    if (valley.trend === 'farther' && road.trend === 'farther') {
      return 'どちらの気配も遠のいた。いまの移動では手掛かりから離れている。';
    }
    if (valley.trend === 'closer' && road.trend === 'farther') {
      return '谷側の気配だけが濃くなった。街道側は遠のいた。';
    }
    if (road.trend === 'closer' && valley.trend === 'farther') {
      return '街道側の気配だけが濃くなった。谷側は遠のいた。';
    }
    if (valley.trend === 'closer') return '谷側の気配が濃くなった。もう一方は大きく変わらない。';
    if (road.trend === 'closer') return '街道側の気配が濃くなった。もう一方は大きく変わらない。';
    if (valley.trend === 'farther') return '谷側の気配が遠のいた。街道側は大きく変わらない。';
    if (road.trend === 'farther') return '街道側の気配が遠のいた。谷側は大きく変わらない。';
    return '二つの気配はほとんど変わらない。別の方向を試す余地がある。';
  }

  function observe(previousSession, currentSession, memoryInput) {
    const currentSenses = locationModel.senseAll(currentSession);
    const previousSenses = previousSession ? locationModel.senseAll(previousSession) : [];
    const senses = currentSenses.map((sense) => {
      const previous = previousSenses.find((item) => item.placeId === sense.placeId);
      const trend = trendForDistance(previous && previous.distance, sense.distance);
      return Object.freeze({
        ...sense,
        trend,
        trendLabel: trendLabel(trend)
      });
    });
    const memory = remember(memoryInput, senses);
    return Object.freeze({
      senses: Object.freeze(senses),
      memory,
      note: movementNote(senses)
    });
  }

  function createThreadMemory() {
    const memory = {};
    for (const sector of FIELD_SECTORS) {
      memory[sector] = Object.freeze({ stage: 'unseen', clues: Object.freeze([]) });
    }
    return Object.freeze(memory);
  }

  function normalizeThreadMemory(input) {
    const memory = {};
    for (const sector of FIELD_SECTORS) {
      const entry = input && input[sector] && typeof input[sector] === 'object' ? input[sector] : {};
      const stage = Object.prototype.hasOwnProperty.call(FIELD_STAGE_RANK, entry.stage) ? entry.stage : 'unseen';
      const clues = Array.isArray(entry.clues)
        ? [...new Set(entry.clues.filter((value) => typeof value === 'string'))]
        : [];
      memory[sector] = Object.freeze({ stage, clues: Object.freeze(clues) });
    }
    return Object.freeze(memory);
  }

  function displacementMeters(position) {
    const x = Number(position && position.x);
    const y = Number(position && position.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
    return Math.hypot(x, y);
  }

  function sectorForPosition(position) {
    const distance = displacementMeters(position);
    if (distance < 18) return null;
    const x = Number(position.x);
    const y = Number(position.y);
    const degrees = (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
    return FIELD_SECTORS[Math.round(degrees / 45) % FIELD_SECTORS.length];
  }

  function fieldStageForDisplacement(distance) {
    const value = Number(distance);
    if (!Number.isFinite(value) || value < 18) return 'unseen';
    if (value >= 105) return 'encounter';
    if (value >= 62) return 'trace';
    return 'faint';
  }

  function threadDefinition(sector, world) {
    const base = FIELD_THREADS[sector];
    if (!base) return null;
    const hillChoice = world && world.choices && world.choices[p3.BLACK_RAVEN_HILL];

    if (sector === 'south_west' && hillChoice === p3.CHOICES.SIGNAL_CHAPEL) {
      return Object.freeze({
        ...base,
        title: '警告を受けた谷',
        trace: Object.freeze({ text: '湿った石の陰で、人々が丘の合図を見たと囁いている。鐘には音を殺す布が巻かれた。', clue: '布を巻かれた鐘' }),
        encounter: Object.freeze({ text: '谷の石壁に着くと、人々はすでに荷をまとめていた。あなたが丘で送った警告がここまで届いている。', clue: '警告で動き始めた人々' })
      });
    }
    if (sector === 'south_west' && hillChoice === p3.CHOICES.SIGNAL_GATE) {
      return Object.freeze({
        ...base,
        title: '合図の届かなかった谷',
        trace: Object.freeze({ text: '鐘は無防備に揺れ、人々は丘で何が起きたか知らないまま集まっている。', clue: '無防備に鳴る鐘' }),
        encounter: Object.freeze({ text: '谷の石壁に着いた。丘から警告を送らなかったため、ここではまだ誰も荷をまとめていない。', clue: '警告を知らない人々' })
      });
    }
    if (sector === 'west' && hillChoice === p3.CHOICES.SIGNAL_GATE) {
      return Object.freeze({
        ...base,
        title: '備えられた街道',
        trace: Object.freeze({ text: '崩れ石は意図的に積み直され、荷車を一台ずつ通す狭い口が作られている。丘の合図を見た者の仕事だ。', clue: '合図で組まれた barricade'.replace(' barricade', '防柵') }),
        encounter: Object.freeze({ text: '関門の手前に着くと、見張りがすでに配置されていた。あなたが丘で送った合図が街道を変えている。', clue: '合図で配置された見張り' })
      });
    }
    if (sector === 'west' && hillChoice === p3.CHOICES.SIGNAL_CHAPEL) {
      return Object.freeze({
        ...base,
        title: '無警戒の街道',
        trace: Object.freeze({ text: '崩れ石は放置され、荷車の轍だけが無理にその脇を抜けている。丘の合図はここへ来なかった。', clue: '放置された崩れ石' }),
        encounter: Object.freeze({ text: '関門の手前に着いた。丘から警告を送らなかったため、人々は近づく者を見て初めて立ち上がる。', clue: '遅れて立ち上がる見張り' })
      });
    }
    return base;
  }

  function cluesForThread(definition, stage) {
    if (!definition || !Object.prototype.hasOwnProperty.call(FIELD_STAGE_RANK, stage)) return [];
    const rank = FIELD_STAGE_RANK[stage];
    const clues = [];
    for (const candidate of ['faint', 'trace', 'encounter']) {
      if (FIELD_STAGE_RANK[candidate] <= rank && definition[candidate] && definition[candidate].clue) {
        clues.push(definition[candidate].clue);
      }
    }
    return clues;
  }

  function rememberThread(memoryInput, sector, stage, definition) {
    const memory = normalizeThreadMemory(memoryInput);
    if (!sector || !definition || stage === 'unseen') return memory;
    const current = memory[sector];
    const strongest = FIELD_STAGE_RANK[stage] > FIELD_STAGE_RANK[current.stage] ? stage : current.stage;
    const next = { ...memory };
    next[sector] = Object.freeze({
      stage: strongest,
      clues: Object.freeze([
        ...new Set([...(current.clues || []), ...cluesForThread(definition, stage)])
      ])
    });
    return Object.freeze(next);
  }

  function threadMemoryEntries(memoryInput, world) {
    const memory = normalizeThreadMemory(memoryInput);
    return Object.freeze(FIELD_SECTORS
      .filter((sector) => memory[sector].stage !== 'unseen')
      .map((sector) => {
        const definition = threadDefinition(sector, world);
        return Object.freeze({
          sector,
          direction: FIELD_SECTOR_LABELS[sector],
          title: definition ? definition.title : '未知の気配',
          stage: memory[sector].stage,
          stageLabel: FIELD_STAGE_LABELS[memory[sector].stage],
          clues: memory[sector].clues
        });
      }));
  }

  function observeFieldThreads(currentSession, memoryInput, world) {
    const distance = displacementMeters(currentSession);
    const sector = sectorForPosition(currentSession);
    if (!sector) {
      const memory = normalizeThreadMemory(memoryInput);
      return Object.freeze({
        memory,
        response: null,
        entries: threadMemoryEntries(memory, world),
        note: '安全に歩ける方向なら、どちらへ踏み出しても世界の筋が立ち上がる。'
      });
    }

    const stage = fieldStageForDisplacement(distance);
    const definition = threadDefinition(sector, world);
    const memory = rememberThread(memoryInput, sector, stage, definition);
    const response = Object.freeze({
      sector,
      direction: FIELD_SECTOR_LABELS[sector],
      title: definition.title,
      stage,
      stageLabel: FIELD_STAGE_LABELS[stage],
      text: definition[stage].text,
      clues: memory[sector].clues
    });
    const note = stage === 'encounter'
      ? `${response.direction}で小さな出来事に辿り着いた。この方向も世界の一部だった。`
      : stage === 'trace'
        ? `${response.direction}の気配が具体的な痕跡になった。引き返しても、この探索中は覚えている。`
        : `${response.direction}へ踏み出したことで、そこにあった気配が見えるようになった。`;

    return Object.freeze({
      memory,
      response,
      entries: threadMemoryEntries(memory, world),
      note
    });
  }

  return Object.freeze({
    TREND_THRESHOLD_METERS,
    CLUE_DEFINITIONS,
    FIELD_SECTORS,
    FIELD_SECTOR_LABELS,
    FIELD_THREADS,
    createClueMemory,
    normalizeMemory,
    trendForDistance,
    trendLabel,
    cluesUnlocked,
    remember,
    movementNote,
    observe,
    createThreadMemory,
    normalizeThreadMemory,
    displacementMeters,
    sectorForPosition,
    fieldStageForDisplacement,
    threadDefinition,
    cluesForThread,
    rememberThread,
    threadMemoryEntries,
    observeFieldThreads
  });
});
