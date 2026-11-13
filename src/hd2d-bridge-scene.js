/* Optional visual-quality gate for the real, playable forest expedition.
 * Deliberately presentation-only. World movement, bridge height, findings,
 * combat, and save data continue to use the existing game systems.
 * The illustration is a candidate until reviewed on a phone; never use its
 * painted silhouettes as a collision map.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CrownlessBridgeScene = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const WORLD_WIDTH = 1050;
  const ART_WIDTH = 1672;
  const ART_HEIGHT = 941;
  const DRAW_HEIGHT = WORLD_WIDTH * ART_HEIGHT / ART_WIDTH;
  const TOP_OFFSET = -31;

  function composition(cameraX, viewportWidth) {
    // Scenery is anchored to the same world X as the live stone-bridge
    // collision surface. Only the transparent haze is allowed to drift.
    return { x: -cameraX, y: TOP_OFFSET, width: WORLD_WIDTH,
      height: DRAW_HEIGHT, visibleWidth: viewportWidth };
  }

  function create() {
    const art = typeof Image === 'function' ? new Image() : null;
    if (art) art.src = 'assets/action-forest/bridge-hd2d-candidate-v1.webp';
    const ready = () => !!(art && art.complete && art.naturalWidth && art.naturalHeight);

    function background(ctx, viewportWidth, cameraX, wave) {
      const p = composition(cameraX, viewportWidth);
      ctx.fillStyle = '#d1b79b';
      ctx.fillRect(0, 0, viewportWidth, 420);
      if (!ready()) return false;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(art, p.x, p.y, p.width, p.height);
      // The storm/dusk phase must stay legible, not repaint the world in neon.
      if (wave % 3 === 2) {
        ctx.fillStyle = 'rgba(34,30,29,.14)';
        ctx.fillRect(0, 0, viewportWidth, 420);
      }
      ctx.restore();
      return true;
    }

    function foreground(ctx, cameraX, viewportWidth, time, hero) {
      if (!ready()) return;
      const p = composition(cameraX, viewportWidth);
      ctx.save();
      // The near boulders and tree are independent occlusion geometry, not
      // screen-space stickers. The travelling actor can pass behind them.
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(183, 0);
      ctx.bezierCurveTo(142, 73, 101, 174, 88, 241);
      ctx.lineTo(132, 294); ctx.lineTo(115, 420);
      ctx.lineTo(0, 420); ctx.closePath();
      // Front bank, which masks feet passing behind the bridge parapet.
      ctx.moveTo(0, 351); ctx.lineTo(246, 361);
      ctx.lineTo(370, 407); ctx.lineTo(435, 420);
      ctx.lineTo(0, 420); ctx.closePath();
      ctx.clip();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(art, p.x + cameraX, p.y, p.width, p.height);
      ctx.restore();

      ctx.save();
      // Very light ink haze between actor and camera, not a flat fog overlay.
      ctx.translate(cameraX, 0);
      const drift = Math.sin(time / 2600) * 18;
      for (const x of [viewportWidth * .16, viewportWidth * .83]) {
        const haze = ctx.createRadialGradient(x + drift, 323, 2, x + drift, 323, 110);
        haze.addColorStop(0, 'rgba(223,208,180,.08)');
        haze.addColorStop(1, 'rgba(223,208,180,0)');
        ctx.fillStyle = haze;
        ctx.fillRect(x + drift - 110, 215, 220, 205);
      }
      ctx.restore();
    }
    return { ready, background, foreground };
  }
  return { create, composition, WORLD_WIDTH, DRAW_HEIGHT };
});
