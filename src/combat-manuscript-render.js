(() => {
  "use strict";

  /*
   * Presentation-only wrapper layered on top of combat-render-space.js.
   * The existing renderer still owns projection and gameplay-space behavior.
   * This wrapper only translates familiar prototype colors into Crownless's
   * living-manuscript palette and adds a slight ink-bleed to strong strokes.
   */

  const previousGetContext = HTMLCanvasElement.prototype.getContext;

  const groundMap = new Map([
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
    ["#785e70", "#745a62"]
  ]);

  const inkStrokeMap = new Map([
    ["#ffd875", "#17130f"],
    ["#f2c96f", "#17130f"],
    ["#e8d8b7", "#211a14"],
    ["#f0dda8", "#302319"],
    ["#e3c66e", "#8a5c29"]
  ]);

  const mutedAccentMap = new Map([
    ["#e5cf91", "#9b7134"],
    ["#f2df9c", "#a27437"],
    ["#e5c875", "#9b7134"],
    ["#c8d3b1", "#547a73"]
  ]);

  function normalize(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : value;
  }

  function mapFill(value) {
    const key = normalize(value);
    if (typeof key !== "string") return value;
    if (groundMap.has(key)) return groundMap.get(key);
    if (mutedAccentMap.has(key)) return mutedAccentMap.get(key);
    return value;
  }

  function mapStroke(value) {
    const key = normalize(value);
    if (typeof key !== "string") return value;
    if (inkStrokeMap.has(key)) return inkStrokeMap.get(key);
    if (key === "#ff735f" || key === "#ff6b57" || key === "#ef6658") return "#9c3b2d";
    if (key === "#ff9a73" || key === "#ef8c75") return "#b34d38";
    if (mutedAccentMap.has(key)) return mutedAccentMap.get(key);
    return value;
  }

  function isInkStroke(style) {
    const value = normalize(style);
    return value === "#17130f" || value === "#211a14" || value === "#302319";
  }

  function wrapArenaContext(ctx) {
    if (!ctx || ctx.__crownlessManuscriptContext) return ctx;

    let currentStroke = "";
    let currentLineWidth = 1;
    const methods = new Map();

    const wrapped = new Proxy(ctx, {
      get(target, property) {
        if (property === "__crownlessManuscriptContext") return true;

        if (property === "stroke") {
          return (...args) => {
            target.stroke(...args);
            if (!isInkStroke(currentStroke) || currentLineWidth < 3) return;

            /* A second, translucent wider pass gives strong attacks and weapon
               marks the slightly soaked edge of ink on rough parchment. */
            target.save();
            const oldAlpha = target.globalAlpha;
            const oldWidth = target.lineWidth;
            target.globalAlpha = Math.max(0.04, oldAlpha * 0.15);
            target.lineWidth = oldWidth + 2.2;
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
          target[property] = mapFill(value);
          return true;
        }

        if (property === "strokeStyle") {
          const mapped = mapStroke(value);
          currentStroke = mapped;
          target[property] = mapped;
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
