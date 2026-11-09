/* Standalone 2.5D discovery-stage pilot. Presentation never writes production saves. */
(function () {
  'use strict';
  const Core = window.CrownlessTacticalStageCore;
  const canvas = document.getElementById('stageCanvas');
  const ctx = canvas.getContext('2d');
  const elements = {
    loading: document.getElementById('stageLoading'),
    discovery: document.getElementById('discoveryBanner'),
    location: document.getElementById('locationLabel'),
    hint: document.getElementById('stageHint'),
    phase: document.getElementById('phaseLabel'),
    message: document.getElementById('message'),
    hp: document.getElementById('hpReadout'),
    loot: document.getElementById('lootReadout'),
    commands: document.getElementById('commands'),
  };
  const W = 1280, H = 720;
  const ASSETS = {
    forest: 'assets/tactical-stage/northern-ridge.webp',
    keep: 'assets/tactical-stage/ruined-keep.webp',
    vault: 'assets/tactical-stage/old-vault.webp',
    scout: 'assets/tactical-stage/scout.webp',
    guardian: 'assets/tactical-stage/guardian.webp',
  };
  const imgs = {};
  let state = Core.initial();
  let imagesReady = false, loadFailed = false;
  let motion = null, previousFrame = 0, lastHit = 0, discoveryUntil = 0;
  let view = {x: Core.ROUTE[0].x, y: Core.ROUTE[0].y};
  let actionLocked = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => im.naturalWidth && im.naturalHeight ? resolve(im) : reject(Error('empty art'));
      im.onerror = () => reject(Error('failed to load ' + url));
      im.src = url;
    });
  }

  function choices() {
    switch (state.phase) {
      case 'explore': return [{action: 'advance', text: '先へ進む', primary: true}, {action: 'retreat', text: '野営地に戻る'}];
      case 'gate': return [{action: 'enter', text: '古城へ入る', primary: true}, {action: 'retreat', text: '引き返す'}];
      case 'combat': return [{action: 'strike', text: state.opening ? '隙を突いて斬る' : '斬る', primary: true}, {action: 'guard', text: '身を守る'}];
      case 'vault': return state.collected
        ? [{action: 'return', text: '鐘鉄を持って生還する', primary: true}]
        : [{action: 'collect', text: '鐘鉄を回収する', primary: true}, {action: 'return', text: '拾わずに戻る'}];
      case 'returned':
      case 'fallen': return [{action: 'restart', text: 'もう一度遠征する', primary: true}];
      default: return [];
    }
  }

  function updateUi() {
    elements.hp.textContent = `体力 ${state.hp}/${Core.MAX_HP}`;
    elements.loot.textContent = `戦利品 ${state.carried ? '鐘鉄 ×1（未確定）' : state.banked ? '鐘鉄 ×1（生還）' : 'なし'}`;
    elements.message.textContent = state.message;
    elements.location.textContent = state.phase === 'combat' || state.phase === 'fallen' ? '霧の古城 · 外郭' :
      state.phase === 'vault' || (state.phase === 'returned' && state.result === 'cleared') ? '霧の古城 · 宝物庫' :
      state.discovered ? '北の丘陵 · 霧の古城' : '北の丘陵 · 未踏の道';
    elements.phase.textContent = ({explore:'探索', gate:'発見', combat:'戦闘', vault:'戦利品', returned:'帰還', fallen:'敗北'})[state.phase];
    elements.hint.textContent = state.phase === 'explore' ? 'マップをタップして進む' :
      state.phase === 'combat' ? (state.combatTurn % 2 === 0 ? '守護者は重撃を構えている' : '守護者の体勢が崩れた') :
      state.phase === 'vault' ? '戦利品は生還するまで未確定' : '探索ステージの試作版';
    elements.commands.replaceChildren(...choices().map(choice => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.action = choice.action;
      button.textContent = choice.text;
      button.className = choice.primary ? 'primary' : '';
      button.disabled = actionLocked || !imagesReady;
      return button;
    }));
  }

  function dispatch(action) {
    if (actionLocked || !imagesReady) return;
    const before = state;
    const next = Core.act(state, action);
    if (next.phase === before.phase && next.step === before.step && next.hp === before.hp &&
        next.guardianHp === before.guardianHp && next.collected === before.collected) return;
    state = next;
    const now = performance.now();
    if (before.phase === 'explore' && next.step !== before.step) {
      const to = Core.ROUTE[next.step];
      motion = {from: {...view}, to, start: now, duration: reducedMotion ? 0 : 650};
      actionLocked = !reducedMotion;
      if (reducedMotion) view = {x: to.x, y: to.y};
    } else {
      motion = null;
      actionLocked = false;
    }
    if (!before.discovered && next.discovered) discoveryUntil = now + 2600;
    if (before.phase === 'combat' && action === 'strike') lastHit = now;
    if (action === 'restart') view = {x: Core.ROUTE[0].x, y: Core.ROUTE[0].y};
    updateUi();
  }

  elements.commands.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (button) dispatch(button.dataset.action);
  });
  canvas.addEventListener('pointerup', (event) => {
    if (event.button !== 0) return;
    if (state.phase === 'explore') dispatch('advance');
  });
  document.addEventListener('keydown', (event) => {
    const key = event.key;
    const primary = choices().find(c => c.primary);
    if (['ArrowRight', 'ArrowUp', ' ', 'Enter'].includes(key) && primary) {
      if (key === ' ' || key.startsWith('Arrow')) event.preventDefault();
      // Don't swallow Enter on focused buttons or links; their own click is native.
      if ((key === ' ' || key === 'Enter') && event.target.closest('button,a')) return;
      dispatch(primary.action);
    } else if (key === 'Escape' && ['explore', 'gate'].includes(state.phase)) {
      dispatch('retreat');
    }
  });

  function resize() {
    const cssW = Math.max(1, canvas.clientWidth), cssH = Math.max(1, canvas.clientHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pxW = Math.round(cssW * dpr), pxH = Math.round(cssH * dpr);
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW;
      canvas.height = pxH;
    }
    return {cssW, cssH, dpr};
  }

  function scene() {
    if (state.phase === 'combat' || state.phase === 'fallen') return 'keep';
    if (state.phase === 'vault' || (state.phase === 'returned' && state.result === 'cleared')) return 'vault';
    return 'forest';
  }

  function focusPoint(s) {
    if (s === 'forest') return {x: view.x, y: view.y - 50};
    if (s === 'keep') return {x: 670, y: 410};
    return {x: 690, y: 355};
  }

  function drawFog() {
    const radius = 173;
    const revealed = state.visited.map(i => Core.ROUTE[i]);
    for (let y = 0; y < H; y += 32) for (let x = 0; x < W; x += 32) {
      const midx = x + 16, midy = y + 16;
      const seen = revealed.some(p => Math.hypot(midx-p.x, midy-p.y) < radius) ||
        (state.discovered && midx > 780 && midy < 425);
      ctx.fillStyle = seen ? 'rgba(9,16,22,.09)' : 'rgba(5,11,19,.82)';
      ctx.fillRect(x, y, 33, 33);
    }
  }

  function ring(x, y, time, color = '#d9c18c') {
    const pulse = Math.sin(time / 380) * 4;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y-20-pulse); ctx.lineTo(x+37+pulse, y);
    ctx.lineTo(x, y+20+pulse); ctx.lineTo(x-37-pulse, y);
    ctx.closePath(); ctx.stroke();
  }

  function drawActor(image, x, y, height, bob = 0) {
    const width = image.naturalWidth * (height / image.naturalHeight);
    ctx.fillStyle = 'rgba(5,9,8,.46)';
    ctx.beginPath(); ctx.ellipse(x, y-2, 18, 6, 0, 0, Math.PI*2); ctx.fill();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, x-width/2, y-height+bob, width, height);
    ctx.imageSmoothingEnabled = true;
  }

  function paint(now) {
    const {cssW, cssH, dpr} = resize();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = '#111819'; ctx.fillRect(0, 0, cssW, cssH);
    if (!imagesReady) return;
    const current = scene();
    const wanted = focusPoint(current);
    const scale = Math.max(cssW/W, cssH/H);
    const vw = cssW/scale, vh = cssH/scale;
    const cameraX = vw >= W ? W/2 : Math.max(vw/2, Math.min(W-vw/2, wanted.x));
    const cameraY = vh >= H ? H/2 : Math.max(vh/2, Math.min(H-vh/2, wanted.y));
    ctx.translate(cssW/2-cameraX*scale, cssH/2-cameraY*scale);
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(imgs[current], 0, 0, W, H);

    if (current === 'forest') {
      drawFog();
      if (state.phase === 'explore' && state.step < Core.ROUTE.length - 1) {
        const next = Core.ROUTE[state.step + 1];
        ring(next.x, next.y, now);
      }
      if (state.discovered) ring(1090, 240, now, '#d8bd8a');
      drawActor(imgs.scout, view.x, view.y, 65, motion ? Math.sin(now/65)*2 : 0);
    } else if (current === 'keep') {
      ring(850, 430, now, state.combatTurn%2===0?'#c6a16f':'#9aafa4');
      drawActor(imgs.scout, 520, 499, 65);
      if (state.phase === 'combat') {
        drawActor(imgs.guardian, 852, 432, 152, Math.sin(now/230)*2);
        ctx.fillStyle = '#252d2a'; ctx.fillRect(785, 267, 136, 12);
        ctx.fillStyle = '#9c7770'; ctx.fillRect(788, 270, 130 * state.guardianHp/Core.ENEMY_HP, 6);
        if (now-lastHit < 280) {
          const intensity = 1-(now-lastHit)/280;
          ctx.strokeStyle = `rgba(255,235,170,${intensity})`;
          ctx.lineWidth = 5;
          for (let i=0; i<9; i++) {
            const a = i * Math.PI * 2/9;
            ctx.beginPath(); ctx.moveTo(832 + 20*Math.cos(a), 361 + 20*Math.sin(a));
            ctx.lineTo(832 + 65*Math.cos(a), 361 + 65*Math.sin(a)); ctx.stroke();
          }
        }
      }
    } else {
      drawActor(imgs.scout, 672, 424, 65);
      if (state.collected) {
        ctx.strokeStyle = '#ead5a0'; ctx.lineWidth = 2;
        for (let i=0; i<10; i++) {
          const a = i * Math.PI*2/10 + now/1800, r = 55 + 6*Math.sin(now/390+i);
          const x = 714 + Math.cos(a)*r, y = 208 + Math.sin(a)*r*.65;
          ctx.beginPath(); ctx.moveTo(x-4,y); ctx.lineTo(x+4,y); ctx.moveTo(x,y-4); ctx.lineTo(x,y+4); ctx.stroke();
        }
      }
    }

    if (state.phase === 'returned' || state.phase === 'fallen') {
      const text = state.result === 'cleared' ? '生 還' : state.phase === 'fallen' ? '敗 北' : '帰 還';
      ctx.fillStyle = 'rgba(14,21,22,.82)'; ctx.fillRect(365, 300, 550, 105);
      ctx.strokeStyle = '#a99a77'; ctx.strokeRect(365,300,550,105);
      ctx.fillStyle = '#efe0be'; ctx.font = 'bold 48px serif'; ctx.textAlign = 'center';
      ctx.fillText(text, 640, 369);
    }
  }

  function loop(now) {
    const delta = now-previousFrame;
    previousFrame = now;
    if (motion) {
      const p = motion.duration ? Math.min(1, (now-motion.start)/motion.duration) : 1;
      const eased = p*p*(3-2*p);
      view.x = motion.from.x + (motion.to.x-motion.from.x)*eased;
      view.y = motion.from.y + (motion.to.y-motion.from.y)*eased;
      if (p >= 1) { motion = null; actionLocked = false; updateUi(); }
    }
    elements.discovery.hidden = !(discoveryUntil && now < discoveryUntil);
    paint(now);
    if (delta >= 0) requestAnimationFrame(loop);
  }

  Promise.all(Object.entries(ASSETS).map(async ([key, url]) => { imgs[key] = await loadImage(url); }))
    .then(() => { imagesReady = true; elements.loading.hidden = true; updateUi(); requestAnimationFrame(loop); })
    .catch(() => {
      loadFailed = true;
      elements.loading.textContent = '画像を読み込めませんでした。通信を確認して再読込してください。';
      elements.loading.setAttribute('role', 'alert');
      updateUi();
    });
  window.CrownlessTacticalStage = {read: () => JSON.parse(JSON.stringify(state)), get ready() { return imagesReady && !loadFailed; }};
  updateUi();
})();
