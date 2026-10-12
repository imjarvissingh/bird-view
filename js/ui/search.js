/* birds view · global search: selector detection, key:value filters, async queries against the MockServer */
(function () {
  const BV = (window.BV = window.BV || {});
  const esc = (s) => BV.fmt.esc(s);
  const ALIAS = { sev: 'severity', country: 'cc', svc: 'service', type: 'kind', reg: 'registrar', flag: 'flags', topic: 'topics', src: 'source' };
  const RE_COORD = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
  const RE_IP = /^\d{1,3}(\.\d{1,3}){1,3}\.?$/;

  function parse(q) {
    const out = { layer: null, kv: [], terms: [] };
    for (const tok of q.trim().split(/\s+/).filter(Boolean)) {
      const m = tok.match(/^([a-z]+):(.+)$/i);
      if (m) {
        const k = m[1].toLowerCase();
        if (k === 'layer' || k === 'in') out.layer = m[2].toLowerCase();
        else out.kv.push([ALIAS[k] || k, m[2].toLowerCase()]);
      } else out.terms.push(tok.toLowerCase());
    }
    return out;
  }

  function matcher(p, L) {
    return (r) => {
      for (const [k, v] of p.kv) {
        const x = r[k];
        if (x === undefined || x === null) return false;
        if (Array.isArray(x)) { if (!x.some((y) => String(y).toLowerCase().includes(v))) return false; }
        else if (typeof x === 'number') {
          const m = v.match(/^([<>]=?)?(\d+(?:\.\d+)?)$/);
          if (!m) return false;
          const n = +m[2];
          if (m[1] === '>' ? !(x > n) : m[1] === '>=' ? !(x >= n) : m[1] === '<' ? !(x < n) : m[1] === '<=' ? !(x <= n) : x !== n) return false;
        } else if (!String(x).toLowerCase().includes(v)) return false;
      }
      if (!p.terms.length) return true;
      const h = L.searchText(r).toLowerCase();
      return p.terms.every((t) => h.includes(t.replace(/^@/, '@')));
    };
  }

  function placeHits(q) {
    q = q.trim().toLowerCase();
    if (q.length < 2 || /[:@]/.test(q) || RE_IP.test(q)) return [];
    const out = [];
    const starts = (s) => s.toLowerCase().startsWith(q), has = (s) => s.toLowerCase().includes(q);
    for (const f of BV.countries || []) if (starts(f.name)) out.push({ name: f.name, kind: 'country', feature: f });
    for (const r of BV.map.regions) if (has(r[0])) out.push({ name: r[0], kind: 'region', lat: r[1], lon: r[2], z: r[3] });
    for (const a of BV.AIRPORTS) if (a[0].toLowerCase() === q || starts(a[1])) out.push({ name: a[1] + ' (' + a[0] + ')', kind: 'airport · ' + a[2], lat: a[3], lon: a[4], z: 6 });
    for (const c of BV.PLACES) if (starts(c[0]) && !out.some((o) => o.name.startsWith(c[0]))) out.push({ name: c[0], kind: 'city · ' + c[1], lat: c[2], lon: c[3], z: 6 });
    for (const f of BV.countries || []) if (!starts(f.name) && has(f.name)) out.push({ name: f.name, kind: 'country', feature: f });
    return out.slice(0, 6);
  }

  BV.initSearch = function (root) {
    const input = root.querySelector('input');
    const box = root.querySelector('.results');
    let hits = [], active = -1, seq = 0;

    function hint() {
      box.innerHTML = '<div class="hint">Try <code>Japan</code>, <code>JFK</code>, <code>NHR</code>, <code>M6</code>, <code>@ghost</code>, <code>35.68, 139.69</code>, ' +
        '<code>mag:&gt;5</code>, <code>layer:flights to:LHR</code>, <code>kind:tanker</code>, <code>sev:crit</code>, <code>port:6379</code>, <code>risk:&gt;70</code></div>';
      box.classList.add('open'); hits = []; active = -1;
    }

    async function run(q) {
      const my = ++seq;
      q = q.trim();
      if (!q) return hint();
      const coord = q.match(RE_COORD);
      if (coord && Math.abs(+coord[1]) <= 90 && Math.abs(+coord[2]) <= 180) {
        hits = [{ coord: [+coord[1], +coord[2]] }];
        box.innerHTML = '<div class="grp">Coordinates</div><div class="hit active" data-i="0"><span style="color:var(--accent)">⌖</span><span class="t">Fly to ' + (+coord[1]).toFixed(4) + ', ' + (+coord[2]).toFixed(4) + '</span><span class="s">Enter</span></div>';
        active = 0; box.classList.add('open'); return;
      }
      const places = placeHits(q);
      const p = parse(q);
      if (RE_IP.test(q.trim())) p.layer = p.layer || null;
      box.innerHTML = '<div class="hint">Querying ' + BV.layers.length + ' feeds…</div>';
      box.classList.add('open');
      const layers = BV.layers.filter((L) => !p.layer || L.id.startsWith(p.layer) || L.label.toLowerCase().includes(p.layer));
      const t0 = performance.now();
      const res = await Promise.all(layers.map((L) => BV.server.query(L.id, matcher(p, L), 6).then((r) => ({ L, r }))));
      if (my !== seq) return; // stale
      const ms = Math.round(performance.now() - t0);
      hits = [];
      let html = '';
      if (places.length) {
        html += '<div class="grp">⌖ Places</div>';
        for (const pl of places) {
          html += '<div class="hit" data-i="' + hits.length + '"><span style="color:var(--accent)">⌖</span><span class="t">' + esc(pl.name) + '</span><span class="s">' + esc(pl.kind) + '</span></div>';
          hits.push({ place: pl });
        }
      }
      for (const { L, r } of res) {
        if (!r.ok) { html += '<div class="grp" style="color:var(--crit)">' + esc(L.label) + ' · feed offline (503)</div>'; continue; }
        if (!r.items.length) continue;
        const total = BV.store.all(L.id).filter(matcher(p, L)).length;
        html += '<div class="grp">' + L.glyph + ' ' + esc(L.label) + ' · ' + total + ' match' + (total === 1 ? '' : 'es') + ' · ' + r.latency + 'ms</div>';
        for (const rec of r.items) {
          html += '<div class="hit" data-i="' + hits.length + '"><span style="color:' + L.hex + '">' + L.glyph + '</span><span class="t">' + esc(L.title(rec)) + '</span><span class="s">' + esc(L.subtitle(rec)) + '</span></div>';
          hits.push({ rec });
        }
        if (total > r.items.length) {
          html += '<div class="hit" data-i="' + hits.length + '"><span style="color:var(--muted)">↳</span><span class="s" style="margin-left:0">Show all ' + total + ' in table</span></div>';
          hits.push({ table: L.id, q });
        }
      }
      if (!hits.length) html += '<div class="hint">No matches across live feeds (' + ms + 'ms). Records are generated continuously, so try again shortly or widen the query.</div>';
      box.innerHTML = html;
      active = hits.length ? 0 : -1;
      paintActive();
    }

    function paintActive() {
      box.querySelectorAll('.hit').forEach((el) => el.classList.toggle('active', +el.dataset.i === active));
      const el = box.querySelector('.hit.active');
      if (el) {
        if (el.offsetTop < box.scrollTop) box.scrollTop = el.offsetTop - 24;
        else if (el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = el.offsetTop + el.offsetHeight - box.clientHeight;
      }
    }

    function choose(i) {
      const h = hits[i];
      if (!h) return;
      if (h.coord) BV.map.flyTo(h.coord[0], h.coord[1], BV.map.view.mode === 'globe' ? 5 : 10);
      else if (h.place) { if (h.place.feature) BV.store.selectCountry({ name: h.place.name, feature: h.place.feature }); else BV.map.flyTo(h.place.lat, h.place.lon, h.place.z); }
      else if (h.table) BV.table.setFilter(h.q.split(/\s+/).filter((t) => !/^(layer|in):/i.test(t)).map((t) => t.replace(/^[a-z]+:/i, '')).join(' '), h.table);
      else BV.store.select(h.rec);
      close();
      input.blur();
    }
    function close() { box.classList.remove('open'); }

    let deb = null;
    input.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(() => run(input.value), 140); });
    input.addEventListener('focus', () => run(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(hits.length - 1, active + 1); paintActive(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); paintActive(); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(active < 0 ? 0 : active); }
      else if (e.key === 'Escape') { close(); input.blur(); }
    });
    box.addEventListener('mousedown', (e) => { const h = e.target.closest('.hit'); if (h) { e.preventDefault(); choose(+h.dataset.i); } });
    document.addEventListener('mousedown', (e) => { if (!root.contains(e.target)) close(); });

    BV.search = {
      focus() { input.focus(); input.select(); },
      run(q) { input.value = q; input.focus(); run(q); },
    };
  };
})();
