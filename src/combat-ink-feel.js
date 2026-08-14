(() => {
  "use strict";

  // Presentation-only combat feel pass layered after combat-manuscript-render.
  // It preserves simulation timings while restoring the authored meanings of
  // the ink sheet: slash / impact / broken-hatch recoil.
  const previousGetContext = HTMLCanvasElement.prototype.getContext;
  const INK_URL = "assets/combat/minimal-v0.1/effects/ink-effects-sheet.png";
  const ink = { image: null, regions: null, ready: false };

  function alphaBounds(image, region) {
    try {
      const scale = Math.min(1, 240 / Math.max(region.sw, region.sh));
      const width = Math.max(1, Math.round(region.sw * scale));
      const height = Math.max(1, Math.round(region.sh * scale));
      const work = document.createElement("canvas");
      work.width = width;
      work.height = height;
      const ctx = work.getContext("2d", { willReadFrequently: true });
      if (!ctx) return region;
      ctx.drawImage(image, region.sx, region.sy, region.sw, region.sh, 0, 0, width, height);
      const data = ctx.getImageData(0, 0, width, height).data;
      let minX = width, minY = height, maxX = -1, maxY = -1;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (data[(y * width + x) * 4 + 3] < 18) continue;
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
      }
      if (maxX < minX) return region;
      const inv = 1 / scale;
      const pad = 2 * inv;
      return {
        sx: Math.max(region.sx, region.sx + minX * inv - pad),
        sy: Math.max(region.sy, region.sy + minY * inv - pad),
        sw: Math.min(region.sw, (maxX - minX + 1) * inv + pad * 2),
        sh: Math.min(region.sh, (maxY - minY + 1) * inv + pad * 2)
      };
    } catch (_) {
      return region;
    }
  }

  function splitInkSheet(image) {
    const horizontal = image.naturalWidth >= image.naturalHeight * 0.9;
    return [0, 1, 2].map((index) => {
      const region = horizontal
        ? { sx: image.naturalWidth * index / 3, sy: 0, sw: image.naturalWidth / 3, sh: image.naturalHeight }
        : { sx: 0, sy: image.naturalHeight * index / 3, sw: image.naturalWidth, sh: image.naturalHeight / 3 };
      return alphaBounds(image, region);
    });
  }

  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    ink.image = image;
    ink.regions = splitInkSheet(image);
    ink.ready = true;
  };
  image.src = INK_URL;

  const roleColors = new Map([
    ["#81765e", "guard"],
    ["#78805b", "skirmisher"],
    ["#a65347", "rusher"]
  ]);
  const slashStyles = new Map([
    ["#e8d8b7", { box: [-44, -34, 88, 68], alpha: 0.78 }],
    ["#ffd875", { box: [-66, -50, 132, 100], alpha: 1 }],
    ["#f2c96f", { box: [-58, -43, 116, 86], alpha: 0.92 }]
  ]);

  function normalize(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : value;
  }

  function telegraphAlpha(value) {
    const key = normalize(value);
    if (typeof key !== "string") return null;
    const danger = /^rgba\(235\s*,\s*72\s*,\s*58\s*,\s*([0-9.]+)\)$/;
    const ranged = /^rgba\(240\s*,\s*210\s*,\s*110\s*,\s*([0-9.]+)\)$/;
    const match = key.match(danger) || key.match(ranged);
    if (!match) return null;
    const alpha = Number(match[1]);
    return Number.isFinite(alpha) ? Math.max(0.18, Math.min(1, alpha)) : 1;
  }

  function drawSlice(target, index, box, alpha = 1) {
    if (!ink.ready || !ink.image || !ink.regions) return false;
    const source = ink.regions[index];
    const [dx, dy, dw, dh] = box;
    const sourceRatio = source.sw / Math.max(1, source.sh);
    const boxRatio = dw / Math.max(1, dh);
    let width = dw, height = dh;
    if (sourceRatio > boxRatio) height = width / sourceRatio;
    else width = height * sourceRatio;
    const oldAlpha = target.globalAlpha;
    target.globalAlpha = oldAlpha * alpha;
    target.drawImage(
      ink.image,
      source.sx, source.sy, source.sw, source.sh,
      dx + (dw - width) / 2,
      dy + (dh - height) / 2,
      width, height
    );
    target.globalAlpha = oldAlpha;
    return true;
  }

  function reactionBoxes(role) {
    if (role === "guard") return { recoil: [-58, -30, 68, 52], impact: [8, -43, 76, 64] };
    if (role === "skirmisher") return { recoil: [-50, -28, 58, 46], impact: [10, -40, 64, 54] };
    return { recoil: [-54, -29, 62, 48], impact: [12, -41, 70, 58] };
  }

  function wrap(ctx) {
    if (!ctx || ctx.__crownlessInkFeelContext) return ctx;
    let pathShape = "";
    let slashSpec = null;
    let warningAlpha = null;
    const roleCache = [];
    const methods = new Map();

    function point() {
      try {
        const matrix = ctx.getTransform();
        return { x: Number(matrix.e) || 0, y: Number(matrix.f) || 0 };
      } catch (_) { return null; }
    }

    function rememberRole(role) {
      const at = point();
      if (!at) return;
      let nearest = null, distance = 54;
      roleCache.forEach((entry) => {
        const d = Math.hypot(entry.x - at.x, entry.y - at.y);
        if (d < distance) { nearest = entry; distance = d; }
      });
      const now = performance.now();
      if (nearest) Object.assign(nearest, at, { role, seen: now });
      else roleCache.push({ ...at, role, seen: now });
      for (let i = roleCache.length - 1; i >= 0; i -= 1) {
        if (roleCache[i].seen < now - 2500) roleCache.splice(i, 1);
      }
    }

    function nearestRole() {
      const at = point();
      if (!at) return null;
      let best = null, distance = 74;
      roleCache.forEach((entry) => {
        const d = Math.hypot(entry.x - at.x, entry.y - at.y);
        if (d < distance) { best = entry.role; distance = d; }
      });
      return best;
    }

    const proxy = new Proxy(ctx, {
      get(target, property) {
        if (property === "__crownlessInkFeelContext") return true;
        if (property === "beginPath") return () => { pathShape = ""; target.beginPath(); };
        if (property === "arc") return (...args) => { pathShape = "arc"; target.arc(...args); };
        if (property === "moveTo") return (...args) => { pathShape = pathShape || "line"; target.moveTo(...args); };
        if (property === "lineTo") return (...args) => { pathShape = "line"; target.lineTo(...args); };
        if (property === "restore") return () => {
          target.restore();
          pathShape = ""; slashSpec = null; warningAlpha = null;
        };
        if (property === "stroke") return (...args) => {
          if (warningAlpha !== null) {
            const oldAlpha = target.globalAlpha;
            target.globalAlpha = oldAlpha * warningAlpha;
            target.stroke(...args);
            target.globalAlpha = oldAlpha;
            return;
          }
          if (slashSpec && pathShape === "arc" && drawSlice(target, 0, slashSpec.box, slashSpec.alpha)) {
            pathShape = "";
            return;
          }
          target.stroke(...args);
        };
        const value = target[property];
        if (typeof value !== "function") return value;
        if (!methods.has(property)) methods.set(property, (...args) => value.apply(target, args));
        return methods.get(property);
      },
      set(target, property, value) {
        const original = normalize(value);
        if (property === "strokeStyle") {
          slashSpec = slashStyles.get(original) || null;
          warningAlpha = telegraphAlpha(value);
          target[property] = value;
          return true;
        }
        if (property === "fillStyle") {
          const role = roleColors.get(original);
          if (role) rememberRole(role);
          if (original === "#f0b28c") {
            const hitRole = nearestRole();
            if (hitRole) {
              const boxes = reactionBoxes(hitRole);
              drawSlice(target, 2, boxes.recoil, 0.42);
              target[property] = value;
              drawSlice(target, 1, boxes.impact, hitRole === "guard" ? 0.62 : 0.72);
              return true;
            }
          }
        }
        target[property] = value;
        return true;
      }
    });
    return proxy;
  }

  HTMLCanvasElement.prototype.getContext = function crownlessInkFeelGetContext(type, options) {
    const ctx = previousGetContext.call(this, type, options);
    if (type !== "2d" || !ctx || this.id !== "arena") return ctx;
    if (!this.__crownlessInkFeelWrappedContext) this.__crownlessInkFeelWrappedContext = wrap(ctx);
    return this.__crownlessInkFeelWrappedContext;
  };
})();
