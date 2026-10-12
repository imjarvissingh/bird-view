/* birds view · live feed engine.
   Layers registered with `live: true` pull real public data instead of being simulated.
   Each one provides poll(api) -> Promise<records[]>; this module schedules polls, merges
   records into the store (keeping object identity so selection, trails and the watchlist
   survive refreshes), expires stale ones, tracks feed health and, when a source can't be
   reached, switches on the simulated layer named in `fallback` so the globe never goes dark. */
(function () {
  const BV = (window.BV = window.BV || {});
  const FAILS_BEFORE_FALLBACK = 1;

  // fetch with timeout + latency measurement. Throws on network errors and non-2xx.
  async function request(url, opts) {
    opts = opts || {};
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t0 = performance.now();
    const timer = setTimeout(() => ctl && ctl.abort(), opts.timeout || 15000);
    try {
      const res = await fetch(url, { signal: ctl && ctl.signal, cache: 'no-store', credentials: 'omit', headers: opts.headers });
      if (!res.ok) { const e = new Error('HTTP ' + res.status); e.status = res.status; throw e; }
      const body = opts.text ? await res.text() : await res.json();
      return { body, ms: Math.round(performance.now() - t0) };
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('timed out');
      throw err;
    } finally { clearTimeout(timer); }
  }

  const live = {
    enabled: typeof fetch === 'function',
    fetchJSON: (url, o) => request(url, o).then((r) => (live.lastMs = r.ms, r.body)),
    fetchText: (url, o) => request(url, Object.assign({ text: true }, o)).then((r) => (live.lastMs = r.ms, r.body)),
    lastMs: 0,
    // small helpers layers share
    cache: {
      get(key, maxAgeMs) {
        try {
          const raw = localStorage.getItem('birdsview.cache.' + key);
          if (!raw) return null;
          const o = JSON.parse(raw);
          return Date.now() - o.t < maxAgeMs ? o.v : null;
        } catch (e) { return null; }
      },
      set(key, v) { try { localStorage.setItem('birdsview.cache.' + key, JSON.stringify({ t: Date.now(), v })); } catch (e) { /* quota or disabled */ } },
    },
    feeds: () => BV.layers.filter((L) => L.live).map((L) => BV.server.feeds.get(L.id)),
    liveCount: () => live.feeds().filter((f) => f.status === 'live').length,
  };

  function feedFor(L) {
    return { id: L.id, live: true, status: 'connecting', latency: 0, baseLatency: 0, lastTs: 0, received: 0, fails: 0, source: L.source || '', error: '', nextAt: 0, fellBack: false };
  }

  function setStatus(feed, status, error) {
    const changed = feed.status !== status;
    feed.status = status; feed.error = error || '';
    if (changed) BV.bus.emit('feed:status', feed);
  }

  // merge a batch of records into the store
  function apply(L, recs, initial) {
    const now = Date.now();
    const seen = new Set();
    let added = 0;
    for (const r of recs) if (r && !r.ts) r.ts = now;
    const silentBefore = initial ? recs.slice().sort((a, b) => b.ts - a.ts)[Math.min(recs.length - 1, 7)] : null;
    for (const r of recs) {
      if (!r || r.lat === undefined || !isFinite(r.lat) || !isFinite(r.lon)) continue;
      r.layer = L.id; r.live = true; r._seen = now;
      seen.add(r.id);
      const cur = BV.store.get(L.id, r.id);
      if (cur) {
        if (L.merge) L.merge(cur, r); else Object.assign(cur, r);
        cur._seen = now; cur.lag = live.lastMs; cur.ended = false;
      } else {
        r.ts = r.ts || now; r.lag = live.lastMs;
        // on first load only the newest few reach the event stream; the rest arrive quietly
        BV.store.add(r, { silent: !!(silentBefore && r.ts < silentBefore.ts) });
        added++;
      }
    }
    // expire: snapshot feeds drop what the source no longer lists; others age out
    for (const cur of BV.store.all(L.id).slice()) {
      const gone = L.snapshot ? !seen.has(cur.id) : false;
      const stale = L.ttl && now - cur._seen > L.ttl;
      const old = L.maxAge && now - cur.ts > L.maxAge;
      if (gone || stale || old) BV.store.remove(L.id, cur.id);
    }
    return added;
  }

  function fallBack(L, feed) {
    if (feed.fellBack || !L.fallback) return;
    feed.fellBack = true;
    const sims = [].concat(L.fallback).map(BV.layer).filter(Boolean);
    sims.forEach((s) => BV.store.setVisible(s.id, true));
    BV.toast(L.label + ' unreachable right now, showing simulated ' + sims.map((s) => s.short.toLowerCase()).join(' + ') + ' instead');
  }

  async function run(L, opts) {
    const feed = BV.server.feeds.get(L.id);
    if (feed.busy) return;
    feed.busy = true;
    const initial = feed.received === 0;
    try {
      const recs = await L.poll(live, opts || {});
      feed.latency = live.lastMs; feed.lastTs = Date.now(); feed.fails = 0;
      if (Array.isArray(recs)) { apply(L, recs, initial); feed.received += recs.length; }
      setStatus(feed, 'live');
      if (feed.fellBack) { // the real source is back: retire the simulated stand-in
        feed.fellBack = false;
        [].concat(L.fallback || []).forEach((id) => BV.store.setVisible(id, false));
        BV.toast(L.label + ' is live again');
      }
      feed.nextAt = Date.now() + (L.interval || 60000);
    } catch (err) {
      feed.fails++;
      console.warn('[birds view] ' + L.id + ' poll failed:', err && err.message);
      const hasData = BV.store.count(L.id) > 0;
      setStatus(feed, hasData ? 'degraded' : 'offline', err && err.message);
      if (!hasData && feed.fails >= FAILS_BEFORE_FALLBACK) fallBack(L, feed);
      // back off: 15s, 30s, 60s … capped at the layer interval (min 2 min)
      const back = Math.min(Math.max(L.interval || 60000, 120000), 15000 * Math.pow(2, feed.fails - 1));
      feed.nextAt = Date.now() + (err && err.status === 429 ? Math.max(back, 120000) : back);
    } finally { feed.busy = false; }
  }

  live.start = function () {
    const ls = BV.layers.filter((L) => L.live);
    for (const L of ls) BV.server.feeds.set(L.id, feedFor(L));
    if (!live.enabled) { ls.forEach((L) => { setStatus(BV.server.feeds.get(L.id), 'offline', 'fetch unavailable'); fallBack(L, BV.server.feeds.get(L.id)); }); return; }
    ls.forEach((L, i) => setTimeout(() => run(L), 150 + i * 250));
    setInterval(() => {
      if (document.hidden || BV.store.state.paused) return;
      const now = Date.now();
      for (const L of ls) {
        const f = BV.server.feeds.get(L.id);
        if (!f.busy && f.nextAt && now >= f.nextAt) run(L);
      }
    }, 1000);
  };
  // poll a layer immediately, optionally with a focus point ({ lat, lon })
  live.refresh = (id, opts) => { const L = BV.layer(id); if (L && L.live) return run(L, opts); };

  BV.live = live;
})();
