(() => {
  "use strict";

  /*
   * Compatibility presentation layer loaded after combat-manuscript-render.
   *
   * The manuscript renderer owns actor art and combat ink. This layer keeps
   * enemy name / HP annotations clear of the accepted actor silhouettes and
   * separates those annotations when several enemies collapse into the same
   * visual cluster.
   *
   * No combat simulation values or actor geometry are changed here.
   */

  const ENEMY_HUD_LIFT = 60;
  const ENEMY_HUD_LANE_GAP = 18;
  const ENEMY_HUD_COLLISION_X = 72;
  const ENEMY_HUD_COLLISION_Y = 16;
  const ENEMY_HUD_MAX_LANES = 4;

  function isEnemyHealthBar(args) {
    if (!Array.isArray(args) || args.length < 4) return false;
    const width = Number(args[2]);
    const height = Number(args[3]);
    return Number.isFinite(width)
      && Number.isFinite(height)
      && width > 0
      && width <= 60.5
      && Math.abs(height - 5) < 0.01;
  }

  function healthBarAnchor(args) {
    return {
      x: Number(args[0]) + 30,
      y: Number(args[1])
    };
  }

  function sameHealthBar(anchor, pending) {
    if (!anchor || !pending) return false;
    return Math.abs(anchor.x - pending.x) < 1.5
      && Math.abs(anchor.y - pending.y) < 1.5;
  }

  function chooseHudLift(anchor, occupied) {
    for (let lane = 0; lane < ENEMY_HUD_MAX_LANES; lane += 1) {
      const lift = ENEMY_HUD_LIFT + lane * ENEMY_HUD_LANE_GAP;
      const shiftedY = anchor.y - lift;
      const collision = occupied.some((slot) => (
        Math.abs(slot.x - anchor.x) < ENEMY_HUD_COLLISION_X
        && Math.abs(slot.y - shiftedY) < ENEMY_HUD_COLLISION_Y
      ));
      if (collision) continue;
      occupied.push({ x: anchor.x, y: shiftedY });
      return lift;
    }

    const lift = ENEMY_HUD_LIFT + ENEMY_HUD_MAX_LANES * ENEMY_HUD_LANE_GAP;
    occupied.push({ x: anchor.x, y: anchor.y - lift });
    return lift;
  }

  function wrap(ctx) {
    if (!ctx || ctx.__crownlessEnemyHudClearance) return ctx;

    let pendingEnemyHud = null;
    const occupiedHudSlots = [];
    const methods = new Map();

    function resetHudLayout() {
      pendingEnemyHud = null;
      occupiedHudSlots.length = 0;
    }

    return new Proxy(ctx, {
      get(target, property) {
        if (property === "__crownlessEnemyHudClearance") return true;

        if (property === "fillRect") {
          return (...args) => {
            if (!isEnemyHealthBar(args)) return target.fillRect(...args);

            const anchor = healthBarAnchor(args);
            if (!sameHealthBar(anchor, pendingEnemyHud)) {
              pendingEnemyHud = {
                ...anchor,
                lift: chooseHudLift(anchor, occupiedHudSlots)
              };
            }

            const shifted = args.slice();
            shifted[1] = Number(shifted[1]) - pendingEnemyHud.lift;
            return target.fillRect(...shifted);
          };
        }

        if (property === "fillText") {
          return (...args) => {
            if (!pendingEnemyHud || args.length < 3) return target.fillText(...args);
            const shifted = args.slice();
            shifted[2] = Number(shifted[2]) - pendingEnemyHud.lift;
            pendingEnemyHud = null;
            return target.fillText(...shifted);
          };
        }

        if (property === "clearRect") {
          return (...args) => {
            resetHudLayout();
            return target.clearRect(...args);
          };
        }

        const value = target[property];
        if (typeof value !== "function") return value;
        if (!methods.has(property)) methods.set(property, (...args) => value.apply(target, args));
        return methods.get(property);
      },

      set(target, property, value) {
        target[property] = value;
        return true;
      }
    });
  }

  let installed = false;

  function install() {
    if (installed) return;
    installed = true;
    const previousGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function crownlessEnemyHudGetContext(type, options) {
      const ctx = previousGetContext.call(this, type, options);
      if (type !== "2d" || !ctx || this.id !== "arena") return ctx;
      if (!this.__crownlessEnemyHudClearance) this.__crownlessEnemyHudClearance = wrap(ctx);
      return this.__crownlessEnemyHudClearance;
    };
  }

  function arm(script) {
    if (window.CrownlessCombatAssets) return install();
    script.addEventListener("load", install, { once: true });
  }

  const found = Array.from(document.scripts).find((script) => /combat-manuscript-render\.js(?:$|\?)/.test(script.src));
  if (found) arm(found);
  else {
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLScriptElement && /combat-manuscript-render\.js(?:$|\?)/.test(node.src)) {
            observer.disconnect();
            arm(node);
            return;
          }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
