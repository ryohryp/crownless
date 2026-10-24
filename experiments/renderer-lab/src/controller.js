import { createState, step, pointTo, interact, fight, returnAlive, craft, depart, nearestSite, viewState } from './gameplay.js';

export function createController(engine) {
  const state = createState();
  let held = 0, draw = () => {}, lastHUD = '', frameCount = 0;
  const frameTimes = [];
  const byId = name => document.getElementById(name);

  function refresh() {
    const nearby = nearestSite(state);
    const label = state.mode === 'camp' ? '野営地で準備' : nearby ? `${nearby.name}を調べる` : '近づいて調べる';
    const view = viewState(state);
    const info = JSON.stringify([view, state.message]);
    if (info === lastHUD) return;
    lastHUD = info;
    byId('scene-prompt').textContent = state.message;
    byId('hp').textContent = `体力 ${state.hp}/3`;
    byId('gear').textContent = state.equipped ? '⚔ 旅人の剣' : '素手';
    byId('run').textContent = `遠征 ${state.run}`;
    byId('cargo').textContent = state.mode === 'camp'
      ? `保管 草${state.herbs} 鉄${state.iron} 紋${state.relics}`
      : `手持ち 草${state.heldHerbs} 鉄${state.heldIron} 紋${state.heldRelic}`;
    byId('interact').textContent = label;
    byId('interact').disabled = !nearby;
    byId('return').disabled = state.mode !== 'exploring';
    byId('decisions').hidden = state.mode !== 'encounter';
    byId('camp').hidden = state.mode !== 'camp';
    byId('craft').disabled = state.equipped || state.herbs < 1 || state.iron < 1;
    byId('craft').textContent = state.equipped ? '旅人の剣を装備中' : '樹皮草1 + 鉄片1で剣を鍛える';
    byId('move-left').disabled = state.mode !== 'exploring';
    byId('move-right').disabled = state.mode !== 'exploring';
    draw(state);
  }

  function mutate(fn) {
    fn(state); refresh();
  }

  [['interact', interact], ['return', returnAlive], ['craft', craft], ['depart', depart]]
    .forEach(([id, action]) => byId(id).addEventListener('click', () => mutate(action)));
  byId('guard').addEventListener('click', () => mutate(s => fight(s, 'guard')));
  byId('strike').addEventListener('click', () => mutate(s => fight(s, 'strike')));

  for (const [id, sign] of [['move-left', -1], ['move-right', 1]]) {
    const button = byId(id);
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      held = sign; state.targetX = null;
      button.setPointerCapture?.(event.pointerId);
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(name, () => { if (held === sign) held = 0; });
    }
  }
  let key = 0;
  window.addEventListener('keydown', event => {
    if (['ArrowLeft', 'a', 'A'].includes(event.key)) { key = -1; event.preventDefault(); }
    if (['ArrowRight', 'd', 'D'].includes(event.key)) { key = 1; event.preventDefault(); }
    if ((event.key === ' ' || event.key === 'Enter') && state.mode === 'exploring') { mutate(interact); event.preventDefault(); }
  });
  window.addEventListener('keyup', event => { if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(event.key)) key = 0; });
  window.addEventListener('blur', () => { held = 0; key = 0; });

  function tick(dt) {
    const elapsed = Math.min(Number(dt) || 0, 60);
    step(state, held || key, elapsed);
    draw(state);
    refresh();
    if (elapsed > 0 && elapsed <= 60) {
      frameTimes.push(elapsed);
      if (frameTimes.length > 180) frameTimes.shift();
    }
    if ((frameCount++ % 50) === 0 && frameTimes.length) {
      const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      byId('metrics').textContent = `${engine} · 約${Math.round(1000 / avg)}fps · ${Math.round(avg * 10) / 10}ms/frame`;
    }
  }

  const api = {
    engine,
    state,
    tick,
    renderWith(fn) { draw = fn; refresh(); },
    pointAt(worldX) { pointTo(state, worldX); refresh(); },
    getSnapshot: () => viewState(state),
    getMetrics: () => ({ frames: frameCount, avgFrameMs: frameTimes.length ? frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length : 0 }),
    ready: false
  };
  window.__rendererLab = api;
  refresh();
  return api;
}
