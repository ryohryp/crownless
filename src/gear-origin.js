(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.CrownlessGearOrigin = api;
    const E = root.CrownlessSlice;
    if (!E || typeof E.gearText !== 'function') return;
    const baseGearText = E.gearText.bind(E);
    E.gearText = (state, id) => {
      const text = baseGearText(state, id);
      const origin = api.originText(id);
      return origin ? `${text} · ${origin}` : text;
    };
  }
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const ORIGINS = Object.freeze({
    fang: '囁きの森から持ち帰った',
    fang_blood: '囁きの森から持ち帰った',
    fang_moon: '囁きの森から持ち帰った',
    shield: '鐘なき塔から持ち帰った',
    shield_thorn: '鐘なき塔から持ち帰った',
    shield_oath: '鐘なき塔から持ち帰った',
    bow: '星沈みの湿原から持ち帰った',
    bow_hunter: '星沈みの湿原から持ち帰った',
    bow_recurve: '星沈みの湿原から持ち帰った',
    crown: '灰冠の廟から持ち帰った',
  });
  const originText = id => ORIGINS[id] || '';
  return { ORIGINS, originText };
});
