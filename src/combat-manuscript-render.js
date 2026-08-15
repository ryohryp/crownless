(() => {
  "use strict";

  /*
   * Crownless living-manuscript presentation wrapper.
   *
   * combat-render-space.js owns projection / actor placement. This layer keeps
   * the legacy simulation untouched while mapping its Canvas output into the
   * Crownless manuscript palette and, when available, replacing prototype
   * primitives with the generated minimal combat image set.
   */

  const previousGetContext = HTMLCanvasElement.prototype.getContext;

  const ASSET_ROOT = "assets/combat/minimal-v0.1";
  const assetManifest = {
    player: `${ASSET_ROOT}/actors/player-unarmed.png`,
    rusher: `${ASSET_ROOT}/actors/enemy-rusher.png`,
    guard: `${ASSET_ROOT}/actors/enemy-guard.png`,
    skirmisher: `${ASSET_ROOT}/actors/enemy-skirmisher.png`,
    sword: `${ASSET_ROOT}/weapons/dropped-sword.png`,
    dagger: `${ASSET_ROOT}/weapons/dropped-dagger.png`,
    ink: `${ASSET_ROOT}/effects/ink-effects-sheet.png`,
    telegraph: `${ASSET_ROOT}/effects/vermilion-telegraphs-sheet.png`
  };

  const assets = Object.create(null);

  function alphaBounds(image, region = null) {
    try {
      const sx = region ? region.sx : 0;
      const sy = region ? region.sy : 0;
      const sw = Math.max(1, Math.floor(region ? region.sw : image.naturalWidth));
      const sh = Math.max(1, Math.floor(region ? region.sh : image.naturalHeight));
      const sampleScale = Math.min(1, 320 / Math.max(sw, sh));
      const cw = Math.max(1, Math.round(sw * sampleScale));
      const ch = Math.max(1, Math.round(sh * sampleScale));
      const work = document.createElement("canvas");
      work.width = cw;
      work.height = ch;
      const workCtx = work.getContext("2d", { willReadFrequently: true });
      if (!workCtx) return null;
      workCtx.clearRect(0, 0, cw, ch);
      workCtx.drawImage(image, sx, sy, sw, sh, 0, 0, cw, ch);
      const data = workCtx.getImageData(0, 0, cw, ch).data;
      let minX = cw;
      let minY = ch;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < ch; y += 1) {
        for (let x = 0; x < cw; x += 1) {
          if (data[(y * cw + x) * 4 + 3] < 18) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      if (maxX < minX || maxY < minY) return null;
      const inv = 1 / sampleScale;
      const pad = 2 * inv;
      return {
        sx: Math.max(sx, sx + minX * inv - pad),
        sy: Math.max(sy, sy + minY * inv - pad),
        sw: Math.min(sw, (maxX - minX + 1) * inv + pad * 2),
        sh: Math.min(sh, (maxY - minY + 1) * inv + pad * 2)
      };
    } catch (_) {
      return null;
    }
  }

  function splitSheetRegions(image) {
    const horizontal = image.naturalWidth >= image.naturalHeight * 0.9;
    const regions = [];
    for (let i = 0; i < 3; i += 1) {
      const region = horizontal
        ? {
            sx: image.naturalWidth * i / 3,
            sy: 0,
            sw: image.naturalWidth / 3,
            sh: image.naturalHeight
          }
        : {
            sx: 0,
            sy: image.naturalHeight * i / 3,
            sw: image.naturalWidth,
            sh: image.naturalHeight / 3
          };
      regions.push(alphaBounds(image, region) || region);
    }
    return regions;
  }

  function loadAsset(key, url) {
    const record = { key, url, image: null, ready: false, failed: false, bounds: null, regions: null };
    assets[key] = record;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      record.image = image;
      record.ready = true;
      if (key === "ink" || key === "telegraph") record.regions = splitSheetRegions(image);
      else record.bounds = alphaBounds(image);
    };
    image.onerror = () => { record.failed = true; };
    image.src = url;
    return record;
  }

  Object.entries(assetManifest).forEach(([key, url]) => loadAsset(key, url));

  function recordReady(key) {
    const record = assets[key];
    return Boolean(record && record.ready && record.image);
  }

  function drawTrimmed(target, record, dx, dy, dw, dh) {
    if (!record || !record.ready || !record.image) return false;
    const image = record.image;
    const source = record.bounds || { sx: 0, sy: 0, sw: image.naturalWidth, sh: image.naturalHeight };
    const sourceRatio = source.sw / Math.max(1, source.sh);
    const boxRatio = dw / Math.max(1, dh);
    let width = dw;
    let height = dh;
    if (sourceRatio > boxRatio) height = width / sourceRatio;
    else width = height * sourceRatio;
    const x = dx + (dw - width) / 2;
    const y = dy + dh - height;
    target.drawImage(image, source.sx, source.sy, source.sw, source.sh, x, y, width, height);
    return true;
  }

  function actorScreenAxes(target) {
    try {
      const canvas = target.canvas;
      const matrix = target.getTransform();
      if (!canvas || !matrix || typeof canvas.getBoundingClientRect !== "function") return { x: 1, y: 1 };
      const rect = canvas.getBoundingClientRect();
      const cssX = rect.width / Math.max(1, canvas.width);
      const cssY = rect.height / Math.max(1, canvas.height);
      const x = Math.hypot(matrix.a * cssX, matrix.b * cssY);
      const y = Math.hypot(matrix.c * cssX, matrix.d * cssY);
      if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0.0001 || y <= 0.0001) return { x: 1, y: 1 };
      return { x, y };
    } catch (_) {
      return { x: 1, y: 1 };
    }
  }

  function actorFootMetrics(target, logicalFootOffset = 37) {
    const axes = actorScreenAxes(target);
    const yCompensation = Math.max(0.16, Math.min(6, axes.x / axes.y));
    return {
      yCompensation,
      footY: logicalFootOffset * yCompensation
    };
  }

  function drawGroundShadow(target, footY) {
    target.save();
    target.globalAlpha *= 0.24;
    target.fillStyle = "rgba(70, 64, 56, 0.42)";
    target.beginPath();
    target.ellipse(0, footY + 2, 16, 5.5, 0, 0, Math.PI * 2);
    target.fill();
    target.restore();
  }

  function drawActorBillboard(target, record, logicalHeight, logicalFootOffset = 37) {
    if (!record || !record.ready || !record.image) return false;
    const image = record.image;
    const source = record.bounds || { sx: 0, sy: 0, sw: image.naturalWidth, sh: image.naturalHeight };
    const sourceRatio = source.sw / Math.max(1, source.sh);
    const { yCompensation, footY } = actorFootMetrics(target, logicalFootOffset);
    const width = logicalHeight * sourceRatio;
    const height = logicalHeight * yCompensation;
    drawGroundShadow(target, footY);
    target.drawImage(
      image,
      source.sx,
      source.sy,
      source.sw,
      source.sh,
      -width / 2,
      footY - height,
      width,
      height
    );
    return true;
  }

  function drawSheetSlice(target, key, index, dx, dy, dw, dh) {
    const record = assets[key];
    if (!record || !record.ready || !record.image || !record.regions) return false;
    const source = record.regions[Math.max(0, Math.min(2, index))];
    const sourceRatio = source.sw / Math.max(1, source.sh);
    const boxRatio = dw / Math.max(1, dh);
    let width = dw;
    let height = dh;
    if (sourceRatio > boxRatio) height = width / sourceRatio;
    else width = height * sourceRatio;
    target.drawImage(
      record.image,
      source.sx,
      source.sy,
      source.sw,
      source.sh,
      dx + (dw - width) / 2,
      dy + (dh - height) / 2,
      width,
      height
    );
    return true;
  }

  const exactColorMap = new Map([
    ["#17140f", "#d8c7a5"],
    ["#10150f", "#d2c19e"],
    ["#17150f", "#d9c8a6"],
    ["#0f1716", "#c9c0a0"],
    ["#18140f", "#d7c29d"],
    ["#151315", "#d0c0a3"],
    ["#262017", "#ad9873"],
    ["#1b281a", "#9d9d79"],
    ["#272219", "#b29d78"],
    ["#172522", "#8fa099"],
    ["#2a2017", "#b28d67"],
    ["#261e24", "#a28f91"],
    ["#8b7449", "#806443"],
    ["#65714f", "#5f705b"],
    ["#857452", "#786142"],
    ["#55766e", "#547a73"],
    ["#98734b", "#8a6138"],
    ["#785e70", "#745a62"],
    ["#ffd875", "#17130f"],
    ["#f2c96f", "#17130f"],
    ["#e8d8b7", "#211a14"],
    ["#f0dda8", "#302319"],
    ["#e3c66e", "#8a5c29"],
    ["#eee8dc", "#3b3024"],
    ["#e5cf91", "#9b7134"],
    ["#f2df9c", "#a27437"],
    ["#e5c875", "#9b7134"],
    ["#c8d3b1", "#547a73"],
    ["#e8cf88", "#8f6934"],
    ["#cbd5b8", "#547a73"],
    ["#f1d77e", "#9b7134"]
  ]);

  const dangerHex = new Set(["#ff735f", "#ff6b57", "#ef6658", "#ff9a73"]);
  const actorFillRole = new Map([
    ["#e4c997", "player"],
    ["#ef8c75", "player"],
    ["#eef2df", "player"],
    ["#81765e", "guard"],
    ["#78805b", "skirmisher"],
    ["#a65347", "rusher"]
  ]);
  const playerWeaponStroke = new Set(["#e9d38d", "#d7c7a3", "#dce0bd", "#c8c6b7", "#f0d979"]);
  const inkSlashStroke = new Map([
    ["#e8d8b7", { slice: 0, box: [-44, -34, 88, 68] }],
    ["#ffd875", { slice: 1, box: [-62, -46, 124, 92] }],
    ["#f2c96f", { slice: 2, box: [-56, -40, 112, 80] }]
  ]);

  function normalize(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : value;
  }

  function remapHexWithAlpha(value) {
    const key = normalize(value);
    if (typeof key !== "string") return value;
    if (exactColorMap.has(key)) return exactColorMap.get(key);
    const match = key.match(/^(#[0-9a-f]{6})([0-9a-f]{2})$/i);
    if (match && exactColorMap.has(match[1])) return `${exactColorMap.get(match[1])}${match[2]}`;
    if (dangerHex.has(key)) return "#9c3b2d";
    return value;
  }

  function remapRgba(value) {
    const key = normalize(value);
    if (typeof key !== "string") return value;
    let match = key.match(/^rgba\(235\s*,\s*72\s*,\s*58\s*,\s*([0-9.]+)\)$/);
    if (match) return `rgba(156,59,45,${match[1]})`;
    match = key.match(/^rgba\(240\s*,\s*210\s*,\s*110\s*,\s*([0-9.]+)\)$/);
    if (match) return `rgba(139,96,43,${match[1]})`;
    match = key.match(/^rgba\(238\s*,\s*232\s*,\s*220\s*,\s*([0-9.]+)\)$/);
    if (match) return `rgba(49,39,29,${Math.min(0.58, Number(match[1]) * 1.25)})`;
    match = key.match(/^rgba\(142\s*,\s*173\s*,\s*121\s*,\s*([0-9.]+)\)$/);
    if (match) return `rgba(84,122,115,${match[1]})`;
    return value;
  }

  function remapColor(value) {
    if (typeof value !== "string") return value;
    const rgba = remapRgba(value);
    if (rgba !== value) return rgba;
    return remapHexWithAlpha(value);
  }

  function isInkStroke(style) {
    const value = normalize(style);
    return value === "#17130f" || value === "#211a14" || value === "#302319" || value === "#3b3024";
  }

  function isTelegraphStroke(value) {
    const key = normalize(value);
    return typeof key === "string"
      && (/^rgba\(235\s*,\s*72\s*,\s*58\s*,/.test(key) || /^rgba\(240\s*,\s*210\s*,\s*110\s*,/.test(key));
  }

  function isSkirmisherTelegraph(value) {
    const key = normalize(value);
    return typeof key === "string" && /^rgba\(240\s*,\s*210\s*,\s*110\s*,/.test(key);
  }

  function wrapGradient(gradient) {
    if (!gradient || gradient.__crownlessManuscriptGradient) return gradient;
    const originalAddColorStop = gradient.addColorStop.bind(gradient);
    gradient.addColorStop = (offset, color) => originalAddColorStop(offset, remapColor(color));
    try { Object.defineProperty(gradient, "__crownlessManuscriptGradient", { value: true }); }
    catch (_) {}
    return gradient;
  }

  function wrapArenaContext(ctx) {
    if (!ctx || ctx.__crownlessManuscriptContext) return ctx;

    let currentStroke = "";
    let currentOriginalStroke = "";
    let currentLineWidth = 1;
    let saveDepth = 0;
    let actorSuppressDepth = 0;
    let fallbackShadowDepth = -1;
    let dropSuppressDepth = 0;
    let pathShape = "";
    let telegraphActive = false;
    let telegraphSkirmisher = false;
    let slashSpec = null;
    const roleCache = [];
    const methods = new Map();

    function currentPoint() {
      try {
        const matrix = ctx.getTransform();
        return { x: Number(matrix.e) || 0, y: Number(matrix.f) || 0 };
      } catch (_) {
        return null;
      }
    }

    function nearestCachedRole(point, maxDistance = 74) {
      if (!point) return null;
      let best = null;
      let bestDistance = maxDistance;
      roleCache.forEach((entry) => {
        const distance = Math.hypot(entry.x - point.x, entry.y - point.y);
        if (distance < bestDistance) {
          best = entry;
          bestDistance = distance;
        }
      });
      return best ? best.role : null;
    }

    function rememberRole(role) {
      if (!role || role === "player") return;
      const point = currentPoint();
      if (!point) return;
      let nearest = null;
      let nearestDistance = 54;
      roleCache.forEach((entry) => {
        const distance = Math.hypot(entry.x - point.x, entry.y - point.y);
        if (distance < nearestDistance) {
          nearest = entry;
          nearestDistance = distance;
        }
      });
      const now = performance.now();
      if (nearest) Object.assign(nearest, point, { role, seen: now });
      else roleCache.push({ ...point, role, seen: now });
      const cutoff = now - 2500;
      for (let i = roleCache.length - 1; i >= 0; i -= 1) {
        if (roleCache[i].seen < cutoff) roleCache.splice(i, 1);
      }
    }

    function resolveActorRole(fill) {
      const key = normalize(fill);
      const direct = actorFillRole.get(key);
      if (direct) return direct;
      if (key === "#f0b28c") return nearestCachedRole(currentPoint());
      return null;
    }

    function drawFallbackActorShadow() {
      if (fallbackShadowDepth === saveDepth) return;
      const { footY } = actorFootMetrics(ctx, 37);
      drawGroundShadow(ctx, footY);
      fallbackShadowDepth = saveDepth;
    }

    function drawActor(role) {
      if (!recordReady(role)) return false;
      const record = assets[role];
      const logicalHeight = role === "guard" ? 138 : role === "rusher" ? 132 : role === "skirmisher" ? 132 : 132;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      const drawn = drawActorBillboard(ctx, record, logicalHeight, 37);
      ctx.restore();
      if (drawn) rememberRole(role);
      return drawn;
    }

    function drawDroppedWeapon(type) {
      const key = type === "sword" ? "sword" : "dagger";
      if (!recordReady(key)) return false;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      const drawn = type === "sword"
        ? drawTrimmed(ctx, assets[key], -34, -22, 68, 42)
        : drawTrimmed(ctx, assets[key], -27, -19, 54, 36);
      ctx.restore();
      return drawn;
    }

    function drawTelegraph() {
      if (!recordReady("telegraph")) return false;
      const role = nearestCachedRole(currentPoint());
      if (telegraphSkirmisher) {
        if (pathShape !== "line") return true;
        return drawSheetSlice(ctx, "telegraph", 2, 8, -34, 176, 68);
      }
      if (pathShape !== "arc") return false;
      if (role === "guard") return drawSheetSlice(ctx, "telegraph", 1, -58, -42, 116, 84);
      return drawSheetSlice(ctx, "telegraph", 0, -58, -42, 116, 84);
    }

    function drawInkSlash() {
      if (!slashSpec || !recordReady("ink") || pathShape !== "arc") return false;
      const [x, y, w, h] = slashSpec.box;
      return drawSheetSlice(ctx, "ink", slashSpec.slice, x, y, w, h);
    }

    function suppressingPrimitive() {
      return actorSuppressDepth === saveDepth || dropSuppressDepth === saveDepth;
    }

    const wrapped = new Proxy(ctx, {
      get(target, property) {
        if (property === "__crownlessManuscriptContext") return true;

        if (property === "createLinearGradient" || property === "createRadialGradient") {
          return (...args) => wrapGradient(target[property](...args));
        }

        if (property === "save") {
          return () => {
            target.save();
            saveDepth += 1;
          };
        }

        if (property === "restore") {
          return () => {
            target.restore();
            if (actorSuppressDepth === saveDepth) actorSuppressDepth = 0;
            if (fallbackShadowDepth === saveDepth) fallbackShadowDepth = -1;
            if (dropSuppressDepth === saveDepth) dropSuppressDepth = 0;
            saveDepth = Math.max(0, saveDepth - 1);
            pathShape = "";
            telegraphActive = false;
            telegraphSkirmisher = false;
            slashSpec = null;
          };
        }

        if (property === "beginPath") {
          return () => {
            pathShape = "";
            target.beginPath();
          };
        }

        if (property === "arc") {
          return (...args) => {
            pathShape = "arc";
            if (suppressingPrimitive()) return;
            target.arc(...args);
          };
        }

        if (property === "moveTo") {
          return (...args) => {
            pathShape = pathShape || "line";
            if (suppressingPrimitive()) return;
            target.moveTo(...args);
          };
        }

        if (property === "lineTo") {
          return (...args) => {
            pathShape = "line";
            if (suppressingPrimitive()) return;
            target.lineTo(...args);
          };
        }

        if (property === "fill") {
          return (...args) => {
            if (suppressingPrimitive()) return;
            target.fill(...args);
          };
        }

        if (property === "fillRect") {
          return (...args) => {
            if (suppressingPrimitive()) return;
            target.fillRect(...args);
          };
        }

        if (property === "stroke") {
          return (...args) => {
            if (suppressingPrimitive()) return;

            if (telegraphActive && recordReady("telegraph")) {
              const handled = drawTelegraph();
              pathShape = "";
              if (handled) return;
            }

            if (slashSpec && recordReady("ink")) {
              const handled = drawInkSlash();
              pathShape = "";
              if (handled) return;
            }

            target.stroke(...args);
            if (!isInkStroke(currentStroke) || currentLineWidth < 3) return;

            target.save();
            const oldAlpha = target.globalAlpha;
            const oldWidth = target.lineWidth;
            target.globalAlpha = Math.max(0.035, oldAlpha * 0.13);
            target.lineWidth = oldWidth + 2.4;
            target.stroke(...args);
            target.globalAlpha = oldAlpha;
            target.lineWidth = oldWidth;
            target.restore();
          };
        }

        const value = target[property];
        if (typeof value !== "function") return value;
        if (!methods.has(property)) methods.set(property, (...args) => value.apply(target, args));
        return methods.get(property);
      },

      set(target, property, value) {
        const original = typeof value === "string" ? normalize(value) : value;

        if (property === "fillStyle") {
          const role = resolveActorRole(value);
          if (role) {
            if (drawActor(role)) {
              actorSuppressDepth = saveDepth;
              target[property] = "rgba(0,0,0,0)";
              return true;
            }
            drawFallbackActorShadow();
          }
          target[property] = remapColor(value);
          return true;
        }

        if (property === "strokeStyle") {
          currentOriginalStroke = original;
          telegraphActive = isTelegraphStroke(value);
          telegraphSkirmisher = isSkirmisherTelegraph(value);
          slashSpec = typeof original === "string" ? inkSlashStroke.get(original) || null : null;

          if (actorSuppressDepth === saveDepth && typeof original === "string" && playerWeaponStroke.has(original)) {
            actorSuppressDepth = 0;
          }

          const mapped = remapColor(value);
          currentStroke = mapped;
          target[property] = mapped;
          return true;
        }

        if (property === "shadowColor") {
          const key = normalize(value);
          let dropType = null;
          if (key === "rgba(237,202,112,.8)" || key === "rgba(237,202,112,0.8)") dropType = "sword";
          if (key === "rgba(194,210,173,.75)" || key === "rgba(194,210,173,0.75)") dropType = "dagger";
          if (dropType && drawDroppedWeapon(dropType)) {
            dropSuppressDepth = saveDepth;
            target[property] = "rgba(0,0,0,0)";
            return true;
          }
          if (dropType === "sword") {
            target[property] = "rgba(139,96,43,.42)";
            return true;
          }
          if (dropType === "dagger") {
            target[property] = "rgba(84,122,115,.36)";
            return true;
          }
        }

        if (property === "shadowBlur") {
          target[property] = dropSuppressDepth === saveDepth ? 0 : Math.min(Number(value) || 0, 8);
          return true;
        }

        if (property === "lineWidth") {
          currentLineWidth = Number(value) || 1;
          target[property] = value;
          return true;
        }

        if (property === "lineCap" && value === "round" && isInkStroke(currentStroke)) {
          target[property] = "butt";
          return true;
        }

        target[property] = value;
        return true;
      }
    });

    return wrapped;
  }

  HTMLCanvasElement.prototype.getContext = function manuscriptGetContext(type, options) {
    const ctx = previousGetContext.call(this, type, options);
    if (type !== "2d" || !ctx || this.id !== "arena") return ctx;
    if (!this.__crownlessManuscriptWrappedContext) {
      this.__crownlessManuscriptWrappedContext = wrapArenaContext(ctx);
    }
    return this.__crownlessManuscriptWrappedContext;
  };

  window.CrownlessCombatAssets = {
    manifest: { ...assetManifest },
    status() {
      return Object.fromEntries(Object.entries(assets).map(([key, record]) => [key, record.ready ? "ready" : record.failed ? "failed" : "loading"]));
    }
  };
})();
