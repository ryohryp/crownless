(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CrownlessRebootSession = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function createStorage(getStorage) {
    const memory = new Map();
    let available = true;
    return {
      get available() { return available; },
      getItem(key) {
        if (memory.has(key)) return memory.get(key);
        try { return getStorage().getItem(key); }
        catch (_) { available = false; return null; }
      },
      setItem(key, value) {
        memory.set(key, value);
        try { getStorage().setItem(key, value); available = true; }
        catch (_) { available = false; }
      }
    };
  }
  function locationErrorMessage(error) {
    if (error && error.code === 1) return '位置情報が許可されていない。設定で許可して再試行するか、模擬探索で続けられる。';
    if (error && error.code === 2) return '現在地を取得できない。安全な場所で再試行するか、模擬探索で続けられる。';
    if (error && error.code === 3) return '現在地の取得がタイムアウトした。安全な場所でもう一度試せる。';
    if (error && error.code === 4) return '位置情報の精度が低いため、まだ発見を確定していない。安全な場所で再確認しよう。';
    return '現在地を確認できなかった。安全な場所で再試行できる。';
  }
  function createLocationReader(getGeolocation, timers) {
    const clock = timers || { setTimeout, clearTimeout };
    let pending = null;
    function cancel() {
      if (!pending) return;
      const old = pending;
      pending = null;
      clock.clearTimeout(old.timer);
      old.busy(false);
    }
    function request(success, failure, busy = () => {}) {
      if (pending) return false;
      const job = { busy };
      pending = job;
      busy(true);
      function finish(error, position) {
        if (pending !== job) return;
        pending = null;
        clock.clearTimeout(job.timer);
        busy(false);
        if (error) return failure(error);
        const c = position && position.coords;
        if (!c || !Number.isFinite(c.latitude) || Math.abs(c.latitude) > 90
          || !Number.isFinite(c.longitude) || Math.abs(c.longitude) > 180) return failure({ code: 2 });
        if (Number.isFinite(c.accuracy) && (c.accuracy < 0 || c.accuracy > 100)) return failure({ code: 4 });
        try { success(position); } catch (error) { failure(error); }
      }
      job.timer = clock.setTimeout(() => finish({ code: 3 }), 12000);
      try {
        const geo = getGeolocation();
        if (!geo || typeof geo.getCurrentPosition !== 'function') finish({ code: 2 });
        else geo.getCurrentPosition(position => finish(null, position), error => finish(error),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
      } catch (error) { finish(error); }
      return true;
    }
    return { request, cancel, get pending() { return Boolean(pending); } };
  }
  return { createStorage, createLocationReader, locationErrorMessage };
});
if (typeof window !== 'undefined' && window.document) {
  window.CrownlessRebootStorage = window.CrownlessRebootSession.createStorage(() => window.localStorage);
  window.CrownlessRebootLocation = window.CrownlessRebootSession.createLocationReader(() => navigator.geolocation);
  document.addEventListener('click', event => {
    if (event.target.closest('#start-sim, #dev-walk-next, #dev-walk-hill, #dev-walk-collision, button[data-move], button[data-place]')) window.CrownlessRebootLocation.cancel();
  }, true);
  const note = document.querySelector('#persistence-note');
  const warning = '保存を利用できないため、このタブ内だけで続けている。閉じたり再読み込みすると今回の変化は失われる。';
  if (note) new MutationObserver(() => {
    if (!window.CrownlessRebootStorage.available && note.textContent !== warning) note.textContent = warning;
  }).observe(note, { childList: true });
}
