(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CrownlessPredatorSigns = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const SIGNS = {
    wolf: { title: '裂けた樹皮', text: '低い位置に深い爪痕。獣は速く、間合いへ飛び込んでくる。', advice: '防御で受けるか、回避から反撃する準備を。' },
    knight: { title: '砕けた盾', text: '石壁の前に、正面から割られた盾が残る。守りの後に重い一撃が来る。', advice: '守りを固めた時は焦らず、気力を整える。' },
    wraith: { title: '消えた足跡', text: '泥の足跡が途中で途切れ、少し先からまた続く。狙いを外す動きに注意。', advice: '大振りを読んだら回避し、隙を逃さない。' },
    king: { title: '折れた長剣', text: '厚い刃が根元から折れている。主は守りから致命的な一撃へつなぐ。', advice: '重い一撃を受け切ろうとせず、回避の気力を残す。' },
  };

  function signFor(enemyKind) {
    const sign = SIGNS[enemyKind];
    return sign ? { ...sign } : null;
  }

  return { signFor };
});
