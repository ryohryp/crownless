(() => {
  "use strict";

  /*
   * Crownless living-manuscript presentation wrapper.
   *
   * combat-render-space.js still owns projection and actor placement. This
   * layer remaps the legacy prototype palette at the Canvas API boundary so
   * the battlefield reads as parchment / ink / vermilion without touching
   * combat simulation or timing.
   */

  const previousGetContext = HTMLCanvasElement.prototype.getContext;

  const exactColorMap = new Map([
    // Ground palette used by drawGround().
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

    // Attack / interaction strokes.
    ["#ffd875", "#17130f"],
    ["#f2c96f", "#17130f"],
    ["#e8d8b7", "#211a14"],
    ["#f0dda8", "#302319"],
    ["#e3c66e", "#8a5c29"],
    ["#eee8dc", "#3b3024"],

    // Temporary battlefield weapon / earned accents.
    ["#e5cf91", "#9b7134"],
    ["#f2df9c", "#a27437"],
    ["#e5c875", "#9b7134"],
    ["#c8d3b1", "#547a73"],
    ["#e8cf88", "#8f6934"],
    ["#cbd5b8", "#547a73"],
    ["#f1d77e", "#9b7134"]
  ]);

  const dangerHex = new Set(["#ff735f", "#ff6b57", "#ef6658", "#ff9a73"]);

  function normalize(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : value;
  }

  function remapHexWithAlpha(value) {
    const key = normalize(value);
    if (typeof key !== "string") return value;
    if (exactColorMap.has(key)) return exactColorMap.get(key);

    // drawGround uses #RRGGBBAA for faint map/terrain strokes. Preserve alpha
    // while translating the base hue into the manuscript palette.
    const match = key.match(/^(#[0-9a-f]{6})([0-9a-f]{2})$/i);
    if (match && exactColorMap.has(match[1])) {
      return `${exactColorMap.get(match[1])}${match[2]}`;
    }

    if (dangerHex.has(key)) return "#9c3b2d";
    return value;
  }

  function remapRgba(value) {
    const key = normalize(value);
    if (typeof key !== "string") return value;

    // Enemy attack telegraphs: red becomes vermilion; ranged yellow becomes
    // restrained ochre. Keep the original alpha because timing readability is
    // gameplay information.
    let match = key.match(/^rgba\(235\s*,\s*72\s*,\s*58\s*,\s*([0-9.]+)\)$/);
    if (match) return `rgba(156,59,45,${match[1]})`;

    match = key.match(/^rgba\(240\s*,\s*210\s*,\s*110\s*,\s*([0-9.]+)\)$/);
    if (match) return `rgba(139,96,43,${match[1]})`;

    // Pointer / ready-state white should read as graphite, not glowing HUD.
    match = key.match(/^rgba\(238\s*,\s*232\s*,\s*220\s*,\s*([0-9.]+)\)$/);
    if (match) return `rgba(49,39,29,${Math.min(0.58, Number(match[1]) * 1.25)})`;

    // Healthy ready-state green becomes faded discovered-land teal.
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

  function wrapGradient(gradient) {
    if (!gradient || gradient.__crownlessManuscriptGradient) return gradient;
    const originalAddColorStop = gradient.addColorStop.bind(gradient);
    gradient.addColorStop = (offset, color) => originalAddColorStop(offset, remapColor(color));
    try {
      Object.defineProperty(gradient, "__crownlessManuscriptGradient", { value: true });
    } catch (_) {}
    return gradient;
  }

  function wrapArenaContext(ctx) {
    if (!ctx || ctx.__crownlessManuscriptContext) return ctx;

    let currentStroke = "";
    let currentLineWidth = 1;
    const methods = new Map();

    const wrapped = new Proxy(ctx, {
      get(target, property) {
        if (property === "__crownlessManuscriptContext") return true;

        if (property === "createLinearGradient" || property === "createRadialGradient") {
          return (...args) => wrapGradient(target[property](...args));
        }

        if (property === "stroke") {
          return (...args) => {
            target.stroke(...args);
            if (!isInkStroke(currentStroke) || currentLineWidth < 3) return;

            // A second, translucent wider pass creates a rough soaked edge
            // instead of a neon/glow slash.
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
        if (!methods.has(property)) {
          methods.set(property, (...args) => value.apply(target, args));
        }
        return methods.get(property);
      },

      set(target, property, value) {
        if (property === "fillStyle") {
          target[property] = remapColor(value);
          return true;
        }

        if (property === "strokeStyle") {
          const mapped = remapColor(value);
          currentStroke = mapped;
          target[property] = mapped;
          return true;
        }

        if (property === "shadowColor") {
          // Battlefield pickups may glow a little, but never with a glossy
          // magical halo. Desaturate known warm/green glows.
          const key = normalize(value);
          if (key === "rgba(237,202,112,.8)" || key === "rgba(237,202,112,0.8)") {
            target[property] = "rgba(139,96,43,.42)";
            return true;
          }
          if (key === "rgba(194,210,173,.75)" || key === "rgba(194,210,173,0.75)") {
            target[property] = "rgba(84,122,115,.36)";
            return true;
          }
        }

        if (property === "shadowBlur") {
          // Cap legacy glow radii so the screen remains ink/paper first.
          target[property] = Math.min(Number(value) || 0, 8);
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
})();
