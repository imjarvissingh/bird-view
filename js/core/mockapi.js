/* birds view · MockServer.
   Stands in for every backend: each registered layer gets a "feed" that streams records
   with Poisson arrivals, network latency, jitter and the occasional degradation or outage.
   It also answers async queries the way a REST API would (with latency), so the UI code
   is written against promises and could be pointed at a real API later. */
(function () {
  const BV = (window.BV = window.BV || {});
  const TICK = 100; // ms

  function MockServer(seed) {
    const rng = BV.RNG(seed);
    const feeds = new Map(); // layer id -> feed state
    let timer = null;
    let last = performance.now();

    function feedFor(layer) {
      return {
        id: layer.id, status: 'live', latency: rng.int(40, 140), baseLatency: rng.int(40, 140),
        lastTs: Date.now(), until: 0, received: 0, carry: 0,
      };
    }

    function ctx() { return { store: BV.store, rng, now: Date.now() }; }

    function deliver(layer, rec, feed) {
      const lag = Math.max(5, feed.latency + rng.gauss(0, feed.latency * 0.25));
      setTimeout(() => {
        rec.ts = Date.now();
        rec.lag = Math.round(lag);
        BV.store.add(rec);
        feed.lastTs = rec.ts;
        feed.received++;
      }, lag);
    }

    function health(feed, now) {
      if (feed.until && now < feed.until) return;
      if (feed.status !== 'live') { // recover
        feed.status = 'live'; feed.latency = feed.baseLatency; feed.until = 0;
        BV.bus.emit('feed:status', feed);
        return;
      }
      const r = rng.next();
      if (r < 0.0002) { feed.status = 'offline'; feed.until = now + rng.int(4000, 9000); }
      else if (r < 0.0011) { feed.status = 'degraded'; feed.latency = feed.baseLatency * rng.int(4, 9); feed.until = now + rng.int(8000, 20000); }
      else { // small latency wander while live
        feed.latency = Math.max(20, Math.round(feed.latency * 0.9 + (feed.baseLatency + rng.gauss(0, 25)) * 0.1));
        return;
      }
      BV.bus.emit('feed:status', feed);
    }

    function tick() {
      const t = performance.now();
      const dt = Math.min(1, (t - last) / 1000);
      last = t;
      if (BV.store.state.paused) return;
      const speed = BV.store.state.speed;
      const now = Date.now();
      const c = ctx();
      for (const layer of BV.layers) {
        const feed = feeds.get(layer.id);
        health(feed, now);
        if (feed.status === 'offline') continue;
        const rate = layer.rate * speed * (feed.status === 'degraded' ? 0.35 : 1);
        // bursty arrivals: jittered accumulator, mean = rate events/sec
        feed.carry += rate * dt * rng.float(0, 2);
        while (feed.carry >= 1) {
          feed.carry -= 1;
          const rec = layer.generate(rng, c);
          if (rec) { rec.layer = layer.id; deliver(layer, rec, feed); }
        }
        if (feed.carry > 3) feed.carry = 3;
      }
      BV.bus.emit('tick', dt * speed);
    }

    return {
      rng,
      feeds,
      start() {
        for (const layer of BV.layers) feeds.set(layer.id, feedFor(layer));
        // layers that correlate other layers (seedAfter) backfill last
        const order = BV.layers.filter((l) => !l.seedAfter).concat(BV.layers.filter((l) => l.seedAfter));
        for (const layer of order) {
          // backfill: history as if the feed had been running for a while
          const c = ctx();
          const n = layer.backfill;
          const recs = layer.seed ? layer.seed(rng, n, c) : Array.from({ length: n }, () => layer.generate(rng, c));
          recs.forEach((rec, i) => {
            if (!rec) return;
            rec.layer = layer.id;
            rec.ts = rec.ts || Date.now() - (n - i) * rng.int(2000, 25000);
            rec.lag = feeds.get(layer.id).latency;
            BV.store.add(rec, { silent: true });
          });
        }
        last = performance.now();
        timer = setInterval(tick, TICK);
        BV.bus.emit('server:ready');
      },
      stop() { clearInterval(timer); },
      // Advance moving entities. Called every animation frame so motion is smooth;
      // the physical world keeps moving even when a feed is degraded or offline.
      advance(dtReal) {
        if (BV.store.state.paused) return;
        const dt = Math.min(0.25, dtReal) * BV.store.state.speed;
        const c = ctx();
        for (const layer of BV.layers) {
          if (!layer.update) continue;
          const recs = BV.store.all(layer.id);
          for (let i = 0; i < recs.length; i++) layer.update(recs[i], rng, dt, c);
        }
      },
      // REST-ish async query with simulated latency
      query(layerId, predicate, limit = 50) {
        const feed = feeds.get(layerId);
        const lag = feed ? feed.latency : 60;
        return new Promise((resolve) => {
          setTimeout(() => {
            if (feed && feed.status === 'offline') return resolve({ ok: false, status: 503, items: [] });
            const items = BV.store.all(layerId).filter(predicate).slice(-limit).reverse();
            resolve({ ok: true, status: 200, items, latency: lag });
          }, Math.max(10, lag * 0.5));
        });
      },
    };
  }

  BV.MockServer = MockServer;
})();
