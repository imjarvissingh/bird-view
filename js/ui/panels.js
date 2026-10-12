/* birds view · side panels: layers, metrics sparkline, watchlist, inspector, event stream, feed status, help */
(function () {
  const BV = (window.BV = window.BV || {});
  const esc = (s) => BV.fmt.esc(s);
  const KEYS = '1234567890';
  BV.layerKey = (L) => { const i = BV.layers.indexOf(L); return i >= 0 && i < KEYS.length ? KEYS[i] : ''; };

  // ---------- layers ----------
  BV.initLayers = function (root) {
    function render() {
      const groups = [];
      for (const L of BV.layers) {
        let g = groups.find((x) => x.name === (L.group || 'Other'));
        if (!g) groups.push((g = { name: L.group || 'Other', items: [] }));
        g.items.push(L);
      }
      const paused = BV.store.state.paused;
      root.innerHTML = groups.map((g) => {
        const allOn = g.items.every((L) => L.visible);
        return '<div class="lgroup"><button class="lgh" data-group="' + esc(g.name) + '" aria-label="Toggle all ' + esc(g.name) + ' layers">' +
          '<span>' + esc(g.name) + '</span><span class="meta">' + (allOn ? 'hide all' : 'show all') + '</span></button>' +
          g.items.map((L) => {
            const feed = BV.server.feeds.get(L.id);
            const st = paused ? 'paused' : feed.status;
            const key = BV.layerKey(L);
            return '<button class="layer' + (L.visible ? '' : ' off') + '" data-id="' + L.id + '" style="--c:' + L.hex + '" aria-pressed="' + L.visible + '" title="' + esc(L.label) + (key ? ' (' + key + ')' : '') + '">' +
              '<span class="sw"></span><span class="name">' + esc(L.label) + '</span><span class="count">' + BV.store.count(L.id).toLocaleString() + '</span>' +
              '<span class="sub"><span><span class="dot ' + st + (st === 'live' ? ' live' : '') + '"></span>' + st + ' · ' + feed.latency + 'ms</span>' +
              (key ? '<span class="key">' + key + '</span>' : '') + '</span></button>';
          }).join('') + '</div>';
      }).join('');
    }
    root.addEventListener('click', (e) => {
      const g = e.target.closest('[data-group]');
      if (g) {
        const items = BV.layers.filter((L) => (L.group || 'Other') === g.dataset.group);
        const on = !items.every((L) => L.visible);
        items.forEach((L) => BV.store.setVisible(L.id, on));
        return;
      }
      const el = e.target.closest('.layer');
      if (el) BV.store.setVisible(el.dataset.id);
    });
    BV.bus.on('layers:change', render);
    BV.bus.on('feed:status', render);
    BV.bus.on('pause', render);
    setInterval(render, 1500);
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
      const hot = BV.store.all('alerts').filter((a) => a.rank >= 3 && Date.now() - a.ts < 300000).length;
      const airborne = BV.store.all('flights').filter((f) => !f.ended).length;
      const storms = BV.store.all('storms').filter((s) => !s.ended).length;
      const bigQ = BV.store.all('quakes').filter((q) => q.mag >= 5 && Date.now() - q.ts < 86400000).length;
      rows.innerHTML =
        '<div class="row"><span>events / s</span><span>' + eps.toFixed(1) + '</span></div>' +
        '<div class="row"><span>entities tracked</span><span>' + BV.store.total().toLocaleString() + '</span></div>' +
        '<div class="row"><span>aircraft airborne</span><span>' + airborne + '</span></div>' +
        '<div class="row"><span>active storms</span><span>' + storms + '</span></div>' +
        '<div class="row"><span>M5+ quakes (24h)</span><span>' + bigQ + '</span></div>' +
        '<div class="row"><span>high+ alerts (5m)</span><span class="' + (hot ? 'hot' : '') + '">' + hot + '</span></div>';
      const max = Math.max(4, ...h);
      const w = 200, ht = 44, n = 90;
      const pts = h.map((v, i) => [(i + n - h.length) * (w / (n - 1)), ht - 3 - (v / max) * (ht - 8)]);
      const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      const area = pts.length ? line + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + ht + ' L' + pts[0][0].toFixed(1) + ' ' + ht + ' Z' : '';
      const end = pts[pts.length - 1];
      svg.innerHTML = '<line x1="0" x2="200" y1="' + (ht / 2) + '" y2="' + (ht / 2) + '" stroke="rgba(120,160,180,.12)" stroke-dasharray="2 3"/>' +
        '<path d="' + area + '" fill="rgba(78,242,194,.10)"/><path d="' + line + '" fill="none" stroke="#4ef2c2" stroke-width="1.2"/>' +
        (end ? '<circle cx="' + end[0].toFixed(1) + '" cy="' + end[1].toFixed(1) + '" r="2.4" fill="#4ef2c2"/>' : '');
    });
  };

  // ---------- watchlist ----------
  BV.initWatch = function (root, countEl) {
    function render(list) {
      list = list || BV.store.state.watch;
      countEl.textContent = list.length;
      if (!list.length) { root.innerHTML = '<div class="empty">Pin anything from the inspector to keep it here.</div>'; return; }
      root.innerHTML = list.map((w, i) => {
        const L = BV.layer(w.layer);
        const live = BV.store.get(w.layer, w.id);
        return '<div class="w" data-i="' + i + '" style="color:' + L.hex + '" role="button" tabindex="0">' + L.glyph +
          ' <span class="wl">' + esc(w.label) + (live && live.ended ? ' <i>(ended)</i>' : '') + '</span><button class="x" data-x="' + i + '" aria-label="Unpin ' + esc(w.label) + '">×</button></div>';
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
    root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('w')) e.target.click(); });
    BV.bus.on('watch:change', render);
    render();
  };

  // ---------- inspector ----------
  BV.initInspector = function (root) {
    let current = null, country = null;
    function empty() {
      root.innerHTML = '<div class="insp-empty"><p>Nothing selected.</p><p>Drag to spin the Earth, scroll to zoom, then click any marker or country. Try <b>Tour</b> to be flown around the world.</p>' +
        '<div class="keys"><span><span class="kbd">/</span> search</span><span><span class="kbd">T</span> tour</span><span><span class="kbd">G</span> globe / flat</span>' +
        '<span><span class="kbd">Space</span> pause</span><span><span class="kbd">1</span>–<span class="kbd">0</span> layers</span><span><span class="kbd">?</span> all shortcuts</span></div></div>';
    }
    function renderCountry() {
      const f = country.feature;
      const inside = BV.store.find((r) => r.lat !== undefined && !r.ended && BV.layer(r.layer).visible && d3.geoContains(f, [r.lon, r.lat]));
      const by = {};
      for (const r of inside) (by[r.layer] = by[r.layer] || []).push(r);
      const recent = inside.slice().sort((a, b) => b.ts - a.ts).slice(0, 14);
      const area = Math.round(f.area * 6371 * 6371);
      root.innerHTML =
        '<div class="insp-head" style="--c:var(--accent)"><div class="kind">⌖ Country briefing</div><div class="title">' + esc(country.name) + '</div>' +
        '<div class="subtitle">' + inside.length + ' tracked entities inside · ~' + area.toLocaleString() + ' km²</div>' +
        '<div class="insp-actions"><button class="btn small" data-a="search">⌕ search records</button><button class="btn small" data-a="clear">✕ close</button></div></div>' +
        '<div class="counts">' + BV.layers.filter((L) => by[L.id]).map((L) =>
          '<button class="cnt" data-l="' + L.id + '" style="--c:' + L.hex + '"><span class="g">' + L.glyph + '</span><b>' + by[L.id].length + '</b><span>' + esc(L.short || L.label) + '</span></button>').join('') +
        (inside.length ? '' : '<div class="empty">No visible activity inside this country right now.</div>') + '</div>' +
        '<div class="subh">Latest</div>' + recent.map(relRow).join('');
    }
    function relRow(o) {
      const OL = BV.layer(o.layer);
      return '<div class="rel" data-l="' + o.layer + '" data-id="' + o.id + '" style="--c:' + OL.hex + '" role="button" tabindex="0"><span class="g">' + OL.glyph + '</span>' +
        '<span class="rt">' + esc(OL.title(o)) + '</span><span class="rs">' + esc(BV.fmt.ago(o.ts)) + '</span></div>';
    }
    function render() {
      if (country) return renderCountry();
      const sel = BV.store.state.selected;
      const rec = sel && BV.store.get(sel.layer, sel.id);
      if (!rec) { current = null; return empty(); }
      current = rec;
      const L = BV.layer(rec.layer);
      const watched = BV.store.isWatched(rec);
      const score = L.score ? L.score(rec) : null;
      const fields = (L.fields ? L.fields(rec) : Object.entries(rec).map(([k, v]) => [k, String(v)]));
      const links = L.links ? L.links(rec, BV.store).slice(0, 10) : [];
      const following = BV.map.isFollowing(rec);
      root.innerHTML =
        '<div class="insp-head" style="--c:' + L.hex + '"><div class="kind">' + L.glyph + ' ' + esc(L.label) + (rec.ended ? ' · ended' : '') + '</div>' +
        '<div class="title">' + esc(L.title(rec)) + '</div><div class="subtitle">' + esc(L.subtitle(rec)) + '</div>' +
        (score !== null ? '<div class="meter" style="--c:' + L.hex + '" title="score ' + score + '"><i style="width:' + score + '%"></i></div>' : '') +
        (L.extra ? L.extra(rec) : '') +
        '<div class="insp-actions">' +
        '<button class="btn small' + (watched ? ' on' : '') + '" data-a="watch">' + (watched ? '★ pinned' : '☆ pin') + '</button>' +
        (rec.lat !== undefined ? '<button class="btn small" data-a="fly">⌖ locate</button>' : '') +
        (L.moving && !rec.ended ? '<button class="btn small' + (following ? ' on' : '') + '" data-a="follow">' + (following ? '◉ following' : '◎ follow') + '</button>' : '') +
        '<button class="btn small" data-a="copy">⧉ copy</button>' +
        '</div></div>' +
        '<div class="kv">' + fields.map(([k, v, pivot]) =>
          '<div class="k">' + esc(k) + '</div><div class="v' + (pivot ? ' pivot" role="button" tabindex="0" data-q="' + esc(String(v)) + '" title="Search for this value' : '') + '">' + esc(String(v)) + '</div>').join('') +
        '<div class="k">updated</div><div class="v">' + BV.fmt.datetime(rec.ts) + ' (' + BV.fmt.ago(rec.ts) + ')</div>' +
        '<div class="k">feed lag</div><div class="v">' + (rec.lag || 0) + ' ms</div>' +
        '<div class="k">record id</div><div class="v">' + esc(rec.id) + '</div></div>' +
        (L.links ? '<div class="subh">Related · ' + links.length + '</div>' + (links.length ? links.map(relRow).join('') : '<div class="empty">No linked entities in the current buffer.</div>') : '');
    }
    root.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]');
      if (a) {
        const act = a.dataset.a;
        if (act === 'clear') { BV.store.selectCountry(null); return; }
        if (act === 'search' && country) { BV.search.run(country.name); return; }
        if (!current) return;
        if (act === 'watch') { BV.store.toggleWatch(current); render(); }
        if (act === 'fly') BV.map.flyTo(current.lat, current.lon, BV.map.view.mode === 'globe' ? 4 : 8);
        if (act === 'follow') { if (BV.map.isFollowing(current)) BV.map.stopFollow(); else BV.map.startFollow(current); render(); }
        if (act === 'copy') {
          const json = JSON.stringify(current, BV.jsonReplacer, 2);
          (navigator.clipboard ? navigator.clipboard.writeText(json) : Promise.reject()).then(() => BV.toast('Copied record JSON'), () => BV.toast('Clipboard unavailable here'));
        }
        return;
      }
      const c = e.target.closest('.cnt');
      if (c && country) { BV.table.setFilter('', c.dataset.l); return; }
      const p = e.target.closest('.pivot');
      if (p) { BV.search.run(p.dataset.q); return; }
      const r = e.target.closest('.rel');
      if (r) BV.store.select({ layer: r.dataset.l, id: r.dataset.id });
    });
    root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.target.classList.contains('rel') || e.target.classList.contains('pivot'))) e.target.click(); });
    BV.bus.on('select', (ev) => { country = ev.country || null; render(); });
    BV.bus.on('record:new', (rec) => { if (current && rec === current) render(); });
    BV.bus.on('record:remove', (r) => { if (current && current.id === r.id) render(); });
    setInterval(() => { if (current && BV.layer(current.layer).moving && !root.matches(':hover')) render(); }, 1000);
    empty();
  };

  // ---------- event stream ----------
  BV.initStream = function (root, filterEl) {
    const MAX = 80;
    let queue = [];
    let only = 'all';
    BV.bus.on('record:new', (rec) => { queue.push(rec); if (queue.length > 200) queue.shift(); });
    const sevColor = { crit: 'var(--crit)', high: '#ff8a5c', med: 'var(--warn)', low: 'var(--muted)' };
    function flush() {
      if (!queue.length || BV.store.state.paused) return;
      const frag = document.createDocumentFragment();
      for (const rec of queue.slice(-14)) {
        const L = BV.layer(rec.layer);
        if (!L.visible) continue;
        if (only === 'alerts' && !L.level) continue;
        if (only !== 'all' && only !== 'alerts' && L.group !== only) continue;
        const lvl = L.level ? L.level(rec) : L.short.toLowerCase();
        const div = document.createElement('div');
        div.className = 'line';
        div.style.setProperty('--c', L.level ? sevColor[lvl] : L.hex);
        div.dataset.l = rec.layer; div.dataset.id = rec.id;
        div.innerHTML = '<span class="ts">' + BV.fmt.time(rec.ts) + '</span><span class="lv">' + esc(lvl) + '</span><span class="msg">' + esc(L.logLine ? L.logLine(rec) : L.title(rec)) + '</span>';
        frag.prepend(div);
      }
      root.prepend(frag);
      queue = [];
      while (root.children.length > MAX) root.lastChild.remove();
    }
    root.addEventListener('click', (e) => {
      const l = e.target.closest('.line');
      if (l) BV.store.select({ layer: l.dataset.l, id: l.dataset.id });
    });
    if (filterEl) {
      const groups = [...new Set(BV.layers.map((L) => L.group))];
      filterEl.innerHTML = '<option value="all">all</option><option value="alerts">severity only</option>' + groups.map((g) => '<option value="' + esc(g) + '">' + esc(g.toLowerCase()) + '</option>').join('');
      filterEl.onchange = () => { only = filterEl.value; root.innerHTML = ''; };
    }
    setInterval(flush, 300);
  };

  // ---------- footer feed status ----------
  BV.initFooter = function (root) {
    function render() {
      const paused = BV.store.state.paused;
      let live = 0, deg = 0, off = 0;
      const dots = BV.layers.map((L) => {
        const f = BV.server.feeds.get(L.id);
        const st = paused ? 'paused' : f.status;
        if (st === 'live') live++; else if (st === 'degraded') deg++; else if (st === 'offline') off++;
        return '<span class="feed" title="' + esc(L.label) + ': ' + st + ', ' + f.latency + ' ms, last ' + BV.fmt.ago(f.lastTs) + '"><span class="dot ' + st + '"></span>' + L.short.toLowerCase() + '</span>';
      }).join('');
      root.innerHTML = '<span class="sum">' + (paused ? 'feeds paused' : live + ' live' + (deg ? ' · ' + deg + ' degraded' : '') + (off ? ' · ' + off + ' offline' : '')) + '</span>' + dots;
    }
    setInterval(render, 1000);
    BV.bus.on('feed:status', (f) => {
      render();
      if (f.status !== 'live') BV.toast(BV.layer(f.id).label + ' feed ' + f.status + (f.status === 'offline' ? ', retrying' : ''));
    });
    render();
  };

  // ---------- toast ----------
  let toastT = null;
  BV.toast = function (msg) {
    const el = document.querySelector('.toast');
    if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2400);
  };

  // JSON export without runtime-only fields
  BV.jsonReplacer = (k, v) => (k === 'trail' || k === 'laneRef' || k === 'interp' || k.startsWith('_') ? undefined : v);
})();
