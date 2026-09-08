(function () {
  'use strict';
  const base = window.CrownlessRebootState;
  const p2 = window.CrownlessRebootPhase2State;
  const p3 = window.CrownlessRebootPhase3State;
  const p4 = window.CrownlessRebootPhase4State;
  const p5 = window.CrownlessRebootPhase5State;
  const $ = selector => document.querySelector(selector);
  const journal = $('#chapter-journal');
  const ending = $('#chapter-ending');
  const places = $('#chapter-places');
  let entries = [];
  let selected = null;
  const epilogues = {
    black_cargo_market: ['鐘の音より遠くまで', '夜の市で、旅人が黒い荷札を裏返す。「塔にいたのは、あなただろう」。あなたが残した合図と、通り抜けた荷。誰も命じなかった市が、その二つから生まれた。'],
    dead_end_market: ['道が閉じても、人は残る', '立ち往生した荷車の間に、小さな火がともる。「ここで夜を越そう」。あなたが知らせた危険は道を閉ざした。その傍らで、人々は新しい居場所を作り始めた。'],
    canvas_market: ['屋根のない者たちの屋根', '誰かが裂けた布の端を支えている。「塔から来た人も、ここにいる」。あなたが選んだ道と、選ばなかった谷。その両方が、この継ぎ接ぎの屋根を作った。'],
    salt_lantern_market: ['閉じた扉の先の灯り', '塩袋の横で、渡し守が灯芯を切る。「戻れないなら、ここを明るくしよう」。封じた扉と開いた道から、小さな市の灯りが生まれた。']
  };
  function remember(id) {
    const entry = entries.find(item => item.id === id);
    if (!entry) return;
    selected = id;
    $('#chapter-memory').hidden = false;
    $('#chapter-memory-title').textContent = entry.title;
    $('#chapter-memory-copy').textContent = entry.copy;
    $('#reboot-map').dataset.memory = id;
    for (const button of places.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.memory === id));
  }
  function refresh() {
    const world = p5.parseState(window.CrownlessRebootStorage.getItem(p5.STORAGE_KEY));
    entries = [];
    const tower = base.getOutcomePresentation(world);
    if (tower) entries.push({ id: base.BELL_TOWER, title: tower.towerTitle, copy: `${tower.towerSummary} ${tower.consequenceLead} ${tower.consequenceHook}` });
    const crossing = p2.getCrossingOutcomePresentation(world);
    if (crossing) entries.push({ id: p2.OLD_CROSSING, title: crossing.crossingTitle, copy: `${crossing.crossingSummary} ${crossing.hillLead} ${crossing.hillHook}` });
    const hill = p3.getHillOutcomePresentation(world);
    if (hill) entries.push({ id: p3.BLACK_RAVEN_HILL, title: hill.hillTitle, copy: `${hill.hillSummary} ${hill.chapel.hook} ${hill.gate.hook}` });
    const fork = p4.getFirstVisitPresentation(world);
    if (fork) {
      entries.push({ id: fork.visited.id, title: fork.visited.title, copy: fork.visited.text });
      entries.push({ id: fork.unvisited.id, title: `${fork.unvisited.title}（未訪問）`, copy: `あなたが訪れていない間の変化：${fork.unvisited.text}` });
    }
    const collision = p5.getCollisionPresentation(world);
    if (collision) entries.push({ id: collision.id, title: collision.title, copy: `${collision.summary} ${collision.history}` });
    journal.hidden = !entries.length;
    places.replaceChildren(...entries.map(entry => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ink-button quiet-action';
      button.dataset.memory = entry.id;
      button.textContent = entry.title;
      return button;
    }));
    if (selected) remember(selected);
    ending.hidden = !collision;
    if (collision) {
      const [title, copy] = epilogues[collision.state];
      $('#chapter-ending-title').textContent = title;
      $('#chapter-ending-copy').textContent = copy;
      $('#collision-summary').hidden = true;
      $('#fork-summary').hidden = true;
      document.body.dataset.chapter = 'complete';
    }
  }
  places.addEventListener('click', event => {
    const button = event.target.closest('button[data-memory]');
    if (button) remember(button.dataset.memory);
  });
  document.addEventListener('click', event => {
    if (event.target.closest('button[data-choice], button[data-place], #dev-walk-collision')) queueMicrotask(refresh);
  });
  document.addEventListener('reboot-chapter-arrived', refresh);
  refresh();
})();
