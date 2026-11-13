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
    const waterfallBaseX = width * 0.45 + 195;
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

  // Bake midground cliff band & pine silhouettes across a wide loop-free span.
  function bakeMidgroundBand() {
    const w = 1600;
    const h = 250;
    const off = makeOffscreen(w, h);
    if (!off) return null;
    const g = off.ctx;
    const rng = makeRng(4207);

    // Canyon back cliffs
    g.fillStyle = '#364346';
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 40) {
      const ridge = 74 + Math.sin(x * 0.008) * 26 + Math.cos(x * 0.023) * 14;
      g.lineTo(x, ridge);
    }
    g.lineTo(w, h);
    g.closePath();
    g.fill();

    // Layered rocky cliff ledges & warm dusk rim facets
    for (let x = 16; x < w; x += 58) {
      const topY = 76 + Math.sin(x * 0.008) * 26 + Math.cos(x * 0.023) * 14;
      g.fillStyle = 'rgba(154, 128, 106, 0.22)';
      g.beginPath();
      g.moveTo(x, topY);
      g.lineTo(x + 26, topY + 20);
      g.lineTo(x + 16, topY + 78);
      g.lineTo(x - 6, topY + 52);
      g.closePath();
      g.fill();

      g.fillStyle = 'rgba(28, 38, 40, 0.26)';
      g.beginPath();
      g.moveTo(x - 14, topY + 14);
      g.lineTo(x + 2, topY + 34);
      g.lineTo(x - 8, topY + 95);
      g.lineTo(x - 24, topY + 70);
      g.closePath();
      g.fill();
    }

    // Organic conifer silhouettes along the cliff crests & ledges
    function pine(px, py, ph, col, rimCol) {
      for (let tier = 0; tier < 4; tier++) {
        const ty = py - ph * (0.2 + tier * 0.2);
        const tw = ph * (0.35 - tier * 0.065);
        const tipY = ty - ph * 0.30;
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(px, tipY);
        g.lineTo(px + tw, ty + 6);
        g.lineTo(px + tw * 0.35, ty + 4);
        g.lineTo(px, ty + 7);
        g.lineTo(px - tw * 0.35, ty + 4);
        g.lineTo(px - tw, ty + 6);
        g.closePath();
        g.fill();

        // Subtle warm twilight highlight on sunward right branch edge
        g.fillStyle = rimCol;
        g.beginPath();
        g.moveTo(px, tipY);
        g.lineTo(px + tw, ty + 6);
        g.lineTo(px + tw * 0.45, ty + 4);
        g.closePath();
        g.fill();
      }
    }

    for (let x = 8; x < w; x += 20) {
      const base = 104 + Math.sin(x * 0.008) * 22 + (rng() - 0.5) * 14;
      const height = 32 + rng() * 34;
      pine(x, base, height,
        rng() > 0.45 ? '#253733' : '#2f453c',
        'rgba(150, 146, 114, 0.22)');
    }

    // Soft gorge mist along the bottom so midground blends into foreground
    const mist = g.createLinearGradient(0, 128, 0, h);
    mist.addColorStop(0, 'rgba(176, 188, 182, 0)');
    mist.addColorStop(0.55, 'rgba(176, 188, 182, 0.22)');
    mist.addColorStop(1, 'rgba(154, 168, 164, 0.55)');
    g.fillStyle = mist;
    g.fillRect(0, 128, w, h - 128);

    return off.canvas;
  }

  // Bake the walkable world foreground: west forest road, elevated arched stone
  // bridge with perspective-aligned cobblestones, lower gorge embankment, and
  // east castle-approach terrace. Baked 1:1 in world coordinates (0..1050).
  function bakeForegroundWorld(heightAt) {
    const off = makeOffscreen(WORLD_WIDTH, VIRTUAL_H);
    if (!off) return null;
    const g = off.ctx;
    const rng = makeRng(9103);

    // 1. Base mossy cliff turf & stone approach ground (west & east & shore ledges)
    g.fillStyle = '#3f4938';
    g.fillRect(0, 200, WORLD_WIDTH, VIRTUAL_H - 200);

    // Subtle organic turf variation (no grid repetition)
    for (let i = 0; i < 2400; i++) {
      const gx = rng() * WORLD_WIDTH;
      const gy = 202 + rng() * 214;
      const pathCenter = 290 + Math.sin(gx / 170) * 18;
      const onRoad = Math.abs(gy - pathCenter) < 58 || (gx >= 415 && gx <= 745 && gy >= 225 && gy <= 355);
      g.fillStyle = onRoad
        ? (rng() > 0.5 ? 'rgba(138, 129, 106, 0.35)' : 'rgba(95, 92, 76, 0.32)')
        : (rng() > 0.5 ? 'rgba(54, 68, 48, 0.48)' : 'rgba(78, 89, 60, 0.36)');
      g.fillRect(gx, gy, 2 + rng() * 5, 1.5 + rng() * 2.5);
    }

    // 2. Winding stone road before & after the bridge (x = 0..432, x = 728..1050)
    function drawApproachPaving(startX, endX) {
      g.save();
      g.beginPath();
      g.rect(startX, 224, endX - startX, 134);
      g.clip();
      g.fillStyle = '#7b7462';
      g.fillRect(startX, 228, endX - startX, 124);

      const stones = ['#8d8571', '#817a67', '#978e78', '#756f5e'];
      for (let z = 232, row = 0; z < 348; z += 12, row++) {
        for (let x = startX - (row % 2) * 14; x < endX;) {
          const sw = 18 + Math.floor(rng() * 16);
          const pad = 1.4;
          const bx = x + pad;
          const bw = sw - pad * 2;
          g.fillStyle = stones[Math.floor(rng() * stones.length)];
          g.fillRect(bx, z + 1, bw, 9.5);
          // Warm sun highlight on top edge, cool mortar shadow below
          g.fillStyle = 'rgba(222, 206, 174, 0.25)';
          g.fillRect(bx, z + 1, bw, 1.5);
          g.fillStyle = 'rgba(34, 38, 32, 0.28)';
          g.fillRect(bx, z + 9.5, bw, 1.2);
          x += sw;
        }
      }
      // Mossy road curb stones along north & south edges
      for (let x = startX; x < endX; x += 26) {
        g.fillStyle = rng() > 0.4 ? '#5a664c' : '#6c6c5a';
        g.fillRect(x + 1, 225, 22, 7);
        g.fillRect(x + 4, 344, 21, 7);
      }
      g.restore();
    }
    drawApproachPaving(0, BRIDGE.left + 4);
    drawApproachPaving(BRIDGE.right - 4, WORLD_WIDTH);

    // East ancient weathered stone retaining parapet along north border (leading toward gate)
    for (let x = 746; x < 1030; x += 36) {
      const hWall = 16 + Math.floor(rng() * 10);
      const yTop = 216 - hWall;
      g.fillStyle = '#5c5d54';
      g.beginPath();
      g.moveTo(x, 218);
      g.lineTo(x + 2, yTop + 3);
      g.lineTo(x + 14, yTop);
      g.lineTo(x + 31, yTop + 2);
      g.lineTo(x + 33, 218);
      g.closePath();
      g.fill();
      g.fillStyle = '#8d8673';
      g.fillRect(x + 3, yTop + 1, 27, 3);
      g.fillStyle = '#4c6244';
      g.fillRect(x + 6, yTop + 4, 10, 5);
    }

    // Shrine stone terrace behind north side of bridge (x = 610..735, z = 206..236)
    g.fillStyle = '#6f6c5d';
    g.fillRect(615, 210, 118, 28);
    g.fillStyle = '#8e8774';
    g.fillRect(622, 214, 104, 20);

    // 3. Lower chasm / riverbank ledge below the bridge arches (z = 350..420)
    // Organic curved embankment & damp gorge boulders so there is no boxy seam.
    const bankGrad = g.createLinearGradient(0, 344, 0, 420);
    bankGrad.addColorStop(0, 'rgba(42, 52, 48, 0.92)');
    bankGrad.addColorStop(0.45, 'rgba(54, 66, 56, 0.85)');
    bankGrad.addColorStop(1, 'rgba(58, 70, 54, 0.95)');
    g.fillStyle = bankGrad;
    g.beginPath();
    g.moveTo(BRIDGE.left - 34, 420);
    g.quadraticCurveTo(BRIDGE.left - 6, 358, BRIDGE.left + 20, 350);
    g.lineTo(BRIDGE.right - 20, 350);
    g.quadraticCurveTo(BRIDGE.right + 6, 358, BRIDGE.right + 34, 420);
    g.closePath();
    g.fill();

    // Shallow gorge stream glint & mossy stepping stones below the arches
    g.fillStyle = 'rgba(116, 146, 144, 0.26)';
    g.beginPath();
    g.ellipse(580, 378, 118, 22, 0, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < 42; i++) {
      const rx = BRIDGE.left - 10 + rng() * (BRIDGE.right - BRIDGE.left + 20);
      const rz = 358 + rng() * 52;
      g.fillStyle = rng() > 0.5 ? '#4c544a' : '#5e6253';
      g.beginPath();
      g.ellipse(rx, rz, 7 + rng() * 12, 2.5 + rng() * 3.5, 0, 0, Math.PI * 2);
      g.fill();
    }

    // Stone bridge abutment wing-walls blending road edges into bridge piers
    for (const [ax, dir] of [[BRIDGE.left, -1], [BRIDGE.right, 1]]) {
      g.fillStyle = '#5c5b50';
      g.beginPath();
      g.moveTo(ax, 345);
      g.lineTo(ax + dir * 24, 345);
      g.lineTo(ax + dir * 18, 378);
      g.lineTo(ax, 374);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(210, 196, 165, 0.22)';
      g.fillRect(Math.min(ax, ax + dir * 20), 344, 20, 3);
    }

    // 4. Elevated Stone Bridge Facade & Vaulted Arches (z = 345 downward)
    // Draw the vertical stone wall supporting the arched deck.
    const step = 4;
    g.beginPath();
    g.moveTo(BRIDGE.left, 362);
    for (let x = BRIDGE.left; x <= BRIDGE.right; x += step) {
      g.lineTo(x, BRIDGE.front - heightAt(x, 290));
    }
    g.lineTo(BRIDGE.right, 362);
    g.closePath();
    g.fillStyle = '#53544b';
    g.fill();

    // Masonry courses on the bridge front facade
    g.save();
    g.clip();
    for (let y = 296; y < 364; y += 10) {
      for (let x = BRIDGE.left - ((y / 10) % 2) * 11; x < BRIDGE.right; x += 22) {
        g.fillStyle = rng() > 0.5 ? '#616155' : '#4e5047';
        g.fillRect(x + 1, y + 1, 20, 8);
        g.fillStyle = 'rgba(205, 191, 158, 0.14)';
        g.fillRect(x + 1, y + 1, 20, 1.5);
      }
    }
    // Deep recessed stone arches under the bridge
    for (const [ax0, ax1] of [[462, 566], [594, 698]]) {
      const amid = (ax0 + ax1) * 0.5;
      const topH = heightAt(amid, 290);
      const crownY = BRIDGE.front - topH + 18;
      // Voussoir arch ring
      g.fillStyle = '#7e7867';
      g.beginPath();
      g.moveTo(ax0 - 6, 362);
      g.quadraticCurveTo(amid, crownY - 12, ax1 + 6, 362);
      g.closePath();
      g.fill();
      // Deep shadowed arch hollow
      g.fillStyle = '#202b30';
      g.beginPath();
      g.moveTo(ax0, 362);
      g.quadraticCurveTo(amid, crownY, ax1, 362);
      g.closePath();
      g.fill();
      // Subtle misty water glint at arch base
      g.fillStyle = 'rgba(155, 182, 178, 0.22)';
      g.fillRect(ax0 + 6, 355, ax1 - ax0 - 12, 7);
    }
    g.restore();

    // 5. Walkable Stone Bridge Deck (x = 430..730, z = 235..345)
    // Every stone slab follows heightAt(x, z) so feet stay locked to stones.
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
    g.fillStyle = '#787362';
    g.fill();

    g.save();
    g.clip();
    const deckColors = ['#9c947e', '#918974', '#a59c86', '#867f6c', '#98907b'];
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

          // Sunlit stone rim along the top of each flagstone
          g.strokeStyle = 'rgba(232, 217, 184, 0.34)';
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(x0, z + 0.8 - h0);
          g.lineTo(x1, z + 0.8 - h1);
          g.stroke();

          // Dark mortar gap along bottom edge
          g.strokeStyle = 'rgba(38, 42, 36, 0.38)';
          g.beginPath();
          g.moveTo(x0, zNext - h0);
          g.lineTo(x1, zNext - h1);
          g.stroke();
        }
        x += wSlab;
      }
    }

    // Subtle mossy weathering along the front/rear bridge edges
    for (let i = 0; i < 240; i++) {
      const mx = BRIDGE.left + rng() * (BRIDGE.right - BRIDGE.left);
      const nearEdge = rng() > 0.5
        ? BRIDGE.back + rng() * 10
        : BRIDGE.front - rng() * 10;
      const mh = heightAt(mx, nearEdge);
      g.fillStyle = rng() > 0.4 ? 'rgba(66, 92, 54, 0.42)' : 'rgba(42, 48, 38, 0.20)';
      g.fillRect(mx, nearEdge - mh, 2 + rng() * 4, 1.5 + rng() * 2);
    }
    g.restore();

    // Crisp sunward coping edge along front edge of bridge deck
    g.strokeStyle = 'rgba(220, 206, 174, 0.55)';
    g.lineWidth = 1.5;
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
    let bakedHeightKey = '';

    const nearScenery = Object.freeze([
      { type: 'rearRail', z: BRIDGE.back },
      { type: 'frontRail', z: BRIDGE.front },
      { type: 'pine', x: 46, z: 222, size: 125 },
      { type: 'pine', x: 992, z: 222, size: 120 },
      { type: 'rock', x: 118, z: 376, size: 20 },
      { type: 'rock', x: 294, z: 222, size: 16 },
      { type: 'rock', x: 396, z: 368, size: 18 },
      { type: 'rock', x: 754, z: 378, size: 22 },
      { type: 'rock', x: 866, z: 386, size: 17 },
      { type: 'grass', x: 174, z: 368, size: 16 },
      { type: 'grass', x: 356, z: 225, size: 15 },
      { type: 'grass', x: 744, z: 226, size: 16 },
      { type: 'grass', x: 842, z: 368, size: 18 }
    ]);

    function ensureAssets(heightAt) {
      if (!castleSprite) castleSprite = bakeCastleSprite();
      if (!midgroundSprite) midgroundSprite = bakeMidgroundBand();
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
      const sky = ctx.createLinearGradient(0, 0, 0, 260);
      if (phase === 0) {
        sky.addColorStop(0, '#404867');
        sky.addColorStop(0.45, '#b67d7a');
        sky.addColorStop(0.82, '#efc094');
        sky.addColorStop(1, '#c8c3ad');
      } else if (phase === 1) {
        sky.addColorStop(0, '#222842');
        sky.addColorStop(0.5, '#594b6b');
        sky.addColorStop(1, '#98888d');
      } else {
        sky.addColorStop(0, '#141e33');
        sky.addColorStop(0.55, '#2b3e5a');
        sky.addColorStop(1, '#687b89');
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, VIRTUAL_H);

      // Sun / Moon atmospheric glow (very slow parallax)
      const glow = ctx.createRadialGradient(anchors.sunX, 74, 4, anchors.sunX, 74, 195);
      if (phase === 0) {
        glow.addColorStop(0, 'rgba(255, 240, 195, 0.85)');
        glow.addColorStop(0.32, 'rgba(248, 198, 146, 0.42)');
        glow.addColorStop(1, 'rgba(240, 180, 136, 0)');
      } else if (phase === 1) {
        glow.addColorStop(0, 'rgba(244, 212, 188, 0.45)');
        glow.addColorStop(1, 'rgba(180, 160, 190, 0)');
      } else {
        glow.addColorStop(0, 'rgba(245, 244, 214, 0.88)');
        glow.addColorStop(0.2, 'rgba(195, 214, 232, 0.35)');
        glow.addColorStop(1, 'rgba(140, 170, 200, 0)');
      }
      ctx.fillStyle = glow;
      ctx.fillRect(anchors.sunX - 195, -80, 390, 360);

      // 2. Far Mountains (12% & 16% parallax)
      drawMountains(ctx, width, cam, 188, PARALLAX.mountainFar,
        [40, 68, 52, 92, 64, 86, 48, 74, 58, 82, 46],
        phase === 2 ? '#4b5a72' : '#8e8a93');
      drawMountains(ctx, width, cam, 204, PARALLAX.mountainMid,
        [28, 54, 42, 72, 50, 66, 38, 60, 44, 58, 32],
        phase === 2 ? '#39495c' : '#6f7782');

      // 3. Far Castle (20% parallax, single occurrence only)
      if (castleSprite) {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(castleSprite, anchors.castleX - 180, anchors.castleY, 360, 240);
        ctx.restore();
      }

      // Atmospheric haze separating far castle from midground cliffs
      const farMist = ctx.createLinearGradient(0, 118, 0, 225);
      farMist.addColorStop(0, 'rgba(222, 205, 186, 0)');
      farMist.addColorStop(1, phase === 2 ? 'rgba(92, 112, 128, 0.36)' : 'rgba(208, 202, 188, 0.42)');
      ctx.fillStyle = farMist;
      ctx.fillRect(0, 118, width, 107);

      // 4. Midground Cliffs, Forest & Waterfall (50% parallax)
      if (midgroundSprite) {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        const midX = anchors.midgroundOffsetX;
        ctx.drawImage(midgroundSprite, midX, 24, 1600, 250);
        if (midX + 1600 < width) {
          ctx.drawImage(midgroundSprite, midX + 1600, 24, 1600, 250);
        }
        ctx.restore();
      }

      // Natural multi-stream waterfall issuing from a rocky cliff cleft below the treeline
      const wfX = anchors.waterfallX;
      if (wfX > -95 && wfX < width + 95) {
        ctx.save();
        // Wet shadowed gorge cleft inside the cliff face (below trees, no boxy cap)
        const recessGrad = ctx.createLinearGradient(wfX, 122, wfX, 232);
        recessGrad.addColorStop(0, 'rgba(30, 40, 44, 0.42)');
        recessGrad.addColorStop(0.5, 'rgba(30, 40, 44, 0.58)');
        recessGrad.addColorStop(1, 'rgba(30, 40, 44, 0)');
        ctx.fillStyle = recessGrad;
        ctx.beginPath();
        ctx.moveTo(wfX - 16, 124);
        ctx.lineTo(wfX + 16, 124);
        ctx.lineTo(wfX + 24, 232);
        ctx.lineTo(wfX - 24, 232);
        ctx.closePath();
        ctx.fill();

        // Irregular organic falling water streams (split around wet rock shelf)
        const wfGrad = ctx.createLinearGradient(wfX, 124, wfX, 234);
        wfGrad.addColorStop(0, 'rgba(225, 240, 236, 0.78)');
        wfGrad.addColorStop(0.55, 'rgba(186, 218, 214, 0.72)');
        wfGrad.addColorStop(1, 'rgba(220, 236, 230, 0)');
        ctx.fillStyle = wfGrad;
        for (const [ox, wTop, wBot] of [[-7, 4, 9], [1, 6, 12], [9, 3.5, 8]]) {
          ctx.beginPath();
          ctx.moveTo(wfX + ox - wTop * 0.5, 124);
          ctx.quadraticCurveTo(wfX + ox - wBot * 0.3, 178, wfX + ox - wBot * 0.5, 232);
          ctx.lineTo(wfX + ox + wBot * 0.5, 232);
          ctx.quadraticCurveTo(wfX + ox + wTop * 0.7, 176, wfX + ox + wTop * 0.5, 124);
          ctx.closePath();
          ctx.fill();
        }

        // Rock ledge breaking the cascade mid-cliff
        ctx.fillStyle = '#384546';
        ctx.beginPath();
        ctx.ellipse(wfX - 3, 166, 10, 3.5, -0.15, 0, Math.PI * 2);
        ctx.fill();

        // Animated water foam ribbons
        ctx.strokeStyle = 'rgba(250, 254, 250, 0.62)';
        ctx.lineWidth = 1.6;
        const shift = (t * 28) % 18;
        for (let i = -2; i <= 2; i++) {
          const rx = wfX + i * 4.6;
          for (let ry = 128 + shift + (Math.abs(i) * 5) % 14; ry < 220; ry += 18) {
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx + i * 0.35, ry + 8);
            ctx.stroke();
          }
        }

        // Layered billowing mist plumes at waterfall base
        for (const [mx, my, mr, ma] of [
          [wfX, 224, 46, 0.52],
          [wfX - 18, 228, 34, 0.34],
          [wfX + 20, 228, 36, 0.34]
        ]) {
          const spray = ctx.createRadialGradient(mx, my, 3, mx, my, mr);
          spray.addColorStop(0, `rgba(232, 240, 234, ${ma})`);
          spray.addColorStop(1, 'rgba(232, 240, 234, 0)');
          ctx.fillStyle = spray;
          ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
        }
        ctx.restore();
      }

      if (phase > 0) {
        ctx.fillStyle = phase === 1 ? 'rgba(22, 24, 40, 0.16)' : 'rgba(12, 18, 34, 0.26)';
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
          ctx.fillStyle = '#3f4938';
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
        ctx.fillStyle = isFront ? '#7e7866' : '#686759';
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
      ctx.fillStyle = isFront ? '#9e957f' : '#857f6e';
      ctx.fill();
      ctx.strokeStyle = 'rgba(42, 46, 39, 0.55)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Sunlit top edge on coping rail
      ctx.beginPath();
      for (let x = startX; x <= endX; x += step) {
        const p = worldToScreen(x, zPos, heightAt(x, zPos), cameraX);
        if (x === startX) ctx.moveTo(p.x, p.y - railTop + 0.5);
        else ctx.lineTo(p.x, p.y - railTop + 0.5);
      }
      ctx.strokeStyle = 'rgba(235, 222, 192, 0.5)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Carved stone posts every 60px
      for (const px of [432, 492, 552, 612, 672, 728]) {
        const p = worldToScreen(px, zPos, heightAt(px, zPos), cameraX);
        const postH = isFront ? 22 : 20;
        ctx.fillStyle = isFront ? '#8a826f' : '#737060';
        ctx.fillRect(p.x - 5, p.y - postH, 10, postH);
        // Sunlit bevel & cap
        ctx.fillStyle = isFront ? '#b5ab92' : '#96907c';
        ctx.fillRect(p.x - 6, p.y - postH - 2, 12, 4);
        ctx.fillStyle = 'rgba(34, 38, 32, 0.45)';
        ctx.fillRect(p.x - 5, p.y - 2, 10, 2);
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
      if (item.type === 'pine') {
        // Trunk
        ctx.fillStyle = '#3c3128';
        ctx.fillRect(-5, -item.size * 0.42, 10, item.size * 0.42);
        // Layered foliage
        const cols = ['#25372d', '#2e4536', '#395440'];
        for (let i = 0; i < 3; i++) {
          const y0 = -item.size * (0.28 + i * 0.22);
          const w0 = item.size * (0.34 - i * 0.06);
          ctx.fillStyle = cols[i];
          ctx.beginPath();
          ctx.moveTo(0, y0 - item.size * 0.34);
          ctx.lineTo(w0, y0 + 8);
          ctx.lineTo(-w0, y0 + 8);
          ctx.closePath();
          ctx.fill();
        }
      } else if (item.type === 'rock') {
        ctx.fillStyle = 'rgba(20, 26, 22, 0.34)';
        ctx.beginPath();
        ctx.ellipse(2, 1, item.size + 4, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6c6f63';
        ctx.beginPath();
        ctx.moveTo(-item.size, 0);
        ctx.lineTo(-item.size * 0.72, -item.size * 0.65);
        ctx.lineTo(item.size * 0.38, -item.size * 0.82);
        ctx.lineTo(item.size, -2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(218, 204, 174, 0.3)';
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
      // Soft ambient canyon mist drifting gently near bottom corners only;
      // never redraws stone walls over actors.
      const t = Number.isFinite(timeMs) ? timeMs : 0;
      const drift = Math.sin(t / 2400) * 8;
      ctx.save();
      const fog = ctx.createRadialGradient(
        viewportWidth * 0.85 + drift, VIRTUAL_H - 12, 8,
        viewportWidth * 0.85 + drift, VIRTUAL_H - 12, 110
      );
      fog.addColorStop(0, 'rgba(210, 214, 204, 0.11)');
      fog.addColorStop(1, 'rgba(210, 214, 204, 0)');
      ctx.fillStyle = fog;
      ctx.fillRect(viewportWidth * 0.85 - 110 + drift, VIRTUAL_H - 122, 220, 122);
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

