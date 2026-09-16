/* UI deliberately has no network client, telemetry, background GPS, or precise-location storage. */
(() => {
  'use strict';
  const E = window.CrownlessSlice, A = window.CrownlessArt;
  const root = document.querySelector('#game');
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  let state = E.initial(), selected = 'wood', tab = 'explore', notice = '', busy = false;
  let session = E.locationSession(), currentKey = null, lastRaw = null, saveBlocked = false, conflict = false, locationRequest = 0;
  const key = mode => `crownless-expedition-v1-${mode}`;
  const warning = message => { const el = document.querySelector('#save-status'); el.hidden = !message; el.textContent = message; document.querySelector('#save-label').textContent = message ? '保存停止中・この画面でのみ進行' : '端末に自動保存'; };
  function loadMode(mode) {
    state = E.initial(); state.mode = mode; currentKey = key(mode); lastRaw = null; saveBlocked = false; conflict = false; warning('');
    try {
      lastRaw = localStorage.getItem(currentKey);
      const loaded = E.parse(lastRaw);
      if (loaded && (!loaded.mode || loaded.mode === mode)) { state = loaded; state.mode = mode; }
      else { saveBlocked = true; warning('セーブを読み込めませんでした。元データを保持し、この回は保存せずに遊べます。'); }
      localStorage.setItem('crownless-expedition-mode', mode);
    } catch { saveBlocked = true; warning('このブラウザでは保存できません。ページを閉じると今回の進行は失われます。'); }
    locationRequest++; busy = false; session = E.locationSession(); selected = state.expedition?.place || 'wood'; tab = 'explore'; notice = ''; render();
  }
  function save() {
    if (!currentKey || saveBlocked) return;
    try {
      if (localStorage.getItem(currentKey) !== lastRaw) { conflict = true; warning('別のタブで進行が変わりました。上書きを防ぐため停止しました。再読み込みしてください。'); return; }
      lastRaw = E.serialize(state); localStorage.setItem(currentKey, lastRaw);
    } catch { saveBlocked = true; warning('保存に失敗しました。この画面では続けられますが、再読み込みで進行が戻る場合があります。'); }
  }
  function button(action, title, body = '', options = {}) {
    return `<button class="${options.class || 'choice'}" data-action="${action}" ${options.value ? `data-value="${options.value}"` : ''} ${options.disabled ? 'disabled' : ''}>${body ? `<strong>${title}</strong><small>${body}</small>` : title}</button>`;
  }
  function scene(id, title, subtitle, enemy = null, tag = '') {
    return `<div class="scene">${A.scene(id, enemy, E.gearFamily(state.equipped))}<span class="scene-top">${enemy ? 'HOLD YOUR GROUND' : 'BEYOND THE MIST'}</span>${tag ? `<span class="scene-tag">${tag}</span>` : ''}<div class="scene-caption"><p class="kicker">${subtitle}</p><h2>${title}</h2></div></div>`;
  }
  const logs = x => `<div class="combat-log" role="status" aria-live="polite">${x.log.map(v => `<p>${esc(v)}</p>`).join('')}</div>`;
  const ledger = x => `<div class="loot-ledger"><p class="kicker">AT RISK · 生還で確定</p><strong>${x.scrap}</strong> <small>鉄片 / 背嚢の中</small>${x.gear.length ? `<p><small>現在装備：${E.GEAR[state.equipped].name} · ${E.gearText(state,state.equipped)}</small></p>` : ''}${x.gear.map(g => `<p>＋ ${E.GEAR[g].name}<br><small>未帰還 · ${E.gearText(state,g)}</small></p>`).join('')}</div>`;
  function onboard() {
    return `<div class="game-layout onboard"><section class="visual-column">${scene('camp','まだ、名もなき旅人。','A FIRE WORTH RETURNING TO')}<div class="journey-note"><b>01</b><span>霧の先には、まだ知らない場所。<br>その手の戦利品を、この火まで持ち帰ろう。</span></div></section><section class="panel"><p class="kicker">A SMALL JOURNEY. SOMETHING TO LOSE.</p><h1>霧の向こうへ。<br>生きて、帰ろう。</h1><p class="intro">欠けた剣と、ふた束の薬草。<br>あなたの旅は、それだけで始まる。<br>踏み込むか、引き返すか。<br>持ち帰った一本の剣が、次の旅を変える。</p><div class="button-stack">${button('mode','まずは体験する <span>約 15 分</span>','',{class:'primary',value:'demo'})}${button('mode','現実の散策で発見する','',{class:'secondary',value:'walk'})}</div><p class="small rule-line">体験モードは、室内で移動を再現します。<br>散策モードは、安全に立ち止まって現在地を確認。<br>位置情報を送信せず、移動履歴も残しません。</p></section></div>`;
  }
  function mapPins() {
    const positions = { wood:[22,68], tower:[47,27], fen:[75,58], crypt:[58,82] };
    const maturity = p => state.cleared.includes(p.id) ? 'surveyed' : state.unlocked.includes(p.id) ? 'found' : p.id === 'tower' ? 'exploring' : p.id === 'fen' ? 'traced' : 'unknown';
    const labels = { unknown:'未踏', traced:'踏査', exploring:'探索', found:'発見', surveyed:'調査済み' };
    const markers = E.PLACES.map(p => {
      const stage = maturity(p), known = stage === 'found' || stage === 'surveyed', [x,y] = positions[p.id];
      if (stage === 'unknown') return '';
      if (!known) return `<span class="atlas-trace ${stage}" style="--atlas-x:${x}%;--atlas-y:${y}%" aria-label="${labels[stage]}"><i></i><small>${labels[stage]}</small></span>`;
      return `<button class="atlas-marker ${selected === p.id ? 'selected' : ''} ${stage}" style="--atlas-x:${x}%;--atlas-y:${y}%" data-action="select" data-value="${p.id}" aria-pressed="${selected === p.id}" aria-label="${p.name}・${labels[stage]}">
        <span class="atlas-marker-icon">${A.icon(p.id)}</span>
        <span class="atlas-marker-copy"><strong>${p.name}</strong><small>${labels[stage]}</small></span>
      </button>`;
    }).join('');
    const shrouds = E.PLACES.map(p => { const stage = maturity(p), [x,y] = positions[p.id]; return `<span class="atlas-shroud stage-${stage}" style="--atlas-x:${x}%;--atlas-y:${y}%" aria-hidden="true"></span>`; }).join('');
    const selectedPlace = E.place(selected), selectedKnown = state.unlocked.includes(selected), selectedCleared = state.cleared.includes(selected);
    const memory = selectedKnown
      ? `<div class="atlas-memory"><span>${selectedCleared ? '調査済みの記録' : '新たな痕跡を発見'}</span><strong>${selectedPlace.name}</strong><small>${selectedCleared ? `${selectedPlace.reward}を持ち帰った。さらに深層には、まだ見ていない武具の気配がある。` : `${selectedPlace.teaser} 遠征すれば、この土地の輪郭がさらに地図へ残る。`}</small></div>`
      : `<div class="atlas-memory unknown"><span>THE MAP IS STILL BLANK</span><strong>歩いた先から、地図が育つ。</strong><small>細い道、淡い地形、痕跡、そして土地の名。発見するほど、この世界は描き込まれていく。</small></div>`;
    return `<section class="exploration-atlas" aria-label="探索によって育つ冒険地図">
      <div class="atlas-heading"><div><p class="kicker">THE UNWRITTEN LANDS</p><strong>探索地図</strong></div><span>${state.unlocked.length} / 4 発見</span></div>
      <div class="atlas-stage-legend" aria-label="地図の成熟度"><span>未踏</span><span>踏査</span><span>探索</span><span>発見</span><span>調査</span></div>
      <div class="atlas-field">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path class="atlas-contour" d="M5 72 C18 55 31 67 40 50 S62 21 76 36 S86 70 96 62" />
          <path class="atlas-contour secondary" d="M12 28 C28 16 37 38 55 26 S80 16 91 31" />
          <path class="atlas-trail" d="M22 68 C31 55 37 43 47 27 M47 27 C59 35 66 44 75 58 M75 58 C68 68 63 76 58 82" />
          <path class="atlas-water" d="M0 82 C19 75 30 84 45 77 S72 65 100 74" />
          <path class="atlas-sketch" d="M34 46 C39 41 42 36 47 27 M66 51 C70 53 73 56 75 58" />
        </svg>
        <span class="atlas-hearth" aria-label="安全な拠点"><i>✦</i><small>焚き火</small></span>
        <div class="atlas-fog" aria-hidden="true"></div>
        ${shrouds}
        ${markers}
      </div>
      ${memory}
      <p class="atlas-note">現実の道路や住所は描かない。歩いた結果だけを、冒険者の地図として抽象化して残す。</p>
    </section>`;
  }
  function scouting() {
    return `<div class="discovery"><p>${state.mode === 'demo' ? '散策を体験する — 歩くほど、地図の線と色が増えていく。' : '画面を閉じて散策し、安全に止まれる場所で発見する。'}</p>${state.mode === 'demo' ? `<div class="choice-grid">${button('scout','丘の道を歩いた','',{value:'tower'})}${button('scout','水辺の道を歩いた','',{value:'fen'})}${button('scout','南の小道を歩いた','',{value:'crypt'})}${button('scout','森の道を歩いた','',{value:'wood'})}</div>` : `${button('gps',busy ? '現在地を確認中…' : session.anchor ? '立ち止まった場所で発見する' : 'ここを散策の起点にする','',{class:'secondary',disabled:busy})}<p class="small" style="margin-top:10px">現在地そのものは地図に表示しません。安全に立ち止まって観測すると、その移動結果だけがゲーム世界へ反映されます。</p>`}${notice ? `<p class="notice" role="status">${esc(notice)}</p>` : ''}</div>`;
  }
  function explorePanel() {
    const p = E.place(selected), unlocked = state.unlocked.includes(p.id), locked = p.id === 'crypt' && state.cleared.length < 2;
    return `<p class="kicker">${unlocked ? p.terrain : 'SIGN IN THE MIST'}</p><h2>${unlocked ? p.name : 'まだ、霧の向こう。'}</h2><p class="intro">${unlocked ? p.subtitle : '地図にはまだ名がない。歩いた結果が積み重なると、痕跡と土地の輪郭が現れる。'}</p>${unlocked ? `<div class="reward"><span class="reward-icon">♢</span><div><strong>${p.reward}</strong><small>${p.hint}</small></div></div><p class="small">5 つの場面 / 戦闘 3 回 / 休息 2 回<br>${p.id === 'crypt' ? '危険度：高い。装備と体力を整えてから。' : '初回は 3〜5 分。深層では珍しい武具が出ることがある。'}</p>${state.cleared.includes(p.id) ? '<span class="badge">調査済み · 深層で珍しい武具を探せる</span>' : ''}<div class="button-stack">${button('depart',locked ? `他の土地をあと ${2-state.cleared.length} か所踏破する` : 'この土地へ遠征する','',{class:'primary',value:p.id,disabled:locked})}</div>` : ''}${scouting()}`;
  }
  function gearPanel() { return ''; }
  function expedition() { return ''; }
  function report() { return ''; }
  function camp() { return ''; }
  function render() { root.innerHTML = !state.mode ? onboard() : state.expedition ? expedition() : state.report ? report() : camp(); }
  function locationResult(coords) {
    const result = E.observe(session,coords);
    const messages = { anchored:'ここを散策の起点にしました。少し場所を変えてから、また安全に立ち止まって発見してください。', nearby:'まだ同じ土地の中です。距離を稼ぐ必要はありません。別の安全な場所へ移動した日に、また試せます。', inaccurate:'位置の精度が足りませんでした。屋外の開けた場所で再度試すか、散策体験モードで続けられます。', moving:'移動中のようです。安全な場所で立ち止まってから再度試してください。' };
    if (result.status === 'discovered') {
      const known = state.unlocked.includes(result.place);
      state = E.discover(state, result.place); selected = result.place;
      notice = known ? `この地域では「${E.place(result.place).name}」を発見済み。いつでも再訪できます。` : `霧が晴れた。「${E.place(result.place).name}」を発見。以後はその場にいなくても遠征できます。`;
      save();
    } else notice = messages[result.status];
    busy = false; render();
  }
})();
