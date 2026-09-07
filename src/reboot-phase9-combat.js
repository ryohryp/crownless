(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CrownlessRebootPhase9Combat = api;
  if (root && root.document) api.bootstrap(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'crownless_reboot_phase9_world_v1';
  const OUTCOMES = Object.freeze({ DEFEATED: 'defeated', ESCAPED: 'escaped' });
  const COMBAT_STATES = Object.freeze({ IDLE: 'idle', ENGAGED: 'engaged', WON: 'won', ESCAPED: 'escaped' });

  const ENCOUNTERS = Object.freeze({
    north: Object.freeze({
      id: 'high_watch_scouts',
      sector: 'north',
      threadTitle: '高みの煙',
      title: '灰矢の斥候',
      intro: '崩れた見張り台へ近づくと、消えたはずの火の陰から二人の斥候が立ち上がった。ここで戦うか、見張りが残ることを承知で退くか。',
      enemies: Object.freeze([
        Object.freeze({ id: 'scout_rusher', name: '灰矢の斥候', role: 'rusher', hp: 2, position: 61 }),
        Object.freeze({ id: 'scout_guard', name: '灰矢の盾持ち', role: 'guard', hp: 2, position: 82 })
      ]),
      defeated: Object.freeze({
        title: '高みの煙 / 見張りは沈黙した',
        text: '灰矢の斥候を退け、見張り火を消した。灰に残る東向きの印が、次に読むべき方角として地図へ刻まれた。',
        mark: '消えた見張り火・東向きの灰印'
      }),
      escaped: Object.freeze({
        title: '高みの煙 / 見張りは残った',
        text: '斥候との接触から退いた。見張り火は残り、北の空に二筋の煙が上がった。ここは警戒された土地として地図に残る。',
        mark: '二筋の警戒煙'
      })
    }),
    north_west: Object.freeze({
      id: 'abandoned_camp_returners',
      sector: 'north_west',
      threadTitle: '消えた野営',
      title: '野営へ戻る略奪者',
      intro: '空だった野営地へ、街道の紋をつけた二人が戻ってきた。鍋の煤印を見られたと気づき、道を塞ぐ。戦う必要はない。退けば、この一団が残ったこと自体が世界の結果になる。',
      enemies: Object.freeze([
        Object.freeze({ id: 'camp_rusher', name: '街道の荒くれ', role: 'rusher', hp: 2, position: 58 }),
        Object.freeze({ id: 'camp_guard', name: '煤盾の男', role: 'guard', hp: 2, position: 80 })
      ]),
      defeated: Object.freeze({
        title: '消えた野営 / 戻り道を断った',
        text: '野営へ戻った略奪者を退けた。煤で描かれた街道紋の横に南西へ逃げた足跡が残り、別の世界の筋が地図へ伸びた。',
        mark: '煤の街道紋・南西への逃走跡'
      }),
      escaped: Object.freeze({
        title: '消えた野営 / 火が戻った',
        text: '戦わず野営を離れた。背後で火が起こされ、消えていた煙が再び上がる。北西には人が戻った野営として新しい警戒印が残る。',
        mark: '戻った野営火・北西の警戒印'
      })
    })
  });

  const ENCOUNTER_BY_ID = Object.freeze(Object.values(ENCOUNTERS).reduce((result, encounter) => {
    result[encounter.id] = encounter;
    return result;
  }, {}));

  function normalizeWorldState(input) {
    const encounters = {};
    const source = input && input.encounters && typeof input.encounters === 'object' ? input.encounters : {};
    for (const encounter of Object.values(ENCOUNTERS)) {
      const outcome = source[encounter.id];
      if (outcome === OUTCOMES.DEFEATED || outcome === OUTCOMES.ESCAPED) encounters[encounter.id] = outcome;
    }
    return { version: 1, encounters };
  }

  function parseWorldState(raw) {
    if (!raw) return normalizeWorldState({});
    try { return normalizeWorldState(JSON.parse(raw)); }
    catch (_error) { return normalizeWorldState({}); }
  }

  function serializeWorldState(state) {
    return JSON.stringify(normalizeWorldState(state));
  }

  function resolveWorldState(inputState, encounterId, outcome) {
    if (!ENCOUNTER_BY_ID[encounterId]) throw new Error('unknown Phase 9 encounter');
    if (outcome !== OUTCOMES.DEFEATED && outcome !== OUTCOMES.ESCAPED) throw new Error('invalid Phase 9 outcome');
    const state = normalizeWorldState(inputState);
    const existing = state.encounters[encounterId];
    if (existing && existing !== outcome) throw new Error('Phase 9 encounter outcome is irreversible');
    if (existing === outcome) return state;
    return normalizeWorldState({ ...state, encounters: { ...state.encounters, [encounterId]: outcome } });
  }

  function encounterForThread(sector, stage) {
    if (stage !== 'encounter') return null;
    return ENCOUNTERS[sector] || null;
  }

  function outcomePresentation(encounterId, outcome) {
    const encounter = ENCOUNTER_BY_ID[encounterId];
    if (!encounter) return null;
    if (outcome === OUTCOMES.DEFEATED) return encounter.defeated;
    if (outcome === OUTCOMES.ESCAPED) return encounter.escaped;
    return null;
  }

  function createCombat(encounterId) {
    const encounter = ENCOUNTER_BY_ID[encounterId];
    if (!encounter) throw new Error('unknown Phase 9 encounter');
    return {
      encounterId,
      mode: COMBAT_STATES.IDLE,
      reason: null,
      player: { hp: 6, maxHp: 6, position: 20, invulnerableUntil: 0, attackReadyAt: 0, dodgeReadyAt: 0, specialReadyAt: 0 },
      enemies: encounter.enemies.map((enemy) => ({
        id: enemy.id,
        name: enemy.name,
        role: enemy.role,
        hp: enemy.hp,
        maxHp: enemy.hp,
        position: enemy.position,
        stunnedUntil: 0,
        nextAttackAt: 0
      })),
      message: '戦うなら距離を詰める。退くことも選べる。'
    };
  }

  function copyCombat(state) {
    return {
      ...state,
      player: { ...state.player },
      enemies: state.enemies.map((enemy) => ({ ...enemy }))
    };
  }

  function clampPosition(value) {
    return Math.max(5, Math.min(95, value));
  }

  function aliveEnemies(state) {
    return state.enemies.filter((enemy) => enemy.hp > 0);
  }

  function nearestEnemy(state) {
    return aliveEnemies(state).sort((a, b) => Math.abs(a.position - state.player.position) - Math.abs(b.position - state.player.position))[0] || null;
  }

  function maybeWin(state) {
    if (!aliveEnemies(state).length) {
      state.mode = COMBAT_STATES.WON;
      state.message = '敵は退いた。見張りと道の状態が変わった。';
    }
    return state;
  }

  function applyCombatAction(inputState, action, nowInput) {
    const now = Number.isFinite(Number(nowInput)) ? Number(nowInput) : 0;
    const state = copyCombat(inputState);

    if (state.mode === COMBAT_STATES.IDLE) {
      if (action === 'engage') {
        state.mode = COMBAT_STATES.ENGAGED;
        state.message = '戦闘になった。近づいて攻撃するか、いつでも退く。';
      } else if (action === 'flee') {
        state.mode = COMBAT_STATES.ESCAPED;
        state.reason = 'chosen_retreat';
        state.message = '戦わず退いた。これは失敗ではなく、この土地に残る選択だ。';
      }
      return state;
    }

    if (state.mode !== COMBAT_STATES.ENGAGED) return state;
    if (action === 'flee') {
      state.mode = COMBAT_STATES.ESCAPED;
      state.reason = 'chosen_retreat';
      state.message = '間合いを切って退いた。敵はこの場所に残る。';
      return state;
    }

    if (action === 'move_left' || action === 'move_right') {
      const delta = action === 'move_left' ? -6 : 6;
      state.player.position = clampPosition(state.player.position + delta);
      state.message = action === 'move_left' ? '間合いを離した。' : '間合いを詰めた。';
      return state;
    }

    if (action === 'attack') {
      if (now < state.player.attackReadyAt) return state;
      state.player.attackReadyAt = now + 380;
      const target = nearestEnemy(state);
      if (!target || Math.abs(target.position - state.player.position) > 14) {
        state.message = '攻撃は空を切った。もう少し近い。';
        return state;
      }
      target.hp = Math.max(0, target.hp - 1);
      state.message = `${target.name}へ一撃。`;
      return maybeWin(state);
    }

    if (action === 'dodge') {
      if (now < state.player.dodgeReadyAt) return state;
      state.player.dodgeReadyAt = now + 1200;
      state.player.invulnerableUntil = now + 650;
      state.player.position = clampPosition(state.player.position - 10);
      state.message = '身を引いて攻撃をかわす。';
      return state;
    }

    if (action === 'special') {
      if (now < state.player.specialReadyAt) return state;
      state.player.specialReadyAt = now + 3500;
      const target = nearestEnemy(state);
      if (!target || Math.abs(target.position - state.player.position) > 18) {
        state.message = '崩しは届かなかった。';
        return state;
      }
      target.hp = Math.max(0, target.hp - 1);
      target.position = clampPosition(target.position + (target.position >= state.player.position ? 9 : -9));
      target.stunnedUntil = now + 900;
      state.message = `${target.name}を崩して押し返した。`;
      return maybeWin(state);
    }

    return state;
  }

  function tickCombat(inputState, nowInput) {
    const now = Number.isFinite(Number(nowInput)) ? Number(nowInput) : 0;
    const state = copyCombat(inputState);
    if (state.mode !== COMBAT_STATES.ENGAGED) return state;

    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || enemy.stunnedUntil > now) continue;
      const delta = state.player.position - enemy.position;
      const distance = Math.abs(delta);
      if (distance > 9) {
        enemy.position = clampPosition(enemy.position + Math.sign(delta) * Math.min(2.2, Math.max(0, distance - 8.5)));
        continue;
      }
      if (now < enemy.nextAttackAt) continue;
      enemy.nextAttackAt = now + (enemy.role === 'rusher' ? 850 : 1050);
      if (state.player.invulnerableUntil > now) {
        state.message = '敵の刃が紙一重で外れた。';
        continue;
      }
      state.player.hp = Math.max(0, state.player.hp - 1);
      state.message = `${enemy.name}の攻撃を受けた。`;
      if (state.player.hp <= 0) {
        state.mode = COMBAT_STATES.ESCAPED;
        state.reason = 'forced_retreat';
        state.message = '押し切られ、命を優先して退いた。敵は残るが、遭遇した事実も残る。';
        break;
      }
    }
    return state;
  }

  function bootstrap(root) {
    const document = root.document;
    const response = document.querySelector('#phase8-response');
    const navigation = document.querySelector('#phase6-navigation');
    const map = document.querySelector('#reboot-map');
    if (!response || !navigation) return;

    const pageEyebrow = document.querySelector('.reboot-header .eyebrow');
    if (pageEyebrow) pageEyebrow.textContent = 'CROWNLESS / REBOOT PROTOTYPE #529–#551';
    document.title = 'Crownless — Reboot Prototype #529–#551';

    injectSurface();
    injectMapMarks();

    const surface = document.querySelector('#phase9-combat');
    const title = document.querySelector('#phase9-combat-title');
    const intro = document.querySelector('#phase9-combat-intro');
    const status = document.querySelector('#phase9-combat-status');
    const decision = document.querySelector('#phase9-decision');
    const arena = document.querySelector('#phase9-arena');
    const vitals = document.querySelector('#phase9-vitals');
    const playerHp = document.querySelector('#phase9-player-hp');
    const enemyHp = document.querySelector('#phase9-enemy-hp');
    const history = document.querySelector('#phase9-history');
    const worldNote = document.querySelector('#phase9-world-note');
    const actorLayer = document.querySelector('#phase9-actors');
    const controls = document.querySelector('#phase9-controls');
    const fightButton = document.querySelector('#phase9-fight');
    const leaveButton = document.querySelector('#phase9-leave');

    let currentEncounter = null;
    let combat = null;
    let timer = null;
    let settling = false;

    function loadWorld() {
      try { return parseWorldState(root.localStorage.getItem(STORAGE_KEY)); }
      catch (_error) { return normalizeWorldState({}); }
    }

    function saveWorld(world) {
      root.localStorage.setItem(STORAGE_KEY, serializeWorldState(world));
    }

    function setExplorationLocked(locked) {
      navigation.dataset.combat = locked ? 'engaged' : 'idle';
      navigation.querySelectorAll('button[data-move], #phase6-live-start, #phase6-live-check').forEach((button) => { button.disabled = locked; });
    }

    function renderHistory() {
      const world = loadWorld();
      const entries = Object.values(ENCOUNTERS).filter((encounter) => world.encounters[encounter.id]);
      if (!entries.length) {
        history.hidden = true;
        return;
      }
      history.hidden = false;
      history.innerHTML = entries.map((encounter) => {
        const outcome = world.encounters[encounter.id];
        const presentation = outcomePresentation(encounter.id, outcome);
        const result = outcome === OUTCOMES.DEFEATED ? '退けた' : '退いた';
        return `<li data-outcome="${outcome}"><b>${escapeHtml(encounter.threadTitle)}</b><span>${result}</span><small>${escapeHtml(presentation.mark)}</small></li>`;
      }).join('');
      renderMapMarks(world);
    }

    function renderMapMarks(world) {
      for (const encounter of Object.values(ENCOUNTERS)) {
        const mark = document.querySelector(`[data-phase9-mark="${encounter.id}"]`);
        if (!mark) continue;
        mark.dataset.outcome = world.encounters[encounter.id] || 'none';
      }
      if (map) map.dataset.phase9Changed = Object.keys(world.encounters).length ? 'true' : 'false';
    }

    function applyOutcomeToThread(encounter, outcome) {
      const presentation = outcomePresentation(encounter.id, outcome);
      if (!presentation) return;
      response.dataset.combatOutcome = outcome;
      const responseTitle = response.querySelector('#phase8-title');
      const responseStage = response.querySelector('#phase8-stage');
      const responseCopy = response.querySelector('#phase8-copy');
      if (responseTitle) responseTitle.textContent = presentation.title;
      if (responseStage) responseStage.textContent = outcome === OUTCOMES.DEFEATED ? '退けた' : '退いた';
      if (responseCopy) responseCopy.textContent = presentation.text;
      worldNote.hidden = false;
      worldNote.textContent = `WORLD CHANGE / ${presentation.mark}`;
    }

    function renderActors() {
      if (!combat || !actorLayer) return;
      const actors = [
        `<div class="phase9-actor player" style="left:${combat.player.position}%"><img src="assets/combat/minimal-v0.1/actors/player-unarmed.png" alt="名もない旅人" /></div>`,
        ...combat.enemies.map((enemy, index) => {
          const asset = enemy.role === 'guard' ? 'enemy-guard.png' : 'enemy-rusher.png';
          return `<div class="phase9-actor enemy${enemy.hp <= 0 ? ' defeated' : ''}" style="left:${enemy.position}%" data-enemy="${escapeHtml(enemy.id)}"><img src="assets/combat/minimal-v0.1/actors/${asset}" alt="${escapeHtml(enemy.name)}" /><i>${index + 1}</i></div>`;
        })
      ];
      actorLayer.innerHTML = actors.join('');
    }

    function renderCombat() {
      if (!combat) return;
      status.textContent = combat.message;
      const engaged = combat.mode === COMBAT_STATES.ENGAGED;
      arena.hidden = !engaged;
      vitals.hidden = !engaged;
      controls.hidden = !engaged;
      decision.hidden = combat.mode !== COMBAT_STATES.IDLE;
      if (engaged) {
        playerHp.textContent = `体力 ${combat.player.hp}/${combat.player.maxHp}`;
        enemyHp.textContent = combat.enemies.map((enemy) => `${enemy.name} ${enemy.hp}/${enemy.maxHp}`).join(' / ');
        renderActors();
      }
      if (combat.mode === COMBAT_STATES.WON || combat.mode === COMBAT_STATES.ESCAPED) settleCombat();
    }

    function stopTimer() {
      if (timer) root.clearInterval(timer);
      timer = null;
    }

    function settleCombat() {
      if (settling || !combat || !currentEncounter) return;
      settling = true;
      stopTimer();
      const outcome = combat.mode === COMBAT_STATES.WON ? OUTCOMES.DEFEATED : OUTCOMES.ESCAPED;
      try {
        const world = resolveWorldState(loadWorld(), currentEncounter.id, outcome);
        saveWorld(world);
        setExplorationLocked(false);
        renderHistory();
        applyOutcomeToThread(currentEncounter, outcome);
        arena.hidden = true;
        vitals.hidden = true;
        controls.hidden = true;
        decision.hidden = true;
        status.textContent = combat.message;
        surface.dataset.outcome = outcome;
      } catch (error) {
        status.textContent = `世界状態を保存できなかった: ${error.message}`;
      } finally {
        settling = false;
      }
    }

    function startCombat() {
      if (!currentEncounter) return;
      combat = applyCombatAction(createCombat(currentEncounter.id), 'engage', Date.now());
      surface.dataset.outcome = 'engaged';
      setExplorationLocked(true);
      renderCombat();
      arena.focus();
      stopTimer();
      timer = root.setInterval(() => {
        combat = tickCombat(combat, Date.now());
        renderCombat();
      }, 220);
    }

    function resolveRetreat() {
      if (!currentEncounter) return;
      combat = applyCombatAction(createCombat(currentEncounter.id), 'flee', Date.now());
      renderCombat();
    }

    function perform(action) {
      if (!combat || combat.mode !== COMBAT_STATES.ENGAGED) return;
      combat = applyCombatAction(combat, action, Date.now());
      renderCombat();
    }

    function renderEncounter() {
      const encounter = encounterForThread(response.dataset.sector, response.dataset.stage);
      currentEncounter = encounter;
      worldNote.hidden = true;
      response.dataset.combatOutcome = 'none';
      if (!encounter) {
        if (!combat || combat.mode !== COMBAT_STATES.ENGAGED) surface.hidden = true;
        return;
      }

      const world = loadWorld();
      const outcome = world.encounters[encounter.id];
      surface.hidden = false;
      title.textContent = encounter.title;
      intro.textContent = encounter.intro;
      if (outcome) {
        combat = null;
        stopTimer();
        setExplorationLocked(false);
        decision.hidden = true;
        arena.hidden = true;
        vitals.hidden = true;
        controls.hidden = true;
        surface.dataset.outcome = outcome;
        status.textContent = outcome === OUTCOMES.DEFEATED
          ? 'この遭遇は決着済み。敵を退けた結果が土地に残っている。'
          : 'この遭遇では退いた。その選択も土地の状態として残っている。';
        applyOutcomeToThread(encounter, outcome);
        return;
      }

      combat = createCombat(encounter.id);
      surface.dataset.outcome = 'unresolved';
      decision.hidden = false;
      arena.hidden = true;
      vitals.hidden = true;
      controls.hidden = true;
      status.textContent = '戦うか、退くか。どちらでもこの遭遇は世界に残る。';
    }

    fightButton.addEventListener('click', startCombat);
    leaveButton.addEventListener('click', resolveRetreat);
    controls.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-combat-action]');
      if (button) perform(button.dataset.combatAction);
    });

    document.addEventListener('keydown', (event) => {
      if (!combat || combat.mode !== COMBAT_STATES.ENGAGED) return;
      const key = event.key.toLowerCase();
      const action = ({
        arrowleft: 'move_left', a: 'move_left',
        arrowright: 'move_right', d: 'move_right',
        ' ': 'attack', j: 'attack',
        k: 'dodge', l: 'special',
        escape: 'flee', r: 'flee'
      })[key];
      if (!action) return;
      event.preventDefault();
      perform(action);
    });

    const observer = new root.MutationObserver(renderEncounter);
    observer.observe(response, { attributes: true, attributeFilter: ['data-stage', 'data-sector'] });
    renderHistory();
    renderEncounter();

    function injectSurface() {
      if (document.querySelector('#phase9-combat')) return;
      response.insertAdjacentHTML('afterend', `
        <section id="phase9-combat" class="phase9-combat" data-outcome="unresolved" hidden aria-label="歩いて見つけた遭遇の短い戦闘">
          <p class="eyebrow">PHASE 9 / ENCOUNTER BECOMES CONSEQUENCE</p>
          <header><h3 id="phase9-combat-title">遭遇</h3><b>戦う必要はない</b></header>
          <p id="phase9-combat-intro" class="phase9-combat-intro"></p>
          <div id="phase9-decision" class="phase9-decision">
            <button id="phase9-fight" class="ink-button primary-action" type="button">武器を構える</button>
            <button id="phase9-leave" class="ink-button quiet-action" type="button">ここは退く</button>
          </div>
          <div id="phase9-arena" class="phase9-arena" tabindex="0" hidden aria-label="短い戦闘。左右移動、通常攻撃、回避、崩し、退却を使う">
            <div class="phase9-ground" aria-hidden="true"></div>
            <div id="phase9-actors" class="phase9-actors"></div>
          </div>
          <div id="phase9-vitals" class="phase9-vitals" hidden>
            <span id="phase9-player-hp"></span><span id="phase9-enemy-hp"></span>
          </div>
          <div id="phase9-controls" class="phase9-controls" hidden aria-label="戦闘操作">
            <button type="button" data-combat-action="move_left">← 離れる</button>
            <button type="button" data-combat-action="move_right">近づく →</button>
            <button type="button" data-combat-action="attack">攻撃</button>
            <button type="button" data-combat-action="dodge">回避</button>
            <button type="button" data-combat-action="special">崩し</button>
            <button type="button" data-combat-action="flee">退く</button>
          </div>
          <p id="phase9-combat-status" class="phase9-combat-status" aria-live="polite"></p>
          <p class="phase9-keys">KEYBOARD: A/D or ←/→ 移動 ・ Space/J 攻撃 ・ K 回避 ・ L 崩し ・ Esc/R 退却</p>
          <p id="phase9-world-note" class="phase9-world-note" hidden></p>
        </section>
        <ul id="phase9-history" class="phase9-history" hidden aria-label="戦闘の結果として残った世界の変化"></ul>`);
    }

    function injectMapMarks() {
      const svg = map && map.querySelector('svg');
      if (!svg || document.querySelector('#phase9-map-layer')) return;
      svg.insertAdjacentHTML('beforeend', `
        <g id="phase9-map-layer" aria-hidden="true">
          <g class="phase9-map-mark" data-phase9-mark="high_watch_scouts" data-outcome="none" transform="translate(279 23)">
            <circle r="9"></circle><path d="M-5 4L5-4M-5-4L5 4"></path><path class="escape-mark" d="M-7 7c4-4 8-4 12 0"></path>
          </g>
          <g class="phase9-map-mark" data-phase9-mark="abandoned_camp_returners" data-outcome="none" transform="translate(226 22)">
            <circle r="9"></circle><path d="M-5 4L5-4M-5-4L5 4"></path><path class="escape-mark" d="M-7 7c4-4 8-4 12 0"></path>
          </g>
        </g>`);
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'\"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;'
    })[char]);
  }

  return Object.freeze({
    STORAGE_KEY,
    OUTCOMES,
    COMBAT_STATES,
    ENCOUNTERS,
    normalizeWorldState,
    parseWorldState,
    serializeWorldState,
    resolveWorldState,
    encounterForThread,
    outcomePresentation,
    createCombat,
    applyCombatAction,
    tickCombat,
    bootstrap
  });
});
