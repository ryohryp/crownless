(() => {
  "use strict";

  /*
   * Post-manuscript enemy HUD layer.
   *
   * Enemy bodies are depth-sorted by combat-depth-order-v1. This layer queues
   * the matching name / HP annotations, places them as collision-aware label
   * rectangles above actor silhouettes, and reduces non-priority enemies to a
   * compact HP bar so clustered fights stay readable.
   *
   * No combat simulation values or actor geometry are changed here.
   */

  const ENEMY_HUD_LIFT = 60;
  const ENEMY_HUD_LANE_GAP = 18;
  const ENEMY_HUD_MAX_LANES = 5;
  const ENEMY_HUD_SIDE_NUDGES = [0, -12, 12, -24, 24];
  const ENEMY_HUD_ACTOR_PAD = 4;
  const NON_PRIORITY_ALPHA = 0.58;
  const ROLE_LABELS = new Set(["RUSHER", "GUARD", "SKIRMISHER"]);

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

  function axisScale(matrix) {
    return {
      x: Math.max(0.001, Math.hypot(matrix.a, matrix.b)),
      y: Math.max(0.001, Math.hypot(matrix.c, matrix.d))
    };
  }

  function rectsOverlap(a, b) {
    return !(
      a.x + a.w <= b.x
      || b.x + b.w <= a.x
      || a.y + a.h <= b.y
      || b.y + b.h <= a.y
    );
  }

  function paddedRect(rect, pad) {
    return {
      x: rect.x - pad,
      y: rect.y - pad,
      w: rect.w + pad * 2,
      h: rect.h + pad * 2
    };
  }

  function wrap(ctx) {
    if (!ctx || ctx.__crownlessEnemyHudClearance) return ctx;

    let pendingEnemyHud = null;
    const queuedEnemyHud = [];
    const methods = new Map();

    function resetHudLayout() {
      pendingEnemyHud = null;
      queuedEnemyHud.length = 0;
    }

    function captureBar(args) {
      return {
        args: args.slice(),
        style: ctx.fillStyle,
        alpha: ctx.globalAlpha,
        matrix: cloneMatrix(ctx.getTransform())
      };
    }

    function captureLabel(args) {
      return {
        text: String(args[0]),
        x: Number(args[1]) || 0,
        y: Number(args[2]) || 0,
        maxWidth: args.length > 3 ? args[3] : undefined,
        style: ctx.fillStyle,
        alpha: ctx.globalAlpha,
        font: ctx.font,
        align: ctx.textAlign,
        baseline: ctx.textBaseline,
        matrix: cloneMatrix(ctx.getTransform())
      };
    }

    function actorOccupiedRects() {
      const depth = window.CrownlessCombatDepth;
      if (!depth || !Array.isArray(depth.enemyBounds)) return [];
      return depth.enemyBounds
        .filter((bounds) => bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.y))
        .map((bounds) => paddedRect(bounds, ENEMY_HUD_ACTOR_PAD));
    }

    function groupScreenPoint(group) {
      if (!group || !group.background) return { x: 0, y: 0 };
      const args = group.background.args;
      const x = Number(args[0]) + 30;
      const y = Number(args[1]) + 65;
      return transformPoint(group.background.matrix, x, y);
    }

    function priorityIndex(groups) {
      const depth = window.CrownlessCombatDepth;
      const player = depth && depth.playerFoot;
      let bestIndex = -1;
      let bestDistance = Infinity;

      groups.forEach((group, index) => {
        if (group.label && !ROLE_LABELS.has(group.label.text.toUpperCase())) {
          group.priority = true;
          return;
        }
        if (!player) return;
        const point = groupScreenPoint(group);
        const distance = Math.hypot(point.x - player.x, point.y - player.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });

      return bestIndex;
    }

    function measureLocalWidth(group, priority) {
      const barWidth = 60;
      if (!priority || !group.label) return barWidth;
      ctx.save();
      ctx.font = group.label.font;
      const labelWidth = ctx.measureText(group.label.text).width + 8;
      ctx.restore();
      return Math.max(barWidth, labelWidth);
    }

    function choosePlacement(group, priority, occupied) {
      const label = group.label;
      const background = group.background;
      const matrix = label ? label.matrix : background.matrix;
      const scale = axisScale(matrix);
      const localWidth = measureLocalWidth(group, priority);
      const localHeight = priority ? 18 : 8;
      const anchorX = label ? label.x : Number(background.args[0]) + 30;
      const anchorY = label ? label.y : Number(background.args[1]) - 8;

      for (let lane = 0; lane < ENEMY_HUD_MAX_LANES; lane += 1) {
        const lift = ENEMY_HUD_LIFT + lane * ENEMY_HUD_LANE_GAP;
        for (const nudge of ENEMY_HUD_SIDE_NUDGES) {
          const center = transformPoint(matrix, anchorX + nudge, anchorY - lift);
          const rect = {
            x: center.x - localWidth * scale.x / 2,
            y: center.y - localHeight * scale.y,
            w: localWidth * scale.x,
            h: localHeight * scale.y
          };
          if (occupied.some((other) => rectsOverlap(rect, other))) continue;
          occupied.push(rect);
          return { lift, nudge };
        }
      }

      return {
        lift: ENEMY_HUD_LIFT + ENEMY_HUD_MAX_LANES * ENEMY_HUD_LANE_GAP,
        nudge: 0
      };
    }

    function drawBar(bar, lift, nudge, alphaScale) {
      if (!bar) return;
      const args = bar.args.slice();
      args[0] = Number(args[0]) + nudge;
      args[1] = Number(args[1]) - lift;
      ctx.save();
      ctx.setTransform(bar.matrix.a, bar.matrix.b, bar.matrix.c, bar.matrix.d, bar.matrix.e, bar.matrix.f);
      ctx.globalAlpha = bar.alpha * alphaScale;
      ctx.fillStyle = bar.style;
      ctx.fillRect(...args);
      ctx.restore();
    }

    function drawLabel(label, lift, nudge) {
      if (!label) return;
      ctx.save();
      ctx.setTransform(label.matrix.a, label.matrix.b, label.matrix.c, label.matrix.d, label.matrix.e, label.matrix.f);
      ctx.globalAlpha = label.alpha;
      ctx.fillStyle = label.style;
      ctx.font = label.font;
      ctx.textAlign = label.align;
      ctx.textBaseline = label.baseline;
      if (label.maxWidth === undefined) ctx.fillText(label.text, label.x + nudge, label.y - lift);
      else ctx.fillText(label.text, label.x + nudge, label.y - lift, label.maxWidth);
      ctx.restore();
    }

    function flushHudLayout() {
      if (pendingEnemyHud) {
        queuedEnemyHud.push(pendingEnemyHud);
        pendingEnemyHud = null;
      }
      if (!queuedEnemyHud.length) return;

      const groups = queuedEnemyHud.splice(0);
      const nearest = priorityIndex(groups);
      if (nearest >= 0) groups[nearest].priority = true;
      const occupied = actorOccupiedRects();

      groups.forEach((group) => {
        const priority = Boolean(group.priority);
        const placement = choosePlacement(group, priority, occupied);
        const alphaScale = priority ? 1 : NON_PRIORITY_ALPHA;
        drawBar(group.background, placement.lift, placement.nudge, alphaScale);
        drawBar(group.foreground, placement.lift, placement.nudge, alphaScale);
        if (priority) drawLabel(group.label, placement.lift, placement.nudge);
      });
    }

    const api = { flush: flushHudLayout, reset: resetHudLayout };
    window.CrownlessEnemyHud = api;

    return new Proxy(ctx, {
      get(target, property) {
        if (property === "__crownlessEnemyHudClearance") return true;

        if (property === "fillRect") {
          return (...args) => {
            if (!isEnemyHealthBar(args)) return target.fillRect(...args);

            const bar = captureBar(args);
            if (!pendingEnemyHud) {
              pendingEnemyHud = { background: bar, foreground: null, label: null, priority: false };
            } else if (!pendingEnemyHud.foreground) {
              pendingEnemyHud.foreground = bar;
            } else {
              queuedEnemyHud.push(pendingEnemyHud);
              pendingEnemyHud = { background: bar, foreground: null, label: null, priority: false };
            }
            return undefined;
          };
        }

        if (property === "fillText") {
          return (...args) => {
            if (!pendingEnemyHud || args.length < 3) return target.fillText(...args);
            pendingEnemyHud.label = captureLabel(args);
            queuedEnemyHud.push(pendingEnemyHud);
            pendingEnemyHud = null;
            return undefined;
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
