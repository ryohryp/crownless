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
    return `<div class="scene">${A.scene(id, enemy, state.equipped)}<span class="scene-top">${enemy ? 'HOLD YOUR GROUND' : 'BEYOND THE MIST'}</span>${tag ? `<span class="scene-tag">${tag}</span>` : ''}<div class="scene-caption"><p class="kicker">${subtitle}</p><h2>${title}</h2></div></div>`;
  }
  const logs = x => `<div class="combat-log" role="status" aria-live="polite">${x.log.map(v => `<p>${esc(v)}</p>`).join('')}</div>`;
  const ledger = x => `<div class="loot-ledger"><p class="kicker">AT RISK · 生還で確定</p><strong>${x.scrap}</strong> <small>鉄片 / 背嚢の中</small>${x.gear.map(g => `<p>＋ ${E.GEAR[g].name}</p>`).join('')}</div>`;
  function onboard() {
    return `<div class="game-layout onboard"><section class="visual-column">${scene('camp','まだ、名もなき旅人。','A FIRE WORTH RETURNING TO')}<div class="journey-note"><b>01</b><span>霧の先には、まだ知らない場所。<br>その手の戦利品を、この火まで持ち帰ろう。</span></div></section><section class="panel"><p class="kicker">A SMALL JOURNEY. SOMETHING TO LOSE.</p><h1>霧の向こうへ。<br>生きて、帰ろう。</h1><p class="intro">欠けた剣と、ふた束の薬草。<br>あなたの旅は、それだけで始まる。<br>踏み込むか、引き返すか。<br>持ち帰った一本の剣が、次の旅を変える。</p><div class="button-stack">${button('mode','まずは体験する <span>約 15 分</span>','',{class:'primary',value:'demo'})}${button('mode','現実の散策で発見する','',{class:'secondary',value:'walk'})}</div><p class="small rule-line">体験モードは、室内で移動を再現します。<br>散策モードは、安全に立ち止まって現在地を確認。<br>位置情報を送信せず、移動履歴も残しません。</p></section></div>`;
  }
  function mapPins() {
    return `<div class="places" aria-label="発見した土地の模式図">${E.PLACES.map(p => `<button class="place-pin ${selected === p.id ? 'selected' : ''} ${state.unlocked.includes(p.id) ? '' : 'locked'}" data-action="select" data-value="${p.id}" aria-pressed="${selected === p.id}">${A.icon(p.id)}<span>${state.unlocked.includes(p.id) ? p.name : '霧の向こう'}</span></button>`).join('')}</div><p class="atlas-note">${state.unlocked.length} / 4 の土地を発見 · 架空の模式図。現実の目的地案内ではありません。</p>`;
  }
  function scouting() {
    return `<div class="discovery"><p>${state.mode === 'demo' ? '散策を体験する — 歩く道で出会う土地が変わる。' : '画面を閉じて散策し、安全に止まれる場所で発見する。'}</p>${state.mode === 'demo' ? `<div class="choice-grid">${button('scout','丘の道を歩いた','',{value:'tower'})}${button('scout','水辺の道を歩いた','',{value:'fen'})}${button('scout','南の小道を歩いた','',{value:'crypt'})}${button('scout','森の道を歩いた','',{value:'wood'})}</div>` : `${button('gps',busy ? '現在地を確認中…' : session.anchor ? '立ち止まった場所で発見する' : 'ここを散策の起点にする','',{class:'secondary',disabled:busy})}<p class="small" style="margin-top:10px">最初の観測点からおよそ 150〜270 m 離れた広い領域で土地を発見。距離の累積報酬はありません。無理に移動せず、後日でも続けられます。</p>`}${notice ? `<p class="notice" role="status">${esc(notice)}</p>` : ''}</div>`;
  }
  function explorePanel() {
    const p = E.place(selected), unlocked = state.unlocked.includes(p.id), locked = p.id === 'crypt' && state.cleared.length < 2;
    return `<p class="kicker">${unlocked ? p.terrain : 'UNDISCOVERED'}</p><h2>${unlocked ? p.name : 'まだ、霧の向こう。'}</h2><p class="intro">${unlocked ? p.subtitle : 'いつもと違う道を歩くと、別の土地に出会えるかもしれない。発見した場所には、あとから何度でも遠征できる。'}</p>${unlocked ? `<div class="reward"><span class="reward-icon">♢</span><div><strong>${p.reward}</strong><small>${p.hint}</small></div></div><p class="small">5 つの場面 / 戦闘 3 回 / 休息 2 回<br>${p.id === 'crypt' ? '危険度：高い。装備と体力を整えてから。' : '初回は 3〜5 分。戦闘の合間はいつでも帰還。'}</p>${state.cleared.includes(p.id) ? '<span class="badge">踏破済み · 深層でさらに鉄片を集められる</span>' : ''}<div class="button-stack">${button('depart',locked ? `他の土地をあと ${2-state.cleared.length} か所踏破する` : 'この土地へ遠征する','',{class:'primary',value:p.id,disabled:locked})}</div>` : ''}${scouting()}`;
  }
  function gearPanel() {
    const id = state.equipped, level = E.weaponLevel(state,id), cost = E.upgradeCost(state,id);
    return `<p class="kicker">MAKE IT HOME. MAKE IT YOURS.</p><h2>次の旅の、戦い方。</h2><p class="small">装備は生還して初めて手に入る。補強は武器ごとに残り、持ち替えても他の武器は強くならない。</p><div class="gear-list">${state.owned.filter(g => g !== 'crown').map(g => button('equip',`${E.GEAR[g].name}${state.equipped === g ? ' · 装備中' : ''} · 補強 ${E.weaponLevel(state,g)}/4`,E.gearText(state,g),{value:g,class:`choice ${state.equipped === g ? 'selected' : ''}`})).join('')}</div>${state.owned.includes('crown') ? '<p class="badge">灰の王冠 · 永続で最大体力 +6</p>' : ''}<div class="rule-line"><div class="section-heading"><h3 style="margin:0">${E.GEAR[id].name}を補強する</h3><span class="small">${level} / 4</span></div><p class="small">この武器の得意行動だけが一段強くなる。</p>${button('upgrade',level >= 4 ? 'この武器の補強を終えた' : `鉄片 ${cost} で補強する`,'',{class:'secondary',disabled:level >= 4 || state.scrap < cost})}${notice ? `<p class="notice" role="status">${esc(notice)}</p>` : ''}</div>`;
  }
  function camp() {
    return `<div class="game-layout"><section class="visual-column"><div class="mode-strip"><span class="mode-pill">${state.mode === 'demo' ? '散策体験モード' : '現実の散策モード'}</span><span>遠征 ${state.runs} 回 · 生還 ${state.victories} 回</span></div>${scene('camp','帰りを待つ火。','THE LAST HEARTH',null,'安全な拠点')}${mapPins()}<div class="stat-strip"><div class="stat">最大体力<b>${E.maxHp(state)}</b></div><div class="stat">手元の鉄片<b>${state.scrap}</b></div><div class="stat">装備<b><em>${E.GEAR[state.equipped].name}</em></b></div></div></section><section class="panel"><nav class="camp-tabs" aria-label="拠点">${button('tab','遠征先','',{class:tab === 'explore' ? 'active' : '',value:'explore'})}${button('tab','装備と補強','',{class:tab === 'gear' ? 'active' : '',value:'gear'})}</nav>${tab === 'gear' ? gearPanel() : explorePanel()}<button class="text-button" data-action="switch-mode">${state.mode === 'demo' ? '現実の散策モードへ' : '散策体験モードへ'} <span aria-hidden="true">↗</span></button></section></div>`;
  }
  function vitals(x) {
    return `<div class="vitals"><div><div class="hp-row"><span>あなたの体力</span><strong class="${x.hp < 10 ? 'danger' : ''}">${x.hp} <small class="small">/ ${E.maxHp(state)}</small></strong></div><div class="bar" role="meter" aria-label="あなたの体力" aria-valuenow="${x.hp}" aria-valuemin="0" aria-valuemax="${E.maxHp(state)}"><span style="width:${100*x.hp/E.maxHp(state)}%"></span></div></div><div><span class="small">気力 · ${x.stamina} / 3</span><div class="stamina" aria-hidden="true">${'◆'.repeat(x.stamina)}<span class="empty">${'◇'.repeat(3-x.stamina)}</span></div></div></div>`;
  }
  function route(x) {
    return `<div class="route" aria-label="遠征の進み具合">${['足跡','灯り','狩場','遺品','土地の主'].map((v,i) => `<span class="route-step ${i === x.room ? 'current' : i < x.room ? 'done' : ''}"><i>${i < x.room ? '✓' : i+1}</i>${v}</span>`).join('')}</div>`;
  }
  function fight(x) {
    const e = x.enemy, next = E.intent(e), profile = E.combatProfile(state), attack = E.GEAR[state.equipped].attack + x.focus;
    const hit = amount => Math.max(0, amount - (next.id === 'guard' ? 5 : 0));
    const strong = profile.pierce ? attack + profile.heavyBonus : hit(attack + profile.heavyBonus);
    return `<p class="kicker">${e.elite ? 'GUARDIAN' : 'ENCOUNTER'} / ${E.GEAR[state.equipped].name}</p><div class="hp-row"><h2 style="margin:0">${e.elite ? '主・' : ''}${E.ENEMIES[e.kind].name}</h2><span>${e.hp} <small class="small">/ ${e.maxHp}</small></span></div><div class="bar enemy-bar" role="meter" aria-label="敵の体力" aria-valuenow="${e.hp}" aria-valuemin="0" aria-valuemax="${e.maxHp}"><span style="width:${e.hp/e.maxHp*100}%"></span></div><div class="intent"><p class="kicker">次の行動 · 行動を選ぶまで時間は進まない</p><span class="damage">${next.damage ? next.damage : '—'}</span><strong>${next.name}</strong><small>${next.help}</small></div><div class="choice-grid">${button('strike',`${state.equipped === 'bow' ? '射る' : '斬る'} <span class="cost">${hit(attack)}</span>`,'気力 +1 / 表示は与えるダメージ')}${button('heavy',`強撃 <span class="cost">${strong}</span>`,'気力 −2 / 大きな一撃',{disabled:x.stamina < 2})}${button('guard','防御',`気力 +1 / ${profile.counter ? `${profile.block} 軽減・${profile.counter} 反撃` : `${profile.block} ダメージ軽減`}`)}${button('dodge','回避',`気力 −1 / 無傷・次の攻撃 +${profile.dodgeFocus}`,{disabled:x.stamina < 1})}</div>${logs(x)}<div class="combat-foot">${button('heal',`薬草 ${x.potions} · 体力 +12`,'敵も行動する',{class:'choice',disabled:x.potions === 0 || x.hp === E.maxHp(state)})}${button('flee',`撤退 · 体力 −${Math.max(2,next.damage)}`,x.hp <= Math.max(2,next.damage) ? '生還できない' : '残れば戦利品を持ち帰れる',{class:'choice',disabled:x.hp <= Math.max(2,next.damage)})}</div><p class="small" style="margin:12px 0 0">背嚢：鉄片 ${x.scrap}${x.gear.length ? ' / 装備 '+x.gear.length+' 個' : ''} · 生還で確定${x.focus ? ` / 追撃 +${x.focus}` : ''}</p>`;
  }
  function pathPanel(x) {
    const event = [1,3].includes(x.room), clear = x.stage === 'cleared';
    const title = clear ? (x.place === 'crypt' ? '灰の冠は、あなたの手に。' : '土地の主を越えた。') : event ? (x.room === 1 ? '消えかけの灯り。' : '茨の奥に、銀の光。') : x.room === 4 ? 'この先に、主がいる。' : x.room === 0 ? '最初の足跡をたどる。' : '奥から、息づかい。';
    return `<p class="kicker">${clear ? 'A WAY HOME' : 'ONE MORE ROOM?'}</p><h2>${title}</h2><p class="intro">${clear ? '手に入れたものを、焚き火へ。まだ余力があるなら、より危険な深層へ進むこともできる。' : event ? '息を整えるか、傷を引き受けて遺品を拾うか。引き返す道も、まだ残っている。' : x.room === 4 ? `この土地の主が「${E.place(x.place).reward}」を守っている。持ち帰れば次の旅が変わる。` : '静かな道をたどるか、宝の気配を追うか。深く踏み込むほど、背嚢を失うことが怖くなる。'}</p>${ledger(x)}<div class="button-stack">${clear ? `${button('return','戦利品を持って生還する','',{class:'primary'})}${x.depth < 3 ? `<p class="notice">奥から、砕けた装具と濃い鉄の匂い。何があるかは、まだ分からない。</p>${button('deeper',`深層 ${x.depth+1} へ踏み込む`,`回復なし / 敵が強化 / 鉄片の基本報酬 ×${x.depth+1}`)}` : '<p class="small">最深部へ到達した。火のもとへ帰ろう。</p>'}` : event ? `${button('rest','火のそばで休む','体力 +6 / 遺品は残す')}${button('search',`茨の遺品を拾う`,`体力 −4 / 鉄片 +${5*x.depth}`,{disabled:x.hp <= 4})}` : `${button('careful',x.room === 4 ? '主に挑む' : '静かに足跡をたどる','通常の敵 / 体力を温存したい')}${button('risky','宝の気配を追う','敵の体力 +3 / 鉄片 +3')}`}</div>${logs(x)}${!clear ? `${button('return','ここで生還する','',{class:'secondary'})}<div class="combat-foot">${button('heal',`薬草を使う（残り ${x.potions}）· 体力 +12`,'',{class:'text-button',disabled:x.potions === 0 || x.hp === E.maxHp(state)})}<span class="small">安全に使える</span></div>` : ''}`;
  }
  function expedition() {
    const x = state.expedition, p = E.place(x.place), isFight = x.stage === 'fight';
    return `<div class="game-layout ${isFight ? 'battle-layout' : ''}"><section class="visual-column">${scene(x.place,p.name,`DEPTH ${String(x.depth).padStart(2,'0')} · ${x.stage === 'cleared' ? '踏破' : `${x.room+1} / 5`}`,x.enemy?.kind,`${E.GEAR[state.equipped].name}`)}${route(x)}${vitals(x)}<div class="journey-note"><b>${String(x.depth).padStart(2,'0')}</b><span>深層 ${x.depth} · 戦利品を失っても、持ち込んだ装備は残る。<br>現実に拠点まで戻る必要はありません。</span></div></section><section class="panel">${isFight ? fight(x) : pathPanel(x)}</section></div>`;
  }
  function report() {
    const r = state.report;
    return `<div class="game-layout"><section class="visual-column">${scene('camp',r.died ? '火は、まだ消えていない。' : 'おかえり、旅人。',r.died ? 'THE ROAD IS NOT OVER' : 'YOU MADE IT HOME')}</section><section class="panel"><p class="kicker">${r.died ? 'EXPEDITION LOST' : 'SAFE RETURN'} / ${E.place(r.place).name}</p><h1>${r.died ? '命だけを、持ち帰った。' : r.newGear.length ? '次は、違う戦い方で。' : '欲張らずに、帰る強さ。'}</h1><p class="intro">${r.died ? '背嚢の中身は霧の中へ。手元の鉄片と装備は無事だ。敵の予兆を読み、次は早めに帰ろう。' : '背嚢の中身は、もうあなたのもの。傷を癒やし、薬草を補充した。新しい準備で、霧の向こうへ。'}</p><div class="result-number">${r.died ? '−' : '+'}${r.scrap} <small>${r.died ? '鉄片を失った' : '鉄片を確保'}</small></div>${r.gear.map(g => `<div class="reward"><span class="reward-icon">♢</span><div><strong>${r.died ? '失った：' : ''}${E.GEAR[g].name}</strong><small>${r.died ? 'もう一度、土地の主に挑もう。' : E.gearText(state,g)}</small></div></div>`).join('')}${!r.died && state.owned.includes('crown') ? '<p class="notice">灰冠の廟を越えた。名もなき旅人の、最初の物語が残った。</p>' : ''}<div class="button-stack">${button('continue',r.newGear.some(g => g !== 'crown') ? '持ち帰った装備を試す' : '焚き火で次の準備をする','',{class:'primary'})}</div><p class="small rule-line">${r.died ? '遠征の失敗で、恒久的な進行は失われません。' : state.cleared.length >= 2 && !state.owned.includes('crown') ? '二つの土地を越えた。次は「灰冠の廟」の主に挑める。' : '別の道を歩けば、別の土地と装備に出会えます。'}</p></section></div>`;
  }
  function render() {
    if (conflict) { root.innerHTML = '<div class="help"><h2>別のタブで旅が進んでいます。</h2><p>最新のセーブを読み直してください。</p><button class="primary" data-action="reload">再読み込み</button></div>'; return; }
    root.innerHTML = !state.mode ? onboard() : state.expedition ? expedition() : state.report ? report() : camp();
  }
  function locationResult(fix) {
    const result = E.observe(session, fix);
    const messages = { inaccurate:'位置の精度が足りません。進行は変わっていません。安全な場所で後ほど試してください。', moving:'移動中のようです。安全に立ち止まってから試してください。', anchored:'ここを今回の起点にしました。次の安全な立ち止まり場所で、別の土地を探せます。', nearby:'起点の近くです。この地域の森はすでに発見済み。別の機会に違う道を散策してみましょう。' };
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