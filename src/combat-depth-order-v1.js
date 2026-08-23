(() => {
  "use strict";

  /*
   * Pre-manuscript Canvas layer.
   *
   * The combat simulation stays untouched. Illustrated ground-bound actor
   * images emitted by the manuscript renderer are buffered for the current
   * frame and replayed from back to front using their projected foot Y.
   * Ground effects / telegraphs / dropped weapons remain in their own pass;
   * only illustrated actor bodies are sorted.
   */

  if (typeof HTMLCanvasElement === "undefined") return;

  const previousGetContext = HTMLCanvasElement.prototype.getContext;
  const ENEMY_ACTOR = /\/actors\/enemy-(rusher|guard|skirmisher)\.png(?:$|\?)/i;
  const PLAYER_ACTOR = /\/actors\/player-unarmed(?:-combat-sprite-sheet-v0\.1)?\.png(?:$|\?)/i;

  const publicState = {
    enabled: true,
    playerFoot: null,
    enemyBounds: [],
    flushHud() {
      const hud = window.CrownlessEnemyHud;
      if (hud && typeof hud.flush === "function") hud.flush();
    },
    resetHud() {
      const hud = window.CrownlessEnemyHud;
      if (hud && typeof hud.reset === "function") hud.reset();
    }
  };
  window.CrownlessCombatDepth = publicState;

  function imageSource(image) {
    if (!image) return "";
    return String(image.currentSrc || image.src || "");
  }

  function playerActorImageUnavailable() {
    const combatAssets = window.CrownlessCombatAssets;
    if (!combatAssets || typeof combatAssets.status !== "function") return false;
    try {
      const status = combatAssets.status();
      return Boolean(
        status
        && status.player !== "ready"
        && status.playerSheet !== "ready"
      );
    } catch (_) {
      return false;
    }
  }

  function cloneMatrix(matrix) {
    return {
      a: Number(matrix.a) || 1,
      b: Number(matrix.b) || 0,
      c: Number(matrix.c) || 0,
      d: Number(matrix.d) || 1,
      e: Number(matrix.e) || 0,
      f: Number(matrix.f) || 0
    };
  }

  function transformPoint(matrix, x, y) {
    return {
      x: matrix.a * x + matrix.c * y + matrix.e,
      y: matrix.b * x + matrix.d * y + matrix.f
    };
  }

  function destinationRect(args) {
    if (args.length >= 9) {
      return {
        x: Number(args[5]) || 0,
        y: Number(args[6]) || 0,
        w: Number(args[7]) || 0,
        h: Number(args[8]) || 0
      };
    }
    if (args.length >= 5) {
      return {
        x: Number(args[1]) || 0,
        y: Number(args[2]) || 0,
        w: Number(args[3]) || 0,
        h: Number(args[4]) || 0
      };
    }
    return null;
  }

  function screenBounds(matrix, rect) {
    if (!rect) return null;
    const points = [
      transformPoint(matrix, rect.x, rect.y),
      transformPoint(matrix, rect.x + rect.w, rect.y),
      transformPoint(matrix, rect.x, rect.y + rect.h),
      transformPoint(matrix, rect.x + rect.w, rect.y + rect.h)
    ];
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys)
    };
  }

  function captureDraw(target, args, role = null, order = 0) {
    const matrix = cloneMatrix(target.getTransform());
    const rect = destinationRect(args);
    const footLocal = rect
      ? { x: rect.x + rect.w / 2, y: rect.y + rect.h }
      : { x: 0, y: 0 };
    const foot = transformPoint(matrix, footLocal.x, footLocal.y);
    return {
      args: args.slice(),
      role,
      order,
      matrix,
      foot,
      bounds: screenBounds(matrix, rect),
      alpha: target.globalAlpha,
      smoothing: target.imageSmoothingEnabled,
      composite: target.globalCompositeOperation,
      filter: typeof target.filter === "string" ? target.filter : "none"
    };
  }

  function replay(target, item) {
    target.save();
    target.setTransform(
      item.matrix.a,
      item.matrix.b,
      item.matrix.c,
      item.matrix.d,
      item.matrix.e,
      item.matrix.f
    );
    target.globalAlpha = item.alpha;
    target.imageSmoothingEnabled = item.smoothing;
    target.globalCompositeOperation = item.composite;
    if ("filter" in target) target.filter = item.filter;
    target.drawImage(...item.args);
    target.restore();
  }

  function compareActors(a, b) {
    if (Math.abs(a.foot.y - b.foot.y) > 0.01) return a.foot.y - b.foot.y;
    if (Math.abs(a.foot.x - b.foot.x) > 0.01) return a.foot.x - b.foot.x;
    return a.order - b.order;
  }

  function wrap(target) {
    if (!target || target.__crownlessDepthOrder) return target;

    const actorQueue = [];
    let actorSequence = 0;
    const methods = new Map();

    function resetFrame() {
      actorQueue.length = 0;
      actorSequence = 0;
      publicState.playerFoot = null;
      publicState.enemyBounds = [];
      publicState.resetHud();
    }

    function flushActors() {
      if (!actorQueue.length) return;
      actorQueue.sort(compareActors);

      const player = actorQueue.find((item) => item.role === "player");
      publicState.playerFoot = player ? { ...player.foot } : null;
      publicState.enemyBounds = actorQueue
        .filter((item) => item.role !== "player" && item.bounds)
        .map((item) => ({ ...item.bounds, role: item.role, foot: { ...item.foot } }));

      actorQueue.forEach((item) => replay(target, item));
      actorQueue.length = 0;
      publicState.flushHud();
    }

    return new Proxy(target, {
      get(ctx, property) {
        if (property === "__crownlessDepthOrder") return true;

        if (property === "drawImage") {
          return (...args) => {
            const source = imageSource(args[0]);
            const enemyMatch = source.match(ENEMY_ACTOR);
            if (enemyMatch) {
              if (playerActorImageUnavailable()) return ctx.drawImage(...args);
              actorQueue.push(captureDraw(ctx, args, enemyMatch[1].toLowerCase(), actorSequence));
              actorSequence += 1;
              return undefined;
            }

            if (PLAYER_ACTOR.test(source)) {
              actorQueue.push(captureDraw(ctx, args, "player", actorSequence));
              actorSequence += 1;
              flushActors();
              return undefined;
            }

            return ctx.drawImage(...args);
          };
        }

        if (property === "clearRect") {
          return (...args) => {
            resetFrame();
            return ctx.clearRect(...args);
          };
        }

        const value = ctx[property];
        if (typeof value !== "function") return value;
        if (!methods.has(property)) methods.set(property, (...args) => value.apply(ctx, args));
        return methods.get(property);
      },

      set(ctx, property, value) {
        ctx[property] = value;
        return true;
      }
    });
  }

  HTMLCanvasElement.prototype.getContext = function crownlessDepthOrderGetContext(type, options) {
    const ctx = previousGetContext.call(this, type, options);
    if (type !== "2d" || !ctx || this.id !== "arena") return ctx;
    if (!this.__crownlessDepthOrderContext) this.__crownlessDepthOrderContext = wrap(ctx);
    return this.__crownlessDepthOrderContext;
  };
})();
