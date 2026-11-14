/* Unified 2.5D castle-bridge exploration field (?art=castle-bridge).
 * Single world-to-screen coordinate transform shared by walkable bridge deck,
 * cobblestones, parapets, discovery spots, shadows, actors, and tap hit-tests.
 * Camera transform is applied once here; never combine with ctx.translate(-cameraX).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CrownlessCastleBridge = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';

  const VIRTUAL_H = 420;
  const WORLD_WIDTH = 1050;
  const BRIDGE = Object.freeze({ left: 430, right: 730, back: 235, front: 305 });
  const BRIDGE_LIFT = 10;
  const PARALLAX = Object.freeze({
    sky: 0.08,
    mountainFar: 0.12,
    mountainMid: 0.16,
    castle: 0.20,
    midground: 0.50,
    foreground: 1.00
  });
  const ACTOR_SCALE = 0.88;
  const BAKE_SCALE = 2;

  function worldToScreen(wx, wz, wy, cameraX) {
    const cam = Number.isFinite(cameraX) ? cameraX : 0;
    const x = Number.isFinite(wx) ? wx : 0;
    const z = Number.isFinite(wz) ? wz : 0;
    const y = Number.isFinite(wy) ? wy : 0;
    return { x: x - cam, y: z - y, scale: 1 };
  }

  function screenToWorld(sx, sy, cameraX, wy) {
    const cam = Number.isFinite(cameraX) ? cameraX : 0;
    const y = Number.isFinite(wy) ? wy : 0;
    return { x: sx + cam, z: sy + y };
  }

  function layerAnchors(cameraX, viewportWidth) {
    const cam = Math.max(0, Number.isFinite(cameraX) ? cameraX : 0);
    const width = Math.max(180, Number.isFinite(viewportWidth) ? viewportWidth : 390);
    const castleBaseX = width * 0.72 + 52;
    // Anchor waterfall so it sits directly inside the open stone arch (world x=580)
    // across both landscape and portrait camera positions while moving at 50% parallax.
    const waterfallBaseX = 568;
    return {
      sunX: width * 0.76 - cam * PARALLAX.sky,
      castleX: castleBaseX - cam * PARALLAX.castle,
      castleY: 14,
      waterfallX: waterfallBaseX - cam * PARALLAX.midground,
      midgroundOffsetX: -cam * PARALLAX.midground,
      foregroundOffsetX: -cam * PARALLAX.foreground
    };
  }

  function hitTestSite(tap, rect, viewportWidth, cameraX, heightAt, sites) {
    if (!tap || !rect || !(rect.width > 0) || !(rect.height > 0) || !(viewportWidth > 0)) {
      return null;
    }
    const sx = (tap.x - rect.left) * viewportWidth / rect.width;
    const sy = (tap.y - rect.top) * VIRTUAL_H / rect.height;
    if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx < 0 || sx > viewportWidth || sy < 0 || sy > VIRTUAL_H) {
      return null;
    }
    return sites.find((spot) => {
      const groundH = typeof heightAt === 'function' ? heightAt(spot.x, spot.z) : 0;
      const p = worldToScreen(spot.x, spot.z, groundH, cameraX);
      return Math.abs(sx - p.x) <= 50 && sy >= p.y - 96 && sy <= p.y + 24;
    }) || null;
  }

  function defaultHeightAt(x, z) {
    if (z >= BRIDGE.back && z <= BRIDGE.front && x >= BRIDGE.left && x <= BRIDGE.right) {
      const center = (BRIDGE.left + BRIDGE.right) * 0.5;
      const half = (BRIDGE.right - BRIDGE.left) * 0.5;
      const norm = (x - center) / half;
      return Math.max(0, Math.cos(norm * Math.PI * 0.5) * BRIDGE_LIFT);
    }
    return 0;
  }

  function makeRng(seedStart) {
    let seed = seedStart >>> 0;
    return () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function makeOffscreen(w, h) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = Math.round(w * BAKE_SCALE);
    c.height = Math.round(h * BAKE_SCALE);
    const g = c.getContext('2d');
    g.scale(BAKE_SCALE, BAKE_SCALE);
    return { canvas: c, ctx: g, width: w, height: h };
  }

  function bakeCastleSprite() {
    const off = makeOffscreen(360, 240);
    if (!off) return null;
    const g = off.ctx;
    const cx = 180;

    const cragGrad = g.createLinearGradient(0, 120, 0, 232);
    cragGrad.addColorStop(0, '#5a5b6a');
    cragGrad.addColorStop(0.65, '#4b5260');
    cragGrad.addColorStop(1, 'rgba(92, 102, 110, 0)');
    g.fillStyle = cragGrad;
    g.beginPath();
    g.moveTo(cx - 135, 232);
    g.lineTo(cx - 108, 182);
    g.lineTo(cx - 76, 150);
    g.lineTo(cx + 74, 147);
    g.lineTo(cx + 112, 178);
    g.lineTo(cx + 142, 232);
    g.closePath();
    g.fill();

    g.fillStyle = '#5a5867';
    g.fillRect(cx - 72, 120, 144, 40);
    g.fillStyle = '#837375';
    g.fillRect(cx + 14, 120, 58, 40);

    function tower(tx, topY, w, h, roofH, lit) {
      g.fillStyle = '#525060';
      g.fillRect(tx - w / 2, topY, w, h);
      g.fillStyle = lit ? '#ab8e7e' : '#7b6f74';
      g.fillRect(tx + w * 0.08, topY, w * 0.42, h);
      g.fillStyle = '#394156';
      g.beginPath();
      g.moveTo(tx - w / 2 - 3, topY - 2);
      g.lineTo(tx, topY - roofH);
      g.lineTo(tx + w / 2 + 3, topY - 2);
      g.closePath();
      g.fill();
      g.fillStyle = '#f8cf8e';
      g.fillRect(tx - 2, topY + 12, 4, 7);
    }

    tower(cx - 60, 88, 20, 56, 22, false);
    tower(cx - 26, 62, 26, 80, 28, true);
    tower(cx + 4, 44, 34, 98, 36, true);
    tower(cx + 39, 70, 22, 72, 24, true);
    tower(cx + 62, 94, 18, 52, 20, true);

    return off.canvas;
  }

  function bakeMidgroundBand() {
    const w = 1600;
    const h = 340;
    const off = makeOffscreen(w, h);
    if (!off) return null;
    const g = off.ctx;
    const rng = makeRng(4207);

    const cliffGrad = g.createLinearGradient(0, 85, 0, h);
    cliffGrad.addColorStop(0, '#3a4656');
    cliffGrad.addColorStop(0.45, '#2b3644');
    cliffGrad.addColorStop(1, '#1a242e');
    g.fillStyle = cliffGrad;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 28) {
      const saddle = Math.sin(x * 0.0055) * 16 + Math.cos(x * 0.014) * 10;
      const ridge = 118 + saddle + (rng() - 0.5) * 5;
      g.lineTo(x, ridge);
    }
    g.lineTo(w, h);
    g.closePath();
    g.fill();

    function pine(px, py, ph, col, rimCol) {
      g.fillStyle = '#252e33';
      g.fillRect(px - 1.5, py - ph * 0.35, 3, ph * 0.36);
      for (let tier = 0; tier < 5; tier++) {
        const ty = py - ph * (0.16 + tier * 0.165);
        const tw = ph * (0.32 - tier * 0.05);
        const tipY = ty - ph * 0.24;
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(px, tipY);
        g.lineTo(px + tw, ty + 5);
        g.lineTo(px - tw, ty + 5);
        g.closePath();
        g.fill();
        g.fillStyle = rimCol;
        g.beginPath();
        g.moveTo(px, tipY);
        g.lineTo(px + tw * 0.85, ty + 4);
        g.lineTo(px + tw * 0.25, ty + 2);
        g.closePath();
        g.fill();
      }
    }

    for (let x = 6; x < w; x += 16) {
      const saddle = Math.sin(x * 0.0055) * 16 + Math.cos(x * 0.014) * 10;
      const base = 126 + saddle + (rng() - 0.5) * 10;
      const height = 24 + rng() * 26;
      pine(x, base, height, rng() > 0.4 ? '#2b393f' : '#35454b', 'rgba(218, 180, 134, 0.22)');
    }

    const mist = g.createLinearGradient(0, 115, 0, h);
    mist.addColorStop(0, 'rgba(198, 208, 220, 0)');
    mist.addColorStop(0.35, 'rgba(198, 208, 220, 0.24)');
    mist.addColorStop(0.75, 'rgba(210, 220, 230, 0.42)');
    mist.addColorStop(1, 'rgba(222, 230, 238, 0.64)');
    g.fillStyle = mist;
    g.fillRect(0, 115, w, h - 115);

    return off.canvas;
  }

  // Fallback procedural foreground used only before world-foreground.png finishes loading.
  function bakeFallbackForeground(heightAt) {
    const off = makeOffscreen(WORLD_WIDTH, VIRTUAL_H);
    if (!off) return null;
    const g = off.ctx;
    g.fillStyle = '#3a3830';
    g.fillRect(0, 225, BRIDGE.left + 20, 195);
    g.fillRect(BRIDGE.right - 20, 225, WORLD_WIDTH - BRIDGE.right + 20, 195);
    g.fillStyle = '#8b7b60';
    g.fillRect(0, BRIDGE.back, WORLD_WIDTH, BRIDGE.front - BRIDGE.back);

    const step = 4;
    const ax0 = 486;
    const ax1 = 676;
    const amid = (ax0 + ax1) * 0.5;
    const archCrownY = BRIDGE.front - heightAt(amid, 270) + 18;
    g.beginPath();
    g.moveTo(BRIDGE.left, 420);
    for (let x = BRIDGE.left; x <= BRIDGE.right; x += step) {
      g.lineTo(x, BRIDGE.back - heightAt(x, BRIDGE.back));
    }
    g.lineTo(BRIDGE.right, 420);
    g.lineTo(ax1, 420);
    g.quadraticCurveTo(amid, archCrownY, ax0, 420);
    g.closePath();
    g.fillStyle = '#7b715c';
    g.fill();
    return off.canvas;
  }

  function create() {
    let castleSprite = null;
    let midgroundSprite = null;
    let fallbackForeground = null;
    let skyCitadelPlate = null;
    let midgroundGorgePlate = null;
    let oakCanopyPlate = null;
    const tex = {
      started: false,
      worldForeground: null,
      bridgeParapet: null,
      partyCompanions: null,
      goblinEnemies: null,
      oakTree: null,
      lanternPost: null,
      shrinePillar: null,
      hollowArch: null,
      autumnFoliage: null
    };

    function loadAssetImage(src, onReady) {
      if (typeof Image !== 'function') return;
      const img = new Image();
      img.onload = () => onReady(img);
      img.src = src;
    }

    const nearScenery = Object.freeze([
      { type: 'rearRail', z: BRIDGE.back },
      { type: 'frontRail', z: BRIDGE.front },
      { type: 'oak', x: 6, z: 244, scale: 1.28 },
      { type: 'lanternPost', x: 152, z: 254, size: 112 }
    ]);

    function ensureAssets(heightAt) {
      if (!castleSprite) castleSprite = bakeCastleSprite();
      if (!midgroundSprite) midgroundSprite = bakeMidgroundBand();
      if (!fallbackForeground) {
        fallbackForeground = bakeFallbackForeground(typeof heightAt === 'function' ? heightAt : defaultHeightAt);
      }
      if (!tex.started && typeof Image === 'function' && typeof document !== 'undefined') {
        tex.started = true;
        loadAssetImage('assets/castle-bridge/sky-citadel.png', (img) => {
          const pw = 540;
          const ph = 285;
          const off = makeOffscreen(pw, ph);
          if (!off) return;
          const g = off.ctx;
          g.drawImage(img, 0, 0, pw, ph);
          // Feather edges smoothly into sky & valley mist
          g.save();
          g.globalCompositeOperation = 'destination-in';
          const hMask = g.createLinearGradient(0, 0, pw, 0);
          hMask.addColorStop(0, 'rgba(255,255,255,0)');
          hMask.addColorStop(0.10, 'rgba(255,255,255,0.32)');
          hMask.addColorStop(0.22, 'rgba(255,255,255,0.85)');
          hMask.addColorStop(0.32, 'rgba(255,255,255,1)');
          hMask.addColorStop(0.88, 'rgba(255,255,255,1)');
          hMask.addColorStop(0.96, 'rgba(255,255,255,0.45)');
          hMask.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = hMask;
          g.fillRect(0, 0, pw, ph);
          const vMask = g.createLinearGradient(0, 0, 0, ph);
          vMask.addColorStop(0, 'rgba(255,255,255,1)');
          vMask.addColorStop(0.78, 'rgba(255,255,255,1)');
          vMask.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = vMask;
          g.fillRect(0, 0, pw, ph);
          g.restore();
          skyCitadelPlate = off.canvas;
        });
        loadAssetImage('assets/castle-bridge/midground-gorge.png', (img) => {
          const gw = 780;
          const gh = 355;
          const off = makeOffscreen(gw, gh);
          if (!off) return;
          const g = off.ctx;
          g.drawImage(img, 0, 0, gw, gh);
          // Feather top edge so left cliff never shows a flat horizontal cutoff in the sky
          g.save();
          g.globalCompositeOperation = 'destination-in';
          const vMask = g.createLinearGradient(0, 0, 0, gh);
          vMask.addColorStop(0, 'rgba(255,255,255,0)');
          vMask.addColorStop(0.14, 'rgba(255,255,255,0.75)');
          vMask.addColorStop(0.24, 'rgba(255,255,255,1)');
          vMask.addColorStop(1, 'rgba(255,255,255,1)');
          g.fillStyle = vMask;
          g.fillRect(0, 0, gw, gh);
          g.restore();
          midgroundGorgePlate = off.canvas;
        });
        loadAssetImage('assets/castle-bridge/world-foreground.png', (img) => { tex.worldForeground = img; });
        loadAssetImage('assets/castle-bridge/bridge-parapet.png', (img) => { tex.bridgeParapet = img; });
        loadAssetImage('assets/castle-bridge/party-companions.png', (img) => { tex.partyCompanions = img; });
        loadAssetImage('assets/castle-bridge/goblin-enemies.png', (img) => { tex.goblinEnemies = img; });
        loadAssetImage('assets/castle-bridge/oak-tree.png', (img) => {
          tex.oakTree = img;
          const cw = 340;
          const ch = 175;
          const off = makeOffscreen(cw, ch);
          if (!off) return;
          const g = off.ctx;
          g.drawImage(img, 0, 0, img.width, Math.round(img.height * 0.68), 0, 0, cw, ch);
          g.save();
          g.globalCompositeOperation = 'destination-in';
          const vMask = g.createLinearGradient(0, 0, 0, ch);
          vMask.addColorStop(0, 'rgba(255,255,255,1)');
          vMask.addColorStop(0.58, 'rgba(255,255,255,1)');
          vMask.addColorStop(0.84, 'rgba(255,255,255,0.38)');
          vMask.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = vMask;
          g.fillRect(0, 0, cw, ch);
          g.restore();
          oakCanopyPlate = off.canvas;
        });
        loadAssetImage('assets/castle-bridge/lantern-post.png', (img) => { tex.lanternPost = img; });
        loadAssetImage('assets/castle-bridge/shrine-pillar.png', (img) => { tex.shrinePillar = img; });
        loadAssetImage('assets/castle-bridge/hollow-arch.png', (img) => { tex.hollowArch = img; });
        loadAssetImage('assets/castle-bridge/autumn-foliage.png', (img) => { tex.autumnFoliage = img; });
      }
    }

    function ready() {
      return true;
    }

    function drawMountains(ctx, width, cam, ridgeYBase, factor, peaks, fill) {
      const offset = -cam * factor;
      const span = Math.max(1500, width + 500);
      const step = span / (peaks.length - 1);
      ctx.beginPath();
      ctx.moveTo(-250 + offset, 265);
      for (let i = 0; i < peaks.length; i++) {
        ctx.lineTo(-250 + i * step + offset, ridgeYBase - peaks[i]);
      }
      ctx.lineTo(-250 + span + offset + 300, 265);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }

    function background(ctx, viewportWidth, cameraX, wave, timeSec) {
      ensureAssets(defaultHeightAt);
      const width = Math.max(1, viewportWidth);
      const cam = Math.max(0, Number.isFinite(cameraX) ? cameraX : 0);
      const phase = Math.max(0, (wave || 1) - 1) % 3;
      const anchors = layerAnchors(cam, width);
      const t = Number.isFinite(timeSec) ? timeSec : 0;

      // 1. Far Sunset Sky
      const sky = ctx.createLinearGradient(0, 0, 0, VIRTUAL_H);
      if (phase === 0) {
        sky.addColorStop(0, '#343958');
        sky.addColorStop(0.20, '#8e6d7e');
        sky.addColorStop(0.42, '#e6b180');
        sky.addColorStop(0.64, '#7c8b9b');
        sky.addColorStop(1, '#1e2833');
      } else if (phase === 1) {
        sky.addColorStop(0, '#1e243d');
        sky.addColorStop(0.32, '#514462');
        sky.addColorStop(0.65, '#3b4a59');
        sky.addColorStop(1, '#19222c');
      } else {
        sky.addColorStop(0, '#111a2e');
        sky.addColorStop(0.35, '#273a55');
        sky.addColorStop(0.68, '#2b3e4f');
        sky.addColorStop(1, '#131d28');
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, VIRTUAL_H);

      // Warm golden sunset scatter
      const glow = ctx.createRadialGradient(anchors.sunX, 64, 10, anchors.sunX, 64, 340);
      if (phase === 0) {
        glow.addColorStop(0, 'rgba(255, 242, 196, 0.88)');
        glow.addColorStop(0.28, 'rgba(252, 202, 140, 0.56)');
        glow.addColorStop(0.62, 'rgba(228, 168, 128, 0.25)');
        glow.addColorStop(1, 'rgba(228, 168, 128, 0)');
      } else {
        glow.addColorStop(0, 'rgba(244, 212, 188, 0.48)');
        glow.addColorStop(1, 'rgba(180, 160, 190, 0)');
      }
      ctx.fillStyle = glow;
      ctx.fillRect(anchors.sunX - 340, -120, 680, 480);

      // 2. Far Mountains (12% & 16% parallax)
      drawMountains(ctx, width, cam, 194, PARALLAX.mountainFar,
        [36, 62, 46, 86, 56, 78, 44, 70, 52, 74, 42],
        phase === 2 ? '#3e4e68' : '#8b7d92');
      drawMountains(ctx, width, cam, 210, PARALLAX.mountainMid,
        [22, 48, 38, 64, 44, 58, 34, 54, 40, 50, 28],
        phase === 2 ? '#304054' : '#6b7085');

      // 3. Far Painted Sunset Sky & Gothic Citadel (20% parallax)
      if (skyCitadelPlate) {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        const plateW = 540;
        const plateH = 272;
        const plateX = anchors.castleX - plateW * 0.695;
        if (phase === 0) {
          const bridgeGlow = ctx.createLinearGradient(0, 58, plateX + 190, 128);
          bridgeGlow.addColorStop(0, 'rgba(234, 172, 128, 0.08)');
          bridgeGlow.addColorStop(0.65, 'rgba(244, 190, 138, 0.32)');
          bridgeGlow.addColorStop(1, 'rgba(244, 190, 138, 0)');
          ctx.fillStyle = bridgeGlow;
          ctx.fillRect(0, 0, Math.min(width, plateX + 210), 180);
        }
        ctx.drawImage(skyCitadelPlate, plateX, -24, plateW, plateH);
        ctx.restore();
      } else if (castleSprite) {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(castleSprite, anchors.castleX - 180, anchors.castleY - 14, 360, 240);
        ctx.restore();
      }

      // Soft valley mist separating far citadel from midground gorge
      const farMist = ctx.createLinearGradient(0, 132, 0, 236);
      farMist.addColorStop(0, 'rgba(218, 206, 196, 0)');
      farMist.addColorStop(1, phase === 2 ? 'rgba(66, 84, 102, 0.38)' : 'rgba(206, 208, 218, 0.42)');
      ctx.fillStyle = farMist;
      ctx.fillRect(0, 132, width, 104);

      // 4. Midground Gorge Cliffs & Pine Ridges (50% parallax)
      if (midgroundSprite) {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        const midX = anchors.midgroundOffsetX;
        ctx.drawImage(midgroundSprite, midX, 88, 1600, 340);
        if (midX + 1600 < width) {
          ctx.drawImage(midgroundSprite, midX + 1600, 88, 1600, 340);
        }
        ctx.restore();
      }

      // 5. Painted HD-2D Gorge Cliffs, Pines & Multi-Tier Waterfall centered inside bridge arch (50% parallax)
      const wfX = anchors.waterfallX;
      if (midgroundGorgePlate) {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        const gw = 780;
        const gh = 355;
        // Drawn at y=108 so the two-tier white waterfall (0.34..0.85 of gh => y=228..410)
        // cascades directly through the open stone arch of the bridge (y=268..420)!
        ctx.drawImage(midgroundGorgePlate, wfX - gw * 0.5, 108, gw, gh);
        if (wfX - gw * 0.5 > 0) {
          ctx.save();
          ctx.translate(wfX - gw * 0.5 + 56, 108);
          ctx.scale(-1, 1);
          ctx.drawImage(midgroundGorgePlate, 0, 0, 240, gh, 0, 0, 190, gh);
          ctx.restore();
        }
        ctx.restore();
      }

      // Animated white waterfall cascade lines & billowing gorge cloud mist inside the arch
      if (wfX > -140 && wfX < width + 140) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.56)';
        ctx.lineWidth = 1.6;
        const shift = (t * 36) % 22;
        for (let i = -2; i <= 2; i++) {
          const rx = wfX + i * 4.8;
          for (let ry = 250 + shift + (Math.abs(i) * 5) % 16; ry < VIRTUAL_H - 16; ry += 22) {
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx + i * 0.25, ry + 9);
            ctx.stroke();
          }
        }
        for (const [mx, my, mr, ma] of [
          [wfX, 396, 76, 0.52],
          [wfX - 36, 404, 58, 0.38],
          [wfX + 36, 404, 58, 0.38]
        ]) {
          const spray = ctx.createRadialGradient(mx, my, 4, mx, my, mr);
          spray.addColorStop(0, `rgba(232, 240, 246, ${ma})`);
          spray.addColorStop(1, 'rgba(232, 240, 246, 0)');
          ctx.fillStyle = spray;
          ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
        }
        ctx.restore();
      }

      if (phase > 0) {
        ctx.fillStyle = phase === 1 ? 'rgba(20, 22, 38, 0.20)' : 'rgba(10, 16, 30, 0.32)';
        ctx.fillRect(0, 0, width, VIRTUAL_H);
      }
      return true;
    }

    function ground(ctx, viewportWidth, cameraX, heightAt) {
      ensureAssets(heightAt);
      const p = worldToScreen(0, 0, 0, cameraX);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      if (tex.worldForeground) {
        ctx.drawImage(tex.worldForeground, p.x, p.y, WORLD_WIDTH, VIRTUAL_H);
      } else if (fallbackForeground) {
        ctx.drawImage(fallbackForeground, p.x, p.y, WORLD_WIDTH, VIRTUAL_H);
      }
      ctx.restore();
    }

    function drawParapet(ctx, cameraX, heightAt, zPos, isFront) {
      if (isFront && tex.bridgeParapet) {
        const p = worldToScreen(0, 0, 0, cameraX);
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(tex.bridgeParapet, p.x, p.y, WORLD_WIDTH, VIRTUAL_H);
        ctx.restore();
        return;
      }
      if (!isFront && tex.worldForeground) {
        // Rear parapet is already seamlessly baked into world-foreground.png behind z=235
        return;
      }
      const startX = BRIDGE.left;
      const endX = BRIDGE.right;
      const step = 10;
      const railTop = isFront ? 16 : 14;
      ctx.save();
      ctx.beginPath();
      for (let x = startX; x <= endX; x += step) {
        const p = worldToScreen(x, zPos, heightAt(x, zPos), cameraX);
        if (x === startX) ctx.moveTo(p.x, p.y - railTop);
        else ctx.lineTo(p.x, p.y - railTop);
      }
      ctx.strokeStyle = isFront ? '#a89c82' : '#8a816c';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.restore();
    }

    function scenery(ctx, cameraX, heightAt, item) {
      if (item.type === 'rearRail') {
        drawParapet(ctx, cameraX, heightAt, item.z, false);
        return;
      }
      if (item.type === 'frontRail') {
        drawParapet(ctx, cameraX, heightAt, item.z, true);
        return;
      }
      const h = heightAt(item.x, item.z);
      const p = worldToScreen(item.x, item.z, h, cameraX);
      ctx.save();
      ctx.translate(p.x, p.y);
      if (item.type === 'oak') {
        const s = item.scale || 1;
        ctx.fillStyle = 'rgba(16, 20, 14, 0.42)';
        ctx.beginPath();
        ctx.ellipse(0, 4, 38 * s, 9 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        if (tex.oakTree) {
          ctx.save();
          if (item.flip) ctx.scale(-s, s);
          else ctx.scale(s, s);
          ctx.drawImage(tex.oakTree, -88, -196, 224, 202);
          ctx.restore();
        }
      } else if (item.type === 'lanternPost') {
        ctx.fillStyle = 'rgba(16, 18, 16, 0.38)';
        ctx.beginPath();
        ctx.ellipse(0, 2, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        if (tex.lanternPost) {
          const lx = 24;
          const ly = -82;
          const lampGlow = ctx.createRadialGradient(lx, ly, 3, lx, ly, 62);
          lampGlow.addColorStop(0, 'rgba(255, 232, 148, 0.72)');
          lampGlow.addColorStop(0.42, 'rgba(255, 188, 82, 0.30)');
          lampGlow.addColorStop(1, 'rgba(255, 168, 60, 0)');
          ctx.fillStyle = lampGlow;
          ctx.fillRect(lx - 62, ly - 62, 124, 124);
          ctx.drawImage(tex.lanternPost, -48, -138, 96, 140);
        }
      }
      ctx.restore();
    }

    function shadow(ctx, x, z, groundH, cameraX, jumpHeight) {
      const p = worldToScreen(x, z, groundH, cameraX);
      const jump = Math.max(0, Number.isFinite(jumpHeight) ? jumpHeight : 0);
      const shrink = Math.max(0.55, 1 - jump * 0.004);
      const alpha = Math.max(0.18, 0.58 - jump * 0.003);
      const rx = 18 * ACTOR_SCALE * shrink;
      const ry = 6.5 * ACTOR_SCALE * shrink;
      ctx.save();
      const radial = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, rx);
      radial.addColorStop(0, `rgba(14, 14, 12, ${alpha})`);
      radial.addColorStop(0.58, `rgba(14, 14, 12, ${(alpha * 0.52).toFixed(2)})`);
      radial.addColorStop(1, 'rgba(14, 14, 12, 0)');
      ctx.fillStyle = radial;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function entity(ctx, x, z, y, cameraX, drawCallback) {
      const p = worldToScreen(x, z, y, cameraX);
      ctx.save();
      ctx.translate(Math.round(p.x), Math.round(p.y));
      ctx.scale(ACTOR_SCALE, ACTOR_SCALE);
      drawCallback();
      ctx.restore();
    }

    // Draw HD-2D pixel-art companion (slot 0 = silver-haired mage, slot 1 = blond knight)
    function drawCompanion(ctx, fighter, slotIndex) {
      if (!tex.partyCompanions) return false;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      const moving = fighter.state === 'WALK' || fighter.state === 'RUN';
      const bob = moving ? Math.abs(Math.sin(fighter.animTime * 2.2)) * 2.5 : 0;
      const tilt = moving ? Math.sin(fighter.animTime * 2.2) * 0.035 : 0;
      const sx = slotIndex === 1 ? 512 : 0;
      const h = slotIndex === 1 ? 62 : 59;
      const w = h * (512 / 640);
      ctx.translate(0, -bob);
      if (tilt) ctx.rotate(tilt);
      ctx.drawImage(tex.partyCompanions, sx, 0, 512, 640, -w * 0.5, -h + 2, w, h);
      ctx.restore();
      return true;
    }

    // Draw HD-2D pixel-art enemy (isBoss/guardian = horned moss knight, otherwise forest goblin)
    function drawEnemy(ctx, fighter) {
      if (!tex.goblinEnemies) return false;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      const isGuardian = Boolean(fighter.isBoss || fighter.name === '苔祠の番人');
      const moving = fighter.state === 'WALK' || fighter.state === 'RUN';
      const attacking = fighter.state === 'ATTACK' || fighter.state === 'SPECIAL';
      const bob = moving ? Math.abs(Math.sin(fighter.animTime * 2.4)) * 2.5 : 0;
      const lunge = attacking ? 5 : 0;
      // Source sprites in goblin-enemies.png face LEFT (-1). Flip when drawFighter already scaled by fighter.facing.
      ctx.scale(-1, 1);
      const sx = isGuardian ? 512 : 0;
      const h = isGuardian ? 72 : 56;
      const w = h * (512 / 640);
      ctx.drawImage(tex.goblinEnemies, sx, 0, 512, 640, -w * 0.5 - lunge, -h + 2 - bob, w, h);
      ctx.restore();
      return true;
    }

    function site(ctx, spot, found, near, groundH, cameraX, timeMs) {
      const p = worldToScreen(spot.x, spot.z, groundH, cameraX);
      ctx.save();
      ctx.translate(Math.round(p.x), Math.round(p.y));

      if (near || found) {
        ctx.fillStyle = 'rgba(18, 22, 18, 0.36)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (spot.id === 'shrine') {
        if (tex.shrinePillar) {
          if (!found) {
            const cGlow = ctx.createRadialGradient(0, -24, 2, 0, -24, 20);
            cGlow.addColorStop(0, 'rgba(255, 214, 122, 0.36)');
            cGlow.addColorStop(1, 'rgba(255, 214, 122, 0)');
            ctx.fillStyle = cGlow;
            ctx.fillRect(-20, -44, 40, 40);
          }
          if (near || found) {
            ctx.drawImage(tex.shrinePillar, -14, -58, 28, 60);
          }
        }
      } else if (spot.id === 'hollow') {
        // The East Gatehouse archway is already painted into world-foreground.png at x=910;
        // draw subtle thorned vines across the archway when unfound.
        if (!found) {
          ctx.strokeStyle = '#3e3224';
          ctx.lineWidth = 2;
          for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(-12, -10 - i * 7);
            ctx.lineTo(12, -24 - i * 5);
            ctx.stroke();
          }
        }
      } else {
        ctx.fillStyle = found ? '#585647' : '#d6c39a';
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(-14 + i * 8, -5 + (i % 2) * 3, 5, 3);
        }
      }

      if (!found) {
        const bob = Math.sin((timeMs || 0) / 480) * 2.5;
        const markerY = spot.id === 'traces' ? -20 + bob : -58 + bob;
        ctx.fillStyle = near ? '#ffe79e' : '#e6be73';
        ctx.beginPath();
        ctx.moveTo(0, markerY - 7);
        ctx.lineTo(5.5, markerY);
        ctx.lineTo(0, markerY + 7);
        ctx.lineTo(-5.5, markerY);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(20, 24, 20, 0.82)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        if (near) {
          ctx.font = 'bold 11px "Noto Sans JP", sans-serif';
          ctx.textAlign = 'center';
          const text = '調べる';
          const tw = ctx.measureText(text).width + 14;
          ctx.fillStyle = 'rgba(20, 24, 20, 0.92)';
          ctx.fillRect(-tw / 2, markerY - 28, tw, 17);
          ctx.strokeStyle = '#e8c47a';
          ctx.lineWidth = 1;
          ctx.strokeRect(-tw / 2, markerY - 28, tw, 17);
          ctx.fillStyle = '#fff3d1';
          ctx.fillText(text, 0, markerY - 15.5);
        }
      }

      ctx.restore();
    }

    function foreground(ctx, viewportWidth, cameraX, timeMs) {
      const t = Number.isFinite(timeMs) ? timeMs : 0;
      const drift = Math.sin(t / 2400) * 12;
      const cam = Number.isFinite(cameraX) ? cameraX : 0;
      const anchors = layerAnchors(cam, viewportWidth);
      ctx.save();

      // 1. Overhanging Golden-Autumn Oak Canopy in upper-left world space (x = -40..420, y = -28..175)
      if ((oakCanopyPlate || tex.oakTree) && cam < 460) {
        const ox = -cam;
        const canopyImg = oakCanopyPlate || tex.oakTree;
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(canopyImg, ox - 34, -26, 360, 172);
        ctx.drawImage(canopyImg, ox + 150, -34, 275, 138);
        ctx.restore();
      }

      // Warm golden lantern halo around the West Promontory heraldic lantern post (world x=132, y=174)
      if (cam < 340) {
        const lx = 132 - cam;
        const ly = 174;
        const lampGlow = ctx.createRadialGradient(lx, ly, 4, lx, ly, 68);
        lampGlow.addColorStop(0, 'rgba(255, 232, 148, 0.56)');
        lampGlow.addColorStop(0.42, 'rgba(255, 188, 82, 0.24)');
        lampGlow.addColorStop(1, 'rgba(255, 168, 60, 0)');
        ctx.fillStyle = lampGlow;
        ctx.fillRect(lx - 68, ly - 68, 136, 136);
      }

      // 2. Dramatic diagonal golden crepuscular sunbeams (god rays) streaming from upper-right past oak canopy onto road & bridge
      const rayGrad = ctx.createLinearGradient(anchors.sunX * 0.68, 0, viewportWidth * 0.22, 325);
      rayGrad.addColorStop(0, 'rgba(255, 226, 152, 0.14)');
      rayGrad.addColorStop(0.52, 'rgba(255, 210, 128, 0.06)');
      rayGrad.addColorStop(1, 'rgba(255, 205, 118, 0)');
      ctx.fillStyle = rayGrad;
      for (const [rxOff, rwTop, rwBot] of [[-145, 58, 145], [-28, 82, 185], [95, 54, 135]]) {
        const sx = anchors.sunX * 0.60 + rxOff;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx + rwTop, 0);
        ctx.lineTo(sx + rwBot - 165, 345);
        ctx.lineTo(sx - 165, 345);
        ctx.closePath();
        ctx.fill();
      }

      // 3. Warm golden light motes drifting gently through the sunbeams
      for (let i = 0; i < 16; i++) {
        const mx = ((i * 71 + t * 0.012) % (viewportWidth + 40)) - 20;
        const my = 64 + ((i * 43 + Math.sin(t * 0.001 + i) * 18) % 215);
        ctx.fillStyle = 'rgba(255, 236, 174, 0.46)';
        ctx.beginPath();
        ctx.arc(mx, my, i % 3 === 0 ? 1.6 : 1.0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Billowing sea of valley clouds / canyon mist below the bridge arch & eastern gorge (world-anchored)
      for (const [wx, wy, rx, ry, fa] of [
        [535 + drift * 0.6, 398, 95, 42, 0.42],
        [625 - drift * 0.5, 392, 115, 48, 0.48],
        [720 + drift * 0.7, 396, 125, 52, 0.44],
        [835 - drift * 0.4, 404, 130, 46, 0.36]
      ]) {
        const sx = wx - cam;
        if (sx + rx < 0 || sx - rx > viewportWidth) continue;
        ctx.save();
        ctx.translate(sx, wy);
        ctx.scale(1, ry / rx);
        const fog = ctx.createRadialGradient(0, 0, 4, 0, 0, rx);
        fog.addColorStop(0, `rgba(226, 232, 240, ${fa})`);
        fog.addColorStop(0.58, `rgba(214, 222, 232, ${(fa * 0.52).toFixed(2)})`);
        fog.addColorStop(1, 'rgba(214, 222, 232, 0)');
        ctx.fillStyle = fog;
        ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
        ctx.restore();
      }

      // 5. Bottom-left foreground autumn maple foliage framing the cliff corner
      if (cam < 320 && tex.autumnFoliage) {
        const leafShift = Math.max(0, 1 - cam / 320);
        ctx.globalAlpha = 0.96 * leafShift;
        ctx.drawImage(tex.autumnFoliage, -16 - cam * 0.25, VIRTUAL_H - 108, 124, 118);
      }
      ctx.restore();
    }

    return {
      ready,
      background,
      ground,
      scenery,
      shadow,
      entity,
      site,
      foreground,
      nearScenery,
      drawCompanion,
      drawEnemy,
      worldToScreen,
      screenToWorld,
      layerAnchors,
      hitTestSite
    };
  }

  return {
    VIRTUAL_H,
    WORLD_WIDTH,
    BRIDGE,
    PARALLAX,
    ACTOR_SCALE,
    worldToScreen,
    screenToWorld,
    layerAnchors,
    hitTestSite,
    defaultHeightAt,
    create
  };
});
