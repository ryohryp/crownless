/* UI deliberately has no network client, telemetry, background GPS, or precise-location storage. */
(() => {
  'use strict';
  const E = window.CrownlessSlice, A = window.CrownlessArt, N = window.CrownlessNeighborhood;
  const root = document.querySelector('#game');
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  let state = E.initial(), selected = 'wood', tab = 'explore', notice = '', busy = false, lastReturnedPlace = null, prioritizeReinforcement = false, endingOpen = false;
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
    locationRequest++; busy = false; session = restoreWalkSession(); selected = state.expedition?.place || N.get(state.neighborhood).biome; tab = 'explore'; notice = ''; lastReturnedPlace = null; prioritizeReinforcement = false; endingOpen = false; render();
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
    return `<div class="scene">${A.scene(id, enemy, state.equipped)}<span class="scene-top">${enemy ? 'HOLD YOUR GROUND' : 'BEYOND THE MIST'}</span><div class="scene-top-actions">${tag ? `<span class="scene-tag">${tag}</span>` : ''}<button class="scene-settings" data-action="settings" aria-label="旅の設定と遊び方">⚙ 設定</button></div><div class="scene-caption"><p class="kicker">${subtitle}</p><h2>${title}</h2></div></div>`;
  }
  const logs = x => `<div class="combat-log" role="status" aria-live="polite">${x.log.map(v => `<p>${esc(v)}</p>`).join('')}</div>`;
  const ledger = x => `<div class='loot-ledger'><p class='kicker'>AT RISK · 生還で確定</p><strong>${x.scrap}</strong> <small>鉄片 / 背嚢の中</small>${x.gear.length ? `<p><small data-current-gear-id='${state.equipped}'>現在装備：${E.GEAR[state.equipped].name} · ${E.qualityLabel(E.weaponQuality(state,state.equipped))} · ${E.gearText(state,state.equipped)}</small></p>` : ''}${x.gear.map((g,i) => { const q=x.gearQuality?.[i] ?? 0; const current=state.owned.includes(g) ? ` / 所持 ${E.qualityLabel(E.weaponQuality(state,g))}` : ''; const foundAttack = E.weaponAttack(state,g,q), currentAttack = E.weaponAttack(state,state.equipped); const delta = foundAttack - currentAttack; const compare = delta > 0 ? `装備中より攻撃 +${delta}` : delta < 0 ? `装備中より攻撃 ${delta}` : '装備中と攻撃は同じ'; return `<p data-found-gear-id='${g}'>＋ ${E.GEAR[g].name} · ${E.qualityLabel(q)}<br><small>未帰還 · ${E.gearText(state,g,q)}${current}<br>${compare}（${foundAttack} / 現在 ${currentAttack}）</small></p>`; }).join('')}</div>`;
  function onboard() {
    return `<div class="game-layout onboard"><section class="visual-column">${scene('camp','まだ、名もなき旅人。','A FIRE WORTH RETURNING TO')}<div class="journey-note"><b>01</b><span>霧の先には、まだ知らない場所。<br>戦利品を持ち帰り、ここに自分の拠点を育てよう。</span></div></section><section class="panel"><p class="kicker">A SMALL JOURNEY. SOMETHING TO LOSE.</p><h1>霧の向こうへ。<br>生きて、帰ろう。</h1><p class="intro">欠けた剣と、ふた束の薬草。<br>あなたの旅は、それだけで始まる。<br>踏み込むか、引き返すか。<br>持ち帰った一本の剣が、次の旅を変える。<br>建材を集め、自分の拠点と領域を育てよう。</p><div class="button-stack">${button('mode','まずは体験する <span>約 15 分</span>','',{class:'primary',value:'demo'})}${button('mode','現実の散策で発見する','',{class:'secondary',value:'walk'})}</div><p class="small rule-line">体験モードは、室内で移動を再現します。<br>散策モードは、安全に立ち止まって現在地を確認。<br>位置情報を送信せず、移動履歴も残しません。</p></section></div>`;
  }
  function homeArt() {
    const n = state.neighborhood, forge = n.buildings.includes('forge'), lodge = n.buildings.includes('lodge');
    return '<svg class="homestead-art" viewBox="0 0 240 150" aria-label="' + (lodge ? '鍛冶小屋と窓明かりのある集落' : forge ? '焚き火に鍛冶小屋が建った拠点' : '小さな焚き火だけの野営地') + '" role="img"><ellipse cx="120" cy="121" rx="105" ry="20" fill="#6d8060" opacity=".25"/><path d="M20 120 Q80 108 120 124 T220 116" fill="none" stroke="#7e7655" stroke-width="2"/>' +
      (forge ? '<path d="M25 88H85V119H25Z" fill="#897451"/><path d="M18 88L55 60L93 88Z" fill="#5a5e4e"/><path d="M73 62V47H82V74" fill="#6c6a5a"/><rect x="43" y="99" width="15" height="20" fill="#423d31"/><path d="M75 41Q87 34 77 25" fill="none" stroke="#adb099" stroke-width="4"/><circle cx="52" cy="108" r="4" fill="#e1a65d"/>' : '<path d="M33 114L57 81L80 114Z" fill="#928464"/><path d="M50 114L57 98L65 114" fill="#4c503f"/>') +
      (lodge ? '<path d="M151 79H210V119H151Z" fill="#a18a63"/><path d="M141 80L181 50L220 80Z" fill="#685c46"/><rect x="175" y="96" width="12" height="23" fill="#494437"/><rect x="156" y="91" width="11" height="13" fill="#efd291"/><rect x="195" y="91" width="10" height="13" fill="#efd291"/><path d="M138 116H224M139 108V123M219 108V123" stroke="#776747" stroke-width="3"/>' : '<path d="M161 117L178 99L191 117M186 118L201 103L216 118" fill="#8d9073" opacity=".45"/>') +
      '<path d="M105 122L128 121M108 126L130 116" stroke="#62523a" stroke-width="4"/><path d="M116 118Q106 107 118 96Q115 108 124 110Q134 119 116 123" fill="#db9850"/><path d="M118 119Q114 113 120 107Q125 117 118 119" fill="#f4d888"/></svg>';
  }
  function mapPins() {
    const n = state.neighborhood, chosen = N.get(n);
    const districts = [...n.districts];
    const rx = Math.max(1,...districts.map(d=>Math.abs(d.x))), ry = Math.max(1,...districts.map(d=>Math.abs(d.y)));
    const pos = d => [50+d.x/(rx*2+1)*96,43-d.y/(ry*2+1)*52];
    const landmark = d => {
      const art = {
        wood:'<path d="M12 35l7-11 7 11M7 38l9-14 9 14M23 37l7-12 8 12M16 39v4M30 38v5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
        tower:'<path d="M15 39h19M18 37V19h13v18M15 19h19M18 15h13v4M21 25h7M23 31h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
        fen:'<path d="M7 33c7-4 12 4 19 0s10 3 15 0M8 38c6-3 11 3 17 0s11 3 15 0M16 29V18M16 21l-4-4M16 24l5-5M31 30V17M31 21l4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        crypt:'<path d="M11 39h27M15 35l5-17h11l4 17M20 18l5-6 6 6M20 28h11M24 23h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
      }[d.biome];
      const flag = d.claimed ? '<path class="district-claim-flag" d="M34 12v16M35 13l7 3-7 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' : '';
      return '<svg class="district-landmark-svg" viewBox="0 0 48 48" focusable="false" aria-hidden="true">'+art+flag+'</svg>';
    };
    const paths = districts.map(d => { const [x,y]=pos(d); return '<path class="district-road '+(d.claimed ? 'claimed' : '')+'" d="M50 43L'+x+' '+y+'"/>'; }).join('');
    const markers = districts.map(d => {
      const [x,y]=pos(d);
      const poi=N.pointOfInterest(d); return '<button class="district-pin biome-'+d.biome+' '+(d.claimed ? 'claimed ' : '')+(d.id===n.selected ? 'selected' : '')+'" style="left:'+x+'%;top:'+y+'%" data-action="district" data-value="'+d.id+'" aria-pressed="'+(d.id===n.selected)+'"><span class="district-landmark" aria-hidden="true">'+landmark(d)+'</span><span class="district-poi-mark" aria-label="'+esc(poi.label)+'">'+poi.icon+'</span><strong>'+N.title(d)+'</strong><small>'+(d.claimed ? 'あなたの領域' : poi.name)+'</small></button>';
    }).join('');
    const frontier = '<div class="district-frontier-fog" aria-hidden="true"></div><span class="district-frontier-mark district-frontier-mark--nw" aria-hidden="true">?</span><span class="district-frontier-mark district-frontier-mark--se" aria-hidden="true">?</span>';
    return '<section class="exploration-atlas neighborhood-atlas" data-living-atlas="true" aria-label="拠点と近所の領域"><div class="atlas-home-header"><div><strong>'+esc(n.name)+'</strong><small>'+ (state.mode==='demo' ? '体験の近所' : '散策の起点の近所')+' · 発見 '+n.districts.length+' / 開拓 '+N.claims(n)+'</small></div><span><b>建材</b>木材 '+n.wood+' · 石材 '+n.stone+'</span></div><div class="atlas-field neighborhood-field"><div class="neighborhood-canvas" style="width:'+((rx*2+1)*140)+'px;height:'+((ry*2+1)*140)+'px"><svg class="district-roads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">'+paths+'</svg>'+frontier+'<button class="district-home" data-action="tab" data-value="home" aria-label="'+esc(n.name)+'の拠点を育てる">'+homeArt()+'<strong>'+esc(n.name)+'</strong><small>'+ (n.buildings.length ? '建物 '+n.buildings.length+' · 拠点を育てる' : 'まだ小さな野営地')+'</small></button>'+markers+'</div></div><p class="atlas-home-caption">主を倒し、帰還した土地に、あなたの旗が立つ。</p></section>';
  }
  function homePanel() {
    const n = state.neighborhood;
    return '<div class="homestead-panel"><p class="kicker">A PLACE TO CALL YOUR OWN</p><h2>'+esc(n.name)+'</h2><p class="home-materials">木材 <b>'+n.wood+'</b> · 石材 <b>'+n.stone+'</b> · 領域 <b>'+N.claims(n)+'</b></p><p class="small">建材は遠征から生還すると持ち帰れる。土地の主を倒して帰ると、その土地にあなたの旗が立つ。</p><div class="home-buildings">'+Object.entries(N.BUILDINGS).map(([id,b]) => { const built=n.buildings.includes(id); return '<section class="home-building '+(built ? 'built' : '')+'"><div><h3>'+(built ? '✓ ' : '')+b.name+'</h3><p>'+b.benefit+'</p></div>'+ (built ? '<small>建設済み · '+b.story+'</small>' : button('home-build',b.name+'を建てる','木材 '+b.wood+' · 石材 '+b.stone+(b.claims ? ' · 領域 '+b.claims+' が必要' : ''),{class:'secondary',value:id,disabled:!N.canBuild(n,id)}))+'</section>'; }).join('')+'</div><div class="home-name"><label for="home-name">この拠点に名前をつける</label><div><input id="home-name" maxlength="16" value="'+esc(n.name)+'" autocomplete="off">'+button('home-name','名付ける','',{class:'secondary'})+'</div></div>'+ (notice ? '<p class="notice" role="status">'+esc(notice)+'</p>' : '')+'</div>';
  }
  function scouting() {
    return `<div class="discovery"><p>${state.mode === 'demo' ? '散策を体験する — 歩くほど、地図の線と色が増えていく。' : '画面を閉じて散策し、安全に止まれる場所で発見する。'}</p>${state.mode === 'demo' ? `<div class="choice-grid">${button('scout','丘の道を歩いた','',{value:'tower'})}${button('scout','水辺の道を歩いた','',{value:'fen'})}${button('scout','南の小道を歩いた','',{value:'crypt'})}${button('scout','森の道を歩いた','',{value:'wood'})}</div>` : `${button('gps',busy ? '現在地を確認中…' : session.anchor ? '立ち止まった場所で発見する' : 'ここを散策の起点にする','',{class:'secondary',disabled:busy})}<p class="small" style="margin-top:10px">現在地そのものは地図に表示しません。安全に立ち止まって観測すると、その移動結果だけがゲーム世界へ反映されます。</p>`}${notice ? `<p class="notice" role="status">${esc(notice)}</p>` : ''}</div>`;
  }
  function explorePanel() {
    const d = N.get(state.neighborhood), p = E.place(d.biome), poi=N.pointOfInterest(d), locked = p.id==='crypt' && state.cleared.length<2;
    const poiCard='<details class="district-poi-card"><summary><span class="district-poi-icon" aria-hidden="true">'+poi.icon+'</span><span class="district-poi-title"><small>'+esc(poi.label)+'</small><strong>'+esc(poi.name)+'</strong></span><span class="district-poi-toggle" aria-hidden="true">＋</span></summary><div class="district-poi-content"><p>'+esc(poi.description)+'</p>'+button('poi',poi.actionLabel,'',{class:'secondary',value:poi.action,disabled:poi.action==='depart' && locked})+'</div></details>';
    return '<div class="map-home-detail"><div class="district-detail"><div><small>'+ (d.claimed ? '⚑ あなたの領域 · 生還 '+d.returns+' 回' : '未開拓 · 主を倒して帰還すると領域になる')+'</small><h2>'+N.title(d)+'</h2><p>'+p.name+' · '+ (d.claimed ? '開拓済みの道から、帰還時の木材・石材が各 +1。' : '最初の戦闘だけでも、帰れば建材を持ち帰れる。')+'</p></div>'+button('depart',locked ? '他の土地を2か所踏破' : 'この土地へ遠征','',{class:'primary',value:p.id,disabled:locked})+'</div>'+poiCard+'<details class="map-home-scouting"><summary>'+ (state.mode==='demo' ? '近所を歩く · 室内で体験' : '立ち止まって近所を発見')+'</summary>'+scouting()+'</details>'+ (state.neighborhood.districts.length>6 ? '<details class="district-list"><summary>発見した土地をすべて見る</summary>'+state.neighborhood.districts.map(v=>button('district',N.title(v),v.claimed ? 'あなたの領域' : '未開拓',{value:v.id})).join('')+'</details>' : '')+ (notice ? '<p class="notice map-home-notice" role="status">'+esc(notice)+'</p>' : '')+'</div>';
  }
  function canReinforceEquipped() {
    const id = state.equipped;
    return Boolean(
      id &&
      state.owned.includes(id) &&
      E.weaponLevel(state, id) < 4 &&
      state.scrap >= E.upgradeCost(state, id)
    );
  }

  function gearPanel() {
    const id = state.equipped, level = E.weaponLevel(state,id), cost = E.upgradeCost(state,id);
    const retryPlace = lastReturnedPlace && state.unlocked.includes(lastReturnedPlace) ? E.place(lastReturnedPlace) : null;
    const retry = retryPlace
      ? `<div class="button-stack">${button('depart',`この装備で${retryPlace.name}へもう一度`,`${E.GEAR[id].name}を試す / 遠征準備へ`,{class:prioritizeReinforcement ? 'secondary' : 'primary',value:retryPlace.id})}</div>`
      : '';
    const maintenance = state.maintenance === 'ready'
      ? `<div class="rule-line"><div class="section-heading"><h3 style="margin:0">焚き火で刃を研ぐ</h3><span class="small">次の遠征だけ</span></div><p class="small">生還した勢いを次の旅へ。最初の3戦、それぞれ最初の一撃だけ +3。</p>${button('maintain','刃を研ぐ','鉄片は使わない',{class:'primary'})}</div>`
      : state.maintenance === 'sharp'
        ? '<p class="notice">刃は研ぎ澄まされている。次の遠征の最初の3戦で、初撃 +3。</p>'
        : '';
    const previewState = {...state, scrap: Math.max(state.scrap, cost)};
    const nextPower = level < 4 ? reinforcementResult(state, E.upgrade(previewState, id), id) : '';
    const powerPreview = nextPower ? `<p class="small reinforcement-preview"><strong>補強後の成果：</strong>${nextPower}</p>` : '';
    return `<p class="kicker">MAKE IT HOME. MAKE IT YOURS.</p><h2>次の旅の、戦い方。</h2><p class="small">深層では同じ武器でも品質の違う一本が見つかる。補強と特性はそのまま、攻撃だけが少し揺れる。</p>${maintenance}<div class="gear-list">${state.owned.filter(g => g !== 'crown').map(g => button('equip',`${E.GEAR[g].name}${state.equipped === g ? ' · 装備中' : ''} · 補強 ${E.weaponLevel(state,g)}/4`,`${E.qualityLabel(E.weaponQuality(state,g))} · ${E.gearText(state,g)}`,{value:g,class:`choice ${state.equipped === g ? 'selected' : ''}`})).join('')}</div>${state.owned.includes('crown') ? '<p class="badge">灰の王冠 · 永続で最大体力 +6</p>' + button('ending-open','最初の物語を振り返る','',{class:'secondary'}) : ''}<div class="rule-line"><div class="section-heading"><h3 style="margin:0">${E.GEAR[id].name}を補強する</h3><span class="small">${level} / 4</span></div><p class="small">この一本の得意行動だけが一段強くなる。別の武器には影響しない。</p>${powerPreview}${button('upgrade',level >= 4 ? 'この武器の補強を終えた' : `鉄片 ${cost} で補強する`,'',{class:'secondary',disabled:level >= 4 || state.scrap < cost})}${notice ? `<p class="notice" role="status">${esc(notice)}</p>` : ''}</div>${retry}`;
  }
  function reinforcementResult(beforeState, afterState, id) {
    const gear = E.GEAR[id];
    const before = E.combatProfile(beforeState, id);
    const after = E.combatProfile(afterState, id);
    if (before.family === 'fang' && before.dodgeFocus !== after.dodgeFocus) return `回避後の追撃 +${before.dodgeFocus} → +${after.dodgeFocus}`;
    if (before.family === 'shield') {
      const changes = [];
      if (before.block !== after.block) changes.push(`防御 ${before.block} → ${after.block} 軽減`);
      if (before.counter !== after.counter) changes.push(`反撃 ${before.counter} → ${after.counter}`);
      if (changes.length) return changes.join(' / ');
    }
    const beforeHeavy = E.weaponAttack(beforeState,id) + before.heavyBonus;
    const afterHeavy = E.weaponAttack(afterState,id) + after.heavyBonus;
    if (beforeHeavy !== afterHeavy) return `強撃 ${beforeHeavy} → ${afterHeavy}`;
    return '得意行動が一段強くなった';
  }

  function camp() {
    const level = E.weaponLevel(state, state.equipped);
    const nav = `<nav class="camp-tabs" aria-label="拠点">${button('tab','近所','',{class:tab === 'explore' ? 'active' : '',value:'explore'})}${button('tab','拠点','',{class:tab === 'home' ? 'active' : '',value:'home'})}${button('tab','装備','',{class:tab === 'gear' ? 'active' : '',value:'gear'})}${button('settings','設定','',{class:'bottom-navigation-item'})}</nav>`;
    return `<div class="game-layout camp-layout ${tab === 'explore' ? 'living-map-home' : tab === 'home' ? 'homestead-home' : 'gear-home'}"><section class="visual-column"><div class="mode-strip"><span class="mode-pill">${state.mode === 'demo' ? '散策体験モード' : '現実の散策モード'}</span><span>遠征 ${state.runs} 回 · 生還 ${state.victories} 回</span></div>${tab === 'home' ? '<div class="home-portrait">'+homeArt()+'<p>'+esc(state.neighborhood.name)+' · '+(state.neighborhood.buildings.length ? '育ち始めた集落' : '野営地')+'</p></div>' : scene('camp','帰りを待つ火。','THE LAST HEARTH',null,'安全な拠点')}${mapPins()}<div class="stat-strip"><div class="stat">最大体力<b>${E.maxHp(state)}</b></div><div class="stat">手元の鉄片<b>${state.scrap}</b></div><div class="stat">装備<b><em>${E.GEAR[state.equipped].name}<small> · ${E.qualityLabel(E.weaponQuality(state,state.equipped))}${level > 0 ? ` · 補強 ${level}/4` : ''}</small></em></b></div></div></section><section class="panel">${tab === 'gear' ? gearPanel() : tab === 'home' ? homePanel() : explorePanel()}<button class="text-button" data-action="switch-mode">${state.mode === 'demo' ? '現実の散策モードへ' : '散策体験モードへ'} <span aria-hidden="true">↗</span></button></section>${nav}</div>`;
  }
  function vitals(x) {
    return `<div class="vitals"><div><div class="hp-row"><span>あなたの体力</span><strong class="${x.hp < 10 ? 'danger' : ''}">${x.hp} <small class="small">/ ${E.maxHp(state)}</small></strong></div><div class="bar" role="meter" aria-label="あなたの体力" aria-valuenow="${x.hp}" aria-valuemin="0" aria-valuemax="${E.maxHp(state)}"><span style="width:${100*x.hp/E.maxHp(state)}%"></span></div></div><div><span class="small">気力 · ${x.stamina} / 3</span><div class="stamina" aria-hidden="true">${'◆'.repeat(x.stamina)}<span class="empty">${'◇'.repeat(3-x.stamina)}</span></div></div></div>`;
  }
  function route(x) {
    return `<div class="route" aria-label="遠征の進み具合">${['足跡','灯り','狩場','遺品','土地の主'].map((v,i) => `<span class="route-step ${i === x.room ? 'current' : i < x.room ? 'done' : ''}"><i>${i < x.room ? '✓' : i+1}</i>${v}</span>`).join('')}</div>`;
  }
  function fight(x) {
    const e = x.enemy, next = E.intent(e), profile = E.combatProfile(state), info = E.enemyProfile(e);
    const level = E.weaponLevel(state, state.equipped);
    const strike = E.attackPreview(state,'strike'), strong = E.attackPreview(state,'heavy');
    const opening = x.stagger ? `<div class="combat-opening" role="status"><strong>体勢を崩した！</strong><span>今の一手だけ、攻撃に追加ダメージ。${next.damage ? '敵の反撃にも注意。' : '敵は攻撃してこない。'}</span></div>` : '';
    const strikeLabel = x.stagger ? '崩し追撃' : E.gearFamily(state.equipped) === 'bow' ? '射る' : '斬る';
    const enemyTag = `${info.archetype}${info.trait ? ` · 《${info.trait.name}》${info.trait.help}` : ''}`;
    const strongHelp = `気力 −${profile.heavyCost} / 大きな一撃${profile.heavyBonus > 4 ? ` · 補強 +${profile.heavyBonus - 4}` : ''}`;
    const guardHelp = `気力 +1 / ${profile.counter ? `${profile.block} 軽減・${profile.counter} 反撃` : `${profile.block} ダメージ軽減`}${level > 0 && profile.family === 'shield' ? ` · 補強 +${level}` : ''}`;
    const strikeHelp = `気力 +1 / 表示は与えるダメージ${x.sharpened > 0 && !x.sharpenedApplied ? ' · 研ぎ澄まし +3' : ''}`;
    const dodgeHelp = next.adaptive
      ? next.id === 'feint'
        ? `気力 −${profile.dodgeCost} / 足運びを読まれている・被弾・追撃なし`
        : `気力 −${profile.dodgeCost} / この対策行動は回避可能`
      : next.id === 'quick'
        ? `気力 −${profile.dodgeCost} / 薙ぎ払いは半分被弾・追撃なし`
        : next.damage
          ? `気力 −${profile.dodgeCost} / 無傷・次の攻撃 +${profile.dodgeFocus}${['heavy','pounce'].includes(next.id) ? '・体勢崩し' : ''}${profile.family === 'fang' && level > 0 ? ` · 補強 +${level}` : ''}`
          : `気力 −${profile.dodgeCost} / 攻撃なし・追撃なし`;
    const combatNote = e.turn === 0
      ? ''
      : `<div class="combat-turn-note">${logs(x)}</div>`;
    return `<div class="combat-vitals">${vitals(x)}</div><div class="combat-enemy-summary"><p class="kicker">${e.elite ? 'GUARDIAN' : 'ENCOUNTER'} / ${E.GEAR[state.equipped].name} · ${E.qualityLabel(E.weaponQuality(state,state.equipped))}${level > 0 ? ` · 補強 +${level}` : ''}</p><div class="hp-row"><h2 style="margin:0">${e.elite ? '主・' : ''}${E.ENEMIES[e.kind].name}</h2><span>${e.hp} <small class="small">/ ${e.maxHp}</small></span></div><p class="small combat-enemy-tag">${enemyTag}</p><div class="bar enemy-bar" role="meter" aria-label="敵の体力" aria-valuenow="${e.hp}" aria-valuemin="0" aria-valuemax="${e.maxHp}"><span style="width:${e.hp/e.maxHp*100}%"></span></div></div><div class="intent"><p class="kicker">次の行動 · 行動を選ぶまで時間は進まない</p><span class="damage">${next.damage ? next.damage : '—'}</span><strong>${next.name}</strong><small>${next.help}</small></div>${opening}<div class="choice-grid combat-choice-grid" data-opening="${x.stagger}">${button('strike',`${strikeLabel} <span class="cost">${strike}</span>`,strikeHelp)}${button('heavy',`${x.stagger ? '崩し強撃' : '強撃'} <span class="cost">${strong}</span>`,strongHelp,{disabled:x.stamina < profile.heavyCost})}${button('guard','防御',guardHelp)}${button('dodge','回避',dodgeHelp,{disabled:x.stamina < profile.dodgeCost})}</div>${combatNote}<div class="combat-foot">${button('heal',`薬草 ${x.potions} · 体力 +12`,'敵も行動する',{class:'choice',disabled:x.potions === 0 || x.hp === E.maxHp(state)})}${button('flee',`撤退 · 体力 −${Math.max(2,next.damage)}`,x.hp <= Math.max(2,next.damage) ? '生還できない' : '残れば戦利品を持ち帰れる',{class:'choice',disabled:x.hp <= Math.max(2,next.damage)})}</div><p class="small combat-bagline">背嚢：鉄片 ${x.scrap}${x.gear.length ? ' / 装備 '+x.gear.length+' 個' : ''} · 生還で確定${x.focus ? ` / 追撃 +${x.focus}` : ''}</p>`;
  }
  function pathPanel(x) {
    const event = [1,3].includes(x.room), clear = x.stage === 'cleared';
    const roadside = event && E.isRoadsideEvent(state, x);
    const title = clear ? (x.place === 'crypt' ? '灰の冠は、あなたの手に。' : '土地の主を越えた。') : roadside ? '朽ちた荷車が、道を塞ぐ。' : event ? (x.room === 1 ? '消えかけの灯り。' : '茨の奥に、銀の光。') : x.room === 4 ? 'この先に、主がいる。' : x.room === 0 ? '最初の足跡をたどる。' : '奥から、息づかい。';
    const detail = clear ? '手に入れたものを、焚き火へ。まだ余力があるなら、より危険な深層へ進むこともできる。' : roadside ? '荷台には乾いた薬草が残る。傍らの古い道標には、血を捧げた旅人の傷跡が刻まれている。' : event ? '息を整えるか、傷を引き受けて遺品を拾うか。引き返す道も、まだ残っている。' : x.room === 4 ? `この土地の主が奥を守っている。深層では、まだ見ていない武具を持つ主もいる。` : '静かな道をたどるか、宝の気配を追うか。深く踏み込むほど、敵の読み方も変わる。';
    const summary = clear ? '戦利品を確定して帰るか、さらに深層へ踏み込むか。' : roadside ? '鉄片を薬草へ替えるか、体力を代価に次の一撃を研ぎ澄ますか。' : event ? '休息するか、傷を負って遺品を拾うか。' : x.room === 4 ? '土地の主へ挑む。生還できる余力を残そう。' : '静かな道をたどるか、宝の気配を追うか。';
    const cue = x.depth >= 2 && !event && !clear ? `<p class="notice">${E.lootCue(x.place,x.depth)} 珍しい武具は生還するまで確定しない。</p>` : '';
    const decisions = clear ? `${button('return','戦利品を持って帰る','',{class:'primary'})}${x.depth < 3 ? `<p class="notice">${E.lootCue(x.place,x.depth+1)}</p>${button('deeper',`深層 ${x.depth+1} へ踏み込む`,`敵の行動も変化 / 珍しい武具の可能性 / 鉄片 ×${x.depth+1}`)}` : '<p class="small">最深部へ到達した。火のもとへ帰ろう。</p>'}` : roadside ? `${button('trade','荷車の薬草を拾う','鉄片 −3 / 薬草 +1',{disabled:x.scrap < 3 || x.potions >= 2})}${button('pray','道標へ血を捧げる','体力 −3 / 次の一撃 +3',{disabled:x.hp <= 3})}` : event ? `${button('rest','火のそばで休む','体力 +6 / 遺品は残す')}${button('search',`茨の遺品を拾う`,`体力 −4 / 鉄片 +${5*x.depth}`,{disabled:x.hp <= 4})}` : `${button('careful',x.room === 4 ? '主に挑む' : '静かに足跡をたどる','通常の敵 / 体力を温存したい')}${button('risky','宝の気配を追う',x.depth >= 2 ? '敵の体力 +3 / 鉄片 +3 / 珍しい武具の可能性' : '敵の体力 +3 / 鉄片 +3')}`;
    const retreat = !clear ? button('return','ここで生還する','',{class:'secondary'}) : '';
    const heal = !clear ? `<div class="combat-foot">${button('heal',`薬草を使う（残り ${x.potions}）· 体力 +12`,'',{class:'text-button',disabled:x.potions === 0 || x.hp === E.maxHp(state)})}<span class="small">安全に使える</span></div>` : '';
    return `<div class="path-decision">
      <div class="path-scroll">
        <div class="path-mobile-status">${vitals(x)}<div class="path-risk"><span>背嚢</span><strong>鉄片 ${x.scrap}</strong><small>${x.gear.length ? `装備 ${x.gear.length} 個 · 生還で確定` : '生還で確定'}</small></div></div>
        <div class="path-copy"><p class="kicker">${clear ? 'A WAY HOME' : 'ONE MORE ROOM?'}</p><h2>${title}</h2><p class="path-summary">${summary}</p><div class="path-desktop-details"><p class="intro">${detail}</p>${ledger(x)}${cue}${logs(x)}</div></div>
      </div>
      <div class="path-actions"><div class="button-stack">${decisions}</div>${!clear ? `<div class="path-secondary-row">${retreat}${heal}</div>` : ''}</div>
    </div>`;
  }
  function expedition() {
    const x = state.expedition, p = E.place(x.place), isFight = x.stage === 'fight';
    const localDistrict = N.get(state.neighborhood,state.neighborhood.active);
    const enemyArt = x.enemy ? (E.ENEMIES[x.enemy.kind].art || x.enemy.kind) : null;
    return `<div class="game-layout expedition-layout ${isFight ? 'battle-layout' : ''}" data-combat-result="${x.log.some(line => line.startsWith('崩し追撃！')) ? 'follow-up' : ''}" data-combat-turn="${x.depth}:${x.room}:${x.enemy?.turn ?? 'path'}"><section class="visual-column">${scene(x.place,localDistrict ? N.title(localDistrict) : p.name,`DEPTH ${String(x.depth).padStart(2,'0')} · ${x.stage === 'cleared' ? '踏破' : `${x.room+1} / 5`}`,enemyArt,`${E.GEAR[state.equipped].name}`)}${route(x)}${vitals(x)}<div class="journey-note"><b>${String(x.depth).padStart(2,'0')}</b><span>深層 ${x.depth} · 戦利品を失っても、持ち込んだ装備は残る。<br>深層ほど敵の型が変わり、珍しい武具を期待できる。</span></div></section><section class="panel ${isFight ? 'combat-panel' : 'path-panel'}">${isFight ? fight(x) : pathPanel(x)}</section></div>`;
  }
  function ending() {
    return `<div class="game-layout report-layout"><section class="visual-column">${scene('camp','灰の冠は、火のそばに。','THE CROWN CAME HOME',null,'旅の到達点')}</section><section class="panel report-panel"><div class="report-scroll"><p class="kicker">EPILOGUE · 名もなき旅人</p><h1>冠を持ち帰った。<br>それでも、旅は続く。</h1><p class="intro">霧の王墓から持ち帰った灰の冠を、あなたは焚き火のそばへ置いた。名は刻まれない。けれど、歩いた土地と、生きて帰った夜だけは残る。</p><div class="result-number">${state.victories} <small>回の生還 / 遠征 ${state.runs} 回</small></div><p class="notice">灰の王冠 · 最大体力 +6。ここから先も、まだ見ていない一本と深層が残っている。</p><p class="small rule-line">これは終わりではなく、最初の物語の区切り。地図へ戻れば、踏破した土地にも再び遠征できる。</p></div><div class="report-actions">${button('ending-continue','旅の地図へ戻る','',{class:'primary'})}</div></section></div>`;
  }
  function report() {
    const r = state.report;
    const duplicates = Array.isArray(r.duplicates) ? r.duplicates : [];
    const unresolved = duplicates.filter(d => !d.decision).length;
    const keptDuplicate = duplicates.some(d => d.decision === 'keep');
    const hasNewBattleGear = r.newGear.some(g => g !== 'crown');
    const canPowerUp = !r.died && canReinforceEquipped();
    const recovery = r.died && window.CrownlessRescueCache?.cacheFromReport
      ? window.CrownlessRescueCache.cacheFromReport(r, r.place)
      : null;
    const recoveryParts = recovery
      ? [recovery.gear ? `${E.GEAR[recovery.gear]?.name}（${E.qualityLabel(recovery.quality ?? 0)}）` : '', recovery.scrap ? `鉄片 ${recovery.scrap}` : ''].filter(Boolean)
      : [];
    const grudgeEnemy = r.died && r.defeatedBy ? E.ENEMIES?.[r.defeatedBy] : null;
    const grudgeHook = grudgeEnemy ? ` 奴の間合いは見切った。次に${grudgeEnemy.name}と戦えば、最初の一撃に執念を乗せられる。` : '';
    const defeatIntro = recovery
      ? `背嚢は落としたが、${E.place(r.place).name}の敗走跡に${recoveryParts.join('と')}が残っている。次に同じ土地へ出れば回収できる。${grudgeHook}`
      : `背嚢の中身は霧の中へ。手元の鉄片と装備は無事だ。次は早めに帰るか、別の装備で挑もう。${grudgeHook}`;
    const lootRows = r.gear.map((g,i) => {
      const q = r.gearQuality?.[i] ?? 0;
      return `<div class='reward'><span class='reward-icon'>♢</span><div><strong>${r.died ? (recovery?.gear === g ? '敗走跡に残った：' : '失った：') : ''}${E.GEAR[g].name} ${g === 'crown' ? '' : `· ${E.qualityLabel(q)}`}</strong><small>${r.died ? (recovery?.gear === g ? '次に同じ土地へ出れば背嚢へ戻る。生還で確定。' : 'もう一度、深層で探そう。') : E.gearText(state,g,q)}</small></div></div>`;
    }).join('');
    const duplicateRows = !r.died && duplicates.length ? `<div class='rule-line'><div class='section-heading'><h3 style='margin:0'>同名武器を比べる</h3><span class='small'>${unresolved ? `残り ${unresolved}` : '整理済み'}</span></div>${duplicates.map((d,i) => {
      const currentQ = E.weaponQuality(state,d.id), currentAttack = E.weaponAttack(state,d.id), foundAttack = E.weaponAttack(state,d.id,d.quality);
      const delta = foundAttack - currentAttack;
      const compare = delta > 0 ? `新しい一本は攻撃 +${delta}` : delta < 0 ? `今の一本より攻撃 ${delta}` : '攻撃は同じ';
      const done = d.decision === 'keep' ? `<p class='notice'>この一本に入れ替えた。現在 ${E.qualityLabel(E.weaponQuality(state,d.id))}。</p>` : d.decision === 'dismantle' ? `<p class='notice'>鉄片 ${E.DISMANTLE_SCRAP} に分解した。</p>` : '';
      const actions = d.decision ? done : `<div class='choice-grid'>${button('loot-keep','この一本に入れ替える',`${E.qualityLabel(d.quality)} / 攻撃 ${foundAttack}`,{value:String(i)})}${button('loot-dismantle',`鉄片 ${E.DISMANTLE_SCRAP} に分解`,`今の一本 ${E.qualityLabel(currentQ)} / 攻撃 ${currentAttack}`,{value:String(i)})}</div>`;
      return `<div class='reward loot-compare'><span class='reward-icon'>↔</span><div><strong>${E.GEAR[d.id].name} · ${E.qualityLabel(d.quality)}</strong><small>今の一本 ${E.qualityLabel(currentQ)} / 攻撃 ${currentAttack} → 発見品 攻撃 ${foundAttack}。${compare}。</small>${actions}</div></div>`;
    }).join('')}</div>` : '';
    const homeOpportunity = state.neighborhood.result && !r.died && (state.neighborhood.result.claimed || Object.keys(N.BUILDINGS).some(id => N.canBuild(state.neighborhood,id)));
    const nextLabel = unresolved ? `同名武器をあと ${unresolved} 本整理する` : keptDuplicate ? '入れ替えた装備を確認する' : homeOpportunity ? '拠点を育てる' : hasNewBattleGear ? '持ち帰った装備を比べる' : canPowerUp ? '補強へ進む' : '焚き火で次の準備をする';
    return `<div class="game-layout report-layout"><section class="visual-column">${scene('camp',r.died ? '火は、まだ消えていない。' : 'おかえり、旅人。',r.died ? 'THE ROAD IS NOT OVER' : 'YOU MADE IT HOME')}</section><section class="panel report-panel"><div class="report-scroll"><p class='kicker'>${r.died ? 'EXPEDITION LOST' : 'SAFE RETURN'} / ${E.place(r.place).name}</p><h1>${r.died ? '命だけを、持ち帰った。' : duplicates.length ? '持ち帰った一本を、比べる。' : r.newGear.length ? '新しい一本を、火へ。' : '欲張らずに、帰る強さ。'}</h1><p class='intro'>${r.died ? defeatIntro : '背嚢の中身は、もうあなたのもの。同じ名の武器でも品質が違う。今の一本と比べて、残すか鉄片にするかを決めよう。'}</p><div class='result-number'>${r.died ? '' : '+'}${r.scrap} <small>${r.died ? '鉄片を落とした' : '鉄片を確保'}</small></div>${state.neighborhood.result ? `<div class="home-return"><strong>${state.neighborhood.result.claimed ? '⚑ '+N.title(N.get(state.neighborhood,state.neighborhood.result.id))+'を開拓！' : state.neighborhood.result.died ? '土地と拠点は残っている。' : '拠点へ建材を持ち帰った。'}</strong><p>木材 +${state.neighborhood.result.wood} · 石材 +${state.neighborhood.result.stone}</p><small>${state.neighborhood.result.claimed ? 'この土地に、あなたの旗が立つ。' : '持ち帰った建材で、拠点に建物を増やせる。'}</small></div>` : ''}${lootRows}${duplicateRows}${recovery?.scrap ? `<div class='reward'><span class='reward-icon'>↺</span><div><strong>敗走跡：鉄片 ${recovery.scrap}</strong><small>次に同じ土地へ出れば背嚢へ戻る。生還するまで未確定。</small></div></div>` : ''}${!r.died && state.owned.includes('crown') ? `<p class='notice'>灰冠の廟を越えた。名もなき旅人の、最初の物語が残った。</p>` : ''}<p class='small rule-line'>${r.died ? (recovery ? '敗走は全損ではない。取り戻しに行くか、別の土地へ向かうかを選べる。' : '遠征の失敗で、恒久的な進行は失われません。') : state.cleared.length >= 2 && !state.owned.includes('crown') ? '二つの土地を越えた。次は「灰冠の廟」の主に挑める。' : '同じ土地へ戻れば、同じ武器でももっと良い品質に出会えることがある。'}</p></div><div class="report-actions">${button('continue',r.died && recovery ? '敗走跡を回収する準備へ' : nextLabel,'',{class:'primary',disabled:unresolved > 0})}</div></section></div>`;
  }
  function render() {
    const help = document.querySelector('#help'), helpToggle = document.querySelector('#help-toggle');
    if (help && !help.hidden) { help.hidden = true; helpToggle?.setAttribute('aria-expanded', 'false'); }
    if (conflict) { root.innerHTML = '<div class="help"><h2>別のタブで旅が進んでいます。</h2><p>最新のセーブを読み直してください。</p><button class="primary" data-action="reload">再読み込み</button></div>'; return; }
    root.innerHTML = !state.mode ? onboard() : state.expedition ? expedition() : endingOpen ? ending() : state.report ? report() : camp();
    const mapWindow = root.querySelector?.('.neighborhood-field'), marker = root.querySelector?.('.district-pin.selected');
    if (mapWindow && marker) {
      mapWindow.scrollLeft = marker.offsetLeft-mapWindow.clientWidth/2;
      mapWindow.scrollTop = marker.offsetTop-mapWindow.clientHeight/2;
    }
  }
  function locationResult(coords) {
    const result = E.observe(session,coords);
    const messages = { anchored:'ここを散策の起点にしました。少し場所を変えてから、また安全に立ち止まって発見してください。', nearby:'まだ同じ土地の中です。距離を稼ぐ必要はありません。別の安全な場所へ移動した日に、また試せます。', inaccurate:'位置の精度が足りませんでした。屋外の開けた場所で再度試すか、散策体験モードで続けられます。', boundary:'土地の境目で、位置の誤差が残っています。無理に移動せず、別の安全な場所に立ち寄った時にまた確認できます。', faraway:'今の拠点から離れた地域です。この版では拠点周辺の開拓を体験できます。', moving:'移動中のようです。安全な場所で立ち止まってから再度試してください。' };
    if (result.status === 'anchored') { session.anchor = coarseAnchor(session.anchor); saveWalkAnchor(); }
    if (result.status === 'discovered') {
      const known = Boolean(N.get(state.neighborhood,result.district.id));
      state = E.discoverDistrict(state,result.district); selected = result.place;
      const poi=N.pointOfInterest(result.district); notice = known ? `${N.title(result.district)}に戻った。${poi.name}も地図に残っています。` : state.neighborhood.selected === result.district.id ? `${N.title(result.district)}を発見。さらに「${poi.name}」を見つけた。` : 'この近所の地図はいっぱいです。発見済みの土地で開拓を続けられます。';
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
    if (action === 'settings') {
      const help = document.querySelector('#help');
      help.hidden = false;
      document.querySelector('#help-toggle').setAttribute('aria-expanded','true');
      return;
    }
    const before = state;
    if (action === 'mode') { loadMode(value); save(); return; }
    if (action === 'switch-mode') { loadMode(state.mode === 'demo' ? 'walk' : 'demo'); save(); return; }
    if (action === 'district') { state = E.selectDistrict(state,value); selected = N.get(state.neighborhood).biome; tab = 'explore'; notice = ''; }
    else if (action === 'poi') { const d=N.get(state.neighborhood), poi=N.pointOfInterest(d); if (value==='gear') { tab='gear'; notice=`${poi.name}で旅支度を見直す。`; } else if (value==='depart') { selected=d.biome; lastReturnedPlace=null; prioritizeReinforcement=false; locationRequest++; busy=false; state=E.start(state,d.biome); } }
    else if (action === 'home-build') { state = E.buildHome(state,value); if (state !== before) notice = N.BUILDINGS[value].story; }
    else if (action === 'home-name') { state = E.renameHome(state,document.querySelector('#home-name').value); }
    else if (action === 'select') { selected = value; tab = 'explore'; notice = ''; lastReturnedPlace = null; prioritizeReinforcement = false; }
    else if (action === 'tab') { tab = value; notice = ''; }
    else if (action === 'scout') {
      const demoSession = E.locationSession(); E.observe(demoSession,{latitude:0,longitude:0,accuracy:5}); session = demoSession;
      const current = N.get(state.neighborhood);
      const cells = {tower:[0,Math.max(1,current.y+1)],fen:[Math.max(1,current.x+1),0],crypt:[0,Math.min(-1,current.y-1)],wood:[Math.min(-1,current.x-1),0]};
      const [dx,dy] = cells[value];
      const offsets = { [value]:[dy*N.CELL_METERS/111320,dx*N.CELL_METERS/111320] };
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
    } else if (action === 'depart') { selected = value; lastReturnedPlace = null; prioritizeReinforcement = false; locationRequest++; busy = false; state = E.start(state,value); }
    else if (action === 'equip') { state = E.equip(state,value); notice = `${E.GEAR[value].name}を装備した。`; }
    else if (action === 'maintain') { state = E.maintain(state); if (state !== before) notice = '刃を研いだ。次の遠征の最初の3戦で、初撃が +3 される。'; }
    else if (action === 'upgrade') { const id=state.equipped; state = E.upgrade(state,id); if (state !== before) { prioritizeReinforcement = false; const delta = reinforcementResult(before,state,id); const destination = lastReturnedPlace ? E.place(lastReturnedPlace)?.name : ''; notice = `${E.GEAR[id].name}を補強した。${delta}。${destination ? `${destination}で` : '次の遠征で'}試してみよう。`; } }
    else if (action === 'loot-keep') { state = E.resolveDuplicate(state,Number(value),'keep'); }
    else if (action === 'loot-dismantle') { state = E.resolveDuplicate(state,Number(value),'dismantle'); }
    else if (action === 'ending-open' && !state.expedition && !state.report && state.owned.includes('crown')) { endingOpen = true; }
    else if (action === 'ending-continue') { endingOpen = false; tab = 'explore'; notice = ''; }
    else if (action === 'continue') {
      const duplicates = state.report.duplicates || [];
      if (duplicates.some(d => !d.decision)) return;
      const hasNewBattleGear = !state.report.died && state.report.newGear.some(g => g !== 'crown');
      const keptDuplicate = !state.report.died && duplicates.some(d => d.decision === 'keep');
      const canPowerUp = !state.report.died && canReinforceEquipped();
      const canMaintain = !state.report.died && state.maintenance === 'ready';
      const gearStep = hasNewBattleGear || canPowerUp || canMaintain;
      lastReturnedPlace = gearStep ? state.report.place : null;
      prioritizeReinforcement = gearStep && !hasNewBattleGear && canPowerUp;
      const homeOpportunity = state.neighborhood.result && !state.report.died && (state.neighborhood.result.claimed || Object.keys(N.BUILDINGS).some(id => N.canBuild(state.neighborhood,id)));
      tab = homeOpportunity ? 'home' : gearStep ? 'gear' : 'explore';
      if (keptDuplicate) { lastReturnedPlace = state.report.place; prioritizeReinforcement = false; tab = 'gear'; }
      const crownEnding = !state.report.died && state.report.newGear.includes('crown');
      endingOpen = crownEnding;
      const homeResult = state.neighborhood.result;
      state = {...state,report:null}; notice = homeOpportunity ? `${homeResult.claimed ? '新しい領域を開拓した。' : ''}木材 ${homeResult.wood}・石材 ${homeResult.stone} を拠点に持ち帰った。` : '';
    }
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
