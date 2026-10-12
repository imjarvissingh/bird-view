/* birds view · entity store: per-layer ring buffers, selection, visibility, watchlist, metrics */
(function () {
  const BV = (window.BV = window.BV || {});
  const DEFAULT_CAP = 600;

  const byLayer = new Map(); // id -> { map: Map(id->rec), order: [], cache: array|null }
  const state = {
    selected: null,       // { layer, id }
    country: null,        // { name, feature } when a country is focused instead of an entity
    watch: [],            // [{ layer, id, label }]
    paused: false,
    speed: 1,
    totals: {},           // layer -> count since start
    history: [],          // events per second, last 90 seconds
    secBucket: 0,
  };

  function bucket(layer) {
    if (!byLayer.has(layer)) byLayer.set(layer, { map: new Map(), order: [], cache: null });
    return byLayer.get(layer);
  }
  const pinned = (id) => (state.selected && state.selected.id === id) || state.watch.some((w) => w.id === id);

  const store = {
    state,
    add(rec, opts) {
      const b = bucket(rec.layer);
      const existed = b.map.has(rec.id);
      b.map.set(rec.id, rec);
      if (!existed) {
        b.order.push(rec.id);
        b.cache = null;
        const L = BV.layer(rec.layer);
        const cap = (L && L.cap) || DEFAULT_CAP;
        // evict the oldest unpinned records beyond the cap
        let guard = b.order.length;
        while (b.order.length > cap && guard-- > 0) {
          const old = b.order.shift();
          if (pinned(old)) b.order.push(old);
          else b.map.delete(old);
        }
      }
      if (!opts || !opts.silent) {
        state.totals[rec.layer] = (state.totals[rec.layer] || 0) + 1;
        state.secBucket++;
        BV.bus.emit('record:new', rec);
      }
      return rec;
    },
    remove(layer, id) {
      const b = byLayer.get(layer);
      if (!b || !b.map.has(id)) return;
      if (pinned(id)) { const r = b.map.get(id); r.ended = true; return; } // keep for the analyst, marked ended
      b.map.delete(id);
      const i = b.order.indexOf(id);
      if (i >= 0) b.order.splice(i, 1);
      b.cache = null;
      BV.bus.emit('record:remove', { layer, id });
    },
    get(layer, id) { const b = byLayer.get(layer); return b ? b.map.get(id) : undefined; },
    all(layer) {
      const b = byLayer.get(layer);
      if (!b) return [];
      if (!b.cache) b.cache = b.order.map((id) => b.map.get(id)).filter(Boolean);
      return b.cache;
    },
    count(layer) { const b = byLayer.get(layer); return b ? b.map.size : 0; },
    total() { let n = 0; for (const b of byLayer.values()) n += b.map.size; return n; },
    find(pred) {
      const out = [];
      for (const [layer, b] of byLayer) for (const rec of b.map.values()) if (pred(rec, layer)) out.push(rec);
      return out;
    },

    select(ref, opts) {
      state.selected = ref && ref.layer ? { layer: ref.layer, id: ref.id } : null;
      if (state.selected) state.country = null;
      BV.bus.emit('select', { ref: state.selected, opts: opts || {} });
    },
    selected() { return state.selected ? store.get(state.selected.layer, state.selected.id) : null; },
    selectCountry(c, opts) {
      state.country = c || null;
      state.selected = null;
      BV.bus.emit('select', { ref: null, country: state.country, opts: opts || {} });
    },

    setVisible(layerId, on) {
      const l = BV.layer(layerId);
      if (!l) return;
      l.visible = on === undefined ? !l.visible : !!on;
      BV.bus.emit('layers:change', l);
    },

    isWatched(ref) { return state.watch.some((w) => w.layer === ref.layer && w.id === ref.id); },
    toggleWatch(rec) {
      const i = state.watch.findIndex((w) => w.layer === rec.layer && w.id === rec.id);
      if (i >= 0) state.watch.splice(i, 1);
      else state.watch.unshift({ layer: rec.layer, id: rec.id, label: BV.layer(rec.layer).title(rec) });
      BV.bus.emit('watch:change', state.watch);
    },

    setPaused(p) { state.paused = p === undefined ? !state.paused : !!p; BV.bus.emit('pause', state.paused); },
    setSpeed(s) { state.speed = s; BV.bus.emit('speed', s); },

    // Called once a second by the app to roll the events/sec history.
    rollSecond() {
      state.history.push(state.secBucket);
      state.secBucket = 0;
      if (state.history.length > 90) state.history.shift();
      BV.bus.emit('metrics', state);
    },
  };

  BV.store = store;
})();
