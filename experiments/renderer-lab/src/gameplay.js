// The deliberately small game contract is shared by both renderer trials.
// No GPS, save schema, remote API, or current Crownless progression is touched.
export const WORLD_WIDTH = 1050;
export const MOVE_SPEED = 185;
export const SITES = Object.freeze([
  { id: 'herbs', x: 260, name: '苔むす採集地' },
  { id: 'guardian', x: 535, name: '石橋の番人' },
  { id: 'shrine', x: 850, name: '閉ざされた祠' }
]);

export function createState() {
  return {
    mode: 'exploring', x: 98, targetX: null, hp: 3, run: 1,
    equipped: false, gathered: false, guardianDefeated: false, shrineOpened: false,
    heldHerbs: 0, heldIron: 0, heldRelic: 0,
    herbs: 0, iron: 0, relics: 0,
    message: '森の奥には古い祠がある。素材を持ち帰り、次の遠征へ。'
  };
}

export function nearestSite(state) {
  if (state.mode !== 'exploring') return null;
  return SITES.find(site => Math.abs(site.x - state.x) <= 56) || null;
}

export function step(state, axis, deltaMs) {
  if (state.mode !== 'exploring') return false;
  const d = Math.min(Math.max(Number(deltaMs) || 0, 0), 60) / 1000;
  const before = state.x;
  let moving = axis;
  if (!moving && state.targetX !== null) {
    moving = Math.abs(state.targetX - state.x) > 2 ? Math.sign(state.targetX - state.x) : 0;
    if (!moving) state.targetX = null;
  }
  state.x = Math.max(58, Math.min(991, state.x + Math.sign(moving) * Math.min(MOVE_SPEED * d, state.targetX !== null && !axis ? Math.abs(state.targetX - state.x) : Infinity)));
  return state.x !== before;
}

export function pointTo(state, x) {
  if (state.mode !== 'exploring') return;
  state.targetX = Math.min(991, Math.max(58, Number(x) || 0));
}

export function interact(state) {
  const site = nearestSite(state);
  if (!site) { state.message = '気になる場所まで近づこう。'; return false; }
  state.targetX = null;
  if (site.id === 'herbs') {
    if (state.gathered) { state.message = 'この採集地は調べ終えた。'; return false; }
    state.gathered = true; state.heldHerbs += 1;
    state.message = '樹皮草を手に入れた。倒れる前に持ち帰ろう。';
    return true;
  }
  if (site.id === 'guardian') {
    if (state.guardianDefeated) { state.message = '倒れた番人の向こうに道が続く。'; return false; }
    state.mode = 'encounter'; state.message = '番人が立ちはだかった。防御して隙を狙うか、強撃するか？';
    return true;
  }
  if (!state.equipped) {
    state.message = '古い鉄の錠だ。鍛冶で作った剣があれば開きそうだ。';
    return false;
  }
  if (!state.guardianDefeated) { state.message = 'まず石橋の番人を退ける必要がある。'; return false; }
  if (state.shrineOpened) { state.message = '祠はすでに調べた。'; return false; }
  state.shrineOpened = true; state.heldRelic += 1;
  state.message = '剣で錠を外した！ 祠から古い紋章を見つけた。';
  return true;
}

export function fight(state, decision) {
  if (state.mode !== 'encounter' || !['guard', 'strike'].includes(decision)) return false;
  const damage = decision === 'guard' ? 1 : (state.equipped ? 0 : 2);
  state.hp -= damage;
  if (state.hp <= 0) {
    state.mode = 'camp';
    state.heldHerbs = 0; state.heldIron = 0; state.heldRelic = 0;
    state.message = '遠征失敗。持ち帰る前の素材を失った。';
    return true;
  }
  state.guardianDefeated = true; state.heldIron++;
  state.mode = 'exploring';
  state.message = decision === 'guard'
    ? '攻撃をいなして番人を退けた。鉄片を入手。'
    : '強撃で番人を退けた。鉄片を入手。';
  return true;
}

export function returnAlive(state) {
  if (state.mode !== 'exploring') return false;
  if (state.x > 175) { state.message = '帰還するには森の入口まで戻ろう。'; state.targetX = 98; return false; }
  state.herbs += state.heldHerbs; state.iron += state.heldIron; state.relics += state.heldRelic;
  state.heldHerbs = 0; state.heldIron = 0; state.heldRelic = 0;
  state.mode = 'camp';
  state.message = '生還した。素材を保管した。鍛冶で剣を作れば祠を開けられる。';
  return true;
}

export function craft(state) {
  if (state.mode !== 'camp' || state.equipped || state.herbs < 1 || state.iron < 1) return false;
  state.herbs--; state.iron--; state.equipped = true;
  state.message = '鍛冶職人が「旅人の剣」を完成させた。次の遠征では姿と戦い方が変わる。';
  return true;
}

export function depart(state) {
  if (state.mode !== 'camp') return false;
  state.mode = 'exploring'; state.x = 98; state.targetX = null; state.hp = 3;
  state.run++; state.gathered = false; state.guardianDefeated = false; state.shrineOpened = false;
  state.message = state.equipped ? '剣を携えて、今度は森の奥の祠へ。' : '再び森へ。';
  return true;
}

export function cameraX(state, viewportWidth) {
  return Math.max(0, Math.min(WORLD_WIDTH - viewportWidth, state.x - viewportWidth * 0.42));
}

export function viewState(state) {
  return {
    mode: state.mode, x: Math.round(state.x), hp: state.hp,
    equipped: state.equipped, run: state.run,
    heldHerbs: state.heldHerbs, heldIron: state.heldIron, heldRelic: state.heldRelic,
    herbs: state.herbs, iron: state.iron, relics: state.relics,
    gathered: state.gathered, guardianDefeated: state.guardianDefeated,
    shrineOpened: state.shrineOpened, nearby: nearestSite(state)?.id ?? null
  };
}
