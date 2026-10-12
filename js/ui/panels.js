/* birds view · side panels: layers, metrics sparkline, watchlist, inspector, event stream, feed status */
(function () {
  const BV = (window.BV = window.BV || {});
  const esc = (s) => BV.fmt.esc(s);

  // ---------- layers ----------
  BV.initLayers = function (root) {
    function render() {
      root.innerHTML = BV.layers.map((L, i) => {
        const feed = BV.server.feeds.get(L.id);
        const st = BV.store.state.paused ? 'paused' : feed.status;
        return '<div class="layer' + (L.visible ? '' : ' off') + '" data-id="' + L.id + '" style="--c:' + L.hex + '" title="Toggle ' + esc(L.label) + ' (' + (i + 1) + ')">' +
          '<span class="sw"></span><span class="name">' + esc(L.label) + '</span><span class="key">' + (i + 1) + '</span>' +
          '<span class="sub"><span><span class="dot ' + st + (st === 'live' ? ' live' : '') + '"></span>' + st + ' · ' + feed.latency + 'ms</span>' +
          '<span class="count">' + BV.store.count(L.id) + '</span></span></div>';
      }).join('');
    }
    root.addEventListener('click', (e) => {
      const el = e.target.closest('.layer');
      if (el) BV.store.setVisible(el.dataset.id);
    });
    BV.bus.on('layers:change', render);
    BV.bus.on('feed:status', render);
    BV.bus.on('pause', render);
    setInterval(render, 1000);
    render();
  };

  // ---------- metrics ----------
  BV.initStats = function (root) {
    const svg = root.querySelector('svg');
    const rows = root.querySelector('.rows');
    BV.bus.on('metrics', (st) => {
      const h = st.history;
      const last10 = h.slice(-10);
      const eps = last10.length ? last10.reduce((a, b) => a + b, 0) / last10.length : 0;
      const alerts = BV.store.all('alerts');
      const hot = alerts.filter((a) => a.rank >= 3 && Date.now() - a.ts < 300000).length;
      const totalSeen = Object.values(st.totals).reduce((a, b) => a + b, 0);
      rows.innerHTML =
        '<div class="row"><span>events / s</span><span>' + eps.toFixed(1) + '</span></div>' +
        '<div class="row"><span>entities held</span><span>' + BV.store.total().toLocaleString() + '</span></div>' +
        '<div class="row"><span>ingested (session)</span><span>' + totalSeen.toLocaleString() + '</span></div>' +
        '<div class="row"><span>high+ alerts (5m)</span><span style="color:' + (hot ? 'var(--crit)' : 'inherit') + '">' + hot + '</span></div>';
      const max = Math.max(4, ...h);
      const w = 200, ht = 44, n = 90;
      const pts = h.map((v, i) => [(i + n - h.length) * (w / (n - 1)), ht - 2 - (v / max) * (ht - 6)]);
      const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      const area = pts.length ? line + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + ht + ' L' + pts[0][0].toFixed(1) + ' ' + ht + ' Z' : '';
      svg.innerHTML = '<path d="' + area + '" fill="rgba(78,242,194,.10)"/><path d="' + line + '" fill="none" stroke="#4ef2c2" stroke-width="1.2"/>';
    });
  };

  // ---------- watchlist ----------
  BV.initWatch = function (root, countEl) {
    function render(list) {
      list = list || BV.store.state.watch;
      countEl.textContent = list.length;
      if (!list.length) { root.innerHTML = '<div class="empty">Pin entities from the inspector to keep them here.</div>'; return; }
      root.innerHTML = list.map((w, i) => {
        const L = BV.layer(w.layer);
        return '<div class="w" data-i="' + i + '" style="color:' + L.hex + '">' + L.glyph +
          ' <span style="color:var(--text)">' + esc(w.label) + '</span><span class="x" data-x="' + i + '" title="Unpin">×</span></div>';
      }).join('');
    }
    root.addEventListener('click', (e) => {
      const list = BV.store.state.watch;
      if (e.target.dataset.x !== undefined) {
        const w = list[+e.target.dataset.x];
        BV.store.toggleWatch({ layer: w.layer, id: w.id });
        return;
      }
      const el = e.target.closest('.w');
      if (el) BV.store.select(list[+el.dataset.i]);
    });
    BV.bus.on('watch:change', render);
    render();
  };

  // ---------- inspector ----------
  BV.initInspector = function (root) {
    let current = null;
    function empty() {
      root.innerHTML = '<div class="insp-empty">Nothing selected.<br><br>Click a marker on the map, a row in the table, or search for an IP, @handle, domain or coordinates.<br><br>' +
        '<span class="kbd">/</span> search &nbsp; <span class="kbd">Space</span> pause<br><span class="kbd">1</span>–<span class="kbd">5</span> toggle layers &nbsp; <span class="kbd">Esc</span> clear</div>';
    }
    function render() {
      const sel = BV.store.state.selected;
      const rec = sel && BV.store.get(sel.layer, sel.id);
      if (!rec) { current = null; return empty(); }
      current = rec;
      const L = BV.layer(rec.layer);
      const watched = BV.store.isWatched(rec);
      const score = L.score ? L.score(rec) : null;
      const fields = (L.fields ? L.fields(rec) : Object.entries(rec).map(([k, v]) => [k, String(v)]));
      const links = L.links ? L.links(rec, BV.store).slice(0, 12) : [];
      root.innerHTML =
        '<div class="insp-head" style="--c:' + L.hex + '"><div class="kind">' + L.glyph + ' ' + esc(L.label) + '</div>' +
        '<div class="title">' + esc(L.title(rec)) + '</div><div class="subtitle">' + esc(L.subtitle(rec)) + '</div>' +
        (score !== null ? '<div class="meter" style="--c:' + L.hex + '"><i style="width:' + score + '%"></i></div>' : '') +
        '<div class="insp-actions">' +
        '<button class="btn small' + (watched ? ' on' : '') + '" data-a="watch">' + (watched ? '★ pinned' : '☆ pin') + '</button>' +
        (rec.lat !== undefined ? '<button class="btn small" data-a="fly">⌖ locate</button>' : '') +
        '<button class="btn small" data-a="copy">⧉ copy json</button>' +
        '</div></div>' +
        '<div class="kv">' + fields.map(([k, v, pivot]) =>
          '<div class="k">' + esc(k) + '</div><div class="v' + (pivot ? ' pivot" data-q="' + esc(String(v)) + '" title="Search for this value' : '') + '">' + esc(String(v)) + '</div>').join('') +
        '<div class="k">first seen</div><div class="v">' + BV.fmt.datetime(rec.ts) + ' (' + BV.fmt.ago(rec.ts) + ')</div>' +
        '<div class="k">feed lag</div><div class="v">' + (rec.lag || 0) + ' ms</div>' +
        '<div class="k">record id</div><div class="v">' + esc(rec.id) + '</div></div>' +
        '<div class="subh">Related · ' + links.length + '</div>' +
        (links.length ? links.map((o) => {
          const OL = BV.layer(o.layer);
          return '<div class="rel" data-l="' + o.layer + '" data-id="' + o.id + '" style="--c:' + OL.hex + '"><span class="g">' + OL.glyph + '</span>' +
            '<span>' + esc(OL.title(o)) + '</span><span style="margin-left:auto;color:var(--muted)">' + esc(OL.label) + '</span></div>';
        }).join('') : '<div class="empty">No linked entities in the current buffer.</div>');
    }
    root.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]');
      if (a && current) {
        if (a.dataset.a === 'watch') { BV.store.toggleWatch(current); render(); }
        if (a.dataset.a === 'fly') BV.map.flyTo(current.lat, current.lon, BV.map.view.minPpd * 8);
        if (a.dataset.a === 'copy') {
          const json = JSON.stringify(current, (k, v) => (k === 'trail' ? undefined : v), 2);
          (navigator.clipboard ? navigator.clipboard.writeText(json) : Promise.reject()).then(() => BV.toast('Copied record JSON'), () => BV.toast('Clipboard unavailable'));
        }
        return;
      }
      const p = e.target.closest('.pivot');
      if (p) { BV.search.run(p.dataset.q); return; }
      const r = e.target.closest('.rel');
      if (r) BV.store.select({ layer: r.dataset.l, id: r.dataset.id });
    });
    BV.bus.on('select', render);
    BV.bus.on('record:new', (rec) => { if (current && rec === current) render(); });
    setInterval(() => { if (current && current.layer === 'pings') render(); }, 1500);
    empty();
  };

  // ---------- event stream ----------
  BV.initStream = function (root) {
    const MAX = 80;
    let queue = [];
    BV.bus.on('record:new', (rec) => { queue.push(rec); });
    function flush() {
      if (!queue.length) return;
      const frag = document.createDocumentFragment();
      for (const rec of queue.slice(-20)) {
        const L = BV.layer(rec.layer);
        if (!L.visible) continue;
        const lvl = L.level ? L.level(rec) : L.id;
        const div = document.createElement('div');
        div.className = 'line';
        div.style.setProperty('--c', rec.layer === 'alerts' ? ({ crit: 'var(--crit)', high: '#ff8a5c', med: 'var(--warn)', low: 'var(--muted)' }[lvl]) : L.hex);
        div.dataset.l = rec.layer; div.dataset.id = rec.id;
        div.innerHTML = '<span class="ts">' + BV.fmt.time(rec.ts) + '</span><span class="lv">' + esc(lvl) + '</span><span class="msg">' + esc(L.logLine ? L.logLine(rec) : L.title(rec)) + '</span>';
        root.prepend(div);
      }
      queue = [];
      while (root.children.length > MAX) root.lastChild.remove();
    }
    root.addEventListener('click', (e) => {
      const l = e.target.closest('.line');
      if (l) BV.store.select({ layer: l.dataset.l, id: l.dataset.id });
    });
    setInterval(flush, 250);
  };

  // ---------- footer feed status ----------
  BV.initFooter = function (root) {
    function render() {
      const paused = BV.store.state.paused;
      root.innerHTML = BV.layers.map((L) => {
        const f = BV.server.feeds.get(L.id);
        const st = paused ? 'paused' : f.status;
        return '<span class="feed"><span class="dot ' + st + '"></span><b>' + L.id + '</b>' + st + ' · ' + f.latency + 'ms · last ' + BV.fmt.ago(f.lastTs) + '</span>';
      }).join('');
    }
    setInterval(render, 1000);
    BV.bus.on('feed:status', (f) => {
      render();
      if (f.status !== 'live') BV.toast(BV.layer(f.id).label + ' feed ' + f.status);
    });
    render();
  };

  // ---------- toast ----------
  let toastT = null;
  BV.toast = function (msg) {
    const el = document.querySelector('.toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2200);
  };
})();
