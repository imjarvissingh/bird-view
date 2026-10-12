/* birds view · canvas map: dotted basemap, layer markers, pulses, arcs, tracks, selection */
(function () {
  const BV = (window.BV = window.BV || {});

  BV.initMap = function (wrap) {
    const canvas = wrap.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const tip = wrap.querySelector('.tip');
    const hud = wrap.querySelector('.map-hud');
    const base = document.createElement('canvas');
    const bctx = base.getContext('2d');

    const view = { lon: 12, lat: 22, ppd: 4, minPpd: 2, maxPpd: 60 }; // pixels per degree
    let W = 0, H = 0, DPR = 1, baseDirty = true;
    let anim = null;
    let hover = null;
    let pts = [];          // screen-space hit list for the current frame
    const pulses = [];     // { lat, lon, color, t0, big }
    const opts = { arcs: true, trails: true, grid: true };

    // ---------- land mask decode ----------
    const LM = window.BV_LANDMASK;
    const land = [];
    LM.rows.forEach((row, ri) => {
      const runs = row.split('.').map((s) => parseInt(s, 36));
      let x = 0, on = false;
      for (const n of runs) {
        if (on) for (let i = 0; i < n; i++) land.push([LM.latTop - (ri + 0.5) * LM.step, LM.lonLeft + (x + i + 0.5) * LM.step, ri, x + i]);
        x += n; on = !on;
      }
    });

    // ---------- projection ----------
    const project = (lat, lon) => [W / 2 + (lon - view.lon) * view.ppd, H / 2 - (lat - view.lat) * view.ppd];
    const unproject = (x, y) => [view.lat - (y - H / 2) / view.ppd, view.lon + (x - W / 2) / view.ppd];
    function clampView() {
      view.ppd = Math.max(view.minPpd, Math.min(view.maxPpd, view.ppd));
      const halfLon = W / 2 / view.ppd, halfLat = H / 2 / view.ppd;
      view.lon = halfLon >= 180 ? 0 : Math.max(-180 + halfLon, Math.min(180 - halfLon, view.lon));
      view.lat = halfLat >= 75 ? 10 : Math.max(-62 + halfLat, Math.min(85 - halfLat, view.lat));
    }

    function resize() {
      const r = wrap.getBoundingClientRect();
      DPR = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      for (const c of [canvas, base]) { c.width = W * DPR; c.height = H * DPR; }
      view.minPpd = Math.max(W / 360, H / 150);
      if (view.ppd < view.minPpd || !resize.done) view.ppd = Math.max(view.minPpd, W / 330);
      resize.done = true;
      clampView();
      baseDirty = true;
    }

    function drawBase() {
      bctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      bctx.clearRect(0, 0, W, H);
      // graticule
      if (opts.grid) {
        bctx.strokeStyle = 'rgba(78,242,194,0.05)';
        bctx.lineWidth = 1;
        bctx.beginPath();
        for (let lon = -180; lon <= 180; lon += 30) { const [x] = project(0, lon); bctx.moveTo(x, 0); bctx.lineTo(x, H); }
        for (let lat = -60; lat <= 90; lat += 30) { const [, y] = project(lat, 0); bctx.moveTo(0, y); bctx.lineTo(W, y); }
        bctx.stroke();
        const [, eq] = project(0, 0);
        bctx.strokeStyle = 'rgba(78,242,194,0.09)';
        bctx.setLineDash([2, 4]); bctx.beginPath(); bctx.moveTo(0, eq); bctx.lineTo(W, eq); bctx.stroke(); bctx.setLineDash([]);
      }
      // land dots
      // thin the grid when zoomed out so dots never merge into a solid fill
      const stride = Math.max(1, Math.ceil(3.2 / (LM.step * view.ppd)));
      const s = Math.max(1.1, Math.min(LM.step * stride * view.ppd * 0.42, 6));
      bctx.fillStyle = '#1d2a33';
      for (const [lat, lon, ri, ci] of land) {
        if (ri % stride || ci % stride) continue;
        const [x, y] = project(lat, lon);
        if (x < -6 || y < -6 || x > W + 6 || y > H + 6) continue;
        bctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
      baseDirty = false;
    }

    // ---------- markers ----------
    function glyph(c, kind, x, y, r, rot) {
      c.beginPath();
      switch (kind) {
        case 'hosts': c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.closePath(); c.fill(); break;
        case 'handles': c.arc(x, y, r * 0.85, 0, Math.PI * 2); c.fill(); break;
        case 'domains': c.rect(x - r * 0.75, y - r * 0.75, r * 1.5, r * 1.5); c.fill(); break;
        case 'pings': {
          c.save(); c.translate(x, y); c.rotate((rot || 0) * Math.PI / 180);
          c.moveTo(0, -r * 1.2); c.lineTo(r * 0.8, r); c.lineTo(-r * 0.8, r); c.closePath(); c.fill(); c.restore(); break;
        }
        case 'alerts': {
          c.lineWidth = 2; c.moveTo(x - r, y - r); c.lineTo(x + r, y + r); c.moveTo(x + r, y - r); c.lineTo(x - r, y + r); c.stroke(); break;
        }
        default: c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      }
    }

    function arc(c, a, b, color, alpha, t) {
      const [x1, y1] = a, [x2, y2] = b;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const d = Math.hypot(x2 - x1, y2 - y1);
      const cx = mx, cy = my - d * 0.28;
      c.strokeStyle = color; c.globalAlpha = alpha; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo(cx, cy, x2, y2); c.stroke();
      if (t !== undefined) { // travelling packet
        const u = t % 1, v = 1 - u;
        const px = v * v * x1 + 2 * v * u * cx + u * u * x2, py = v * v * y1 + 2 * v * u * cy + u * u * y2;
        c.globalAlpha = Math.min(1, alpha * 2.4); c.fillStyle = color;
        c.beginPath(); c.arc(px, py, 1.8, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
    }

    function frame(now) {
      requestAnimationFrame(frame);
      if (anim) stepAnim(now);
      if (baseDirty) drawBase();
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(base, 0, 0, W, H);

      const tNow = Date.now();
      const r0 = Math.max(2.2, Math.min(5, view.ppd * 0.55));
      pts = [];
      const sel = BV.store.state.selected;

      for (const L of BV.layers) {
        if (!L.visible) continue;
        const recs = BV.store.all(L.id);
        ctx.fillStyle = L.hex; ctx.strokeStyle = L.hex;

        if (L.id === 'pings' && opts.trails) {
          ctx.lineWidth = 1;
          for (const d of recs) {
            if (!d.trail || d.trail.length < 2) continue;
            ctx.beginPath();
            d.trail.forEach(([la, lo], i) => { const [x, y] = project(la, lo); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
            const [hx, hy] = project(d.lat, d.lon); ctx.lineTo(hx, hy);
            ctx.globalAlpha = 0.28; ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }

        if (L.id === 'alerts' && opts.arcs) {
          for (const a of recs) {
            if (!a.target) continue;
            const age = (tNow - a.ts) / 1000;
            if (age > 240) continue;
            const alpha = Math.max(0.07, 0.6 * Math.exp(-age / 60));
            arc(ctx, project(a.lat, a.lon), project(a.target.lat, a.target.lon), L.hex, alpha, age < 90 ? (tNow / 1600 + a.rank * 0.17) : undefined);
          }
        }

        for (const rec of recs) {
          if (rec.lat === undefined) continue;
          const [x, y] = project(rec.lat, rec.lon);
          if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
          const age = (tNow - rec.ts) / 1000;
          const fresh = Math.max(0, 1 - age / 30);
          ctx.globalAlpha = 0.5 + 0.5 * fresh;
          const r = r0 * (L.id === 'alerts' ? 1 + (rec.rank - 1) * 0.18 : 1) * (0.85 + (L.score ? L.score(rec) / 99 : 0.5) * 0.35);
          if (fresh > 0.3) { ctx.shadowColor = L.hex; ctx.shadowBlur = 10 * fresh; }
          glyph(ctx, L.id, x, y, r, rec.heading);
          ctx.shadowBlur = 0;
          pts.push({ x, y, rec, L });
        }
        ctx.globalAlpha = 1;
      }

      // pulses for new arrivals
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        const t = (tNow - p.t0) / 1600;
        if (t >= 1) { pulses.splice(i, 1); continue; }
        const [x, y] = project(p.lat, p.lon);
        ctx.strokeStyle = p.color; ctx.globalAlpha = (1 - t) * (p.big ? 0.9 : 0.55); ctx.lineWidth = p.big ? 1.6 : 1;
        ctx.beginPath(); ctx.arc(x, y, 3 + t * (p.big ? 34 : 16), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // selection reticle + links
      if (sel) {
        const rec = BV.store.get(sel.layer, sel.id);
        if (rec && rec.lat !== undefined) {
          const L = BV.layer(sel.layer);
          const [x, y] = project(rec.lat, rec.lon);
          if (L.links) {
            for (const o of L.links(rec, BV.store)) {
              if (o.lat === undefined || !BV.layer(o.layer).visible) continue;
              const [ox, oy] = project(o.lat, o.lon);
              ctx.setLineDash([3, 3]); ctx.strokeStyle = '#eef4f8'; ctx.globalAlpha = 0.45;
              ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ox, oy); ctx.stroke(); ctx.setLineDash([]);
              ctx.globalAlpha = 1; ctx.strokeStyle = BV.layer(o.layer).hex;
              ctx.beginPath(); ctx.arc(ox, oy, 7, 0, Math.PI * 2); ctx.stroke();
            }
          }
          if (rec.target) arc(ctx, [x, y], project(rec.target.lat, rec.target.lon), L.hex, 0.9, tNow / 1200);
          const spin = (tNow / 1000) % (Math.PI * 2);
          ctx.strokeStyle = L.hex; ctx.lineWidth = 1.4; ctx.globalAlpha = 1;
          for (let k = 0; k < 4; k++) {
            const a0 = spin + k * Math.PI / 2;
            ctx.beginPath(); ctx.arc(x, y, 14, a0, a0 + 0.9); ctx.stroke();
          }
          ctx.beginPath();
          ctx.moveTo(x - 24, y); ctx.lineTo(x - 17, y); ctx.moveTo(x + 17, y); ctx.lineTo(x + 24, y);
          ctx.moveTo(x, y - 24); ctx.lineTo(x, y - 17); ctx.moveTo(x, y + 17); ctx.lineTo(x, y + 24);
          ctx.stroke();
        }
      }

      if (hover) {
        ctx.strokeStyle = '#eef4f8'; ctx.globalAlpha = 0.8; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(hover.x, hover.y, 8, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      }

      if (now - (frame.hudT || 0) > 250) { frame.hudT = now; updateHud(); }
    }

    function updateHud() {
      const [la, lo] = [view.lat, view.lon];
      hud.innerHTML =
        '<span class="chip">center <b>' + la.toFixed(2) + ', ' + lo.toFixed(2) + '</b></span>' +
        '<span class="chip">zoom <b>' + (view.ppd / view.minPpd).toFixed(1) + 'x</b></span>' +
        '<span class="chip">on map <b>' + pts.length + '</b></span>';
    }

    // ---------- interaction ----------
    function nearest(mx, my) {
      let best = null, bd = 12 * 12;
      for (const p of pts) {
        const d = (p.x - mx) ** 2 + (p.y - my) ** 2;
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    }

    let drag = null;
    canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, lon: view.lon, lat: view.lat, moved: false };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) { drag.moved = true; canvas.classList.add('drag'); anim = null; }
        if (drag.moved) {
          view.lon = drag.lon - dx / view.ppd; view.lat = drag.lat + dy / view.ppd;
          clampView(); baseDirty = true; hideTip(); return;
        }
      }
      hover = nearest(mx, my);
      if (hover) showTip(hover, mx, my); else hideTip();
    });
    canvas.addEventListener('pointerup', (e) => {
      canvas.classList.remove('drag');
      if (drag && !drag.moved) {
        const r = canvas.getBoundingClientRect();
        const hit = nearest(e.clientX - r.left, e.clientY - r.top);
        BV.store.select(hit ? hit.rec : null, { from: 'map' });
      }
      drag = null;
    });
    canvas.addEventListener('pointerleave', () => { hover = null; hideTip(); });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
    canvas.addEventListener('dblclick', (e) => {
      const r = canvas.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, 2);
    });

    function zoomAt(mx, my, k) {
      anim = null;
      const [la, lo] = unproject(mx, my);
      view.ppd *= k; clampView();
      const [la2, lo2] = unproject(mx, my);
      view.lat += la - la2; view.lon += lo - lo2;
      clampView(); baseDirty = true;
    }

    function showTip(p, mx, my) {
      tip.style.display = 'block';
      tip.style.setProperty('--c', p.L.hex);
      tip.innerHTML = '<div class="t">' + p.L.glyph + ' ' + BV.fmt.esc(p.L.title(p.rec)) + '</div><div class="s">' +
        BV.fmt.esc(p.L.subtitle(p.rec)) + '</div><div class="s">' + BV.fmt.ago(p.rec.ts) + ' · click to inspect</div>';
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      tip.style.left = Math.min(W - tw - 8, mx + 14) + 'px';
      tip.style.top = Math.min(H - th - 8, my + 14) + 'px';
    }
    function hideTip() { tip.style.display = 'none'; }

    // ---------- animation ----------
    function flyTo(lat, lon, ppd) {
      const from = { lat: view.lat, lon: view.lon, ppd: view.ppd };
      const to = { lat, lon, ppd: ppd || Math.max(view.ppd, view.minPpd * 4) };
      anim = { from, to, t0: performance.now(), dur: 900 };
    }
    function stepAnim(now) {
      const t = Math.min(1, (now - anim.t0) / anim.dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      // zoom out a little mid-flight for a sense of travel
      const bump = Math.sin(Math.PI * t) * 0.35;
      view.lat = anim.from.lat + (anim.to.lat - anim.from.lat) * e;
      view.lon = anim.from.lon + (anim.to.lon - anim.from.lon) * e;
      view.ppd = (anim.from.ppd + (anim.to.ppd - anim.from.ppd) * e) * (1 - bump);
      clampView(); baseDirty = true;
      if (t >= 1) anim = null;
    }

    // ---------- wiring ----------
    BV.bus.on('record:new', (rec) => {
      const L = BV.layer(rec.layer);
      if (!L || !L.visible || rec.lat === undefined) return;
      if (pulses.length > 120) pulses.shift();
      pulses.push({ lat: rec.lat, lon: rec.lon, color: L.hex, t0: Date.now(), big: rec.layer === 'alerts' && rec.rank >= 3 });
    });
    BV.bus.on('select', ({ ref, opts: o }) => {
      if (!ref || o.from === 'map' || o.noFly) return;
      const rec = BV.store.get(ref.layer, ref.id);
      if (rec && rec.lat !== undefined) flyTo(rec.lat, rec.lon);
    });

    wrap.querySelector('[data-act=zin]').onclick = () => zoomAt(W / 2, H / 2, 1.6);
    wrap.querySelector('[data-act=zout]').onclick = () => zoomAt(W / 2, H / 2, 1 / 1.6);
    wrap.querySelector('[data-act=home]').onclick = () => flyTo(22, 12, view.minPpd * 1.05);
    const tArcs = wrap.querySelector('[data-act=arcs]');
    tArcs.onclick = () => { opts.arcs = !opts.arcs; opts.trails = opts.arcs; tArcs.classList.toggle('on', opts.arcs); };

    new ResizeObserver(resize).observe(wrap);
    resize();
    requestAnimationFrame(frame);

    BV.map = { flyTo, view, opts };
  };
})();
