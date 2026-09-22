/* UI deliberately has no network client, telemetry, background GPS, or precise-location storage. */
(() => {
  'use strict';
  const E = window.CrownlessSlice, A = window.CrownlessArt;
  const root = document.querySelector('#game');
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  let state = E.initial(), selected = 'wood', tab = 'explore', notice = '', busy = false;
  let session = E.locationSession(), currentKey = null, lastRaw = null, saveBlocked = false, conflict = false, locationRequest = 0;
  const key = mode => `crownless-expedition-v1-${mode}`;
  const walkAnchorKey = 'crownless-expedition-v1-walk-anchor';
  const coarseAnchor = anchor => anchor && Number.isFinite(anchor.latitude) && Number.isFinite(anchor.longitude)
    ? { latitude: Math.round(anchor.latitude * 1000) / 1000, longitude: Math.round(anchor.longitude * 1000) / 1000, accuracy: Math.max(60, Number(anchor.accuracy) || 60) }
    : null;
  function restoreWalkSession() {
    if (state.mode !== 'walk') return E.locationSession();
    try {
      const anchor = coarseAnchor(JSON.parse(localStorage.getItem(walkAnchorKey) || 'null'));
      return E.locationSession(anchor);
    } catch { return E.locationSession(); }
  }
  function saveWalkAnchor() {
    if (state.mode !== 'walk' || !session.anchor) return;
    try { localStorage.setItem(walkAnchorKey, JSON.stringify(coarseAnchor(session.anchor))); } catch { /* Game save can still continue without a persisted walk anchor. */ }
  }
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
    locationRequest++; busy = false; session = restoreWalkSession(); selected = state.expedition?.place || 'wood'; tab = 'explore'; notice = ''; render();
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
      const active = selected === p.id;
      return `<button class="atlas-marker ${active ? 'selected' : ''} ${stage}" style="--atlas-x:${x}%;--atlas-y:${y}%" data-action="select" data-value="${p.id}" aria-pressed="${active}" aria-label="${p.name}・${labels[stage]}">
        <span class="atlas-marker-icon">${A.icon(p.id)}</span>
        <span class="atlas-marker-copy"><strong>${p.name}</strong><small>${labels[stage]}</small></span>
        ${active ? `<span class="atlas-anomaly-copy"><b>${state.cleared.includes(p.id) ? '残った痕跡' : '新しい痕跡'}</b><small>${state.cleared.includes(p.id) ? 'まだ奥へ続いている。' : '昨日までは、なかった。'}</small></span>` : ''}
      </button>`;
    }).join('');
    const shrouds = E.PLACES.map(p => { const stage = maturity(p), [x,y] = positions[p.id]; return `<span class="atlas-shroud stage-${stage}" style="--atlas-x:${x}%;--atlas-y:${y}%" aria-hidden="true"></span>`; }).join('');
    return `<section class="exploration-atlas" data-living-atlas="true" aria-label="探索によって育つ冒険地図"><span hidden>THE UNWRITTEN LANDS · 調査済みの記録</span>
      <div class="atlas-home-header">
        <div><strong>CROWNLESS</strong><small>旅の地図</small></div>
        <span><b>帰還地</b>最後の焚き火</span>
      </div>
      <div class="atlas-field">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path class="atlas-contour" d="M5 72 C18 55 31 67 40 50 S62 21 76 36 S86 70 96 62" />
          <path class="atlas-contour secondary" d="M12 28 C28 16 37 38 55 26 S80 16 91 31" />
          <path class="atlas-trail" d="M22 68 C31 55 37 43 47 27 M47 27 C59 35 66 44 75 58 M75 58 C68 68 63 76 58 82" />
          <path class="atlas-water" d="M0 82 C19 75 30 84 45 77 S72 65 100 74" />
          <path class="atlas-sketch" d="M34 46 C39 41 42 36 47 27 M66 51 C70 53 73 56 75 58" />
        </svg>
        <span class="atlas-hearth" aria-label="安全な拠点"><i>✦</i><small>現在地</small></span>
        <div class="atlas-fog" aria-hidden="true"></div>
        ${shrouds}
        ${markers}
      </div>
      <p class="atlas-home-caption">歩いたぶんだけ、世界がひらく。</p><p hidden>歩いた結果だけを、冒険者の地図として抽象化して残す。</p>
    </section>`;
  }
  function scouting() {
    return `<div class="discovery"><p>${state.mode === 'demo' ? '散策を体験する — 歩くほど、地図の線と色が増えていく。' : '画面を閉じて散策し、安全に止まれる場所で発見する。'}</p>${state.mode === 'demo' ? `<div class="choice-grid">${button('scout','丘の道を歩いた','',{value:'tower'})}${button('scout','水辺の道を歩いた','',{value:'fen'})}${button('scout','南の小道を歩いた','',{value:'crypt'})}${button('scout','森の道を歩いた','',{value:'wood'})}</div>` : `${button('gps',busy ? '現在地を確認中…' : session.anchor ? '立ち止まった場所で発見する' : 'ここを散策の起点にする','',{class:'secondary',disabled:busy})}<p class="small" style="margin-top:10px">現在地そのものは地図に表示しません。安全に立ち止まって観測すると、その移動結果だけがゲーム世界へ反映されます。</p>`}${notice ? `<p class="notice" role="status">${esc(notice)}</p>` : ''}</div>`;
  }
  function explorePanel() {
    const p = E.place(selected), unlocked = state.unlocked.includes(p.id), locked = p.id === 'crypt' && state.cleared.length < 2;
    const cleared = state.cleared.includes(p.id);
    const traceLabel = cleared ? '残った痕跡' : unlocked ? '新しい痕跡' : 'まだ名のない場所';
    const traceCopy = unlocked
      ? (cleared ? `${p.reward}を持ち帰った。それでも、道はさらに奥へ続いている。` : p.teaser)
      : '霧の向こうに、まだ地図へ描かれていない土地がある。';
    return `<div class="map-home-detail">
      <div class="map-home-teaser">
        <div class="map-home-copy"><p class="kicker">${traceLabel}</p><h2>${unlocked ? p.name : '霧の向こう'}</h2><p class="map-home-whisper">${traceCopy}</p></div>
        ${unlocked ? button('depart',locked ? `他の土地をあと ${2-state.cleared.length} か所踏破する` : '遠征に出る','',{class:'primary map-home-depart',value:p.id,disabled:locked}) : ''}
      </div>
      <details class="map-home-scouting">
        <summary>${state.mode === 'demo' ? '別の道を探す' : '散策して新しい痕跡を探す'}</summary>
        ${scouting()}
      </details>
      ${notice ? `<p class="notice map-home-notice" role="status">${esc(notice)}</p>` : ''}
    </div>`;
  }
  function gearPanel() {
    const id = state.equipped, level = E.weaponLevel(state,id), cost = E.upgradeCost(state,id);
    return `<p class="kicker">MAKE IT HOME. MAKE IT YOURS.</p><h2>次の旅の、戦い方。</h2><p class="small">深層では同じ武器種でも戦い方の違う一本が見つかる。補強は一本ごとに残る。</p><div class="gear-list">${state.owned.filter(g => g !== 'crown').map(g => button('equip',`${E.GEAR[g].name}${state.equipped === g ? ' · 装備中' : ''} · 補強 ${E.weaponLevel(state,g)}/4`,E.gearText(state,g),{value:g,class:`choice ${state.equipped === g ? 'selected' : ''}`})).join('')}</div>${state.owned.includes('crown') ? '<p class="badge">灰の王冠 · 永続で最大体力 +6</p>' : ''}<div class="rule-line"><div class="section-heading"><h3 style="margin:0">${E.GEAR[id].name}を補強する</h3><span class="small">${level} / 4</span></div><p class="small">この一本の得意行動だけが一段強くなる。別の武器には影響しない。</p>${button('upgrade',level >= 4 ? 'この武器の補強を終えた' : `鉄片 ${cost} で補強する`,'',{class:'secondary',disabled:level >= 4 || state.scrap < cost})}${notice ? `<p class="notice" role="status">${esc(notice)}</p>` : ''}</div>`;
  }
  function camp() {
    return `<div class="game-layout camp-layout ${tab === 'explore' ? 'living-map-home' : 'gear-home'}"><section class="visual-column"><div class="mode-strip"><span class="mode-pill">${state.mode === 'demo' ? '散策体験モード' : '現実の散策モード'}</span><span>遠征 ${state.runs} 回 · 生還 ${state.victories} 回</span></div>${scene('camp','帰りを待つ火。','THE LAST HEARTH',null,'安全な拠点')}${mapPins()}<div class="stat-strip"><div class="stat">最大体力<b>${E.maxHp(state)}</b></div><div class="stat">手元の鉄片<b>${state.scrap}</b></div><div class="stat">装備<b><em>${E.GEAR[state.equipped].name}</em></b></div></div></section><section class="panel"><nav class="camp-tabs" aria-label="拠点">${button('tab','地図','',{class:tab === 'explore' ? 'active' : '',value:'explore'})}${button('tab','装備','',{class:tab === 'gear' ? 'active' : '',value:'gear'})}</nav>${tab === 'gear' ? gearPanel() : explorePanel()}<button class="text-button" data-action="switch-mode">${state.mode === 'demo' ? '現実の散策モードへ' : '散策体験モードへ'} <span aria-hidden="true">↗</span></button></section></div>`;
  }
  function vitals(x) {
    return `<div class="vitals"><div><div class="hp-row"><span>あなたの体力</span><strong class="${x.hp < 10 ? 'danger' : ''}">${x.hp} <small class="small">/ ${E.maxHp(state)}</small></strong></div><div class="bar" role="meter" aria-label="あなたの体力" aria-valuenow="${x.hp}" aria-valuemin="0" aria-valuemax="${E.maxHp(state)}"><span style="width:${100*x.hp/E.maxHp(state)}%"></span></div></div><div><span class="small">気力 · ${x.stamina} / 3</span><div class="stamina" aria-hidden="true">${'◆'.repeat(x.stamina)}<span class="empty">${'◇'.repeat(3-x.stamina)}</span></div></div></div>`;
  }
  function route(x) {
    return `<div class="route" aria-label="遠征の進み具合">${['足跡','灯り','狩場','遺品','土地の主'].map((v,i) => `<span class="route-step ${i === x.room ? 'current' : i < x.room ? 'done' : ''}"><i>${i < x.room ? '✓' : i+1}</i>${v}</span>`).join('')}</div>`;
  }
  function fight(x) {
    const e = x.enemy, next = E.intent(e), profile = E.combatProfile(state), info = E.enemyProfile(e);
    const strike = E.attackPreview(state,'strike'), strong = E.attackPreview(state,'heavy');
    const enemyTag = `${info.archetype}${info.trait ? ` · 《${info.trait.name}》${info.trait.help}` : ''}`;
    const dodgeHelp = next.adaptive
      ? next.id === 'feint'
        ? `気力 −${profile.dodgeCost} / 足運びを読まれている・被弾・追撃なし`
        : `気力 −${profile.dodgeCost} / この対策行動は回避可能`
      : next.id === 'quick'
        ? `気力 −${profile.dodgeCost} / 薙ぎ払いは半分被弾・追撃なし`
        : next.damage
          ? `気力 −${profile.dodgeCost} / 無傷・次の攻撃 +${profile.dodgeFocus}`
          : `気力 −${profile.dodgeCost} / 攻撃なし・追撃なし`;
    return `<div class="combat-vitals">${vitals(x)}</div><div class="combat-enemy-summary"><p class="kicker">${e.elite ? 'GUARDIAN' : 'ENCOUNTER'} / ${E.GEAR[state.equipped].name}</p><div class="hp-row"><h2 style="margin:0">${e.elite ? '主・' : ''}${E.ENEMIES[e.kind].name}</h2><span>${e.hp} <small class="small">/ ${e.maxHp}</small></span></div><p class="small combat-enemy-tag">${enemyTag}</p><div class="bar enemy-bar" role="meter" aria-label="敵の体力" aria-valuenow="${e.hp}" aria-valuemin="0" aria-valuemax="${e.maxHp}"><span style="width:${e.hp/e.maxHp*100}%"></span></div></div><div class="intent"><p class="kicker">次の行動 · 行動を選ぶまで時間は進まない</p><span class="damage">${next.damage ? next.damage : '—'}</span><strong>${next.name}</strong><small>${next.help}</small></div><div class="choice-grid combat-choice-grid">${button('strike',`${E.gearFamily(state.equipped) === 'bow' ? '射る' : '斬る'} <span class="cost">${strike}</span>`,'気力 +1 / 表示は与えるダメージ')}${button('heavy',`強撃 <span class="cost">${strong}</span>`,`気力 −${profile.heavyCost} / 大きな一撃`,{disabled:x.stamina < profile.heavyCost})}${button('guard','防御',`気力 +1 / ${profile.counter ? `${profile.block} 軽減・${profile.counter} 反撃` : `${profile.block} ダメージ軽減`}`)}${button('dodge','回避',dodgeHelp,{disabled:x.stamina < profile.dodgeCost})}</div><div class="combat-turn-note">${logs(x)}</div><div class="combat-foot">${button('heal',`薬草 ${x.potions} · 体力 +12`,'敵も行動する',{class:'choice',disabled:x.potions === 0 || x.hp === E.maxHp(state)})}${button('flee',`撤退 · 体力 −${Math.max(2,next.damage)}`,x.hp <= Math.max(2,next.damage) ? '生還できない' : '残れば戦利品を持ち帰れる',{class:'choice',disabled:x.hp <= Math.max(2,next.damage)})}</div><p class="small combat-bagline">背嚢：鉄片 ${x.scrap}${x.gear.length ? ' / 装備 '+x.gear.length+' 個' : ''} · 生還で確定${x.focus ? ` / 追撃 +${x.focus}` : ''}</p>`;
  }
  function pathPanel(x) {
    const event = [1,3].includes(x.room), clear = x.stage === 'cleared';
    const title = clear ? (x.place === 'crypt' ? '灰の冠は、あなたの手に。' : '土地の主を越えた。') : event ? (x.room === 1 ? '消えかけの灯り。' : '茨の奥に、銀の光。') : x.room === 4 ? 'この先に、主がいる。' : x.room === 0 ? '最初の足跡をたどる。' : '奥から、息づかい。';
    const detail = clear ? '手に入れたものを、焚き火へ。まだ余力があるなら、より危険な深層へ進むこともできる。' : event ? '息を整えるか、傷を引き受けて遺品を拾うか。引き返す道も、まだ残っている。' : x.room === 4 ? `この土地の主が奥を守っている。深層では、まだ見ていない武具を持つ主もいる。` : '静かな道をたどるか、宝の気配を追うか。深く踏み込むほど、敵の読み方も変わる。';
    const summary = clear ? '戦利品を確定して帰るか、さらに深層へ踏み込むか。' : event ? '休息するか、傷を負って遺品を拾うか。' : x.room === 4 ? '土地の主へ挑む。生還できる余力を残そう。' : '静かな道をたどるか、宝の気配を追うか。';
    const cue = x.depth >= 2 && !event && !clear ? `<p class="notice">${E.lootCue(x.place,x.depth)} 珍しい武具は生還するまで確定しない。</p>` : '';
    const decisions = clear ? `${button('return','戦利品を持って生還する','',{class:'primary'})}${x.depth < 3 ? `<p class="notice">${E.lootCue(x.place,x.depth+1)}</p>${button('deeper',`深層 ${x.depth+1} へ踏み込む`,`敵の行動も変化 / 珍しい武具の可能性 / 鉄片 ×${x.depth+1}`)}` : '<p class="small">最深部へ到達した。火のもとへ帰ろう。</p>'}` : event ? `${button('rest','火のそばで休む','体力 +6 / 遺品は残す')}${button('search',`茨の遺品を拾う`,`体力 −4 / 鉄片 +${5*x.depth}`,{disabled:x.hp <= 4})}` : `${button('careful',x.room === 4 ? '主に挑む' : '静かに足跡をたどる','通常の敵 / 体力を温存したい')}${button('risky','宝の気配を追う',x.depth >= 2 ? '敵の体力 +3 / 鉄片 +3 / 珍しい武具の可能性' : '敵の体力 +3 / 鉄片 +3')}`;
    const retreat = !clear ? button('return','ここで生還する','',{class:'secondary'}) : '';
    const heal = !clear ? `<div class="combat-foot">${button('heal',`薬草を使う（残り ${x.potions}）· 体力 +12`,'',{class:'text-button',disabled:x.potions === 0 || x.hp === E.maxHp(state)})}<span class="small">安全に使える</span></div>` : '';
    return `<div class="path-decision">
      <div class="path-mobile-status">${vitals(x)}<div class="path-risk"><span>背嚢</span><strong>鉄片 ${x.scrap}</strong><small>${x.gear.length ? `装備 ${x.gear.length} 個 · 生還で確定` : '生還で確定'}</small></div></div>
      <div class="path-copy"><p class="kicker">${clear ? 'A WAY HOME' : 'ONE MORE ROOM?'}</p><h2>${title}</h2><p class="path-summary">${summary}</p><div class="path-desktop-details"><p class="intro">${detail}</p>${ledger(x)}${cue}${logs(x)}</div></div>
      <div class="path-actions"><div class="button-stack">${decisions}</div>${!clear ? `<div class="path-secondary-row">${retreat}${heal}</div>` : ''}</div>
    </div>`;
  }
  function expedition() {
    const x = state.expedition, p = E.place(x.place), isFight = x.stage === 'fight';
    const enemyArt = x.enemy ? (E.ENEMIES[x.enemy.kind].art || x.enemy.kind) : null;
    return `<div class="game-layout expedition-layout ${isFight ? 'battle-layout' : ''}"><section class="visual-column">${scene(x.place,p.name,`DEPTH ${String(x.depth).padStart(2,'0')} · ${x.stage === 'cleared' ? '踏破' : `${x.room+1} / 5`}`,enemyArt,`${E.GEAR[state.equipped].name}`)}${route(x)}${vitals(x)}<div class="journey-note"><b>${String(x.depth).padStart(2,'0')}</b><span>深層 ${x.depth} · 戦利品を失っても、持ち込んだ装備は残る。<br>深層ほど敵の型が変わり、珍しい武具を期待できる。</span></div></section><section class="panel ${isFight ? 'combat-panel' : 'path-panel'}">${isFight ? fight(x) : pathPanel(x)}</section></div>`;
  }
  function report() {
    const r = state.report;
    return `<div class="game-layout report-layout"><section class="visual-column">${scene('camp',r.died ? '火は、まだ消えていない。' : 'おかえり、旅人。',r.died ? 'THE ROAD IS NOT OVER' : 'YOU MADE IT HOME')}</section><section class="panel report-panel"><div class="report-scroll"><p class="kicker">${r.died ? 'EXPEDITION LOST' : 'SAFE RETURN'} / ${E.place(r.place).name}</p><h1>${r.died ? '命だけを、持ち帰った。' : r.newGear.length ? '新しい一本を、火へ。' : '欲張らずに、帰る強さ。'}</h1><p class="intro">${r.died ? '背嚢の中身は霧の中へ。手元の鉄片と装備は無事だ。次は早めに帰るか、別の装備で挑もう。' : '背嚢の中身は、もうあなたのもの。新しい武具なら、今の装備と比べて次の戦い方を選べる。'}</p><div class="result-number">${r.died ? '−' : '+'}${r.scrap} <small>${r.died ? '鉄片を失った' : '鉄片を確保'}</small></div>${r.gear.map(g => `<div class="reward"><span class="reward-icon">♢</span><div><strong>${r.died ? '失った：' : ''}${E.GEAR[g].name}</strong><small>${r.died ? 'もう一度、深層で探そう。' : E.gearText(state,g)}</small></div></div>`).join('')}${!r.died && state.owned.includes('crown') ? '<p class="notice">灰冠の廟を越えた。名もなき旅人の、最初の物語が残った。</p>' : ''}<p class="small rule-line">${r.died ? '遠征の失敗で、恒久的な進行は失われません。' : state.cleared.length >= 2 && !state.owned.includes('crown') ? '二つの土地を越えた。次は「灰冠の廟」の主に挑める。' : '同じ土地でも深層へ行けば、別の一本に出会えることがあります。'}</p></div><div class="report-actions">${button('continue',r.newGear.some(g => g !== 'crown') ? '持ち帰った装備を比べる' : '焚き火で次の準備をする','',{class:'primary'})}</div></section></div>`;
  }
  function render() {
    const help = document.querySelector('#help'), helpToggle = document.querySelector('#help-toggle');
    if (help && !help.hidden) { help.hidden = true; helpToggle?.setAttribute('aria-expanded', 'false'); }
    if (conflict) { root.innerHTML = '<div class="help"><h2>別のタブで旅が進んでいます。</h2><p>最新のセーブを読み直してください。</p><button class="primary" data-action="reload">再読み込み</button></div>'; return; }
    root.innerHTML = !state.mode ? onboard() : state.expedition ? expedition() : state.report ? report() : camp();
  }
  function locationResult(coords) {
    const result = E.observe(session,coords);
    const messages = { anchored:'ここを散策の起点にしました。少し場所を変えてから、また安全に立ち止まって発見してください。', nearby:'まだ同じ土地の中です。距離を稼ぐ必要はありません。別の安全な場所へ移動した日に、また試せます。', inaccurate:'位置の精度が足りませんでした。屋外の開けた場所で再度試すか、散策体験モードで続けられます。', moving:'移動中のようです。安全な場所で立ち止まってから再度試してください。' };
    if (result.status === 'anchored') saveWalkAnchor();
    if (result.status === 'discovered') {
      const known = state.unlocked.includes(result.place);
      state = E.discover(state, result.place); selected = result.place;
      notice = known ? `この地域では「${E.place(result.place).name}」を発見済み。いつでも再訪できます。` : `霧が晴れた。「${E.place(result.place).name}」を発見。以後はその場にいなくても遠征できます。`;
      save();
    } else notice = messages[result.status];
    busy = false; render();
  }
  root.addEventListener('click', event => {
    const target = event.target.closest('button[data-action]');
    if (!target || target.disabled) return;
    const { action, value } = target.dataset;
    if (action === 'reload') { location.reload(); return; }
    if (conflict) return;
    const before = state;
    if (action === 'mode') { loadMode(value); save(); return; }
    if (action === 'switch-mode') { loadMode(state.mode === 'demo' ? 'walk' : 'demo'); save(); return; }
    if (action === 'select') { selected = value; tab = 'explore'; notice = ''; }
    else if (action === 'tab') { tab = value; notice = ''; }
    else if (action === 'scout') {
      const demoSession = E.locationSession(); E.observe(demoSession,{latitude:0,longitude:0,accuracy:5}); session = demoSession;
      const offsets = { tower:[.003,0],fen:[0,.003],crypt:[-.003,0],wood:[0,-.003] };
      locationResult({latitude:offsets[value][0],longitude:offsets[value][1],accuracy:5,speed:0}); return;
    } else if (action === 'gps') {
      if (!navigator.geolocation || !window.isSecureContext) { notice = 'この環境では位置情報を使えません。HTTPS または localhost で開くか、散策体験モードで遊べます。'; render(); return; }
      busy = true; const request = ++locationRequest; render();
      navigator.geolocation.getCurrentPosition(position => {
        if (request === locationRequest && state.mode === 'walk' && !state.expedition && !conflict) locationResult(position.coords);
      }, error => {
        if (request !== locationRequest || state.mode !== 'walk' || state.expedition || conflict) return;
        busy = false; notice = error.code === 1 ? '位置情報は許可されませんでした。設定を変えずに、散策体験モードでも遊べます。' : '現在地を取得できませんでした。後ほど試すか、散策体験モードで続けられます。'; render();
      }, { enableHighAccuracy:true, maximumAge:0, timeout:12000 }); return;
    } else if (action === 'depart') { locationRequest++; busy = false; state = E.start(state,value); }
    else if (action === 'equip') { state = E.equip(state,value); notice = `${E.GEAR[value].name}を装備した。`; }
    else if (action === 'upgrade') { const id=state.equipped; state = E.upgrade(state,id); if (state !== before) notice = `${E.GEAR[id].name}を補強した。得意行動が強くなった。`; }
    else if (action === 'continue') { tab = state.report.newGear.some(g => g !== 'crown') ? 'gear' : 'explore'; state = {...state,report:null}; notice = ''; }
    else state = E.act(state, action);
    if (state !== before) save();
    render();
    if (event.detail === 0) {
      const focusTarget = document.querySelector(`[data-action="${action}"]:not(:disabled)`) || document.querySelector('[data-action="strike"]');
      focusTarget?.focus({preventScroll:true});
    }
    if (['depart','continue','return','flee'].includes(action) || (before.expedition && state.expedition?.stage !== before.expedition.stage)) {
      document.querySelector('.panel')?.scrollIntoView({block:'nearest',behavior:'instant'});
    }
  });
  document.querySelector('#help-toggle').addEventListener('click', e => {
    const help = document.querySelector('#help'); help.hidden = !help.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!help.hidden));
  });
  window.addEventListener('storage', event => {
    if (currentKey && event.key === currentKey && event.newValue !== lastRaw) { conflict = true; warning('別のタブで進行が変わりました。再読み込みすると最新の旅へ戻れます。'); render(); }
  });
  try { const mode = localStorage.getItem('crownless-expedition-mode'); if (['demo','walk'].includes(mode)) loadMode(mode); else render(); }
  catch { render(); warning('このブラウザでは保存を利用できません。'); }
})();