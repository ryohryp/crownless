/**
 * Pure game rules for Crownless Expedition Slice.
 *
 * Deterministic state transitions shared between the browser runtime and node:test suite.
 * No external dependencies, side-effects, or precise coordinate storage.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CrownlessSlice = factory();
  }
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  // ==========================================================================
  // 1. Constants & Master Data
  // ==========================================================================

  const VERSION = 1;

  const PLACES = [
    {
      id: 'wood',
      name: '囁きの森',
      subtitle: '根の下に、誰かの剣が眠る。',
      terrain: 'FOREST',
      weapon: 'fang',
      enemy: 'wolf',
      reward: '牙の短剣',
      hint: '回避のあとに、一撃を返す。',
      color: '#93ae8e'
    },
    {
      id: 'tower',
      name: '鐘なき塔',
      subtitle: '鳴らない鐘を、今も守る者。',
      terrain: 'WATCHTOWER',
      weapon: 'shield',
      enemy: 'knight',
      reward: '番人の盾',
      hint: '守りを固め、敵の隙を待つ。',
      color: '#c5ad79'
    },
    {
      id: 'fen',
      name: '星沈みの湿原',
      subtitle: '水面に、消えた星が映る。',
      terrain: 'WETLAND',
      weapon: 'bow',
      enemy: 'wraith',
      reward: '葦の長弓',
      hint: '鎧を貫き、狙った獲物を射る。',
      color: '#91b4bd'
    },
    {
      id: 'crypt',
      name: '灰冠の廟',
      subtitle: '王冠だけが、主を忘れない。',
      terrain: 'ROYAL TOMB',
      weapon: 'crown',
      enemy: 'king',
      reward: '灰の王冠',
      hint: 'この小さな旅の、最初の到達点。',
      color: '#b1a0ca'
    }
  ];

  const GEAR = {
    rust: {
      name: '欠けた鉄剣',
      short: '鉄剣',
      text: '攻撃 4。強撃は気力 2 で 8 ダメージ。',
      attack: 4
    },
    fang: {
      name: '牙の短剣',
      short: '短剣',
      text: '攻撃 5。回避後の追撃が +5（通常 +3）。',
      attack: 5
    },
    shield: {
      name: '番人の盾',
      short: '剣と盾',
      text: '攻撃 4。防御で 12 軽減し、3 ダメージを返す。',
      attack: 4
    },
    bow: {
      name: '葦の長弓',
      short: '長弓',
      text: '攻撃 5。強撃が敵の守りを貫通する。',
      attack: 5
    },
    crown: {
      name: '灰の王冠',
      short: '王冠',
      text: '持ち帰った証。すべての装備で最大体力 +6。',
      attack: 4
    }
  };

  const ENEMIES = {
    wolf: {
      name: '茨牙の狼',
      hp: 16,
      pattern: ['quick', 'heavy', 'open']
    },
    knight: {
      name: '鐘守の亡兵',
      hp: 20,
      pattern: ['guard', 'heavy', 'open', 'quick']
    },
    wraith: {
      name: '沼灯の亡霊',
      hp: 17,
      pattern: ['quick', 'quick', 'open', 'heavy']
    },
    king: {
      name: '灰冠の騎士',
      hp: 27,
      pattern: ['guard', 'heavy', 'quick', 'open']
    }
  };

  const INTENTS = {
    quick: {
      name: '薙ぎ払い',
      damage: 6,
      help: '防御で受け止める。回避なら追撃の好機。'
    },
    heavy: {
      name: '大振り',
      damage: 12,
      help: '回避がおすすめ。防御だけでは削られる。'
    },
    guard: {
      name: '守りを固める',
      damage: 0,
      help: '攻撃を 5 軽減する。防御で気力を整える。'
    },
    open: {
      name: '体勢を崩している',
      damage: 0,
      help: '攻撃の好機。強撃なら大きく削れる。'
    }
  };

  // ==========================================================================
  // 2. State Helpers & Master Queries
  // ==========================================================================

  const copy = (state) => JSON.parse(JSON.stringify(state));

  const place = (id) => PLACES.find((p) => p.id === id);

  /**
   * Generates a clean initial state for a new player.
   */
  function initial() {
    return {
      version: VERSION,
      mode: null,
      unlocked: ['wood'],
      cleared: [],
      owned: ['rust'],
      equipped: 'rust',
      scrap: 0,
      level: 0,
      runs: 0,
      victories: 0,
      expedition: null,
      report: null
    };
  }

  /**
   * Computes max HP including level upgrades and Crown bonus.
   */
  function maxHp(state) {
    const baseHp = 30;
    const upgradeBonus = state.level * 5;
    const crownBonus = state.owned.includes('crown') ? 6 : 0;
    return baseHp + upgradeBonus + crownBonus;
  }

  /**
   * Calculates scrap cost for the next camp reinforcement level.
   */
  function upgradeCost(state) {
    return 8 + state.level * 6;
  }

  /**
   * Resolves the enemy's upcoming turn intent, scaling damage with depth and elite status.
   */
  function intent(enemy) {
    const pattern = ENEMIES[enemy.kind].pattern;
    const intentId = pattern[enemy.turn % pattern.length];
    const baseIntent = INTENTS[intentId];

    let damage = 0;
    if (baseIntent.damage > 0) {
      const depthBonus = enemy.depth - 1;
      const eliteBonus = enemy.elite ? 2 : 0;
      damage = baseIntent.damage + depthBonus + eliteBonus;
    }

    return {
      id: intentId,
      ...baseIntent,
      damage
    };
  }

  // ==========================================================================
  // 3. Discovery & Expedition Lifecycle
  // ==========================================================================

  /**
   * Unlocks a newly discovered place.
   */
  function discover(state, placeId) {
    if (!place(placeId) || state.unlocked.includes(placeId)) {
      return state;
    }
    const nextState = copy(state);
    nextState.unlocked.push(placeId);
    return nextState;
  }

  /**
   * Starts an expedition to an unlocked location.
   */
  function start(state, placeId) {
    const isLockedCrypt = placeId === 'crypt' && state.cleared.length < 2;
    if (
      state.expedition ||
      !state.mode ||
      !state.unlocked.includes(placeId) ||
      !place(placeId) ||
      isLockedCrypt
    ) {
      return state;
    }

    const nextState = copy(state);
    nextState.report = null;
    nextState.runs++;
    nextState.expedition = {
      place: placeId,
      depth: 1,
      room: 0,
      hp: maxHp(state),
      stamina: 3,
      focus: 0,
      potions: 2,
      scrap: 0,
      gear: [],
      seals: [],
      enemy: null,
      stage: 'path',
      log: ['火はここで待っている。まずは足跡をたどろう。']
    };
    return nextState;
  }

  /**
   * Spawns an encounter for the current room in the expedition.
   */
  function encounter(expedition, risky) {
    const placeInfo = place(expedition.place);
    const kind = placeInfo.enemy;
    const isElite = expedition.room === 4;

    const baseHp = ENEMIES[kind].hp;
    const depthHp = (expedition.depth - 1) * 6;
    const eliteHp = isElite ? 8 : 0;
    const riskyHp = risky ? 3 : 0;
    const totalHp = baseHp + depthHp + eliteHp + riskyHp;

    expedition.enemy = {
      kind,
      hp: totalHp,
      maxHp: totalHp,
      turn: 0,
      depth: expedition.depth,
      elite: isElite,
      risky
    };
    expedition.stage = 'fight';
    expedition.stamina = Math.max(2, expedition.stamina);
    expedition.focus = 0;

    let initialLog = '足音が止んだ。敵の構えをよく見よう。';
    if (isElite) {
      initialLog = '土地の主が、帰り道を塞いだ。';
    } else if (risky) {
      initialLog = '宝の気配を追った。獲物も、こちらを見ている。';
    }
    expedition.log = [initialLog];
  }

  /**
   * Concludes an expedition, banking loot if survived, or losing bag contents on defeat.
   */
  function finish(state, died) {
    const expedition = state.expedition;
    const newlyFoundGear = expedition.gear.filter((g) => !state.owned.includes(g));

    state.report = {
      died,
      place: expedition.place,
      depth: expedition.depth,
      scrap: expedition.scrap,
      gear: [...expedition.gear],
      newGear: died ? [] : newlyFoundGear,
      hp: expedition.hp,
      cleared: [...expedition.seals]
    };

    if (!died) {
      state.scrap += expedition.scrap;
      state.owned = [...new Set([...state.owned, ...expedition.gear])];
      state.cleared = [...new Set([...state.cleared, ...expedition.seals])];
      state.victories++;
    }

    state.expedition = null;
    return state;
  }

  /**
   * Resolves victory over the current enemy.
   */
  function victory(state) {
    const expedition = state.expedition;
    const currentEnemy = expedition.enemy;

    const baseLoot = currentEnemy.elite ? 5 : 2;
    const riskyLoot = currentEnemy.risky ? 3 : 0;
    const loot = baseLoot * expedition.depth + riskyLoot;

    expedition.scrap += loot;
    expedition.log.push(`討伐。鉄片を ${loot} 個、背嚢へ。生還するまで確定しない。`);

    if (currentEnemy.elite) {
      const weaponReward = place(expedition.place).weapon;
      const alreadyHave = expedition.gear.includes(weaponReward) || state.owned.includes(weaponReward);

      if (!alreadyHave) {
        expedition.gear.push(weaponReward);
        expedition.log.push(`${GEAR[weaponReward].name}を発見！ 焚き火へ持ち帰ろう。`);
      } else {
        expedition.scrap += 4;
        expedition.log.push('持っている装備の代わりに、鉄片 +4。');
      }

      expedition.seals.push(expedition.place);
      expedition.stage = 'cleared';
    } else {
      expedition.room++;
      expedition.stage = 'path';
    }

    expedition.enemy = null;
  }

  // ==========================================================================
  // 4. Action Handler
  // ==========================================================================

  /**
   * Dispatches player actions during an ongoing expedition.
   */
  function act(state, action) {
    const nextState = copy(state);
    const expedition = nextState.expedition;
    if (!expedition) return state;

    // --- Safe Return ---
    if (action === 'return' && expedition.stage !== 'fight') {
      return finish(nextState, false);
    }

    // --- Potion Healing ---
    if (action === 'heal' && expedition.potions > 0 && expedition.hp < maxHp(nextState)) {
      expedition.potions--;
      const healAmount = Math.min(12, maxHp(nextState) - expedition.hp);
      expedition.hp += healAmount;

      const contextText = expedition.stage === 'fight' ? '使う間に敵が動く。' : '息を整えた。';
      expedition.log = [`薬草で体力 +${healAmount}。${contextText}`];

      if (expedition.stage !== 'fight') {
        return nextState;
      }
    } else if (expedition.stage === 'cleared' && action === 'deeper' && expedition.depth < 3) {
      // --- Advance to Deeper Layer ---
      expedition.depth++;
      expedition.room = 0;
      expedition.stage = 'path';
      expedition.log = ['さらに深く。敵の体力と攻撃、持ち帰れる鉄片が増える。'];
      return nextState;
    } else if (expedition.stage === 'path') {
      // --- Path Stage: Events (rooms 1, 3) or Approaching Enemies ---
      const isRestRoom = [1, 3].includes(expedition.room);
      if (isRestRoom) {
        if (!['rest', 'search'].includes(action)) return state;
        if (action === 'rest') {
          expedition.hp = Math.min(maxHp(nextState), expedition.hp + 6);
          expedition.log = ['小さな灯りのそばで休んだ。体力 +6。'];
        } else {
          // search
          expedition.hp -= 4;
          const scrapGain = 5 * expedition.depth;
          expedition.scrap += scrapGain;
          expedition.log = [`茨の中の遺品を拾う。体力 −4 / 鉄片 +${scrapGain}。`];
        }
        expedition.room++;
        if (expedition.hp <= 0) {
          return finish(nextState, true);
        }
        return nextState;
      }

      if (!['careful', 'risky'].includes(action)) return state;
      encounter(expedition, action === 'risky');
      return nextState;
    } else if (expedition.stage === 'fight') {
      // --- Combat Stage Validation ---
      const allowedCombatActions = ['strike', 'heavy', 'guard', 'dodge', 'flee'];
      if (!allowedCombatActions.includes(action)) return state;
      if (action === 'heavy' && expedition.stamina < 2) return state;
      if (action === 'dodge' && expedition.stamina < 1) return state;
      expedition.log = [];
    } else {
      return state;
    }

    // --- Combat Action Resolution ---
    const currentEnemy = expedition.enemy;
    const nextIntent = intent(currentEnemy);
    const playerWeapon = GEAR[nextState.equipped];

    // Fleeing
    if (action === 'flee') {
      const escapeDamage = Math.max(2, nextIntent.damage);
      expedition.hp -= escapeDamage;
      return finish(nextState, expedition.hp <= 0);
    }

    // Offensive Actions: Strike & Heavy
    let dealtDamage = 0;
    if (action === 'strike' || action === 'heavy') {
      const isHeavy = action === 'heavy';
      const heavyBonus = isHeavy ? 4 : 0;
      dealtDamage = playerWeapon.attack + heavyBonus + expedition.focus;

      // Enemy Guard mitigation: Bow's heavy attack pierces guard
      const isBowHeavy = nextState.equipped === 'bow' && isHeavy;
      if (nextIntent.id === 'guard' && !isBowHeavy) {
        dealtDamage = Math.max(0, dealtDamage - 5);
      }

      // Stamina & Focus adjustments
      const staminaDelta = isHeavy ? -2 : 1;
      expedition.stamina = Math.min(3, expedition.stamina + staminaDelta);
      expedition.focus = 0;
    }

    // Defensive Action: Guard
    if (action === 'guard') {
      expedition.stamina = Math.min(3, expedition.stamina + 1);
      if (nextState.equipped === 'shield' && nextIntent.damage > 0) {
        dealtDamage = 3; // Shield retaliatory damage
      }
    }

    // Defensive Action: Dodge
    if (action === 'dodge') {
      expedition.stamina--;
      expedition.focus = nextState.equipped === 'fang' ? 5 : 3;
    }

    // Apply player damage to enemy
    currentEnemy.hp = Math.max(0, currentEnemy.hp - dealtDamage);
    if (dealtDamage > 0) {
      expedition.log.push(`こちらの一撃。${dealtDamage} ダメージ。`);
    }

    // Check if enemy defeated
    if (currentEnemy.hp <= 0) {
      victory(nextState);
      return nextState;
    }

    // Calculate damage taken from enemy intent
    let blockPower = 0;
    if (action === 'guard') {
      blockPower = nextState.equipped === 'shield' ? 12 : 9;
    }

    const takenDamage = action === 'dodge' ? 0 : Math.max(0, nextIntent.damage - blockPower);
    expedition.hp -= takenDamage;

    if (action === 'dodge') {
      expedition.log.push(`身をかわした。次の攻撃 +${expedition.focus}。`);
    } else if (takenDamage > 0) {
      expedition.log.push(`${nextIntent.name}。体力 −${takenDamage}。`);
    } else if (nextIntent.damage > 0) {
      expedition.log.push('攻撃を受け止めた。体力消費なし。');
    } else {
      expedition.log.push('敵は攻撃してこない。');
    }

    currentEnemy.turn++;

    // Check player defeat
    if (expedition.hp <= 0) {
      return finish(nextState, true);
    }

    return nextState;
  }

  // ==========================================================================
  // 5. Equipment & Progression
  // ==========================================================================

  /**
   * Equips owned gear (weapons only; Crown is a passive trophy).
   */
  function equip(state, gearId) {
    if (
      state.expedition ||
      !state.owned.includes(gearId) ||
      !GEAR[gearId] ||
      gearId === 'crown'
    ) {
      return state;
    }
    const nextState = copy(state);
    nextState.equipped = gearId;
    return nextState;
  }

  /**
   * Upgrades player level at the camp using banked scrap.
   */
  function upgrade(state) {
    const cost = upgradeCost(state);
    if (state.expedition || state.level >= 4 || state.scrap < cost) {
      return state;
    }
    const nextState = copy(state);
    nextState.scrap -= cost;
    nextState.level++;
    return nextState;
  }

  // ==========================================================================
  // 6. Location & Spatial Observation
  // Only explicit, stationary fixes are used. Coordinates exist only in session.
  // ==========================================================================

  const locationSession = () => ({ anchor: null });

  /**
   * Evaluates a stationary geolocation fix relative to the session's anchor.
   * Returns:
   *  - 'inaccurate' if fix is missing, out-of-range, or has poor accuracy
   *  - 'moving' if speed indicates the user is walking or driving
   *  - 'anchored' if this is the first valid fix of the session
   *  - 'nearby' if the distance from anchor is under 150m + accuracies
   *  - 'discovered' with placeId if far enough in a relative geographic direction
   */
  function observe(session, fix) {
    const isInvalidCoordinate =
      !fix ||
      !Number.isFinite(fix.latitude) ||
      Math.abs(fix.latitude) > 90 ||
      !Number.isFinite(fix.longitude) ||
      Math.abs(fix.longitude) > 180 ||
      !Number.isFinite(fix.accuracy) ||
      fix.accuracy < 0 ||
      fix.accuracy > 60;

    if (isInvalidCoordinate) {
      return { status: 'inaccurate' };
    }

    if (Number.isFinite(fix.speed) && fix.speed > 1.5) {
      return { status: 'moving' };
    }

    if (!session.anchor) {
      session.anchor = {
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy: fix.accuracy
      };
      return { status: 'anchored' };
    }

    const anchor = session.anchor;
    const northMeters = (fix.latitude - anchor.latitude) * 111320;
    const deltaLongitude = ((fix.longitude - anchor.longitude + 540) % 360) - 180;
    const eastMeters = deltaLongitude * 111320 * Math.cos((anchor.latitude * Math.PI) / 180);
    const distanceMeters = Math.hypot(northMeters, eastMeters);

    const minDistanceThreshold = 150 + anchor.accuracy + fix.accuracy;
    if (distanceMeters < minDistanceThreshold) {
      return { status: 'nearby' };
    }

    // Four broad relative regions; no trail, coordinates, bearing or grid identifiers saved.
    let placeId;
    if (Math.abs(northMeters) > Math.abs(eastMeters)) {
      placeId = northMeters > 0 ? 'tower' : 'crypt';
    } else {
      placeId = eastMeters > 0 ? 'fen' : 'wood';
    }

    return { status: 'discovered', place: placeId };
  }

  // ==========================================================================
  // 7. Save Serialization & Schema Validation
  // ==========================================================================

  function serialize(state) {
    return JSON.stringify(state);
  }

  /**
   * Safely deserializes and validates a saved game state.
   * Returns initial state on missing data, or null on invalid / corrupted schema.
   */
  function parse(rawJson) {
    if (!rawJson) return initial();

    try {
      const state = JSON.parse(rawJson);
      const placeIds = PLACES.map((p) => p.id);
      const validTopKeys = Object.keys(initial());

      const isValidArray = (arr, allowedSet) =>
        Array.isArray(arr) &&
        arr.length <= allowedSet.length &&
        new Set(arr).size === arr.length &&
        arr.every((val) => allowedSet.includes(val));

      const isIntInRange = (num, min, max) =>
        Number.isInteger(num) && num >= min && num <= max;

      const isInvalidTopStructure =
        state.version !== VERSION ||
        Object.keys(state).some((k) => !validTopKeys.includes(k)) ||
        ![null, 'demo', 'walk'].includes(state.mode) ||
        !isValidArray(state.unlocked, placeIds) ||
        !state.unlocked.includes('wood') ||
        !isValidArray(state.cleared, placeIds) ||
        !isValidArray(state.owned, Object.keys(GEAR)) ||
        !state.owned.includes('rust') ||
        !state.owned.includes(state.equipped) ||
        state.equipped === 'crown' ||
        !isIntInRange(state.level, 0, 4) ||
        !isIntInRange(state.scrap, 0, 1e9) ||
        !isIntInRange(state.runs, 0, 1e9) ||
        !isIntInRange(state.victories, 0, state.runs);

      if (isInvalidTopStructure) {
        throw new Error('Invalid top-level state schema');
      }

      // Validate the active expedition if one is saved
      if (state.expedition) {
        const exp = state.expedition;
        const validExpKeys = [
          'place', 'depth', 'room', 'hp', 'stamina', 'focus',
          'potions', 'scrap', 'gear', 'seals', 'enemy', 'stage', 'log'
        ];

        const isInvalidExpedition =
          Object.keys(exp).some((k) => !validExpKeys.includes(k)) ||
          !state.unlocked.includes(exp.place) ||
          !isIntInRange(exp.depth, 1, 3) ||
          !isIntInRange(exp.room, 0, 4) ||
          !isIntInRange(exp.hp, 1, maxHp(state)) ||
          !isIntInRange(exp.stamina, 0, 3) ||
          ![0, 3, 5].includes(exp.focus) ||
          !isIntInRange(exp.potions, 0, 2) ||
          !isIntInRange(exp.scrap, 0, 1000) ||
          !isValidArray(exp.gear, Object.keys(GEAR)) ||
          !Array.isArray(exp.seals) ||
          exp.seals.length > 3 ||
          !exp.seals.every((v) => placeIds.includes(v)) ||
          !['path', 'fight', 'cleared'].includes(exp.stage) ||
          !Array.isArray(exp.log) ||
          exp.log.length > 8 ||
          !exp.log.every((v) => typeof v === 'string' && v.length < 250);

        if (isInvalidExpedition) {
          throw new Error('Invalid expedition schema');
        }

        if (exp.stage === 'fight') {
          const enemyObj = exp.enemy;
          const validEnemyKeys = ['kind', 'hp', 'maxHp', 'turn', 'depth', 'elite', 'risky'];
          const isInvalidEnemy =
            !enemyObj ||
            Object.keys(enemyObj).some((k) => !validEnemyKeys.includes(k)) ||
            !ENEMIES[enemyObj.kind] ||
            !isIntInRange(enemyObj.maxHp, 1, 80) ||
            !isIntInRange(enemyObj.hp, 1, enemyObj.maxHp) ||
            !isIntInRange(enemyObj.turn, 0, 1e6) ||
            enemyObj.depth !== exp.depth ||
            typeof enemyObj.elite !== 'boolean' ||
            typeof enemyObj.risky !== 'boolean';

          if (isInvalidEnemy) {
            throw new Error('Invalid enemy schema in fight stage');
          }
        } else if (exp.enemy !== null) {
          throw new Error('Enemy must be null outside of fight stage');
        }
      }

      // Validate the last expedition report if present
      if (state.report) {
        const rep = state.report;
        const validReportKeys = [
          'died', 'place', 'depth', 'scrap', 'gear', 'newGear', 'hp', 'cleared'
        ];

        const isInvalidReport =
          Object.keys(rep).some((k) => !validReportKeys.includes(k)) ||
          typeof rep.died !== 'boolean' ||
          !placeIds.includes(rep.place) ||
          !isIntInRange(rep.depth, 1, 3) ||
          !isIntInRange(rep.scrap, 0, 1000) ||
          !isValidArray(rep.gear, Object.keys(GEAR)) ||
          !isValidArray(rep.newGear, Object.keys(GEAR)) ||
          !isIntInRange(rep.hp, -30, 80) ||
          !Array.isArray(rep.cleared) ||
          rep.cleared.length > 3 ||
          !rep.cleared.every((v) => placeIds.includes(v));

        if (isInvalidReport) {
          throw new Error('Invalid report schema');
        }
      }

      return state;
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // Public API Export
  // ==========================================================================

  return {
    VERSION,
    PLACES,
    GEAR,
    ENEMIES,
    INTENTS,
    initial,
    maxHp,
    upgradeCost,
    intent,
    place,
    discover,
    start,
    act,
    equip,
    upgrade,
    locationSession,
    observe,
    serialize,
    parse
  };
});
