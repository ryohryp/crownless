(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.CrownlessRebootWegoBattlefield = api;
    api.installResolutionPolish(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CERTAINTY = Object.freeze({
    VAGUE: 'vague',
    PARTIAL: 'partial',
    CLEAR: 'clear'
  });

  const RESOLUTION_MS = 340;
  const SETTLE_MS = 220;

  const PLAN_SCENES = Object.freeze({
    probe_shot: Object.freeze({
      frontliner: Object.freeze({ x: 61, y: 57, cue: '接近' }),
      archer: Object.freeze({ x: 79, y: 31, cue: '射線' }),
      frontTarget: Object.freeze([42, 57]),
      shotTarget: Object.freeze([27, 59])
    }),
    brace_flank: Object.freeze({
      frontliner: Object.freeze({ x: 54, y: 56, cue: '待構' }),
      archer: Object.freeze({ x: 81, y: 52, cue: '回込' }),
      frontTarget: Object.freeze([52, 56]),
      shotTarget: Object.freeze([34, 54])
    }),
    advance_reposition: Object.freeze({
      frontliner: Object.freeze({ x: 51, y: 59, cue: '踏込' }),
      archer: Object.freeze({ x: 74, y: 27, cue: '移動' }),
      frontTarget: Object.freeze([38, 59]),
      shotTarget: Object.freeze([47, 47])
    }),
    cutoff_volley: Object.freeze({
      frontliner: Object.freeze({ x: 47, y: 72, cue: '遮断' }),
      archer: Object.freeze({ x: 76, y: 58, cue: '二射' }),
      frontTarget: Object.freeze([27, 73]),
      shotTarget: Object.freeze([25, 62])
    }),
    break_and_cover: Object.freeze({
      frontliner: Object.freeze({ x: 70, y: 49, cue: '後退' }),
      archer: Object.freeze({ x: 84, y: 34, cue: '援護' }),
      frontTarget: Object.freeze([82, 48]),
      shotTarget: Object.freeze([42, 55])
    }),
    close_trap: Object.freeze({
      frontliner: Object.freeze({ x: 39, y: 69, cue: '封鎖' }),
      archer: Object.freeze({ x: 68, y: 61, cue: '重射線' }),
      frontTarget: Object.freeze([24, 73]),
      shotTarget: Object.freeze([21, 69])
    })
  });

  const TERMINAL_SCENES = Object.freeze({
    cleared: Object.freeze({
      player: Object.freeze({ x: 53, y: 54 }),
      frontliner: Object.freeze({ x: 86, y: 48, cue: '退走' }),
      archer: Object.freeze({ x: 91, y: 29, cue: '退走' }),
      retreatTone: 'open'
    }),
    retreated: Object.freeze({
      player: Object.freeze({ x: 13, y: 74 }),
      frontliner: Object.freeze({ x: 58, y: 58, cue: '残留' }),
      archer: Object.freeze({ x: 78, y: 37, cue: '残留' }),
      retreatTone: 'open'
    }),
    forced_retreat: Object.freeze({
      player: Object.freeze({ x: 11, y: 79 }),
      frontliner: Object.freeze({ x: 36, y: 69, cue: '支配' }),
      archer: Object.freeze({ x: 66, y: 55, cue: '支配' }),
      retreatTone: 'danger'
    })
  });

  function point(x, y) {
    return Object.freeze({ x, y });
  }

  function certaintyFor(state) {
    if (!state) return CERTAINTY.VAGUE;
    if (state.readIntent || Number(state.knowledge) >= 2) return CERTAINTY.CLEAR;
    if (Number(state.knowledge) >= 1) return CERTAINTY.PARTIAL;
    return CERTAINTY.VAGUE;
  }

  function playerPosition(state) {
    if (!state) return point(26, 61);
    switch (state.lastAction) {
      case 'press': return point(39, 57);
      case 'guard': return point(27, 61);
      case 'maneuver': return point(31, 39);
      case 'retreat': return point(15, 75);
      default: return point(26, 61);
    }
  }

  function retreatTone(pressure) {
    const value = Number(pressure) || 0;
    if (value >= 3) return 'danger';
    if (value >= 1) return 'watched';
    return 'open';
  }

  function gearMode(gear) {
    if (gear === 'long_spear') return 'reach';
    if (gear === 'light_kit') return 'mobility';
    return 'shield';
  }

  function line(from, to, kind) {
    return Object.freeze({
      from: Object.freeze([from[0], from[1]]),
      to: Object.freeze([to[0], to[1]]),
      kind
    });
  }

  function terminalScene(state) {
    const preset = TERMINAL_SCENES[state.result] || TERMINAL_SCENES.retreated;
    return Object.freeze({
      status: 'resolved',
      outcome: state.result || 'retreated',
      certainty: CERTAINTY.CLEAR,
      planId: null,
      gear: gearMode(state.gear),
      player: point(preset.player.x, preset.player.y),
      frontliner: Object.freeze({ x: preset.frontliner.x, y: preset.frontliner.y, cue: preset.frontliner.cue }),
      archer: Object.freeze({ x: preset.archer.x, y: preset.archer.y, cue: preset.archer.cue }),
      retreatTone: preset.retreatTone,
      frontIntent: null,
      shotIntent: null
    });
  }

  function sceneFor(state, plan) {
    if (state && state.status === 'resolved') return terminalScene(state);

    const scene = (plan && PLAN_SCENES[plan.id]) || PLAN_SCENES.probe_shot;
    const player = playerPosition(state);
    const certainty = certaintyFor(state);
    const frontKind = plan && Array.isArray(plan.tags) && plan.tags.includes('brace') ? 'brace'
      : plan && Array.isArray(plan.tags) && plan.tags.includes('cutoff') ? 'cutoff'
        : plan && Array.isArray(plan.tags) && plan.tags.includes('wavering') ? 'retreating'
          : 'closing';
    const shotKind = plan && Array.isArray(plan.tags) && plan.tags.includes('reposition') ? 'reposition' : 'shot';

    return Object.freeze({
      status: 'active',
      outcome: null,
      certainty,
      planId: plan ? plan.id : 'probe_shot',
      gear: gearMode(state && state.gear),
      player,
      frontliner: Object.freeze({ x: scene.frontliner.x, y: scene.frontliner.y, cue: scene.frontliner.cue }),
      archer: Object.freeze({ x: scene.archer.x, y: scene.archer.y, cue: scene.archer.cue }),
      retreatTone: retreatTone(state && state.pressure),
      frontIntent: line([scene.frontliner.x, scene.frontliner.y], scene.frontTarget, frontKind),
      shotIntent: line([scene.archer.x, scene.archer.y], scene.shotTarget, shotKind)
    });
  }

  function resolutionPresentation(before, after, plan, action) {
    const tags = plan && Array.isArray(plan.tags) ? plan.tags : [];
    const advantageDelta = Number(after && after.advantage || 0) - Number(before && before.advantage || 0);
    const pressureDelta = Number(after && after.pressure || 0) - Number(before && before.pressure || 0);
    const newInjury = Boolean(after && after.injury && !(before && before.injury));
    let tone = 'neutral';
    if ((after && after.result === 'cleared') || (advantageDelta > 0 && pressureDelta <= 1)) tone = 'favorable';
    if ((after && after.result === 'forced_retreat') || advantageDelta < 0 || pressureDelta >= 2) tone = 'unfavorable';

    let defense = 'none';
    if (tags.includes('shot')) {
      if (action === 'guard' && before && before.gear === 'round_shield') defense = 'shield';
      else if (action === 'maneuver') defense = 'terrain';
      else defense = 'exposed';
    }

    return Object.freeze({
      action,
      planId: plan && plan.id ? plan.id : 'unknown',
      tone,
      defense,
      retreat: pressureDelta > 0 ? 'narrowing' : pressureDelta < 0 ? 'opening' : 'steady',
      injury: newInjury ? after.injury : null,
      frontMotion: tags.includes('cutoff') || tags.includes('flank') ? 'flank'
        : tags.includes('wavering') ? 'retreat'
          : tags.includes('brace') ? 'brace'
            : 'close',
      archerMotion: tags.includes('reposition') || tags.includes('flank') ? 'reposition'
        : tags.includes('shot') ? 'shot'
          : 'hold'
    });
  }

  function certaintyLabel(value) {
    if (value === CERTAINTY.CLEAR) return '意図まで読める';
    if (value === CERTAINTY.PARTIAL) return '動きは読める';
    return '狙いは不明';
  }

  function installResolutionPolish(root) {
    const doc = root && root.document;
    if (!doc || doc.documentElement.dataset.wegoResolutionPolish === 'true') return false;
    doc.documentElement.dataset.wegoResolutionPolish = 'true';

    if (!doc.querySelector('link[data-wego-resolution-polish]')) {
      const link = doc.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'reboot-wego-resolution.css';
      link.dataset.wegoResolutionPolish = 'true';
      doc.head.appendChild(link);
    }

    let replaying = false;
    let locked = false;

    function prefersReducedMotion() {
      return Boolean(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function setButtonsLocked(actions, value) {
      if (!actions) return;
      actions.querySelectorAll('button[data-wego-action]').forEach((button) => {
        button.disabled = Boolean(value);
      });
    }

    function shotPlan(planId) {
      return ['probe_shot', 'brace_flank', 'cutoff_volley', 'break_and_cover', 'close_trap'].includes(planId);
    }

    function visibleTone(docRef, previousRetreat) {
      const field = docRef.querySelector('#wego-battlefield');
      const position = docRef.querySelector('#wego-position');
      if (!field) return 'neutral';
      if (field.dataset.outcome === 'cleared') return 'favorable';
      if (field.dataset.outcome === 'forced_retreat') return 'unfavorable';
      if (position && /崩し切る寸前|こちら寄り/.test(position.textContent)) return 'favorable';
      if (position && /敵側/.test(position.textContent)) return 'unfavorable';
      if (previousRetreat !== 'danger' && field.dataset.retreat === 'danger') return 'unfavorable';
      return 'neutral';
    }

    function syncInjury(field) {
      const injury = doc.querySelector('#wego-injury');
      if (!field || !injury) return;
      field.dataset.injury = /負傷なし/.test(injury.textContent) ? 'none' : 'marked';
    }

    doc.addEventListener('click', (event) => {
      const button = event.target && event.target.closest ? event.target.closest('button[data-wego-action]') : null;
      if (!button) return;
      const actions = button.closest('#wego-actions');
      const field = doc.querySelector('#wego-battlefield');
      if (!actions || !field) return;
      if (replaying || prefersReducedMotion()) return;

      if (locked) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      locked = true;
      const action = button.dataset.wegoAction;
      const planId = field.dataset.plan || 'unknown';
      const previousRetreat = field.dataset.retreat || 'open';
      const gear = field.dataset.gear || 'shield';
      const defense = shotPlan(planId)
        ? action === 'guard' && gear === 'shield' ? 'shield'
          : action === 'maneuver' ? 'terrain'
            : 'exposed'
        : 'none';

      setButtonsLocked(actions, true);
      field.dataset.resolving = 'true';
      field.dataset.resolutionPhase = 'intent';
      field.dataset.resolutionAction = action;
      field.dataset.resolutionPlan = planId;
      field.dataset.resolutionDefense = defense;

      root.setTimeout(() => {
        field.dataset.resolutionPhase = 'impact';
        replaying = true;
        button.disabled = false;
        try { button.click(); }
        finally { replaying = false; }
        setButtonsLocked(actions, true);
        field.dataset.resolutionTone = visibleTone(doc, previousRetreat);
        syncInjury(field);

        root.setTimeout(() => {
          delete field.dataset.resolving;
          delete field.dataset.resolutionPhase;
          delete field.dataset.resolutionAction;
          delete field.dataset.resolutionPlan;
          delete field.dataset.resolutionDefense;
          delete field.dataset.resolutionTone;
          locked = false;
          if (actions.offsetParent !== null) setButtonsLocked(actions, false);
        }, SETTLE_MS);
      }, RESOLUTION_MS);
    }, true);

    return true;
  }

  return Object.freeze({
    CERTAINTY,
    PLAN_SCENES,
    certaintyFor,
    playerPosition,
    retreatTone,
    gearMode,
    sceneFor,
    resolutionPresentation,
    certaintyLabel,
    installResolutionPolish
  });
});
