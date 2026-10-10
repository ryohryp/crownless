/* Two tiny source-controlled pixel silhouettes on top of the approved ink-wash map.
   Render only discovered POIs. No engine, external asset or new save field. */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof root === "object") root.CrownlessMapPixelArt = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const PIXELS = Object.freeze({
    shop: [
      "............",
      "...kkkkkk...",
      "..kkkkkkkk..",
      ".kkkwwwwkkk.",
      ".kwwwwwwwwk.",
      ".kkkkkkkkkk.",
      "..vvvvvvvv..",
      "..wkwkkwkw..",
      "..wkwkkwkw..",
      "..wkkwwkkw..",
      "..kkkkkkkk..",
      "............",
    ],
    event: [
      ".....kk.....",
      "....kvvk....",
      ".....vv.....",
      "....kwwk....",
      "...kwwwwk...",
      "..kkkwwkkk..",
      "...kkkkkk...",
      "...kwvvwk...",
      "...kwvvwk...",
      "...kkkkkk...",
      "....kkkk....",
      "............",
    ],
  });
  // Warm paper + charcoal + just a few muted-vermilion pixels.
  const COLORS = Object.freeze({
    k: "#373530",
    w: "#eee5d2",
    v: "#995b4d",
  });
  function sprite(family) {
    const rows = PIXELS[family];
    if (!rows) return "";
    const pixels = rows.map((row, y) =>
      [...row].map((symbol, x) =>
        COLORS[symbol] ? '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + COLORS[symbol] + '"/>' : ''
      ).join("")
    ).join("");
    return '<svg class="district-pixel-art" viewBox="0 0 12 12" shape-rendering="crispEdges" focusable="false" aria-hidden="true">' + pixels + '</svg>';
  }
  return { sprite, PIXELS };
});
