/* birds view · data table: tab per layer, sort, filter, export */
(function () {
  const BV = (window.BV = window.BV || {});
  const LIMIT = 300;

  BV.initTable = function (root) {
    const tabs = root.querySelector('.tabs');
    const body = root.querySelector('.tbody');
    const filter = tabs.querySelector('input.filter');
    let active = BV.layers[0].id;
    const sort = {}; // layer -> { key, dir }
    let dirty = true;

    function renderTabs() {
      const html = BV.layers.map((L) =>
        '<div class="tab' + (L.id === active ? ' active' : '') + '" data-id="' + L.id + '" style="--c:' + L.hex + '">' +
        '<span style="color:' + L.hex + '">' + L.glyph + '</span>' + BV.fmt.esc(L.short || L.label) + ' <span class="n">' + BV.store.count(L.id) + '</span></div>').join('');
      tabs.querySelector('.tablist').innerHTML = html;
    }

    function rows() {
      const L = BV.layer(active);
      let recs = BV.store.all(active);
      const q = filter.value.trim().toLowerCase();
      if (q) {
        const terms = q.split(/\s+/);
        recs = recs.filter((r) => { const h = L.searchText(r).toLowerCase(); return terms.every((t) => h.includes(t)); });
      }
      const s = sort[active] || { key: 'ts', dir: -1 };
      const col = L.columns.find((c) => c.key === s.key);
      const k = (col && col.sortKey) || s.key;
      recs = recs.slice().sort((a, b) => {
        const x = a[k], y = b[k];
        if (x === y) return 0;
        if (x === undefined || x === null) return 1;
        if (y === undefined || y === null) return -1;
        return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * s.dir;
      });
      return recs;
    }

    function render() {
      dirty = false;
      const L = BV.layer(active);
      const recs = rows();
      const s = sort[active] || { key: 'ts', dir: -1 };
      const sel = BV.store.state.selected;
      const now = Date.now();
      const keepScroll = body.scrollTop;
      let html = '<table class="grid"><colgroup>' + L.columns.map((c) => '<col' + (c.width ? ' style="width:' + c.width + 'px"' : '') + '>').join('') + '</colgroup><thead><tr>' +
        L.columns.map((c) => '<th data-k="' + c.key + '" class="' + (s.key === c.key ? 'sorted' : '') + '">' + c.label + (s.key === c.key ? (s.dir < 0 ? ' ↓' : ' ↑') : '') + '</th>').join('') +
        '</tr></thead><tbody>';
      for (const r of recs.slice(0, LIMIT)) {
        const cls = (sel && sel.id === r.id ? 'sel' : '') + (now - r.ts < 1500 ? ' fresh' : '');
        html += '<tr data-id="' + r.id + '" class="' + cls + '">' + L.columns.map((c) => {
          const v = r[c.key];
          const out = c.html ? c.html(v, r) : BV.fmt.esc(c.fmt ? c.fmt(v, r) : v === undefined || v === null ? '—' : v);
          return '<td>' + out + '</td>';
        }).join('') + '</tr>';
      }
      html += '</tbody></table>';
      if (!recs.length) html += '<div class="tempty">No records match. Widen the filter or wait for the feed.</div>';
      else if (recs.length > LIMIT) html += '<div class="tempty">Showing ' + LIMIT + ' of ' + recs.length + '. Refine the filter to narrow down.</div>';
      body.innerHTML = html;
      body.scrollTop = keepScroll;
    }

    tabs.addEventListener('click', (e) => {
      const t = e.target.closest('.tab');
      if (t) { active = t.dataset.id; renderTabs(); render(); }
      const ex = e.target.closest('[data-export]');
      if (ex) exportRows(ex.dataset.export);
    });
    body.addEventListener('click', (e) => {
      const th = e.target.closest('th');
      if (th) {
        const s = sort[active] || { key: 'ts', dir: -1 };
        sort[active] = { key: th.dataset.k, dir: s.key === th.dataset.k ? -s.dir : -1 };
        render(); return;
      }
      const tr = e.target.closest('tr[data-id]');
      if (tr) BV.store.select({ layer: active, id: tr.dataset.id }, { from: 'table' });
    });
    filter.addEventListener('input', render);

    function exportRows(kind) {
      const L = BV.layer(active);
      const recs = rows();
      let blob;
      if (kind === 'json') {
        blob = new Blob([JSON.stringify(recs, BV.jsonReplacer, 2)], { type: 'application/json' });
      } else {
        const cols = L.columns.map((c) => c.key);
        const cell = (v) => { const s = Array.isArray(v) ? v.join('|') : v && typeof v === 'object' ? JSON.stringify(v) : v === undefined || v === null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
        blob = new Blob([cols.join(',') + '\n' + recs.map((r) => cols.map((c) => cell(r[c])).join(',')).join('\n')], { type: 'text/csv' });
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'birdsview-' + active + '-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '') + '.' + kind;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      BV.toast('Exported ' + recs.length + ' ' + L.label.toLowerCase());
    }

    BV.bus.on('record:new', (r) => { if (r.layer === active) dirty = true; });
    BV.bus.on('record:remove', (r) => { if (r.layer === active) dirty = true; });
    BV.bus.on('select', ({ ref, opts }) => {
      if (ref && ref.layer !== active && opts.from !== 'table') { active = ref.layer; filter.value = ''; renderTabs(); }
      render();
      if (ref && opts.from !== 'table') { // manual scroll: scrollIntoView would also shift overflow-hidden ancestors
        const tr = body.querySelector('tr.sel');
        if (tr) {
          const top = tr.offsetTop - 30, bottom = tr.offsetTop + tr.offsetHeight;
          if (top < body.scrollTop) body.scrollTop = top;
          else if (bottom > body.scrollTop + body.clientHeight) body.scrollTop = bottom - body.clientHeight;
        }
      }
    });
    setInterval(() => { renderTabs(); if (BV.layer(active).moving) dirty = true; if (dirty && !BV.store.state.paused && !body.matches(':hover')) render(); }, 700);

    renderTabs(); render();
    BV.table = { setFilter(q, layer) { if (layer) active = layer; filter.value = q; renderTabs(); render(); } };
  };
})();
