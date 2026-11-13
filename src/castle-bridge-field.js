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
  const BRIDGE = Object.freeze({ left: 430, right: 730, back: 235, front: 345 });
  const PARALLAX = Object.freeze({
    sky: 0.08,
    mountainFar: 0.12,
    mountainMid: 0.16,
    castle: 0.20,
    midground: 0.50,
    foreground: 1.00
  });
  const ACTOR_SCALE = 0.82;
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
    // Keep the distant castle visibly ahead of the approach at t=0 on both
    // narrow portrait phones (~206px virtualW) and wide landscape (~910px),
    // while moving strictly linearly with cameraX * PARALLAX.castle.
    const castleBaseX = width * 0.74 + 45;
    const waterfallBaseX = Math.max(330, width * 0.52 + 66);
    return {
      sunX: width * 0.78 - cam * PARALLAX.sky,
      castleX: castleBaseX - cam * PARALLAX.castle,
      castleY: 18,
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
      return Math.max(0, Math.cos(norm * Math.PI * 0.5) * 46);
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

  // Bake the distant castle once so towers, sunlit masonry, shadows, and soft
  // misty base are crisp and never exhibit box seams.
  function bakeCastleSprite() {
    const off = makeOffscreen(360, 240);
    if (!off) return null;
    const g = off.ctx;
    const cx = 180;

    // Rocky crag pedestal fading into valley mist at bottom
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

    // Sunlit right cliff highlights
    g.fillStyle = 'rgba(224, 176, 136, 0.30)';
    g.beginPath();
    g.moveTo(cx + 20, 148);
    g.lineTo(cx + 74, 147);
    g.lineTo(cx + 112, 178);
    g.lineTo(cx + 82, 206);
    g.lineTo(cx + 10, 198);
    g.closePath();
    g.fill();

    // Outer curtain walls & lower gatehouse wing
    g.fillStyle = '#5a5867';
    g.fillRect(cx - 72, 120, 144, 40);
    g.fillStyle = '#837375';
    g.fillRect(cx + 14, 120, 58, 40);
    // Recessed castle gate arch
    g.fillStyle = '#333645';
    g.beginPath();
    g.arc(cx + 32, 152, 7, Math.PI, 0);
    g.lineTo(cx + 39, 160);
    g.lineTo(cx + 25, 160);
    g.closePath();
    g.fill();
    // Battlements
    for (let bx = cx - 72; bx <= cx + 64; bx += 11) {
      g.fillStyle = bx >= cx + 10 ? '#9c837a' : '#5e5b6a';
      g.fillRect(bx, 114, 7, 7);
    }

    // Helper for medieval stone towers with warm dusk rim & slender spire finials
    function tower(tx, topY, w, h, roofH, lit) {
      g.fillStyle = '#525060';
      g.fillRect(tx - w / 2, topY, w, h);
      g.fillStyle = lit ? '#ab8e7e' : '#7b6f74';
      g.fillRect(tx + w * 0.08, topY, w * 0.42, h);
      // Subtle masonry shadow bands
      g.fillStyle = 'rgba(35, 38, 52, 0.22)';
      g.fillRect(tx - w / 2, topY + Math.floor(h * 0.45), w, 2);
      // Cornice
      g.fillStyle = '#3f4252';
      g.fillRect(tx - w / 2 - 2, topY - 3, w + 4, 4);
      // Pointed slate spire
      g.fillStyle = '#394156';
      g.beginPath();
      g.moveTo(tx - w / 2 - 3, topY - 2);
      g.lineTo(tx, topY - roofH);
      g.lineTo(tx + w / 2 + 3, topY - 2);
      g.closePath();
      g.fill();
      // Sunward edge of spire
      g.fillStyle = '#736f82';
      g.beginPath();
      g.moveTo(tx, topY - roofH);
      g.lineTo(tx + w / 2 + 3, topY - 2);
      g.lineTo(tx + 2, topY - 2);
      g.closePath();
      g.fill();
      // Slender finial needle
      g.fillStyle = '#6c6878';
      g.fillRect(tx - 0.8, topY - roofH - 7, 1.6, 8);
      // Warm arched castle windows
      g.fillStyle = '#f8cf8e';
      g.fillRect(tx - 2, topY + 12, 4, 7);
      if (h > 45) g.fillRect(tx - 2, topY + 28, 4, 7);
    }

    tower(cx - 60, 88, 20, 56, 22, false);
    tower(cx - 26, 62, 26, 80, 28, true);
    tower(cx + 4, 44, 34, 98, 36, true); // Central keep
    tower(cx + 39, 70, 22, 72, 24, true);
    tower(cx + 62, 94, 18, 52, 20, true);

    // Apply atmospheric dusk veil ONLY to drawn castle/crag pixels (never a sky box!)
    g.save();
    g.globalCompositeOperation = 'source-atop';
    const haze = g.createLinearGradient(0, 20, 0, 225);
    haze.addColorStop(0, 'rgba(242, 200, 168, 0.16)');
    haze.addColorStop(0.65, 'rgba(196, 178, 176, 0.28)');
    haze.addColorStop(1, 'rgba(176, 188, 184, 0.42)');
    g.fillStyle = haze;
    g.fillRect(0, 0, 360, 240);
    g.restore();

    return off.canvas;
  }

  // Bake midground cliff gorge, layered pine ridges, and canyon depths (placed at y=85
  // so distant sunset mountains and gothic castle towers soar cleanly above treeline).
  function bakeMidgroundBand() {
    const w = 1600;
    const h = 340;
    const off = makeOffscreen(w, h);
    if (!off) return null;
    const g = off.ctx;
    const rng = makeRng(4207);

    // Sculpted canyon cliff ridges dipping in valley saddles so castle skyline breathes
    const cliffGrad = g.createLinearGradient(0, 45, 0, h);
    cliffGrad.addColorStop(0, '#323e4a');
    cliffGrad.addColorStop(0.45, '#26313c');
    cliffGrad.addColorStop(1, '#1a232d');
    g.fillStyle = cliffGrad;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 28) {
      const saddle = Math.sin(x * 0.0055) * 22 + Math.cos(x * 0.014) * 14;
      const ridge = 76 + saddle + (rng() - 0.5) * 7;
      g.lineTo(x, ridge);
    }
    g.lineTo(w, h);
    g.closePath();
    g.fill();

    // Faceted slate cliff crags & warm golden dusk catch-lights on upper rock shelves
    for (let x = 12; x < w; x += 42) {
      const saddle = Math.sin(x * 0.0055) * 22 + Math.cos(x * 0.014) * 14;
      const topY = 80 + saddle;
      g.fillStyle = 'rgba(182, 146, 106, 0.22)';
      g.beginPath();
      g.moveTo(x, topY);
      g.lineTo(x + 24, topY + 22);
      g.lineTo(x + 12, topY + 135);
      g.lineTo(x - 10, topY + 88);
      g.closePath();
      g.fill();

      g.fillStyle = 'rgba(16, 22, 30, 0.42)';
      g.beginPath();
      g.moveTo(x - 14, topY + 10);
      g.lineTo(x + 2, topY + 34);
      g.lineTo(x - 10, topY + 170);
      g.lineTo(x - 26, topY + 125);
      g.closePath();
      g.fill();
    }

    // Painterly conifer silhouettes with feathered boughs & golden rim-light tips
    function pine(px, py, ph, col, rimCol) {
      g.fillStyle = '#232724';
      g.fillRect(px - 1.5, py - ph * 0.35, 3, ph * 0.36);
      for (let tier = 0; tier < 5; tier++) {
        const ty = py - ph * (0.16 + tier * 0.165);
        const tw = ph * (0.34 - tier * 0.052);
        const tipY = ty - ph * 0.25;
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(px, tipY);
        g.lineTo(px + tw, ty + 5);
        g.lineTo(px + tw * 0.52, ty + 2.5);
        g.lineTo(px + tw * 0.18, ty + 6);
        g.lineTo(px - tw * 0.18, ty + 6);
        g.lineTo(px - tw * 0.52, ty + 2.5);
        g.lineTo(px - tw, ty + 5);
        g.closePath();
        g.fill();

        g.fillStyle = rimCol;
        g.beginPath();
        g.moveTo(px, tipY);
        g.lineTo(px + tw * 0.9, ty + 4);
        g.lineTo(px + tw * 0.25, ty + 2);
        g.closePath();
        g.fill();
      }
    }

    for (let x = 6; x < w; x += 15) {
      const saddle = Math.sin(x * 0.0055) * 22 + Math.cos(x * 0.014) * 14;
      const base = 92 + saddle + (rng() - 0.5) * 12;
      const height = 28 + rng() * 34;
      pine(x, base, height,
        rng() > 0.4 ? '#1e2f2a' : '#283d33',
        'rgba(186, 158, 98, 0.28)');
    }

    // Gorge pines standing deeper down inside the canyon abyss (visible through arch)
    for (let x = 22; x < w; x += 26) {
      const base = 296 + (rng() - 0.5) * 20;
      const height = 38 + rng() * 24;
      pine(x, base, height, '#192726', 'rgba(130, 148, 136, 0.16)');
    }

    // Soft gorge mist drifting across canyon floor
    const mist = g.createLinearGradient(0, 110, 0, h);
    mist.addColorStop(0, 'rgba(192, 202, 214, 0)');
    mist.addColorStop(0.25, 'rgba(192, 202, 214, 0.22)');
    mist.addColorStop(0.7, 'rgba(200, 212, 224, 0.36)');
    mist.addColorStop(1, 'rgba(210, 222, 232, 0.58)');
    g.fillStyle = mist;
    g.fillRect(0, 110, w, h - 110);

    return off.canvas;
  }

  // Bake textured oak canopy & gnarled bark once (eliminates circular blobs).
  function bakeOakSprite() {
    const w = 220;
    const h = 210;
    const off = makeOffscreen(w, h);
    if (!off) return null;
    const g = off.ctx;
    const rng = makeRng(3319);
    const ox = 98;
    const oy = 204;

    // Gnarled trunk & root flare
    g.fillStyle = '#2d221a';
    g.beginPath();
    g.moveTo(ox - 16, oy);
    g.quadraticCurveTo(ox - 11, oy - 56, ox - 8, oy - 112);
    g.lineTo(ox + 10, oy - 112);
    g.quadraticCurveTo(ox + 10, oy - 56, ox + 18, oy);
    g.closePath();
    g.fill();

    // Warm sunset rim along right trunk bark
    g.fillStyle = '#5a4634';
    g.fillRect(ox + 3, oy - 102, 5, 96);

    // Diverging boughs
    g.strokeStyle = '#31251d';
    g.lineCap = 'round';
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(ox, oy - 96);
    g.quadraticCurveTo(ox + 30, oy - 122, ox + 74, oy - 130);
    g.moveTo(ox - 4, oy - 100);
    g.quadraticCurveTo(ox - 34, oy - 124, ox - 64, oy - 138);
    g.moveTo(ox + 2, oy - 104);
    g.quadraticCurveTo(ox + 10, oy - 140, ox + 26, oy - 168);
    g.stroke();

    // Organic leaf tuft clusters (shaded olive -> sunlit chartreuse -> golden amber tips)
    const hubs = [
      [ox - 46, oy - 138, 34, false],
      [ox - 12, oy - 154, 40, false],
      [ox + 24, oy - 166, 38, true],
      [ox + 64, oy - 132, 36, true],
      [ox + 14, oy - 130, 32, false],
      [ox + 48, oy - 148, 34, true],
      [ox + 86, oy - 122, 24, true]
    ];
    for (const [hx, hy, hr, lit] of hubs) {
      for (let i = 0; i < 64; i++) {
        const ang = rng() * Math.PI * 2;
        const dist = Math.sqrt(rng()) * hr * 1.08;
        const lx = hx + Math.cos(ang) * dist;
        const ly = hy + Math.sin(ang) * dist * 0.76;
        const lr = 2.6 + rng() * 4.2;
        const tSun = (lx - (hx - hr)) / (hr * 2) * 0.6 + (hy - ly + hr) / (hr * 2) * 0.4;
        g.fillStyle = lit && (tSun > 0.60 || rng() > 0.65)
          ? (rng() > 0.45 ? '#e4b84b' : '#b79e3b')
          : (tSun > 0.48 ? '#6d8334' : '#2d4023');
        g.beginPath();
        g.ellipse(lx, ly, lr, lr * 0.65, rng() * Math.PI, 0, Math.PI * 2);
        g.fill();
      }
    }
    return off.canvas;
  }

  // Bake the walkable world foreground: sunlit oak-lined forest road, elevated
  // vaulted stone bridge with sculpted limestone flagstones, crimson pier banners,
  // open canyon arch revealing 50%-parallax waterfall below, and castle gate path.
  function bakeForegroundWorld(heightAt) {
    const off = makeOffscreen(WORLD_WIDTH, VIRTUAL_H);
    if (!off) return null;
    const g = off.ctx;
    const rng = makeRng(9103);

    // 1. West & East rocky cliff plateaus (leave chasm open beneath central bridge arch!)
    function paintPlateau(startX, endX) {
      const turfGrad = g.createLinearGradient(0, 200, 0, VIRTUAL_H);
      turfGrad.addColorStop(0, '#3a4932');
      turfGrad.addColorStop(0.55, '#48573a');
      turfGrad.addColorStop(1, '#2b3228');
      g.fillStyle = turfGrad;
      g.fillRect(startX, 200, endX - startX, VIRTUAL_H - 200);
    }
    paintPlateau(0, BRIDGE.left + 32);
    paintPlateau(BRIDGE.right - 32, WORLD_WIDTH);

    // Crisp rocky cliff drop-offs sloping steeply down into the central gorge chasm
    for (const [bx, dir] of [[BRIDGE.left + 30, -1], [BRIDGE.right - 30, 1]]) {
      g.fillStyle = '#363b36';
      g.beginPath();
      g.moveTo(bx, 200);
      g.lineTo(bx + dir * 22, 345);
      g.lineTo(bx + dir * 32, 376);
      g.lineTo(bx + dir * 24, 420);
      g.lineTo(bx, 420);
      g.closePath();
      g.fill();
    }

    // Subtle organic mossy soil, fallen golden leaves & cliff grass flecks
    for (let i = 0; i < 2600; i++) {
      const gx = rng() * WORLD_WIDTH;
      if (gx > BRIDGE.left + 12 && gx < BRIDGE.right - 12 && rng() > 0.25) continue;
      const gy = 202 + rng() * 214;
      const pathCenter = 288 + Math.sin(gx / 170) * 14;
      const onRoad = Math.abs(gy - pathCenter) < 58 || (gx >= 415 && gx <= 745 && gy >= 225 && gy <= 355);
      g.fillStyle = onRoad
        ? (rng() > 0.45 ? 'rgba(164, 148, 114, 0.34)' : 'rgba(98, 92, 74, 0.30)')
        : (rng() > 0.65 ? 'rgba(136, 118, 56, 0.28)' : rng() > 0.4 ? 'rgba(54, 70, 44, 0.50)' : 'rgba(78, 92, 58, 0.38)');
      g.fillRect(gx, gy, 2 + rng() * 5, 1.5 + rng() * 2.5);
    }

    // 2. Painterly golden-lit limestone flagstone road (west & east approaches)
    function drawApproachPaving(startX, endX) {
      g.save();
      g.beginPath();
      g.rect(startX, 222, endX - startX, 134);
      g.clip();
      g.fillStyle = '#756c57';
      g.fillRect(startX, 226, endX - startX, 124);

      const stones = ['#baa882', '#ab9a78', '#c8b68f', '#9c8e70', '#b3a17d'];
      for (let z = 230, row = 0; z < 348; z += 11.5, row++) {
        for (let x = startX - (row % 2) * 14; x < endX;) {
          const sw = 17 + Math.floor(rng() * 15);
          const pad = 1.5;
          const bx = x + pad;
          const bw = sw - pad * 2;
          g.fillStyle = stones[Math.floor(rng() * stones.length)];
          g.fillRect(bx, z + 1, bw, 9.2);
          // Sunlit warm bevel top, deep mortar crack bottom
          g.fillStyle = 'rgba(246, 226, 174, 0.32)';
          g.fillRect(bx, z + 1, bw, 1.6);
          g.fillStyle = 'rgba(32, 34, 30, 0.34)';
          g.fillRect(bx, z + 9.4, bw, 1.2);
          // Occasional dappled leaf shadow or moss grain
          if (rng() > 0.72) {
            g.fillStyle = 'rgba(42, 54, 38, 0.22)';
            g.fillRect(bx + rng() * bw * 0.4, z + 3, bw * 0.45, 5);
          }
          x += sw;
        }
      }
      // Weathered stone curb edges + moss & wildflowers along road verges
      for (let x = startX; x < endX; x += 22) {
        g.fillStyle = rng() > 0.4 ? '#5a6848' : '#7b745f';
        g.fillRect(x + 1, 223, 18, 6);
        g.fillRect(x + 4, 344, 18, 6);
        if (rng() > 0.55) {
          g.fillStyle = rng() > 0.5 ? '#f5eed6' : '#f2c864';
          g.fillRect(x + rng() * 12, 220 + rng() * 5, 2.2, 2.2);
          g.fillRect(x + rng() * 12, 349 + rng() * 6, 2.2, 2.2);
        }
      }
      g.restore();
    }
    drawApproachPaving(0, BRIDGE.left + 4);
    drawApproachPaving(BRIDGE.right - 4, WORLD_WIDTH);

    // Warm golden sunlight pool streaming onto west road before bridge
    const roadGlow = g.createRadialGradient(290, 290, 20, 290, 290, 155);
    roadGlow.addColorStop(0, 'rgba(255, 222, 138, 0.22)');
    roadGlow.addColorStop(0.55, 'rgba(246, 206, 122, 0.10)');
    roadGlow.addColorStop(1, 'rgba(246, 206, 122, 0)');
    g.fillStyle = roadGlow;
    g.fillRect(120, 220, 340, 140);

    // East ancient weathered stone retaining parapet & ascending castle steps cue
    for (let x = 746; x < 1030; x += 34) {
      const hWall = 15 + Math.floor(rng() * 10);
      const yTop = 216 - hWall;
      g.fillStyle = '#58574f';
      g.beginPath();
      g.moveTo(x, 218);
      g.lineTo(x + 2, yTop + 3);
      g.lineTo(x + 14, yTop);
      g.lineTo(x + 30, yTop + 2);
      g.lineTo(x + 32, 218);
      g.closePath();
      g.fill();
      g.fillStyle = '#a89a7e';
      g.fillRect(x + 3, yTop + 1, 26, 3);
      g.fillStyle = '#485e3e';
      g.fillRect(x + 6, yTop + 4, 10, 5);
    }

    // Shrine stone terrace behind north side of bridge (x = 615..735, z = 208..236)
    g.fillStyle = '#6f6c5c';
    g.fillRect(615, 210, 118, 28);
    g.fillStyle = '#999079';
    g.fillRect(622, 214, 104, 20);

    // 3. Fore-edge Rocky Cliff Crags flanking left & right abutments (z = 352..420)
    // Open chasm sits cleanly between x = 468..692 so the midground gorge & waterfall show through!
    function drawCliffCrag(cx, cy, cw, ch) {
      g.fillStyle = '#3b4144';
      g.beginPath();
      g.moveTo(cx - cw * 0.5, cy + ch);
      g.lineTo(cx - cw * 0.42, cy + ch * 0.25);
      g.lineTo(cx - cw * 0.12, cy);
      g.lineTo(cx + cw * 0.28, cy + ch * 0.14);
      g.lineTo(cx + cw * 0.5, cy + ch);
      g.closePath();
      g.fill();
      // Warm sunlit top rock plane
      g.fillStyle = 'rgba(208, 178, 132, 0.34)';
      g.beginPath();
      g.moveTo(cx - cw * 0.12, cy);
      g.lineTo(cx + cw * 0.28, cy + ch * 0.14);
      g.lineTo(cx + cw * 0.14, cy + ch * 0.46);
      g.lineTo(cx - cw * 0.26, cy + ch * 0.34);
      g.closePath();
      g.fill();
    }
    for (const [cx, cy, cw, ch] of [
      [340, 354, 86, 66], [405, 348, 72, 72], [448, 356, 56, 64],
      [714, 356, 58, 64], [768, 348, 78, 72], [835, 358, 84, 62]
    ]) {
      drawCliffCrag(cx, cy, cw, ch);
    }

    // Stone bridge abutment piers & buttresses
    for (const [ax, dir] of [[BRIDGE.left, -1], [BRIDGE.right, 1]]) {
      g.fillStyle = '#5c5a4f';
      g.beginPath();
      g.moveTo(ax - dir * 18, 344);
      g.lineTo(ax + dir * 24, 344);
      g.lineTo(ax + dir * 16, 420);
      g.lineTo(ax - dir * 24, 420);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(222, 202, 162, 0.26)';
      g.fillRect(ax - 12, 344, 24, 4);
    }

    // 4. Elevated Stone Bridge Facade & Grand Open Vaulted Arch (x = 430..730)
    const step = 4;
    const ax0 = 478;
    const ax1 = 682;
    const amid = (ax0 + ax1) * 0.5;
    const archCrownY = BRIDGE.front - heightAt(amid, 290) + 22;

    g.beginPath();
    g.moveTo(BRIDGE.left, 420);
    g.lineTo(BRIDGE.left, 345);
    for (let x = BRIDGE.left; x <= BRIDGE.right; x += step) {
      g.lineTo(x, BRIDGE.front - heightAt(x, 290));
    }
    g.lineTo(BRIDGE.right, 345);
    g.lineTo(BRIDGE.right, 420);
    g.lineTo(ax1, 420);
    g.quadraticCurveTo(amid, archCrownY, ax0, 420);
    g.closePath();
    g.fillStyle = '#57554b';
    g.fill();

    // Sculpted limestone masonry blocks on the bridge spandrel wall
    g.save();
    g.clip();
    for (let y = 292; y < 420; y += 10) {
      for (let x = BRIDGE.left - ((y / 10) % 2) * 11; x < BRIDGE.right; x += 22) {
        g.fillStyle = rng() > 0.5 ? '#666356' : '#515147';
        g.fillRect(x + 1, y + 1, 20, 8.2);
        g.fillStyle = 'rgba(218, 198, 158, 0.16)';
        g.fillRect(x + 1, y + 1, 20, 1.5);
      }
    }
    // Deep arch soffit inner shadow rim
    g.strokeStyle = 'rgba(20, 26, 30, 0.72)';
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(ax0, 420);
    g.quadraticCurveTo(amid, archCrownY - 2, ax1, 420);
    g.stroke();
    g.restore();

    // Punch open the vaulted arch & chasm gap cleanly so the 50%-parallax waterfall shines through
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.moveTo(ax0 + 2, 420);
    g.quadraticCurveTo(amid, archCrownY + 3, ax1 - 2, 420);
    g.closePath();
    g.fill();
    g.restore();

    // Radial limestone voussoir arch ring stones framing the open canyon arch
    const archSteps = 22;
    for (let i = 0; i < archSteps; i++) {
      const t0 = i / archSteps;
      const t1 = (i + 0.85) / archSteps;
      const p0x = (1 - t0) * (1 - t0) * ax0 + 2 * (1 - t0) * t0 * amid + t0 * t0 * ax1;
      const p0y = (1 - t0) * (1 - t0) * 420 + 2 * (1 - t0) * t0 * archCrownY + t0 * t0 * 420;
      const p1x = (1 - t1) * (1 - t1) * ax0 + 2 * (1 - t1) * t1 * amid + t1 * t1 * ax1;
      const p1y = (1 - t1) * (1 - t1) * 420 + 2 * (1 - t1) * t1 * archCrownY + t1 * t1 * 420;
      const mx = (p0x + p1x) * 0.5;
      const my = (p0y + p1y) * 0.5;
      const nx = (mx - amid) * 0.06;
      const ny = -8;
      g.fillStyle = i % 2 === 0 ? '#918873' : '#7b7462';
      g.beginPath();
      g.moveTo(p0x, p0y);
      g.lineTo(p1x, p1y);
      g.lineTo(p1x + nx, p1y + ny);
      g.lineTo(p0x + nx, p0y + ny);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(28, 32, 28, 0.45)';
      g.lineWidth = 0.9;
      g.stroke();
    }

    // Trailing mossy ivy vines hanging down over the stone spandrel wall
    for (const [vx, vy, len] of [[448, 344, 34], [462, 336, 48], [488, 328, 28], [678, 330, 32], [704, 340, 44]]) {
      g.strokeStyle = '#364d2b';
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(vx, vy);
      g.quadraticCurveTo(vx + 3, vy + len * 0.5, vx - 2, vy + len);
      g.stroke();
      g.fillStyle = '#4e6c38';
      for (let ly = 4; ly < len; ly += 6) {
        g.beginPath();
        g.ellipse(vx + (ly % 12 === 4 ? -3 : 3), vy + ly, 3.2, 1.8, 0.3, 0, Math.PI * 2);
        g.fill();
      }
    }

    // Vertical crimson heraldic banners with gold cross emblems hanging from bridge piers
    for (const bx of [464, 694]) {
      const topY = BRIDGE.front - heightAt(bx, 290) + 4;
      const bw = 18;
      const bh = 42;
      // Soft banner shadow on stonework
      g.fillStyle = 'rgba(18, 20, 18, 0.36)';
      g.fillRect(bx - bw / 2 + 2, topY + 2, bw, bh);
      // Crimson cloth body & notched swallowtail bottom
      const banGrad = g.createLinearGradient(bx, topY, bx, topY + bh);
      banGrad.addColorStop(0, '#9a2429');
      banGrad.addColorStop(1, '#5e1418');
      g.fillStyle = banGrad;
      g.beginPath();
      g.moveTo(bx - bw / 2, topY);
      g.lineTo(bx + bw / 2, topY);
      g.lineTo(bx + bw / 2, topY + bh);
      g.lineTo(bx, topY + bh - 8);
      g.lineTo(bx - bw / 2, topY + bh);
      g.closePath();
      g.fill();
      // Gold trim & heraldic cross emblem
      g.strokeStyle = '#d7ac56';
      g.lineWidth = 1.2;
      g.strokeRect(bx - bw / 2 + 2, topY + 2, bw - 4, bh - 12);
      g.fillStyle = '#e7be62';
      g.fillRect(bx - 1.3, topY + 7, 2.6, 15);
      g.fillRect(bx - 5, topY + 12, 10, 2.5);
    }

    // 5. Walkable Stone Bridge Deck (x = 430..730, z = 235..345)
    // Every flagstone slab follows heightAt(x, z) so feet stay locked to stones.
    g.beginPath();
    for (let x = BRIDGE.left; x <= BRIDGE.right; x += step) {
      const y = BRIDGE.back - heightAt(x, BRIDGE.back);
      if (x === BRIDGE.left) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    for (let x = BRIDGE.right; x >= BRIDGE.left; x -= step) {
      g.lineTo(x, BRIDGE.front - heightAt(x, BRIDGE.front));
    }
    g.closePath();
    g.fillStyle = '#7b745f';
    g.fill();

    g.save();
    g.clip();
    const deckColors = ['#b7aa89', '#aa9c7b', '#c6b793', '#9d9072', '#b0a282'];
    const rowDepth = 11;
    for (let z = BRIDGE.back, row = 0; z < BRIDGE.front; z += rowDepth, row++) {
      for (let x = BRIDGE.left - (row % 2) * 11; x < BRIDGE.right;) {
        const wSlab = 16 + Math.floor(rng() * 14);
        const x0 = Math.max(BRIDGE.left, x + 0.8);
        const x1 = Math.min(BRIDGE.right, x + wSlab - 0.8);
        if (x1 > x0 + 2) {
          const h0 = heightAt(x0, z);
          const h1 = heightAt(x1, z);
          const zNext = Math.min(BRIDGE.front, z + rowDepth - 1.1);
          g.beginPath();
          g.moveTo(x0, z - h0);
          g.lineTo(x1, z - h1);
          g.lineTo(x1, zNext - h1);
          g.lineTo(x0, zNext - h0);
          g.closePath();
          g.fillStyle = deckColors[Math.floor(rng() * deckColors.length)];
          g.fill();

          // Warm golden-hour sunlit rim along upper slab edge
          g.strokeStyle = 'rgba(248, 232, 188, 0.38)';
          g.lineWidth = 1.1;
          g.beginPath();
          g.moveTo(x0, z + 0.8 - h0);
          g.lineTo(x1, z + 0.8 - h1);
          g.stroke();

          // Deep cool mortar shadow below
          g.strokeStyle = 'rgba(32, 36, 32, 0.42)';
          g.beginPath();
          g.moveTo(x0, zNext - h0);
          g.lineTo(x1, zNext - h1);
          g.stroke();
        }
        x += wSlab;
      }
    }

    // Soft golden sun pool & moss weathering along the arch bridge deck
    const deckSun = g.createRadialGradient(545, 250, 18, 545, 250, 145);
    deckSun.addColorStop(0, 'rgba(255, 224, 144, 0.24)');
    deckSun.addColorStop(1, 'rgba(255, 224, 144, 0)');
    g.fillStyle = deckSun;
    g.fillRect(BRIDGE.left, 200, BRIDGE.right - BRIDGE.left, 160);

    for (let i = 0; i < 240; i++) {
      const mx = BRIDGE.left + rng() * (BRIDGE.right - BRIDGE.left);
      const nearEdge = rng() > 0.5
        ? BRIDGE.back + rng() * 11
        : BRIDGE.front - rng() * 11;
      const mh = heightAt(mx, nearEdge);
      g.fillStyle = rng() > 0.4 ? 'rgba(62, 88, 48, 0.44)' : 'rgba(38, 44, 34, 0.22)';
      g.fillRect(mx, nearEdge - mh, 2 + rng() * 4, 1.5 + rng() * 2);
    }
    g.restore();

    // Crisp sunward coping edge along front edge of bridge deck
    g.strokeStyle = 'rgba(235, 218, 176, 0.62)';
    g.lineWidth = 1.6;
    g.beginPath();
    for (let x = BRIDGE.left; x <= BRIDGE.right; x += step) {
      const y = BRIDGE.front - heightAt(x, BRIDGE.front);
      if (x === BRIDGE.left) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();

    return off.canvas;
  }

  function create() {
    let castleSprite = null;
    let midgroundSprite = null;
    let foregroundSprite = null;
    let oakSprite = null;
    let skyCitadelPlate = null;
    let skyCitadelLoading = false;
    let bakedHeightKey = '';

    const nearScenery = Object.freeze([
      { type: 'rearRail', z: BRIDGE.back },
      { type: 'frontRail', z: BRIDGE.front },
      { type: 'oak', x: 96, z: 220, size: 175 },
      { type: 'lanternPost', x: 230, z: 226, size: 78 },
      { type: 'fence', x: 158, z: 227, width: 92 },
      { type: 'fence', x: 342, z: 227, width: 108 },
      { type: 'fence', x: 356, z: 348, width: 88 },
      { type: 'pine', x: 988, z: 220, size: 132 },
      { type: 'rock', x: 118, z: 378, size: 22 },
      { type: 'rock', x: 294, z: 222, size: 16 },
      { type: 'rock', x: 392, z: 368, size: 18 },
      { type: 'rock', x: 762, z: 378, size: 22 },
      { type: 'rock', x: 866, z: 386, size: 17 },
      { type: 'grass', x: 174, z: 368, size: 16 },
      { type: 'grass', x: 356, z: 225, size: 15 },
      { type: 'grass', x: 744, z: 226, size: 16 },
      { type: 'grass', x: 842, z: 368, size: 18 }
    ]);

    function ensureAssets(heightAt) {
      if (!castleSprite) castleSprite = bakeCastleSprite();
      if (!midgroundSprite) midgroundSprite = bakeMidgroundBand();
      if (!oakSprite) oakSprite = bakeOakSprite();
      if (!skyCitadelLoading && typeof Image === 'function' && typeof document !== 'undefined') {
        skyCitadelLoading = true;
        const img = new Image();
        img.onload = () => {
          const pw = 480;
          const ph = 270;
          const off = makeOffscreen(pw, ph);
          if (!off) return;
          const g = off.ctx;
          g.drawImage(img, 0, 0, pw, ph);
          // Feather horizontal & bottom boundaries cleanly into canvas sky/mist.
          // Always draw destination-in across the FULL (0,0,pw,ph) rectangle so
          // the upper citadel & sky are preserved at alpha=1.
          g.save();
          g.globalCompositeOperation = 'destination-in';
          const hMask = g.createLinearGradient(0, 0, pw, 0);
          hMask.addColorStop(0, 'rgba(255,255,255,0)');
          hMask.addColorStop(0.09, 'rgba(255,255,255,0.28)');
          hMask.addColorStop(0.20, 'rgba(255,255,255,0.78)');
          hMask.addColorStop(0.30, 'rgba(255,255,255,1)');
          hMask.addColorStop(0.86, 'rgba(255,255,255,1)');
          hMask.addColorStop(0.95, 'rgba(255,255,255,0.42)');
          hMask.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = hMask;
          g.fillRect(0, 0, pw, ph);
          const vMask = g.createLinearGradient(0, 0, 0, ph);
          vMask.addColorStop(0, 'rgba(255,255,255,1)');
          vMask.addColorStop(0.80, 'rgba(255,255,255,1)');
          vMask.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = vMask;
          g.fillRect(0, 0, pw, ph);
          g.restore();
          skyCitadelPlate = off.canvas;
        };
        img.src = 'assets/castle-bridge/sky-citadel.png';
      }
      const key = typeof heightAt === 'function' ? 'custom' : 'default';
      if (!foregroundSprite || bakedHeightKey !== key) {
        foregroundSprite = bakeForegroundWorld(typeof heightAt === 'function' ? heightAt : defaultHeightAt);
        bakedHeightKey = key;
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
      ctx.moveTo(-250 + offset, 260);
      for (let i = 0; i < peaks.length; i++) {
        ctx.lineTo(-250 + i * step + offset, ridgeYBase - peaks[i]);
      }
      ctx.lineTo(-250 + span + offset + 300, 260);
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

      // 1. Far Sky (fills entire canvas height to prevent any blank gap)
      const sky = ctx.createLinearGradient(0, 0, 0, VIRTUAL_H);
      if (phase === 0) {
        sky.addColorStop(0, '#363b5a');
        sky.addColorStop(0.22, '#8b6e7f');
        sky.addColorStop(0.44, '#e2ab7e');
        sky.addColorStop(0.66, '#7a8a99');
        sky.addColorStop(1, '#202b36');
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

      // Sun / Moon atmospheric glow (broad warm scatter so sky plate blends on wide viewports)
      const glow = ctx.createRadialGradient(anchors.sunX, 68, 8, anchors.sunX, 68, 320);
      if (phase === 0) {
        glow.addColorStop(0, 'rgba(255, 240, 192, 0.84)');
        glow.addColorStop(0.28, 'rgba(249, 198, 138, 0.52)');
        glow.addColorStop(0.62, 'rgba(226, 166, 128, 0.24)');
        glow.addColorStop(1, 'rgba(226, 166, 128, 0)');
      } else if (phase === 1) {
        glow.addColorStop(0, 'rgba(244, 212, 188, 0.45)');
        glow.addColorStop(1, 'rgba(180, 160, 190, 0)');
      } else {
        glow.addColorStop(0, 'rgba(245, 244, 214, 0.88)');
        glow.addColorStop(0.2, 'rgba(195, 214, 232, 0.35)');
        glow.addColorStop(1, 'rgba(140, 170, 200, 0)');
      }
      ctx.fillStyle = glow;
      ctx.fillRect(anchors.sunX - 320, -120, 640, 460);

      // 2. Far Mountains (12% & 16% parallax)
      drawMountains(ctx, width, cam, 196, PARALLAX.mountainFar,
        [38, 66, 48, 92, 60, 84, 46, 74, 56, 80, 44],
        phase === 2 ? '#3e4e68' : '#8c7d91');
      drawMountains(ctx, width, cam, 212, PARALLAX.mountainMid,
        [24, 52, 40, 70, 46, 62, 36, 58, 42, 54, 30],
        phase === 2 ? '#304054' : '#6c7084');

      // 3. Far Painted Sunset Sky & Gothic Castle (20% parallax, single occurrence)
      if (skyCitadelPlate) {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        const plateW = 480;
        const plateH = 250;
        // Align gothic castle peak (~69.5% across plate) onto exact PARALLAX.castle anchor
        // and sit high enough so towers soar cleanly above the y=125..195 pine ridge
        const plateX = anchors.castleX - plateW * 0.695;
        if (phase === 0) {
          // Soft horizontal golden cloud wash bridging far-left canvas sky into skyCitadelPlate
          const bridgeGlow = ctx.createLinearGradient(0, 62, plateX + 180, 128);
          bridgeGlow.addColorStop(0, 'rgba(232, 168, 126, 0.06)');
          bridgeGlow.addColorStop(0.65, 'rgba(242, 186, 134, 0.30)');
          bridgeGlow.addColorStop(1, 'rgba(242, 186, 134, 0)');
          ctx.fillStyle = bridgeGlow;
          ctx.fillRect(0, 0, Math.min(width, plateX + 200), 175);
        }
        ctx.drawImage(skyCitadelPlate, plateX, -28, plateW, plateH);
        ctx.restore();
      } else if (castleSprite) {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(castleSprite, anchors.castleX - 180, anchors.castleY - 14, 360, 240);
        ctx.restore();
      }

      // Soft valley mist separating far castle cliff from midground canyon
      const farMist = ctx.createLinearGradient(0, 128, 0, 232);
      farMist.addColorStop(0, 'rgba(218, 206, 196, 0)');
      farMist.addColorStop(1, phase === 2 ? 'rgba(66, 84, 102, 0.36)' : 'rgba(202, 202, 212, 0.38)');
      ctx.fillStyle = farMist;
      ctx.fillRect(0, 128, width, 104);

      // 4. Midground Gorge Cliffs, Forest & Deep Chasm (50% parallax, y=85..425)
      if (midgroundSprite) {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        const midX = anchors.midgroundOffsetX;
        ctx.drawImage(midgroundSprite, midX, 85, 1600, 340);
        if (midX + 1600 < width) {
          ctx.drawImage(midgroundSprite, midX + 1600, 85, 1600, 340);
        }
        ctx.restore();
      }

      // 5. Midground Canyon Waterfall descending through chasm inside vaulted bridge arch (50% parallax)
      const wfX = anchors.waterfallX;
      if (wfX > -105 && wfX < width + 105) {
        ctx.save();
        // Wet shadowed basalt gorge recess starting below treeline (y=218..420)
        const recessGrad = ctx.createLinearGradient(wfX, 215, wfX, VIRTUAL_H);
        recessGrad.addColorStop(0, 'rgba(18, 26, 34, 0.56)');
        recessGrad.addColorStop(0.55, 'rgba(14, 21, 28, 0.80)');
        recessGrad.addColorStop(1, 'rgba(24, 34, 42, 0.25)');
        ctx.fillStyle = recessGrad;
        ctx.beginPath();
        ctx.moveTo(wfX - 22, 218);
        ctx.lineTo(wfX + 22, 218);
        ctx.lineTo(wfX + 36, VIRTUAL_H);
        ctx.lineTo(wfX - 36, VIRTUAL_H);
        ctx.closePath();
        ctx.fill();

        // Twin tiered silver-white cliff waterfall cascading down into the abyss
        const wfGrad = ctx.createLinearGradient(wfX, 218, wfX, VIRTUAL_H);
        wfGrad.addColorStop(0, 'rgba(240, 249, 252, 0.84)');
        wfGrad.addColorStop(0.45, 'rgba(220, 240, 245, 0.94)');
        wfGrad.addColorStop(0.88, 'rgba(230, 244, 248, 0.68)');
        wfGrad.addColorStop(1, 'rgba(230, 244, 248, 0)');
        ctx.fillStyle = wfGrad;
        for (const [ox, wTop, wBot] of [[-7, 4.5, 9.5], [1, 7.5, 13.5], [9, 4, 8.5]]) {
          ctx.beginPath();
          ctx.moveTo(wfX + ox - wTop * 0.5, 218);
          ctx.quadraticCurveTo(wfX + ox - wBot * 0.35, 315, wfX + ox - wBot * 0.5, VIRTUAL_H);
          ctx.lineTo(wfX + ox + wBot * 0.5, VIRTUAL_H);
          ctx.quadraticCurveTo(wfX + ox + wTop * 0.65, 310, wfX + ox + wTop * 0.5, 218);
          ctx.closePath();
          ctx.fill();
        }

        // Wet rock shelf deflecting water partway down the chasm
        ctx.fillStyle = '#26333c';
        ctx.beginPath();
        ctx.ellipse(wfX + 4, 352, 13, 5, 0.12, 0, Math.PI * 2);
        ctx.fill();

        // Animated vertical foam streaks (visible cleanly inside open bridge arch)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.90)';
        ctx.lineWidth = 1.9;
        const shift = (t * 34) % 20;
        for (let i = -2; i <= 2; i++) {
          const rx = wfX + i * 4.5;
          for (let ry = 224 + shift + (Math.abs(i) * 5) % 16; ry < VIRTUAL_H - 10; ry += 20) {
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx + i * 0.3, ry + 9);
            ctx.stroke();
          }
        }

        // Billowing silver-white waterfall mist clouds inside gorge base
        for (const [mx, my, mr, ma] of [
          [wfX, 398, 64, 0.64],
          [wfX - 28, 405, 48, 0.46],
          [wfX + 28, 405, 48, 0.46]
        ]) {
          const spray = ctx.createRadialGradient(mx, my, 4, mx, my, mr);
          spray.addColorStop(0, `rgba(226, 238, 242, ${ma})`);
          spray.addColorStop(1, 'rgba(226, 238, 242, 0)');
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
      if (foregroundSprite) {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(foregroundSprite, p.x, p.y, WORLD_WIDTH, VIRTUAL_H);
        // Extend east earth/stone slightly if wide viewport reaches past 1050
        if (p.x + WORLD_WIDTH < viewportWidth) {
          ctx.fillStyle = '#3a4932';
          ctx.fillRect(p.x + WORLD_WIDTH - 1, 200, viewportWidth - (p.x + WORLD_WIDTH) + 2, VIRTUAL_H - 200);
        }
        ctx.restore();
      }
    }

    function drawParapet(ctx, cameraX, heightAt, zPos, isFront) {
      const startX = BRIDGE.left;
      const endX = BRIDGE.right;
      const step = 10;

      // Top rail + lower curb (open balustrade so hero's body is never buried)
      const railTop = isFront ? 17 : 15;
      const railThickness = 5;

      // Semi-open stone balusters between posts
      for (let x = startX + 12; x < endX - 6; x += 15) {
        const h = heightAt(x, zPos);
        const p = worldToScreen(x, zPos, h, cameraX);
        ctx.fillStyle = isFront ? '#847b65' : '#6c6858';
        ctx.fillRect(p.x - 2, p.y - railTop + 4, 4, railTop - 4);
      }

      // Continuous horizontal coping rail
      ctx.beginPath();
      for (let x = startX; x <= endX; x += step) {
        const p = worldToScreen(x, zPos, heightAt(x, zPos), cameraX);
        if (x === startX) ctx.moveTo(p.x, p.y - railTop);
        else ctx.lineTo(p.x, p.y - railTop);
      }
      for (let x = endX; x >= startX; x -= step) {
        const p = worldToScreen(x, zPos, heightAt(x, zPos), cameraX);
        ctx.lineTo(p.x, p.y - railTop + railThickness);
      }
      ctx.closePath();
      ctx.fillStyle = isFront ? '#a89c82' : '#8a816c';
      ctx.fill();
      ctx.strokeStyle = 'rgba(36, 40, 34, 0.58)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Sunlit golden rim on coping top edge
      ctx.beginPath();
      for (let x = startX; x <= endX; x += step) {
        const p = worldToScreen(x, zPos, heightAt(x, zPos), cameraX);
        if (x === startX) ctx.moveTo(p.x, p.y - railTop + 0.5);
        else ctx.lineTo(p.x, p.y - railTop + 0.5);
      }
      ctx.strokeStyle = 'rgba(250, 232, 186, 0.58)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Carved stone posts every 60px with weathered cap & mossy accents
      for (const px of [432, 492, 552, 612, 672, 728]) {
        const p = worldToScreen(px, zPos, heightAt(px, zPos), cameraX);
        const postH = isFront ? 22 : 20;
        ctx.fillStyle = isFront ? '#8f856f' : '#746e5e';
        ctx.fillRect(p.x - 5.5, p.y - postH, 11, postH);
        ctx.fillStyle = isFront ? '#c2b597' : '#9c927a';
        ctx.fillRect(p.x - 6.5, p.y - postH - 2, 13, 4);
        ctx.fillStyle = 'rgba(54, 78, 44, 0.45)';
        ctx.fillRect(p.x - 4, p.y - postH + 2, 4, 3);
        ctx.fillStyle = 'rgba(30, 34, 28, 0.45)';
        ctx.fillRect(p.x - 5.5, p.y - 2, 11, 2);
      }
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
        ctx.fillStyle = 'rgba(18, 22, 16, 0.36)';
        ctx.beginPath();
        ctx.ellipse(0, 2, 28, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        if (oakSprite) {
          ctx.drawImage(oakSprite, -98, -204, 220, 210);
        }
      } else if (item.type === 'lanternPost') {
        // Wooden lantern signpost with glowing amber lamp & crimson heraldic pennant
        ctx.fillStyle = 'rgba(18, 20, 18, 0.34)';
        ctx.beginPath();
        ctx.ellipse(0, 1, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // Timber upright + crossbeam
        ctx.fillStyle = '#3f2e22';
        ctx.fillRect(-3, -78, 6, 78);
        ctx.fillRect(-20, -72, 44, 5);
        ctx.fillStyle = '#5c4634';
        ctx.fillRect(-1, -76, 2, 74);

        // Hanging crimson banner with gold emblem on left crossarm
        ctx.fillStyle = '#8d2025';
        ctx.beginPath();
        ctx.moveTo(-19, -67);
        ctx.lineTo(-5, -67);
        ctx.lineTo(-5, -36);
        ctx.lineTo(-12, -41);
        ctx.lineTo(-19, -36);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#e7be62';
        ctx.fillRect(-13, -61, 2, 11);
        ctx.fillRect(-16, -57, 8, 2);

        // Wrought-iron lantern & glowing amber flame halo on right crossarm
        const lx = 17;
        const ly = -54;
        const lampGlow = ctx.createRadialGradient(lx, ly, 2, lx, ly, 36);
        lampGlow.addColorStop(0, 'rgba(255, 224, 128, 0.72)');
        lampGlow.addColorStop(0.45, 'rgba(255, 180, 74, 0.26)');
        lampGlow.addColorStop(1, 'rgba(255, 170, 60, 0)');
        ctx.fillStyle = lampGlow;
        ctx.fillRect(lx - 36, ly - 36, 72, 72);

        ctx.strokeStyle = '#252629';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(lx, -67);
        ctx.lineTo(lx, ly - 8);
        ctx.stroke();
        ctx.fillStyle = '#2c2b2e';
        ctx.fillRect(lx - 5, ly - 9, 10, 3);
        ctx.fillRect(lx - 4, ly + 4, 8, 3);
        ctx.fillStyle = '#ffdfa0';
        ctx.fillRect(lx - 3.5, ly - 6, 7, 10);
      } else if (item.type === 'fence') {
        const hw = (item.width || 90) * 0.5;
        ctx.fillStyle = '#4c3a2b';
        ctx.fillRect(-hw, -13, hw * 2, 2.5);
        ctx.fillRect(-hw, -7, hw * 2, 2.5);
        for (let fx = -hw + 4; fx <= hw - 4; fx += 24) {
          ctx.fillStyle = '#3d2e22';
          ctx.fillRect(fx - 2.2, -18, 4.4, 18);
          ctx.fillStyle = '#6b533e';
          ctx.fillRect(fx - 1.5, -18, 2, 4);
        }
      } else if (item.type === 'pine') {
        // Trunk & feathered boughs
        ctx.fillStyle = '#362a20';
        ctx.fillRect(-5, -item.size * 0.42, 10, item.size * 0.42);
        const cols = ['#1f3028', '#273c30', '#314b39'];
        for (let i = 0; i < 4; i++) {
          const y0 = -item.size * (0.24 + i * 0.19);
          const w0 = item.size * (0.34 - i * 0.055);
          ctx.fillStyle = cols[i % cols.length];
          ctx.beginPath();
          ctx.moveTo(0, y0 - item.size * 0.30);
          ctx.lineTo(w0, y0 + 7);
          ctx.lineTo(w0 * 0.35, y0 + 4);
          ctx.lineTo(-w0 * 0.35, y0 + 4);
          ctx.lineTo(-w0, y0 + 7);
          ctx.closePath();
          ctx.fill();
        }
      } else if (item.type === 'rock') {
        ctx.fillStyle = 'rgba(20, 26, 22, 0.36)';
        ctx.beginPath();
        ctx.ellipse(2, 1, item.size + 4, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#606257';
        ctx.beginPath();
        ctx.moveTo(-item.size, 0);
        ctx.lineTo(-item.size * 0.72, -item.size * 0.65);
        ctx.lineTo(item.size * 0.38, -item.size * 0.82);
        ctx.lineTo(item.size, -2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(232, 212, 168, 0.34)';
        ctx.beginPath();
        ctx.moveTo(-item.size * 0.3, -item.size * 0.66);
        ctx.lineTo(item.size * 0.38, -item.size * 0.82);
        ctx.lineTo(item.size * 0.75, -item.size * 0.35);
        ctx.closePath();
        ctx.fill();
      } else if (item.type === 'grass') {
        ctx.strokeStyle = '#56704c';
        ctx.lineWidth = 2.2;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 2.5, 0);
          ctx.quadraticCurveTo(i * 4.5, -item.size * 0.5, i * 6, -item.size * 0.85);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    function shadow(ctx, x, z, groundH, cameraX, jumpHeight) {
      const p = worldToScreen(x, z, groundH, cameraX);
      const jump = Math.max(0, Number.isFinite(jumpHeight) ? jumpHeight : 0);
      const shrink = Math.max(0.55, 1 - jump * 0.004);
      const alpha = Math.max(0.18, 0.56 - jump * 0.003);
      const rx = 18 * ACTOR_SCALE * shrink;
      const ry = 6.5 * ACTOR_SCALE * shrink;
      ctx.save();
      const radial = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, rx);
      radial.addColorStop(0, `rgba(14, 16, 14, ${alpha})`);
      radial.addColorStop(0.55, `rgba(14, 16, 14, ${(alpha * 0.52).toFixed(2)})`);
      radial.addColorStop(1, 'rgba(14, 16, 14, 0)');
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

    function site(ctx, spot, found, near, groundH, cameraX, timeMs) {
      const p = worldToScreen(spot.x, spot.z, groundH, cameraX);
      ctx.save();
      ctx.translate(Math.round(p.x), Math.round(p.y));

      // Ground contact shadow
      ctx.fillStyle = 'rgba(18, 24, 20, 0.34)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 19, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      if (spot.id === 'shrine') {
        // Small mossy stone wayside shrine
        ctx.fillStyle = '#7c7b6c';
        ctx.fillRect(-13, -34, 26, 34);
        ctx.fillStyle = '#9b947f';
        ctx.fillRect(-17, -39, 34, 6);
        ctx.fillStyle = '#5c7252';
        ctx.fillRect(-12, -33, 9, 8);
        ctx.fillStyle = found ? '#4f5550' : '#f2c879';
        ctx.fillRect(-4, -23, 8, 12);
      } else if (spot.id === 'hollow') {
        // Thorn-covered ancient stone gate
        ctx.fillStyle = '#68675b';
        ctx.fillRect(-19, -46, 9, 46);
        ctx.fillRect(10, -46, 9, 46);
        ctx.fillRect(-23, -52, 46, 8);
        ctx.fillStyle = '#252a27';
        ctx.fillRect(-10, -44, 20, 44);
        if (!found) {
          ctx.strokeStyle = '#5c4b39';
          ctx.lineWidth = 2.4;
          for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(-12, -10 - i * 7);
            ctx.lineTo(12, -28 - i * 4);
            ctx.stroke();
          }
        }
      } else {
        // Animal tracks pressed into soil
        ctx.fillStyle = found ? '#585647' : '#d6c39a';
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(-14 + i * 8, -5 + (i % 2) * 3, 5, 3);
        }
      }

      // Subtle diamond glint ONLY when unfound; text label ONLY when near
      if (!found) {
        const bob = Math.sin((timeMs || 0) / 480) * 2.5;
        const markerY = spot.id === 'traces' ? -20 + bob : -60 + bob;
        ctx.fillStyle = near ? '#ffe79e' : '#e6be73';
        ctx.beginPath();
        ctx.moveTo(0, markerY - 8);
        ctx.lineTo(6, markerY);
        ctx.lineTo(0, markerY + 8);
        ctx.lineTo(-6, markerY);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(20, 26, 22, 0.78)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (near) {
          ctx.font = 'bold 11px "Noto Sans JP", sans-serif';
          ctx.textAlign = 'center';
          const text = '調べる';
          const tw = ctx.measureText(text).width + 14;
          ctx.fillStyle = 'rgba(22, 30, 24, 0.9)';
          ctx.fillRect(-tw / 2, markerY - 30, tw, 18);
          ctx.strokeStyle = '#e8c47a';
          ctx.lineWidth = 1;
          ctx.strokeRect(-tw / 2, markerY - 30, tw, 18);
          ctx.fillStyle = '#fff3d1';
          ctx.fillText(text, 0, markerY - 17);
        }
      }

      ctx.restore();
    }

    function foreground(ctx, viewportWidth, cameraX, timeMs) {
      const t = Number.isFinite(timeMs) ? timeMs : 0;
      const drift = Math.sin(t / 2400) * 10;
      const anchors = layerAnchors(cameraX, viewportWidth);
      ctx.save();

      // Soft diagonal golden crepuscular sunbeams streaming subtly across scene
      const rayGrad = ctx.createLinearGradient(anchors.sunX * 0.72, 0, viewportWidth * 0.25, 310);
      rayGrad.addColorStop(0, 'rgba(255, 224, 146, 0.08)');
      rayGrad.addColorStop(0.55, 'rgba(255, 210, 128, 0.04)');
      rayGrad.addColorStop(1, 'rgba(255, 205, 118, 0)');
      ctx.fillStyle = rayGrad;
      for (const [rxOff, rwTop, rwBot] of [[-120, 56, 140], [-10, 74, 175], [105, 48, 125]]) {
        const sx = anchors.sunX * 0.62 + rxOff;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx + rwTop, 0);
        ctx.lineTo(sx + rwBot - 160, 340);
        ctx.lineTo(sx - 160, 340);
        ctx.closePath();
        ctx.fill();
      }

      // Soft warm amber light dust motes drifting slowly through the sunbeams
      for (let i = 0; i < 14; i++) {
        const mx = ((i * 73 + t * 0.012) % (viewportWidth + 40)) - 20;
        const my = 70 + ((i * 47 + Math.sin(t * 0.001 + i) * 18) % 210);
        ctx.fillStyle = 'rgba(255, 232, 168, 0.42)';
        ctx.beginPath();
        ctx.arc(mx, my, i % 3 === 0 ? 1.5 : 1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Billowing canyon mist hovering below the bridge chasm corners
      for (const [fx, fr, fa] of [
        [viewportWidth * 0.25 + drift, 125, 0.16],
        [viewportWidth * 0.78 - drift, 130, 0.18]
      ]) {
        const fog = ctx.createRadialGradient(fx, VIRTUAL_H - 10, 10, fx, VIRTUAL_H - 10, fr);
        fog.addColorStop(0, `rgba(218, 226, 234, ${fa})`);
        fog.addColorStop(1, 'rgba(218, 226, 234, 0)');
        ctx.fillStyle = fog;
        ctx.fillRect(fx - fr, VIRTUAL_H - 10 - fr, fr * 2, fr + 14);
      }

      // Extreme bottom-left autumn leaf sprig framing chasm margin (non-occluding)
      const cam = Number.isFinite(cameraX) ? cameraX : 0;
      if (cam < 240) {
        const leafShift = Math.max(0, 1 - cam / 240);
        ctx.globalAlpha = 0.9 * leafShift;
        for (const [lx, ly, lw, lh, rot, lc] of [
          [10, VIRTUAL_H - 6, 9, 4.5, -0.35, '#8a2b1a'],
          [22, VIRTUAL_H - 10, 8, 4, -0.15, '#b84620'],
          [32, VIRTUAL_H - 4, 7, 3.8, 0.2, '#d4742a'],
          [16, VIRTUAL_H - 14, 6.5, 3.2, -0.6, '#db8c36'],
          [44, VIRTUAL_H - 8, 6, 3, -0.25, '#9d361d']
        ]) {
          ctx.fillStyle = lc;
          ctx.beginPath();
          ctx.ellipse(lx, ly, lw, lh, rot, 0, Math.PI * 2);
          ctx.fill();
        }
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

