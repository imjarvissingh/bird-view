/* birds view · tiny pub/sub bus */
(function () {
  const BV = (window.BV = window.BV || {});
  const subs = new Map();
  BV.bus = {
    on(evt, fn) {
      if (!subs.has(evt)) subs.set(evt, new Set());
      subs.get(evt).add(fn);
      return () => subs.get(evt).delete(fn);
    },
    emit(evt, payload) {
      const s = subs.get(evt);
      if (!s) return;
      for (const fn of s) {
        try { fn(payload); } catch (e) { console.error('[bus]', evt, e); }
      }
    },
  };
})();
