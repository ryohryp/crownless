(() => {
  'use strict';
  const Save = window.CrownlessSaveData;
  const Engine = window.CrownlessSlice;
  const help = document.querySelector('#help');
  if (!Save || !Engine || !help) return;

  const section = document.createElement('div');
  section.className = 'rule-line';
  section.innerHTML = '<strong>旅の記録</strong><p class="small">端末変更やテスト前に、セーブを文字列でバックアップできます。位置情報の基準点は含みません。</p><div class="choice-grid"><button id="save-export" class="secondary">バックアップをコピー</button><button id="save-import" class="secondary">バックアップを復元</button></div><button id="save-reset" class="text-button">旅を最初からやり直す</button><p id="save-data-status" class="small" role="status" aria-live="polite"></p>';
  help.appendChild(section);
  const status = message => { document.querySelector('#save-data-status').textContent = message; };

  document.querySelector('#save-export').addEventListener('click', async () => {
    try {
      const backup = Save.exportBackup(localStorage);
      await navigator.clipboard.writeText(backup);
      status('バックアップをコピーしました。安全な場所に保管してください。');
    } catch {
      status('コピーできませんでした。このブラウザのクリップボード許可を確認してください。');
    }
  });

  document.querySelector('#save-import').addEventListener('click', () => {
    const text = window.prompt('Crownless のバックアップ文字列を貼り付けてください。現在のセーブは上書きされます。');
    if (!text) return;
    try {
      Save.importBackup(localStorage, text, Engine.parse);
      window.alert('旅の記録を復元しました。最新の状態を読み込みます。');
      location.reload();
    } catch {
      status('バックアップを読み込めませんでした。元のセーブは変更していません。');
    }
  });

  document.querySelector('#save-reset').addEventListener('click', () => {
    if (!window.confirm('旅の記録を最初からやり直しますか？ 装備・鉄片・発見した土地が消えます。')) return;
    if (!window.confirm('この操作は取り消せません。バックアップ済みであることを確認して、すべて消去しますか？')) return;
    Save.resetJourney(localStorage);
    location.reload();
  });
})();
