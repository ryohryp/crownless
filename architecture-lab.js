/* Architectural experiment, NOT a second live game. No mutations of any
   persisted Crownless keys, no MutationObserver and no canvas dependency. */
(() => {
  'use strict';
  const E = window.CrownlessSlice, N = window.CrownlessNeighborhood;
  const mount = document.querySelector('#architecture-lab');
  if (!mount || !E || !N) throw new Error('Crownless core missing');
  const escape = value => String(value == null ? '' : value)
    .replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const mode = localStorage.getItem('crownless-expedition-mode') === 'walk' ? 'walk' : 'demo';
  const key = 'crownless-expedition-v1-' + mode;
  let raw = null;
  try { raw = localStorage.getItem(key); } catch { /* no persistence required */ }
  const parsed = E.parse(raw);
  const saveWasValid = parsed !== null;
  // Experiment work is intentionally in-memory. A current return report can
  // be dismissed here without changing or consuming the original save.
  let state = parsed && parsed.mode ? {...parsed, report: null} : {...E.initial(), mode:'demo'};
  const button = (action,label,kind='secondary',wide=false,disabled=false) =>
    '<button data-action="' + action + '" class="' + kind + (wide ? ' full' : '') +
    '"' + (disabled ? ' disabled' : '') + '>' + escape(label) + '</button>';

  function areaMap() {
    const districts = state.neighborhood.districts;
    const current = N.get(state.neighborhood);
    const byDistance = [...districts].sort((a,b) =>
      (Math.abs(a.x-current.x)+Math.abs(a.y-current.y)) -
      (Math.abs(b.x-current.x)+Math.abs(b.y-current.y)));
    const shown = byDistance.slice(0,7);
    const span = Math.max(2,...shown.map(d=>Math.max(Math.abs(d.x-current.x),Math.abs(d.y-current.y))));
    const pins = shown.map(d => {
      const selected = current.id===d.id;
      const changed = state.designs && state.designs.shield_thorn===d.id;
      const status = changed ? '🔔 鐘が戻った' : d.claimed ? '⚑ あなたの領域' :
        N.pointOfInterest(d).family==='shop' ? '◆ 店を発見' : '✦ 異変を発見';
      const left = Math.max(16, Math.min(84, 50+(d.x-current.x)*31/span));
      const top = Math.max(22, Math.min(80, 48-(d.y-current.y)*27/span));
      return '<button class="lab-place" data-action="select" data-value="' + escape(d.id) +
        '" aria-pressed="' + selected + '" style="left:' + left + '%;top:' + top + '%"><strong>' +
        escape(N.title(d)) + '</strong><small>' + escape(status) + '</small></button>';
    }).join('');
    return '<section class="lab-map" data-lab-map="true"><span class="eyebrow">THE DISCOVERED LANDS · 地図をタップ</span>' +
      pins + '</section>';
  }

  function scene() {
    const x=state.expedition;
    const biome=E.place(x.place);
    const description=x.stage==='fight' ? E.ENEMIES[x.enemy.kind].name :
      x.stage==='cleared' ? '主を倒した。無事に生還しよう。' : '霧の先に何がいるか、まだ分からない。';
    const glyph=x.stage==='fight' ? '⚔' : x.stage==='cleared' ? '⚑' : '♜';
    return '<section class="lab-map"><div class="lab-scene"><div class="glyph" aria-hidden="true">' +
      glyph + '</div><h2>' + escape(biome.name) + '</h2><p>' + escape(description) +
      '</p><p>HP ' + x.hp + ' / ' + E.maxHp(state) +
      ' · 背嚢の鉄片 ' + x.scrap + '</p></div></section>';
  }

  function mapCard() {
    const d=N.get(state.neighborhood), place=E.place(d.biome), poi=N.pointOfInterest(d);
    const restored=state.designs && state.designs.shield_thorn===d.id;
    const locked=d.biome==='crypt' && state.cleared.length<2;
    const status=restored ? '🔔 鐘が戻った · ユノが滞在中' :
      d.claimed ? '⚑ 開拓済み' : poi.family==='shop' ? '◆ 店を発見' : '✦ 異変を発見';
    const details=restored ?
      '鐘守の弟子・ユノが修復された鐘の音で敵の動きを知らせてくれる。' :
      poi.family==='event' ? '異変の手掛かりを追うと強敵に出会う。素材を持ち帰るには生還が必要。' :
      '発見した店では地域素材の交易ができる。';
    const alternative=restored
      ? button('bell','ユノの合図で出発','secondary',false,state.activeCharacter!==0)
      : poi.family==='event' && !locked
        ? button('clue','異変を追う','secondary',false,state.activeCharacter!==0)
        : button('scout','丘の道を試す','secondary');
    const primary=state.activeCharacter===0
      ? button('depart',locked?'王墓はまだ封鎖中':'この土地へ遠征','primary',false,locked)
      : button('traveler','旅人に切り替える','primary');
    return '<article class="lab-card" data-lab-card="true"><p class="lab-kicker">' + escape(status) +
      ' · ' + escape(place.name) + '</p><h1>' + escape(N.title(d)) +
      '</h1><p>' + escape(restored ? '鐘が戻り、旅人の帰りを知らせている。' : place.teaser) +
      '</p><div class="lab-actions">' + primary + alternative +
      '</div><details class="lab-detail"><summary>この土地の詳細を見る</summary><p>' +
      escape(details) + '</p></details></article>';
  }

  function expeditionCard() {
    const x=state.expedition, fighting=x.stage==='fight';
    const kicker=fighting?'ENCOUNTER · 次の行動を選択':x.stage==='cleared'?'SAFE RETURN?':'EXPEDITION · 生還が目標';
    const title=fighting?E.ENEMIES[x.enemy.kind].name:x.stage==='cleared'?'戦利品を持ち帰る':'最初の足跡をたどる';
    const action=fighting
      ? button('auto','決着まで任せる','primary') + button('strike','斬る','secondary')
      : x.stage==='cleared'
        ? button('return','戦利品を持って帰る','primary',true)
        : button('careful','静かに進む','primary') + button('return','ここで生還','secondary');
    return '<article class="lab-card" data-lab-card="true"><p class="lab-kicker">' + escape(kicker) +
      '</p><h1>' + escape(title) + '</h1><p>' + escape(fighting ?
        '敵の予兆を読み、必要なら防御・回避を選ぼう。' :
        '深追いせずに帰れば、背嚢の素材を確保できる。') +
      '</p><div class="lab-actions">' + action + '</div>' +
      (fighting ? '<div class="lab-actions">' + button('guard','防御','secondary') +
        button('dodge','回避','secondary') + '</div>' : '') + '</article>';
  }

  function reportCard() {
    const r=state.report;
    return '<article class="lab-card" data-lab-card="true"><p class="lab-kicker">' +
      (r.died?'EXPEDITION LOST':'SAFE RETURN') + '</p><h1>' +
      (r.died?'敗走した。もう一度、火のもとへ。':'生還した。素材は確保された。') +
      '</h1><p>鉄片 ' + (r.died?'喪失 ':'獲得 ') + r.scrap +
      ' · 元のセーブデータには反映されません。</p><div class="lab-actions">' +
      button('resume','地図へ戻る','primary',true) + '</div></article>';
  }

  function render() {
    mount.innerHTML='<div class="lab-frame"><header class="lab-head"><strong>♜ CROWNLESS · UI試作</strong>' +
      '<small>現在のゲームコア使用・試作の操作は保存されません' + (saveWasValid?'':' · 元セーブ未取得/検証失敗') +
      '</small></header>' +
      (state.expedition?scene():areaMap()) +
      (state.report?reportCard():state.expedition?expeditionCard():mapCard()) +
      '<footer class="lab-foot"><span>単一描画責任 · 独立スクロールなし</span>' +
      '<a href="expedition.html">現行ゲームに戻る ↗</a></footer></div>';
  }

  mount.addEventListener('click',event=>{
    const el=event.target.closest('button[data-action]');
    if (!el || !mount.contains(el)) return;
    const action=el.dataset.action;
    if(action==='select')state=E.selectDistrict(state,el.dataset.value);
    else if(action==='scout')state=E.discoverDistrict(state,N.cell(400,0));
    else if(action==='traveler')state=E.switchCharacter(state,0);
    else if(action==='depart')state=E.start(state,N.get(state.neighborhood).biome);
    else if(action==='clue')state=E.startWithLocalClue(state);
    else if(action==='bell')state=E.startWithBellSignal(state);
    else if(['careful','return','strike','guard','dodge'].includes(action))state=E.act(state,action);
    else if(action==='auto')state=E.resolveFight(state);
    else if(action==='resume')state={...state,report:null};
    render();
  });
  render();
})();
