/* Standalone canvas renderer/input for the impact-combat experiment. No GPS or storage. */
(() => {
  'use strict';
  const Core = window.ImpactCombat;
  const canvas = document.querySelector('#arena');
  const ctx = canvas.getContext('2d');
  const arena = document.querySelector('#battle');
  const pad = document.querySelector('#touchpad');
  const stick = document.querySelector('#stickBase');
  const knob = document.querySelector('#stickKnob');
  const attack = document.querySelector('#attack');
  let game = Core.create();
  let width = 640, height = 420, camera = 0, padPointer = null;
  let axis = { x: 0, z: 0 }, held = false, effects = [], last = performance.now();
  const keys = new Set();
  let audio = null;
  let shakeFrame = 0;

  function initializeSound() {
    if (audio) { if (audio.state === 'suspended') audio.resume(); return; }
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (Audio) audio = new Audio();
  }
  function noise(kind) {
    if (!audio) return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const t = audio.currentTime;
    const chain = kind === 'chain';
    osc.type = chain ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(chain ? 190 : 120, t);
    osc.frequency.exponentialRampToValueAtTime(chain ? 43 : 38, t + 0.11);
    gain.gain.setValueAtTime(chain ? 0.11 : 0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    osc.connect(gain).connect(audio.destination);
    osc.start(t); osc.stop(t + 0.12);
  }

  function resize() {
    const r = arena.getBoundingClientRect();
    const scale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * scale);
    canvas.height = Math.round(r.height * scale);
    width = Math.max(160, Math.min(1400, r.width / Math.max(1, r.height) * height));
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  }
  window.addEventListener('resize', resize);

  function rect(x, y, w, h, color) {
    ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }
  function circle(x, y, r, color) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  }
  function ellipse(x, y, rx, ry, color) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  }

  function background() {
    const grad = ctx.createLinearGradient(0, 0, 0, 265);
    grad.addColorStop(0, '#1d2630'); grad.addColorStop(0.72, '#746b67');
    grad.addColorStop(1, '#c5a77c');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);
    circle(width - 78 - camera * 0.08, 75, 30, '#dfc9a5');
    // Distant charcoal mountains shift slower than the gameplay layer.
    ctx.fillStyle = '#34414a';
    ctx.beginPath(); ctx.moveTo(-60, 214);
    for (let x = -60; x <= width + 100; x += 80) {
      ctx.lineTo(x, 170 + Math.sin((x + camera * 0.26) / 90) * 45);
    }
    ctx.lineTo(width + 100, 226); ctx.fill();
    ctx.save(); ctx.translate(-camera * 0.55, 0);
    for (let x = 0; x < 1200; x += 170) {
      rect(x, 147, 23, 89, '#3e3531');
      ellipse(x + 12, 143, 45, 52, '#38463b');
      ellipse(x + 45, 155, 24, 36, '#4d5846');
      rect(x + 65, 197, 105, 36, '#5b4c3e');
      rect(x + 65, 188, 105, 10, '#3a3735');
    }
    ctx.restore();
    const floor = ctx.createLinearGradient(0, 190, 0, height);
    floor.addColorStop(0, '#83755d'); floor.addColorStop(1, '#464a42');
    rect(0, 199, width, height - 199, floor);
    ctx.save(); ctx.translate(-camera, 0);
    for (let i = 0; i < 60; i++) {
      const x = i * 71 + (i * 13) % 31, y = 223 + (i * 29) % 163;
      rect(x, y, 19, 2, 'rgba(33,39,37,.25)');
      if (i % 4 === 0) {
        rect(x - 10, y - 3, 2, 12, '#475346');
        rect(x - 4, y - 7, 2, 16, '#5f6b4c');
      }
    }
    ctx.restore();
  }

  function drawShadow(x, z, scale = 1) {
    ellipse(x, z + 6, 18 * scale, 6 * scale, 'rgba(12,17,20,.43)');
  }
  function drawFighter(e, hero) {
    const x = e.x, ground = e.z + 20;
    drawShadow(x, ground, hero ? 1.2 : 0.9);
    ctx.save();
    ctx.translate(x, ground - e.air);
    const direction = hero ? e.face : (game.player.x < e.x ? -1 : 1);
    ctx.scale(direction, 1);
    if (e.dead) {
      ctx.rotate(-1.25);
      ctx.globalAlpha = 0.55;
    } else if (!hero && e.stun > 0) {
      ctx.rotate(Math.sin(game.time * 39) * 0.25);
    }
    if (hero) {
      rect(-9, -19, 7, 18, '#3d3132'); rect(4, -19, 7, 18, '#332b2a');
      rect(-16, -52, 29, 36, '#465364');
      rect(-20, -50, 7, 24, '#b5aa90'); rect(15, -50, 8, 24, '#b5aa90');
      rect(-11, -31, 25, 5, '#ab5b42');
      rect(-12, -70, 24, 19, '#e4bd92');
      rect(-15, -75, 30, 9, '#302928');
      rect(8, -64, 3, 3, '#242729');
      // Every swing is accompanied by a sweeping arc and a blade flash.
      rect(18, -41, 5, 8, '#d7b77d');
      if (e.attackAnim > 0) {
        ctx.strokeStyle = game.combo === 3 ? '#fff2b4' : '#dadfd8';
        ctx.lineWidth = game.combo === 3 ? 9 : 5;
        ctx.beginPath(); ctx.arc(11, -48, 47, -1.15, 0.82); ctx.stroke();
        rect(17, -51, 51, 5, '#f4f1da');
      } else {
        rect(19, -67, 5, 38, '#e6e6d5');
      }
      if (e.invuln > 0) rect(-16, -54, 38, 3, '#edaca0');
    } else {
      rect(-10, -13, 8, 14, '#282b27'); rect(3, -13, 8, 14, '#282b27');
      rect(-16, -37, 31, 25, '#667652');
      rect(-20, -32, 7, 17, '#88956a'); rect(14, -32, 7, 17, '#88956a');
      rect(-13, -55, 25, 20, '#7e9b63');
      ctx.fillStyle = '#7e9b63';
      ctx.beginPath(); ctx.moveTo(-13, -51); ctx.lineTo(-24, -60);
      ctx.lineTo(-20, -43); ctx.fill();
      ctx.beginPath(); ctx.moveTo(12, -51); ctx.lineTo(23, -61);
      ctx.lineTo(18, -43); ctx.fill();
      rect(5, -49, 4, 4, '#fb8861');
      rect(18, -29, 4, 20, '#8e6e53');
      rect(-18, -17, 38, 5, '#4e433c');
      if (!e.dead) {
        rect(-17, -66, 34, 4, '#332b2c');
        rect(-17, -66, Math.ceil(34 * e.hp / 50), 4, '#c96c56');
      }
    }
    ctx.restore();
  }

  function drawEffects(dt) {
    for (const fx of effects) {
      fx.life -= dt;
      fx.y -= dt * 25;
      const alpha = Math.max(0, fx.life / fx.maxLife);
      ctx.save(); ctx.globalAlpha = alpha;
      if (fx.type === 'hit' || fx.type === 'chain') {
        circle(fx.x, fx.y - 43, (1 - alpha) * 31 + 8, fx.type === 'chain' ? '#ffb34d' : '#fff1b9');
        ctx.fillStyle = fx.type === 'chain' ? '#ffc26c' : '#ffffff';
        ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center';
        ctx.fillText((fx.type === 'chain' ? '巻き込み ' : '-') + fx.damage, fx.x, fx.y - 76);
      } else if (fx.type === 'finish') {
        ctx.strokeStyle = '#fff2c2'; ctx.lineWidth = 5 * alpha;
        ctx.beginPath(); ctx.arc(fx.x, fx.y - 43, (1 - alpha) * 72, 0, Math.PI * 2); ctx.stroke();
      } else if (fx.type === 'hurt') {
        circle(fx.x, fx.y - 50, 15, '#c94c42');
      }
      ctx.restore();
    }
    effects = effects.filter(fx => fx.life > 0);
  }

  function render(dt) {
    ctx.clearRect(0, 0, width, height);
    camera += ((Math.max(0, Math.min(960 - width, game.player.x - width * 0.4))) - camera) * 0.14;
    shakeFrame++;
    const shake = game.shake * 6;
    ctx.save();
    ctx.translate(Math.sin(shakeFrame * 2.1) * shake, Math.cos(shakeFrame * 1.7) * shake * 0.5);
    background();
    ctx.save(); ctx.translate(-camera, 0);
    const actors = [...game.enemies.map(e => ({ ...e, hero:false })),
      { ...game.player, air:0, hero:true }];
    actors.sort((a, b) => a.z - b.z);
    for (const a of actors) drawFighter(a, a.hero);
    drawEffects(dt);
    ctx.restore(); ctx.restore();
    if (game.hitstop > 0) {
      ctx.fillStyle = 'rgba(255,239,182,.10)';
      ctx.fillRect(0, 0, width, height);
    }
  }

  function inputAxis() {
    let x = axis.x, z = axis.z;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x = -1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x = 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) z = -1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) z = 1;
    return { x, z, attack: held || keys.has('KeyJ') || keys.has('Space') };
  }

  function updateHud() {
    document.querySelector('#hpFill').style.width = game.player.hp + '%';
    const alive = game.enemies.filter(e => !e.dead).length;
    document.querySelector('#count strong').textContent = alive + ' / 3';
    document.querySelector('#stats').textContent = '命中 ' + game.hits + ' ・ 巻き込み ' + game.chains;
    document.querySelector('#message').textContent =
      game.finished ? '討伐成功！ もう一戦、試してみよう。' :
      game.player.hp <= 0 ? '倒れてしまった……「やり直す」で再挑戦' :
      game.chains > 0 ? '巻き込み成功！ 敵をまとめて吹き飛ばせ！' :
      game.hits > 0 ? 'いい一撃！ 三連撃の最後は強力な吹き飛ばし！' :
      '移動して、ゴブリンを吹き飛ばそう！';
  }
  function reset() {
    game = Core.create(); effects = []; axis = { x:0, z:0 }; held = false;
    updateHud();
  }
  document.querySelector('#reset').addEventListener('click', reset);
  attack.addEventListener('pointerdown', e => {
    e.preventDefault(); initializeSound(); attack.setPointerCapture(e.pointerId);
    held = true; attack.classList.add('pressed');
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    attack.addEventListener(name, () => { held = false; attack.classList.remove('pressed'); });
  }
  window.addEventListener('keydown', e => {
    if (['Space', 'ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
    initializeSound(); keys.add(e.code);
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); held = false; axis = {x:0,z:0}; });

  function updatePad(e) {
    const r = pad.getBoundingClientRect();
    const cx = Number(stick.dataset.cx), cy = Number(stick.dataset.cy);
    const dx = e.clientX - cx, dz = e.clientY - cy;
    const radius = Math.min(42, Math.hypot(dx, dz));
    const angle = Math.atan2(dz, dx);
    axis = { x: Math.cos(angle) * radius / 42, z: Math.sin(angle) * radius / 42 };
    knob.style.transform = 'translate(' + (axis.x * 30) + 'px,' + (axis.z * 30) + 'px)';
  }
  pad.addEventListener('pointerdown', e => {
    if (padPointer !== null) return;
    e.preventDefault(); initializeSound(); padPointer = e.pointerId;
    pad.setPointerCapture(e.pointerId);
    stick.dataset.cx = e.clientX; stick.dataset.cy = e.clientY;
    const r = pad.getBoundingClientRect();
    stick.style.left = (e.clientX - r.left) + 'px';
    stick.style.top = (e.clientY - r.top) + 'px';
    stick.style.display = 'block'; updatePad(e);
  });
  pad.addEventListener('pointermove', e => { if (e.pointerId === padPointer) updatePad(e); });
  function clearPad(e) {
    if (e.pointerId !== padPointer) return;
    padPointer = null; axis = { x:0, z:0 };
    knob.style.transform = ''; stick.style.display = 'none';
  }
  pad.addEventListener('pointerup', clearPad);
  pad.addEventListener('pointercancel', clearPad);
  pad.addEventListener('lostpointercapture', clearPad);

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    Core.step(game, dt, inputAxis());
    for (const ev of game.events.splice(0)) {
      if (['hit','chain','finish','hurt'].includes(ev.type)) {
        effects.push({ ...ev, y:ev.z + 20, life:ev.type === 'finish' ? 0.34 : 0.42,
          maxLife:ev.type === 'finish' ? 0.34 : 0.42 });
      }
      if (ev.type === 'hit' || ev.type === 'chain') {
        noise(ev.type);
        if (navigator.vibrate) navigator.vibrate(ev.type === 'chain' ? 22 : 12);
      }
    }
    render(dt); updateHud();
    requestAnimationFrame(frame);
  }
  resize(); updateHud(); requestAnimationFrame(frame);
})();
