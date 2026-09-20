(() => {
  'use strict';
  const E = window.CrownlessSlice;
  if (!E || E.__secretConditionLoot) return;

  const originalIntent = E.intent;
  const originalAct = E.act;

  // One bounded experiment for #651: the deep Forest lord carries a visible
  // moon-scar clue. Finishing its exposed opening with a heavy attack reveals
  // a small bonus cache; normal victory loot is unchanged when the clue is missed.
  E.intent = enemy => {
    const next = originalIntent(enemy);
    if (enemy?.kind === 'wolf' && enemy.elite && enemy.depth >= 2 && next.id === 'open') {
      return {
        ...next,
        help: `${next.help} 月色の傷が開く。ここを強撃で断てば、何かこぼれそうだ。`,
      };
    }
    return next;
  };

  E.act = (state, action) => {
    const x = state?.expedition;
    const enemy = x?.enemy;
    const next = enemy ? originalIntent(enemy) : null;
    const secretFinish = action === 'heavy'
      && enemy?.kind === 'wolf'
      && enemy.elite
      && enemy.depth >= 2
      && next?.id === 'open'
      && E.attackPreview(state, action) >= enemy.hp;

    const result = originalAct(state, action);
    if (!secretFinish || result === state) return result;

    const after = result?.expedition;
    if (!after || after.stage !== 'cleared' || after.enemy) return result;
    after.scrap += 8;
    after.log.push('月色の傷から《月牙の欠片》がこぼれた。鉄片 +8。隙を強撃で断った者だけが見つける戦利品だ。');
    return result;
  };

  E.__secretConditionLoot = true;
})();
