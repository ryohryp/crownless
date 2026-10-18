/*
 * Crownless action impact lab: standalone and deliberately disconnected from expedition saves.
 * Inspired by the supplied 2.5D belt-scrolling demo; no production combat wiring.
 */
(function (root) {
  'use strict';
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const ENEMY_LAYOUT = [
    { id: 1, x: 430, z: 270 },
    { id: 2, x: 476, z: 270 },
    { id: 3, x: 524, z: 272 }
  ];

  function create() {
    return {
      time: 0,
      player: { x: 215, z: 270, hp: 100, face: 1, cooldown: 0, invuln: 0, attackAnim: 0 },
      enemies: ENEMY_LAYOUT.map(e => ({
        ...e, hp: 50, vx: 0, air: 0, vy: 0, stun: 0,
        cooldown: 0.65 + e.id * 0.28, hitChain: 0, dead: false
      })),
      combo: 0, comboAge: 0, hitstop: 0, shake: 0, chainCounter: 0,
      events: [], hits: 0, chains: 0, finished: false
    };
  }

  function hitEnemy(s, e, damage, direction, speed, lift, chainId, chained) {
    if (e.dead) return;
    e.hp = Math.max(0, e.hp - damage);
    e.dead = e.hp === 0;
    e.stun = 0.7;
    e.vx = direction * speed;
    e.vy = lift;
    e.hitChain = chainId;
    if (chained) s.chains++;
    s.hits++;
    s.events.push({ type: chained ? 'chain' : 'hit', x: e.x, z: e.z, damage, dead: e.dead });
  }

  function strike(s) {
    const p = s.player;
    if (p.hp <= 0 || s.finished || p.cooldown > 0 || s.hitstop > 0) return false;
    s.combo = s.comboAge > 0 ? (s.combo % 3) + 1 : 1;
    s.comboAge = 1.0;
    p.attackAnim = 0.24;
    const finisher = s.combo === 3;
    p.cooldown = finisher ? 0.33 : 0.20;
    s.events.push({ type: 'swing', finisher, x: p.x + p.face * 35, z: p.z });
    const candidates = s.enemies
      .filter(e => !e.dead && (e.x - p.x) * p.face >= -12 &&
        (e.x - p.x) * p.face <= 110 && Math.abs(e.z - p.z) <= 34)
      .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
    if (!candidates.length) return true;
    const target = candidates[0];
    hitEnemy(s, target, finisher ? 28 : 18, p.face, finisher ? 660 : 450,
      finisher ? 315 : 230, ++s.chainCounter, false);
    s.hitstop = finisher ? 0.12 : 0.075;
    s.shake = finisher ? 1 : 0.6;
    if (finisher) s.events.push({ type: 'finish', x: target.x, z: target.z });
    return true;
  }

  function step(s, seconds, input = {}) {
    const dt = clamp(seconds, 0, 0.05);
    if (s.hitstop > 0) {
      s.hitstop = Math.max(0, s.hitstop - dt);
      return;
    }
    s.time += dt;
    s.shake = Math.max(0, s.shake - dt * 3.5);
    s.comboAge = Math.max(0, s.comboAge - dt);
    const p = s.player;
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.attackAnim = Math.max(0, p.attackAnim - dt);
    if (!s.finished && p.hp > 0) {
      const mx = clamp(Number(input.x) || 0, -1, 1);
      const mz = clamp(Number(input.z) || 0, -1, 1);
      const length = Math.max(1, Math.hypot(mx, mz));
      p.x = clamp(p.x + (mx / length) * 215 * dt, 42, 920);
      p.z = clamp(p.z + (mz / length) * 145 * dt, 205, 328);
      if (Math.abs(mx) > 0.15) p.face = Math.sign(mx);
      if (input.attack) strike(s);
    }

    for (const e of s.enemies) {
      e.cooldown = Math.max(0, e.cooldown - dt);
      e.stun = Math.max(0, e.stun - dt);
      if (Math.abs(e.vx) > 0.5) {
        e.x = clamp(e.x + e.vx * dt, 32, 925);
        e.vx *= Math.exp(-4.4 * dt);
      }
      if (e.air > 0 || e.vy > 0) {
        e.air += e.vy * dt;
        e.vy -= 870 * dt;
        if (e.air <= 0) { e.air = 0; e.vy = 0; }
      }
      if (e.dead || s.finished || p.hp <= 0 || e.stun > 0) continue;
      const dx = p.x - e.x;
      const dz = p.z - e.z;
      if (Math.abs(dx) > 38) e.x += Math.sign(dx) * 63 * dt;
      if (Math.abs(dz) > 13) e.z += Math.sign(dz) * 43 * dt;
      if (Math.abs(dx) < 34 && Math.abs(dz) < 24 && e.cooldown === 0 && p.invuln === 0) {
        p.hp = Math.max(0, p.hp - 7);
        p.invuln = 0.68;
        e.cooldown = 1.1;
        s.events.push({ type: 'hurt', x: p.x, z: p.z });
      }
    }

    // Launched bodies collide with the next goblin and transfer momentum.
    // A chain identifier prevents repeated damage loops within one blow.
    for (const e of s.enemies) {
      if (!e.hitChain || Math.abs(e.vx) < 65) continue;
      const direction = Math.sign(e.vx);
      for (const other of s.enemies) {
        if (other === e || other.dead || other.hitChain === e.hitChain) continue;
        const ahead = (other.x - e.x) * direction;
        if (ahead >= -5 && ahead < 32 && Math.abs(other.z - e.z) < 27) {
          hitEnemy(s, other, 12, direction, Math.max(300, Math.abs(e.vx) * 0.9),
            200, e.hitChain, true);
          e.vx *= 0.66;
          s.shake = Math.max(s.shake, 0.8);
          s.hitstop = Math.max(s.hitstop, 0.045);
        }
      }
    }
    if (!s.finished && s.enemies.every(e => e.dead)) {
      s.finished = true;
      s.events.push({ type: 'victory', x: p.x, z: p.z });
    }
  }

  const api = { create, step, strike };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ImpactCombat = api;
})(typeof window !== 'undefined' ? window : globalThis);
