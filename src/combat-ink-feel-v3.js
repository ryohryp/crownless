(() => {
  "use strict";

  /*
   * Compatibility presentation layer loaded after combat-manuscript-render.
   *
   * The previous version inferred hit events from Canvas fill colors and drew
   * extra slices from the generated ink sheet. That made visual state depend
   * on prototype drawing colors and could leave noisy image fragments over an
   * enemy. The manuscript renderer already owns combat ink effects, so this
   * layer now has one narrow responsibility: keep enemy name / HP annotations
   * above the accepted actor silhouettes.
   *
   * No combat simulation values or actor geometry are changed here.
   */

  const ENEMY_HUD_LIFT = 52;

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

  function wrap(ctx) {
    if (!ctx || ctx.__crownlessEnemyHudClearance) return ctx;

    let pendingEnemyLabel = false;
    const methods = new Map();

    return new Proxy(ctx, {
      get(target, property) {
        if (property === "__crownlessEnemyHudClearance") return true;

        if (property === "fillRect") {
          return (...args) => {
            if (!isEnemyHealthBar(args)) return target.fillRect(...args);
            pendingEnemyLabel = true;
            const shifted = args.slice();
            shifted[1] = Number(shifted[1]) - ENEMY_HUD_LIFT;
            return target.fillRect(...shifted);
          };
        }

        if (property === "fillText") {
          return (...args) => {
            if (!pendingEnemyLabel || args.length < 3) return target.fillText(...args);
            pendingEnemyLabel = false;
            const shifted = args.slice();
            shifted[2] = Number(shifted[2]) - ENEMY_HUD_LIFT;
            return target.fillText(...shifted);
          };
        }

        if (property === "clearRect") {
          return (...args) => {
            pendingEnemyLabel = false;
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
