(() => {
  "use strict";

  // Presentation-only feel layer. The ink sheet is authored as
  // slash / impact / broken-hatch recoil; simulation timings stay untouched.
  const ink = new Image();
  ink.decoding = "async";
  ink.src = "assets/combat/minimal-v0.1/effects/ink-effects-sheet.png";

  const roles = new Map([
    ["#81765e", "guard"],
    ["#78805b", "skirmisher"],
    ["#a65347", "rusher"]
  ]);
  const slashes = new Map([
    ["#e8d8b7", { box: [-48, -38, 96, 76], alpha: .78 }],
    ["#ffd875", { box: [-72, -55, 144, 110], alpha: 1 }],
    ["#f2c96f", { box: [-64, -48, 128, 96], alpha: .92 }]
  ]);
  const norm = (v) => typeof v === "string" ? v.trim().toLowerCase() : v;

  function warningAlpha(v) {
    const s = norm(v);
    if (typeof s !== "string") return null;
    const m = s.match(/^rgba\((?:235\s*,\s*72\s*,\s*58|240\s*,\s*210\s*,\s*110)\s*,\s*([0-9.]+)\)$/);
    return m ? Math.max(.18, Math.min(1, Number(m[1]) || 1)) : null;
  }

  function drawSlice(ctx, index, box, alpha) {
    if (!ink.complete || !ink.naturalWidth) return false;
    const horizontal = ink.naturalWidth >= ink.naturalHeight * .9;
    const sx = horizontal ? ink.naturalWidth * index / 3 : 0;
    const sy = horizontal ? 0 : ink.naturalHeight * index / 3;
    const sw = horizontal ? ink.naturalWidth / 3 : ink.naturalWidth;
    const sh = horizontal ? ink.naturalHeight : ink.naturalHeight / 3;
    const [x, y, w, h] = box;
    const ratio = sw / Math.max(1, sh);
    let dw = w, dh = h;
    if (ratio > w / Math.max(1, h)) dh = dw / ratio;
    else dw = dh * ratio;
    const old = ctx.globalAlpha;
    ctx.globalAlpha = old * alpha;
    ctx.drawImage(ink, sx, sy, sw, sh, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.globalAlpha = old;
    return true;
  }

  function reaction(role) {
    if (role === "guard") return { back: [-64, -34, 76, 60], hit: [6, -48, 86, 72] };
    if (role === "skirmisher") return { back: [-56, -32, 66, 54], hit: [8, -44, 74, 62] };
    return { back: [-60, -33, 70, 56], hit: [10, -46, 80, 66] };
  }

  function wrap(ctx) {
    let shape = "", slash = null, warning = null;
    const cache = [], methods = new Map();
    const point = () => {
      try { const m = ctx.getTransform(); return { x: +m.e || 0, y: +m.f || 0 }; }
      catch (_) { return null; }
    };
    const remember = (role) => {
      const p = point(); if (!p) return;
      let near = null, d0 = 54;
      cache.forEach((e) => { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < d0) { near = e; d0 = d; } });
      const now = performance.now();
      if (near) Object.assign(near, p, { role, seen: now }); else cache.push({ ...p, role, seen: now });
      for (let i = cache.length - 1; i >= 0; i--) if (cache[i].seen < now - 2500) cache.splice(i, 1);
    };
    const nearest = () => {
      const p = point(); if (!p) return null;
      let role = null, d0 = 74;
      cache.forEach((e) => { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < d0) { role = e.role; d0 = d; } });
      return role;
    };

    return new Proxy(ctx, {
      get(t, p) {
        if (p === "beginPath") return () => { shape = ""; t.beginPath(); };
        if (p === "arc") return (...a) => { shape = "arc"; t.arc(...a); };
        if (p === "moveTo") return (...a) => { shape ||= "line"; t.moveTo(...a); };
        if (p === "lineTo") return (...a) => { shape = "line"; t.lineTo(...a); };
        if (p === "restore") return () => { t.restore(); shape = ""; slash = null; warning = null; };
        if (p === "stroke") return (...a) => {
          if (warning !== null) {
            const old = t.globalAlpha; t.globalAlpha = old * warning; t.stroke(...a); t.globalAlpha = old; return;
          }
          if (slash && shape === "arc" && drawSlice(t, 0, slash.box, slash.alpha)) { shape = ""; return; }
          t.stroke(...a);
        };
        const v = t[p];
        if (typeof v !== "function") return v;
        if (!methods.has(p)) methods.set(p, (...a) => v.apply(t, a));
        return methods.get(p);
      },
      set(t, p, v) {
        const original = norm(v);
        if (p === "strokeStyle") {
          slash = slashes.get(original) || null;
          warning = warningAlpha(v);
        }
        if (p === "fillStyle") {
          const role = roles.get(original); if (role) remember(role);
          if (original === "#f0b28c") {
            const hitRole = nearest();
            if (hitRole) {
              const b = reaction(hitRole);
              drawSlice(t, 2, b.back, .42);
              t[p] = v;
              drawSlice(t, 1, b.hit, hitRole === "guard" ? .62 : .72);
              return true;
            }
          }
        }
        t[p] = v; return true;
      }
    });
  }

  let installed = false;
  function install() {
    if (installed) return;
    installed = true;
    const previous = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, options) {
      const ctx = previous.call(this, type, options);
      if (type !== "2d" || !ctx || this.id !== "arena") return ctx;
      if (!this.__crownlessInkFeel) this.__crownlessInkFeel = wrap(ctx);
      return this.__crownlessInkFeel;
    };
  }

  function arm(script) {
    if (window.CrownlessCombatAssets) return install();
    script.addEventListener("load", install, { once: true });
  }

  const found = Array.from(document.scripts).find((s) => /combat-manuscript-render\.js(?:$|\?)/.test(s.src));
  if (found) arm(found);
  else {
    const observer = new MutationObserver((records) => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node instanceof HTMLScriptElement && /combat-manuscript-render\.js(?:$|\?)/.test(node.src)) {
          observer.disconnect(); arm(node); return;
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
