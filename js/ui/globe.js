/* birds view · world view: rotating 3D globe and flat map (d3-geo on canvas).
   Draws countries, day/night, graticule, labels, every visible layer, tracks, arcs, pulses and
   selection overlays. Handles drag/inertia, wheel and pinch zoom, fly-to, follow, tour and regions. */
(function () {
  const BV = (window.BV = window.BV || {});
  const RAD = Math.PI / 180;

  const REGIONS = [
    ['World', 15, 10, 1], ['North America', 42, -100, 2.6], ['Central America & Caribbean', 16, -80, 4], ['South America', -18, -60, 2.6],
    ['Europe', 50, 12, 3.6], ['Africa', 3, 20, 2.4], ['Middle East', 28, 47, 4.5], ['South Asia', 22, 79, 4], ['East Asia', 35, 118, 3.2],
    ['Southeast Asia', 6, 112, 3.6], ['Oceania', -25, 140, 2.8], ['North Atlantic', 40, -40, 2.2], ['Pacific', 10, -170, 1.6], ['Arctic', 75, 20, 2.2],
  ];

  BV.initMap = function (wrap) {
    const canvas = wrap.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const base = document.createElement('canvas');
    const bctx = base.getContext('2d');
    const tip = wrap.querySelector('.tip');
    const hud = wrap.querySelector('.map-hud .readout');

    // ---------- world data ----------
    const W110 = window.BV_WORLD110;
    const world = {
      countries: topojson.feature(W110, W110.objects.countries).features,
      borders: topojson.mesh(W110, W110.objects.countries, (a, b) => a !== b),
      land: topojson.feature(W110, W110.objects.land),
    };
    let world50 = null;
    function detail() {
      if (!world50 && window.BV_WORLD50) {
        const W = window.BV_WORLD50;
        world50 = { borders: topojson.mesh(W, W.objects.countries, (a, b) => a !== b), land: fixWinding(topojson.feature(W, W.objects.land)) };
      }
      return world50;
    }
    // d3-geo treats a polygon whose rings wind the "wrong" way as covering the rest of the sphere;
    // flip any polygon larger than a hemisphere so fills stay on land.
    function fixWinding(fc) {
      const fixGeom = (g) => {
        if (!g) return;
        const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
        for (const poly of polys) {
          if (d3.geoArea({ type: 'Polygon', coordinates: poly }) > 2 * Math.PI) for (const ring of poly) ring.reverse();
        }
      };
      if (fc.type === 'FeatureCollection') fc.features.forEach((f) => fixGeom(f.geometry)); else fixGeom(fc.geometry || fc);
      return fc;
    }
    fixWinding(world.land);
    world.countries.forEach((f) => fixWinding(f));
    for (const f of world.countries) {
      f.name = (f.properties && f.properties.name) || 'Unknown';
      f.centroid = d3.geoCentroid(f);
      f.area = d3.geoArea(f);
      f.bounds = d3.geoBounds(f);
    }
    BV.countries = world.countries;
    const bySize = world.countries.slice().sort((a, b) => b.area - a.area);
    let FONT = null;
    const font = () => FONT || (FONT = getComputedStyle(document.body).fontFamily);
    const graticule = d3.geoGraticule10();
    const stars = Array.from({ length: 220 }, (_, i) => [Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1, Math.abs(Math.sin(i * 78.233) * 12345.678) % 1, (i % 7) / 7]);

    // ---------- view state ----------
    const view = { lat: 18, lon: 20, z: 1, mode: 'globe' };
    const opts = { night: true, labels: true, trails: true, spin: true, grid: true };
    const ortho = d3.geoOrthographic().clipAngle(90).precision(0.35);
    const flat = d3.geoEquirectangular().precision(0.35);
    let proj = ortho;
    const path = d3.geoPath(proj, ctx);
    const bpath = d3.geoPath(proj, bctx);
    let W = 0, H = 0, DPR = 1, baseScale = 1;
    let baseKey = '';
    let anim = null, follow = null, tour = null;
    let vel = { lon: 0, lat: 0 }, lastInteract = performance.now() - 10000;
    let hover = null, hoverCountry = null, cursor = null;
    let pts = [];
    const pulses = [];

    const zMin = () => (view.mode === 'globe' ? 0.6 : Math.max(1, H / (W / 2)));
    const zMax = 60;

    function configure(p) {
      if (view.mode === 'globe') {
        baseScale = Math.min(W, H) * 0.44;
        p.scale(baseScale * view.z).translate([W / 2, H / 2]).rotate([-view.lon, -view.lat]);
      } else {
        baseScale = W / (2 * Math.PI);
        const s = baseScale * view.z;
        const maxLat = Math.max(0, 85 - (H / 2) / (s * RAD));
        view.lat = Math.max(-maxLat, Math.min(maxLat, view.lat));
        p.scale(s).translate([W / 2, H / 2 + view.lat * RAD * s]).rotate([-view.lon, 0]);
      }
    }
    function clamp() {
      view.z = Math.max(zMin(), Math.min(zMax, view.z));
      view.lat = Math.max(-85, Math.min(85, view.lat));
      view.lon = ((view.lon + 540) % 360) - 180;
    }
    function visible(lon, lat) {
      if (view.mode !== 'globe') return true;
      return d3.geoDistance([lon, lat], [view.lon, view.lat]) < Math.PI / 2 - 0.01;
    }
    function project(lon, lat) {
      if (!visible(lon, lat)) return null;
      const p = proj([lon, lat]);
      if (!p || p[0] < -40 || p[1] < -40 || p[0] > W + 40 || p[1] > H + 40) return null;
      return p;
    }
    function screenAngle(lon, lat, heading) {
      const a = proj([lon, lat]);
      const h = (heading || 0) * RAD, d = 0.3;
      const b = proj([lon + Math.sin(h) * d / Math.max(0.2, Math.cos(lat * RAD)), lat + Math.cos(h) * d]);
      if (!a || !b) return 0;
      return Math.atan2(b[1] - a[1], b[0] - a[0]);
    }

    function resize() {
      const r = wrap.getBoundingClientRect();
      DPR = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      for (const c of [canvas, base]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
      clamp();
      baseKey = '';
    }

    // ---------- basemap ----------
    function drawBase(now) {
      const nightBucket = Math.floor(Date.now() / 20000);
      const key = [view.mode, view.lat.toFixed(3), view.lon.toFixed(3), view.z.toFixed(4), W, H, hoverCountry && hoverCountry.name,
        BV.store.state.country && BV.store.state.country.name, opts.night, opts.labels, opts.grid, nightBucket].join('|');
      if (key === baseKey) return;
      baseKey = key;
      const c = bctx;
      c.setTransform(DPR, 0, 0, DPR, 0, 0);
      c.clearRect(0, 0, W, H);
      configure(proj);
      const r = proj.scale();

      if (view.mode === 'globe') {
        // stars + atmosphere
        c.fillStyle = 'rgba(200,220,230,0.5)';
        for (const [sx, sy, b] of stars) { c.globalAlpha = 0.15 + b * 0.45; c.fillRect(sx * W, sy * H, 1, 1); }
        c.globalAlpha = 1;
        const g = c.createRadialGradient(W / 2, H / 2, r * 0.96, W / 2, H / 2, r * 1.16);
        g.addColorStop(0, 'rgba(78,242,194,0.20)'); g.addColorStop(0.35, 'rgba(69,140,255,0.08)'); g.addColorStop(1, 'rgba(6,8,10,0)');
        c.fillStyle = g; c.beginPath(); c.arc(W / 2, H / 2, r * 1.16, 0, Math.PI * 2); c.fill();
        const ocean = c.createRadialGradient(W / 2 - r * 0.35, H / 2 - r * 0.4, r * 0.1, W / 2, H / 2, r);
        ocean.addColorStop(0, '#0d2030'); ocean.addColorStop(1, '#060d14');
        c.fillStyle = ocean;
      } else {
        c.fillStyle = '#07111a';
      }
      c.beginPath(); bpath({ type: 'Sphere' }); c.fill();

      if (opts.grid) { c.beginPath(); bpath(graticule); c.strokeStyle = 'rgba(120,200,220,0.07)'; c.lineWidth = 0.6; c.stroke(); }

      // countries
      const sel = BV.store.state.country;
      const hi = view.z * baseScale > 1300 && detail();
      c.beginPath(); bpath(hi ? hi.land : world.land); c.fillStyle = '#132029'; c.fill();
      c.strokeStyle = 'rgba(120,200,215,0.42)'; c.lineWidth = 0.8; c.stroke();
      if (hoverCountry && hoverCountry !== (sel && sel.feature)) { c.beginPath(); bpath(hoverCountry); c.fillStyle = '#1b2d39'; c.fill(); }
      if (sel && sel.feature) { c.beginPath(); bpath(sel.feature); c.fillStyle = 'rgba(78,242,194,0.16)'; c.fill(); }
      c.beginPath(); bpath(hi ? hi.borders : world.borders); c.strokeStyle = 'rgba(120,170,190,0.28)'; c.lineWidth = 0.6; c.stroke();
      if (sel && sel.feature) { c.beginPath(); bpath(sel.feature); c.strokeStyle = 'rgba(78,242,194,0.85)'; c.lineWidth = 1.3; c.stroke(); }

      // day / night terminator with a soft twilight band
      if (opts.night) {
        const sun = BV.geo.sun(Date.now());
        const anti = [((sun[0] + 360) % 360) - 180, -sun[1]];
        for (const [rad, a] of [[95, 0.14], [89, 0.22]]) {
          c.beginPath(); bpath(d3.geoCircle().center(anti).radius(rad)()); c.fillStyle = 'rgba(0,3,8,' + a + ')'; c.fill();
        }
        const sp = visible(sun[0], sun[1]) && proj(sun);
        if (sp) {
          const sg = c.createRadialGradient(sp[0], sp[1], 0, sp[0], sp[1], 26);
          sg.addColorStop(0, 'rgba(255,214,120,0.55)'); sg.addColorStop(1, 'rgba(255,214,120,0)');
          c.fillStyle = sg; c.beginPath(); c.arc(sp[0], sp[1], 26, 0, Math.PI * 2); c.fill();
        }
      }

      if (view.mode === 'globe') { // limb shading
        const limb = c.createRadialGradient(W / 2, H / 2, r * 0.7, W / 2, H / 2, r);
        limb.addColorStop(0, 'rgba(0,0,0,0)'); limb.addColorStop(1, 'rgba(0,0,0,0.35)');
        c.fillStyle = limb; c.beginPath(); c.arc(W / 2, H / 2, r, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(78,242,194,0.35)'; c.lineWidth = 1; c.beginPath(); c.arc(W / 2, H / 2, r, 0, Math.PI * 2); c.stroke();
      }

      // labels
      if (opts.labels) {
        const pxArea = (r * r);
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = '500 10px ' + font();
        const placed = [];
        for (const f of bySize) {
          if (f.area * pxArea < 900) continue;
          const p = project(f.centroid[0], f.centroid[1]);
          if (!p) continue;
          const w = f.name.length * 6.4 + 6;
          if (placed.some((q) => Math.abs(q[0] - p[0]) < (q[2] + w) / 2 && Math.abs(q[1] - p[1]) < 13)) continue;
          placed.push([p[0], p[1], w]);
          c.fillStyle = sel && sel.feature === f ? 'rgba(78,242,194,0.95)' : 'rgba(170,195,210,0.55)';
          c.fillText(f.name.toUpperCase(), p[0], p[1]);
        }
        if (view.z * baseScale > 700) {
          c.font = '10px ' + font();
          c.textAlign = 'left';
          for (const pl of BV.PLACES) {
            const p = project(pl[3], pl[2]);
            if (!p) continue;
            if (placed.some((q) => Math.abs(q[0] - p[0]) < q[2] / 2 + 30 && Math.abs(q[1] - p[1]) < 12)) continue;
            c.fillStyle = 'rgba(200,215,225,0.8)'; c.fillRect(p[0] - 1.5, p[1] - 1.5, 3, 3);
            c.fillStyle = 'rgba(200,215,225,0.62)'; c.fillText(pl[0], p[0] + 5, p[1]);
            placed.push([p[0] + 30, p[1], 60]);
          }
        }
      }
    }

    // ---------- glyphs ----------
    function glyph(c, shape, x, y, r, ang, rec) {
      c.beginPath();
      switch (shape) {
        case 'plane': {
          c.save(); c.translate(x, y); c.rotate(ang); const s = r * 1.25;
          c.moveTo(s * 1.1, 0); c.lineTo(s * 0.2, s * 0.18); c.lineTo(-s * 0.1, s * 0.95); c.lineTo(-s * 0.32, s * 0.95); c.lineTo(-s * 0.18, s * 0.2);
          c.lineTo(-s * 0.8, s * 0.2); c.lineTo(-s * 0.95, s * 0.5); c.lineTo(-s * 1.05, s * 0.5); c.lineTo(-s * 0.95, 0);
          c.lineTo(-s * 1.05, -s * 0.5); c.lineTo(-s * 0.95, -s * 0.5); c.lineTo(-s * 0.8, -s * 0.2); c.lineTo(-s * 0.18, -s * 0.2);
          c.lineTo(-s * 0.32, -s * 0.95); c.lineTo(-s * 0.1, -s * 0.95); c.lineTo(s * 0.2, -s * 0.18); c.closePath(); c.fill(); c.restore(); break;
        }
        case 'ship': {
          c.save(); c.translate(x, y); c.rotate(ang); const s = r * 1.1;
          c.moveTo(s * 1.2, 0); c.lineTo(s * 0.4, s * 0.5); c.lineTo(-s * 0.9, s * 0.5); c.lineTo(-s * 0.9, -s * 0.5); c.lineTo(s * 0.4, -s * 0.5); c.closePath();
          c.fill(); c.restore(); break;
        }
        case 'sat': {
          c.save(); c.translate(x, y); c.rotate(ang || 0);
          c.fillRect(-r * 0.45, -r * 0.45, r * 0.9, r * 0.9);
          c.globalAlpha *= 0.85; c.fillRect(-r * 1.6, -r * 0.25, r * 0.95, r * 0.5); c.fillRect(r * 0.65, -r * 0.25, r * 0.95, r * 0.5);
          c.restore(); break;
        }
        case 'quake': {
          const m = rec.mag || 3;
          const rr = 2 + Math.max(0, m - 2.4) * 2.6;
          c.globalAlpha *= 0.28; c.arc(x, y, rr, 0, Math.PI * 2); c.fill(); c.globalAlpha /= 0.28;
          c.lineWidth = m >= 5 ? 1.6 : 1; c.beginPath(); c.arc(x, y, rr, 0, Math.PI * 2); c.stroke();
          c.beginPath(); c.arc(x, y, 1.4, 0, Math.PI * 2); c.fill(); break;
        }
        case 'fire': {
          const s = 1.4 + Math.min(3, Math.log10(rec.frp + 1));
          c.globalAlpha *= 0.25; c.arc(x, y, s * 2.4, 0, Math.PI * 2); c.fill(); c.globalAlpha /= 0.25;
          c.beginPath(); c.arc(x, y, s * 0.8, 0, Math.PI * 2); c.fill(); break;
        }
        case 'storm': {
          const rr = 8 + (rec.wind || 40) / 9;
          c.save(); c.translate(x, y); c.rotate(rec.spin || 0); c.lineWidth = 1.6;
          for (let k = 0; k < 3; k++) {
            c.beginPath();
            for (let t = 0; t <= 1; t += 0.05) { const a = k * 2.094 + t * 3.4 * (rec.hemi || 1), rad = rr * (0.25 + t); c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
            c.stroke();
          }
          c.beginPath(); c.arc(0, 0, 2.2, 0, Math.PI * 2); c.fill(); c.restore(); break;
        }
        case 'event': c.moveTo(x, y - r * 1.15); c.lineTo(x + r, y + r * 0.8); c.lineTo(x - r, y + r * 0.8); c.closePath(); c.fill(); c.globalAlpha *= 0.4; c.beginPath(); c.arc(x, y, r * 2, 0, Math.PI * 2); c.stroke(); break;
        case 'news': c.moveTo(x, y - r); c.lineTo(x + r * 0.8, y); c.lineTo(x, y + r); c.lineTo(x - r * 0.8, y); c.closePath(); c.fill(); break;
        case 'hosts': c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.closePath(); c.fill(); break;
        case 'domains': c.rect(x - r * 0.75, y - r * 0.75, r * 1.5, r * 1.5); c.fill(); break;
        case 'pings': {
          c.save(); c.translate(x, y); c.rotate(ang + Math.PI / 2);
          c.moveTo(0, -r * 1.2); c.lineTo(r * 0.8, r); c.lineTo(-r * 0.8, r); c.closePath(); c.fill(); c.restore(); break;
        }
        case 'alerts': c.lineWidth = 2; c.moveTo(x - r, y - r); c.lineTo(x + r, y + r); c.moveTo(x + r, y - r); c.lineTo(x - r, y + r); c.stroke(); break;
        default: c.arc(x, y, r * 0.85, 0, Math.PI * 2); c.fill();
      }
    }

    function line(coords, color, alpha, width, dash) {
      if (!coords || coords.length < 2) return;
      ctx.beginPath(); path({ type: 'LineString', coordinates: coords });
      ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = width || 1;
      if (dash) ctx.setLineDash(dash);
      ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    // fast polyline for short tracks: straight segments between projected points
    function track(coords, color, alpha, width, dash) {
      ctx.beginPath();
      let pen = false, prev = null;
      for (const q of coords) {
        const p = visible(q[0], q[1]) ? proj(q) : null;
        if (!p || (prev && Math.abs(p[0] - prev[0]) > W / 3)) { pen = false; prev = p; continue; } // hidden or wrapped
        if (pen) ctx.lineTo(p[0], p[1]); else { ctx.moveTo(p[0], p[1]); pen = true; }
        prev = p;
      }
      ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = width || 1;
      if (dash) ctx.setLineDash(dash);
      ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    function circle(center, radiusDeg, color, fillA, strokeA) {
      ctx.beginPath(); path(d3.geoCircle().center(center).radius(radiusDeg).precision(2)());
      if (fillA) { ctx.fillStyle = color; ctx.globalAlpha = fillA; ctx.fill(); }
      if (strokeA) { ctx.strokeStyle = color; ctx.globalAlpha = strokeA; ctx.lineWidth = 1; ctx.stroke(); }
      ctx.globalAlpha = 1;
    }

    // ---------- frame ----------
    let lastT = performance.now();
    function frame(now) {
      requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
      BV.server.advance(dt);
      stepCamera(now, dt);
      configure(proj);
      drawBase(now);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(base, 0, 0, W, H);

      const tNow = Date.now();
      const zs = view.z * baseScale / 300;
      const r0 = Math.max(2, Math.min(5, 2.2 + zs * 0.6));
      pts = [];
      const sel = BV.store.state.selected;

      for (const L of BV.layers) {
        if (!L.visible) continue;
        const recs = BV.store.all(L.id);
        const hex = L.hex;

        if (opts.trails && L.moving) {
          for (const d of recs) {
            if (!d.trail || d.trail.length < 2) continue;
            const coords = d.trail.concat([[d.lon, d.lat]]);
            track(coords, hex, L.id === 'storms' ? 0.5 : 0.22, L.id === 'storms' ? 1.4 : 0.9, L.id === 'storms' ? [3, 3] : null);
          }
        }
        if (L.id === 'pings' && opts.trails) {
          for (const d of recs) if (d.trail && d.trail.length > 1) track(d.trail.map(([la, lo]) => [lo, la]).concat([[d.lon, d.lat]]), hex, 0.25, 1);
        }
        if (L.id === 'alerts' && opts.trails) {
          for (const a of recs) {
            if (!a.target) continue;
            const age = (tNow - a.ts) / 1000;
            if (age > 240) continue;
            line([[a.lon, a.lat], [a.target.lon, a.target.lat]], hex, Math.max(0.08, 0.55 * Math.exp(-age / 60)), 1);
            if (age < 90) {
              const t = ((tNow / 1800 + a.rank * 0.17) % 1);
              const p = d3.geoInterpolate([a.lon, a.lat], [a.target.lon, a.target.lat])(t);
              const sp = project(p[0], p[1]);
              if (sp) { ctx.fillStyle = hex; ctx.beginPath(); ctx.arc(sp[0], sp[1], 1.8, 0, Math.PI * 2); ctx.fill(); }
            }
          }
        }

        ctx.fillStyle = hex; ctx.strokeStyle = hex;
        for (const rec of recs) {
          if (rec.lat === undefined || rec.ended) continue;
          const p = project(rec.lon, rec.lat);
          if (!p) continue;
          const age = (tNow - rec.ts) / 1000;
          const fresh = L.moving ? 0.6 : Math.max(0, 1 - age / 30);
          ctx.globalAlpha = L.moving ? 0.95 : 0.45 + 0.55 * fresh;
          if (L.id === 'quakes') ctx.globalAlpha = Math.max(0.35, 1 - age / 7200);
          if (L.id === 'fires') ctx.globalAlpha = Math.max(0.4, 1 - age / 3600);
          if (L.fade) ctx.globalAlpha = Math.max(0.4, 1 - age / L.fade);
          const shape = L.shape || L.id;
          const r = r0 * (L.id === 'alerts' ? 1 + (rec.rank - 1) * 0.18 : 1);
          const ang = rec.heading !== undefined && (shape === 'plane' || shape === 'ship' || shape === 'pings' || shape === 'sat') ? screenAngle(rec.lon, rec.lat, rec.heading) : 0;
          glyph(ctx, shape, p[0], p[1], r, ang, rec);
          pts.push({ x: p[0], y: p[1], rec, L });
        }
        ctx.globalAlpha = 1;
      }

      // pulses for new arrivals
      for (let i = pulses.length - 1; i >= 0; i--) {
        const pu = pulses[i];
        const t = (tNow - pu.t0) / pu.dur;
        if (t >= 1) { pulses.splice(i, 1); continue; }
        const p = project(pu.lon, pu.lat);
        if (!p) continue;
        ctx.strokeStyle = pu.color; ctx.globalAlpha = (1 - t) * (pu.big ? 0.9 : 0.5); ctx.lineWidth = pu.big ? 1.6 : 1;
        ctx.beginPath(); ctx.arc(p[0], p[1], 3 + t * (pu.big ? 44 : 16), 0, Math.PI * 2); ctx.stroke();
        if (pu.big) { ctx.globalAlpha *= 0.6; ctx.beginPath(); ctx.arc(p[0], p[1], 3 + t * 24, 0, Math.PI * 2); ctx.stroke(); }
      }
      ctx.globalAlpha = 1;

      drawSelection(tNow);

      if (hover) {
        ctx.strokeStyle = '#eef4f8'; ctx.globalAlpha = 0.85; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(hover.x, hover.y, 9, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      }

      if (now - (frame.hudT || 0) > 200) { frame.hudT = now; updateHud(); }
    }

    function drawSelection(tNow) {
      const sel = BV.store.state.selected;
      if (!sel) return;
      const rec = BV.store.get(sel.layer, sel.id);
      if (!rec || rec.lat === undefined) return;
      const L = BV.layer(sel.layer);
      const hex = L.hex;
      // per-type overlays
      if ((sel.layer === 'flights' || sel.layer === 'lflights') && rec.route) {
        line(rec.route, hex, 0.35, 1, [4, 4]);
        line([[rec.lon, rec.lat], rec.route[1]], hex, 0.8, 1.4);
        for (const q of rec.route) { const p = project(q[0], q[1]); if (p) { ctx.strokeStyle = hex; ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, Math.PI * 2); ctx.stroke(); } }
      }
      if (sel.layer === 'vessels' && rec.laneRef) line(rec.laneRef.pts, hex, 0.35, 1, [4, 4]);
      if (L.groundTrack) {
        line(L.groundTrack(rec), hex, 0.55, 1.2, [5, 4]);
        circle([rec.lon, rec.lat], L.footprintDeg(rec), hex, 0.07, 0.5);
      }
      if (sel.layer === 'storms') {
        circle([rec.lon, rec.lat], (rec.wind * 3.2) / 111, hex, 0.06, 0.45);
        circle([rec.lon, rec.lat], (rec.wind * 1.4) / 111, hex, 0.08, 0.6);
      }
      if (rec.track) track(rec.track, hex, 0.6, 1.2, [3, 3]);
      if (sel.layer === 'quakes' || sel.layer === 'lquakes') circle([rec.lon, rec.lat], Math.pow(10, 0.43 * rec.mag - 0.6) / 111, hex, 0.07, 0.6);
      if (rec.target) line([[rec.lon, rec.lat], [rec.target.lon, rec.target.lat]], hex, 0.9, 1.4);
      if (L.links) {
        for (const o of L.links(rec, BV.store).slice(0, 12)) {
          if (o.lat === undefined || !BV.layer(o.layer).visible) continue;
          line([[rec.lon, rec.lat], [o.lon, o.lat]], '#eef4f8', 0.35, 1, [3, 3]);
          const op = project(o.lon, o.lat);
          if (op) { ctx.strokeStyle = BV.layer(o.layer).hex; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(op[0], op[1], 7, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
        }
      }
      const p = project(rec.lon, rec.lat);
      if (!p) return;
      const [x, y] = p;
      const spin = (tNow / 1000) % (Math.PI * 2);
      ctx.strokeStyle = hex; ctx.lineWidth = 1.4;
      for (let k = 0; k < 4; k++) { const a0 = spin + k * Math.PI / 2; ctx.beginPath(); ctx.arc(x, y, 15, a0, a0 + 0.9); ctx.stroke(); }
      ctx.beginPath();
      ctx.moveTo(x - 25, y); ctx.lineTo(x - 18, y); ctx.moveTo(x + 18, y); ctx.lineTo(x + 25, y);
      ctx.moveTo(x, y - 25); ctx.lineTo(x, y - 18); ctx.moveTo(x, y + 18); ctx.lineTo(x, y + 25);
      ctx.stroke();
      // callout label
      const label = L.title(rec);
      ctx.font = '500 11px ' + font();
      const w = ctx.measureText(label).width + 12;
      const lx = Math.min(W - w - 6, x + 22), ly = Math.max(6, y - 34);
      ctx.fillStyle = 'rgba(6,8,10,0.85)'; ctx.fillRect(lx, ly, w, 18);
      ctx.strokeStyle = hex; ctx.globalAlpha = 0.8; ctx.strokeRect(lx + 0.5, ly + 0.5, w - 1, 17); ctx.globalAlpha = 1;
      ctx.fillStyle = '#eef4f8'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(label, lx + 6, ly + 9.5);
    }

    function updateHud() {
      const c = cursor ? cursor[1].toFixed(2) + '°, ' + cursor[0].toFixed(2) + '°' : '—';
      hud.innerHTML =
        '<span class="chip">cursor <b>' + c + '</b></span>' +
        '<span class="chip">zoom <b>' + view.z.toFixed(1) + 'x</b></span>' +
        '<span class="chip">in view <b>' + pts.length.toLocaleString() + '</b></span>' +
        (follow ? '<span class="chip live">following <b>' + BV.fmt.esc(BV.layer(follow.layer).title(follow)) + '</b></span>' : '') +
        (tour ? '<span class="chip live">tour <b>on</b> · Esc stops</span>' : '');
    }

    // ---------- camera ----------
    function stepCamera(now, dt) {
      let moved = false;
      if (anim) {
        const t = Math.min(1, (now - anim.t0) / anim.dur);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const c = anim.interp(e);
        view.lon = c[0]; view.lat = c[1];
        const bump = anim.bump ? Math.sin(Math.PI * t) * anim.bump : 0;
        view.z = Math.exp(Math.log(anim.from.z) + (Math.log(anim.to.z) - Math.log(anim.from.z)) * e) * (1 - bump);
        if (t >= 1) anim = null;
        moved = true;
      } else if (follow) {
        if (follow.ended || !BV.store.get(follow.layer, follow.id)) { follow = null; BV.toast('Target left the feed'); }
        else {
          const k = 1 - Math.pow(0.02, dt);
          const dl = ((follow.lon - view.lon + 540) % 360) - 180;
          view.lon += dl * k; view.lat += (follow.lat - view.lat) * k; moved = true;
        }
      } else if (Math.abs(vel.lon) + Math.abs(vel.lat) > 0.01 && !drag) {
        view.lon += vel.lon * dt; view.lat += vel.lat * dt;
        const f = Math.pow(0.04, dt); vel.lon *= f; vel.lat *= f; moved = true;
      } else if (opts.spin && view.mode === 'globe' && now - lastInteract > 6000 && !BV.store.state.selected && !tour) {
        view.lon += dt * 3.5 * Math.min(1, (now - lastInteract - 6000) / 2000); moved = true;
      }
      if (moved) { clamp(); saveHash(); }
    }

    function flyTo(lat, lon, z, opt) {
      follow = opt && opt.follow ? follow : null;
      const from = { lat: view.lat, lon: view.lon, z: view.z };
      const to = { lat, lon, z: Math.max(zMin(), Math.min(zMax, z || Math.max(view.z, view.mode === 'globe' ? 2.4 : 4))) };
      const dist = d3.geoDistance([from.lon, from.lat], [lon, lat]);
      const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      anim = { from, to, t0: performance.now(), dur: reduce ? 1 : 700 + dist * 420, interp: d3.geoInterpolate([from.lon, from.lat], [lon, lat]), bump: Math.min(0.45, dist * 0.25) };
      lastInteract = performance.now();
    }
    function startFollow(rec) {
      if (!rec || rec.lat === undefined) return;
      follow = rec;
      flyTo(rec.lat, rec.lon, Math.max(view.z, view.mode === 'globe' ? 3 : 5), { follow: true });
    }
    function stopFollow() { follow = null; }

    // ---------- tour ----------
    function tourStops() {
      const s = BV.store, out = [];
      const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
      const add = (r) => { if (r && r.lat !== undefined && BV.layer(r.layer).visible) out.push(r); };
      add(s.all('alerts').filter((a) => a.rank >= 3).slice(-1)[0]);
      add(s.all('quakes').slice().sort((a, b) => b.mag - a.mag)[0]);
      add(s.all('lquakes').slice().sort((a, b) => b.mag - a.mag)[0]);
      add(pick(s.all('events')));
      add(pick(s.all('news')));
      add(pick(s.all('lflights').filter((f) => !f.onGround)));
      add(s.all('lsats').find((x) => /ISS/.test(x.name)));
      add(pick(s.all('storms').filter((x) => !x.ended)));
      add(pick(s.all('flights').filter((f) => f.routeKm > 6000)));
      add(pick(s.all('vessels')));
      add(s.all('sats').find((x) => x.family === 'station'));
      add(s.all('fires').slice().sort((a, b) => b.frp - a.frp)[0]);
      add(pick(s.all('hosts').filter((h) => h.risk > 70)));
      add(pick(s.all('pings')));
      return out.sort(() => Math.random() - 0.5);
    }
    function startTour() {
      stopTour(true);
      let stops = tourStops(), i = 0;
      const step = () => {
        if (i >= stops.length) { stops = tourStops(); i = 0; }
        const r = stops[i++];
        if (!r) return;
        BV.store.select(r, { from: 'tour', noFly: true });
        flyTo(r.lat, r.lon, view.mode === 'globe' ? 2.8 : 5);
      };
      tour = setInterval(step, 7000); step();
      BV.bus.emit('tour', true);
    }
    function stopTour(silent) { if (tour) { clearInterval(tour); tour = null; if (!silent) BV.bus.emit('tour', false); } }

    // ---------- hit testing ----------
    function nearest(mx, my) {
      let best = null, bd = 13 * 13;
      for (const p of pts) { const d = (p.x - mx) ** 2 + (p.y - my) ** 2; if (d < bd) { bd = d; best = p; } }
      return best;
    }
    function invert(mx, my) {
      const ll = proj.invert([mx, my]);
      if (!ll || isNaN(ll[0])) return null;
      if (view.mode === 'globe' && !visible(ll[0], ll[1])) return null;
      if (view.mode === 'globe' && Math.hypot(mx - W / 2, my - H / 2) > proj.scale()) return null;
      return ll;
    }
    function countryAt(ll) {
      if (!ll) return null;
      // d3-geo treats a polygon whose rings wind the "wrong" way as covering the rest of the sphere;
    // flip any polygon larger than a hemisphere so fills stay on land.
    function fixWinding(fc) {
      const fixGeom = (g) => {
        if (!g) return;
        const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
        for (const poly of polys) {
          if (d3.geoArea({ type: 'Polygon', coordinates: poly }) > 2 * Math.PI) for (const ring of poly) ring.reverse();
        }
      };
      if (fc.type === 'FeatureCollection') fc.features.forEach((f) => fixGeom(f.geometry)); else fixGeom(fc.geometry || fc);
      return fc;
    }
    fixWinding(world.land);
    world.countries.forEach((f) => fixWinding(f));
    for (const f of world.countries) {
        const b = f.bounds;
        const inLat = ll[1] >= b[0][1] - 0.5 && ll[1] <= b[1][1] + 0.5;
        const inLon = b[0][0] <= b[1][0] ? ll[0] >= b[0][0] - 0.5 && ll[0] <= b[1][0] + 0.5 : ll[0] >= b[0][0] || ll[0] <= b[1][0];
        if (inLat && inLon && d3.geoContains(f, ll)) return f;
      }
      return null;
    }

    // ---------- pointer / touch ----------
    const pointers = new Map();
    let drag = null, pinch = null;
    const degPerPx = () => 1 / (proj.scale() * RAD);
    function interact() { lastInteract = performance.now(); anim = null; stopTour(); }

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.z }; drag = null;
      } else {
        drag = { x: e.clientX, y: e.clientY, lon: view.lon, lat: view.lat, moved: false, t: performance.now(), px: e.clientX, py: e.clientY };
      }
      vel = { lon: 0, lat: 0 };
    });
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        view.z = pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d; clamp(); interact(); return;
      }
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; canvas.classList.add('drag'); interact(); stopFollow(); }
        if (drag.moved) {
          const k = degPerPx();
          view.lon = drag.lon - dx * k; view.lat = drag.lat + dy * k; clamp();
          const t = performance.now(), dtt = Math.max(1, t - drag.t) / 1000;
          vel = { lon: -(e.clientX - drag.px) * k / dtt * 0.6, lat: (e.clientY - drag.py) * k / dtt * 0.6 };
          drag.t = t; drag.px = e.clientX; drag.py = e.clientY;
          hideTip(); return;
        }
      }
      cursor = invert(mx, my);
      hover = nearest(mx, my);
      const hc = hover ? null : countryAt(cursor);
      if (hc !== hoverCountry) { hoverCountry = hc; }
      if (hover) showTip(hover, mx, my); else if (hoverCountry) showCountryTip(hoverCountry, mx, my); else hideTip();
    });
    function endPointer(e) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      canvas.classList.remove('drag');
      if (drag && !drag.moved && e.type === 'pointerup') {
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        const hit = nearest(mx, my);
        interact();
        if (hit) BV.store.select(hit.rec, { from: 'map' });
        else {
          const f = countryAt(invert(mx, my));
          if (f) { const at = invert(mx, my); BV.store.selectCountry({ name: f.name, feature: f, at: at ? [at[1], at[0]] : null }, { from: 'map' }); }
          else { BV.store.select(null); BV.store.selectCountry(null); }
        }
      }
      if (drag && performance.now() - drag.t > 80) vel = { lon: 0, lat: 0 };
      drag = null;
    }
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('pointerleave', () => { hover = null; hoverCountry = null; cursor = null; hideTip(); });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)));
    }, { passive: false });
    canvas.addEventListener('dblclick', (e) => {
      const r = canvas.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, 2);
    });

    function zoomAt(mx, my, k) {
      interact();
      const before = invert(mx, my);
      const z0 = view.z;
      view.z = Math.max(zMin(), Math.min(zMax, view.z * k));
      if (before) { // pull the center toward the cursor so the point under it stays put (approximately)
        const f = 1 - z0 / view.z;
        const c = d3.geoInterpolate([view.lon, view.lat], before)(f);
        view.lon = c[0]; view.lat = c[1];
      }
      clamp(); saveHash();
    }
    function zoomBy(k) { zoomAt(W / 2, H / 2, k); }
    function pan(dLon, dLat) { interact(); stopFollow(); view.lon += dLon / view.z; view.lat += dLat / view.z; clamp(); saveHash(); }

    function showTip(p, mx, my) {
      tip.style.display = 'block';
      tip.style.setProperty('--c', p.L.hex);
      tip.innerHTML = '<div class="t">' + p.L.glyph + ' ' + BV.fmt.esc(p.L.title(p.rec)) + '</div><div class="s">' +
        BV.fmt.esc(p.L.subtitle(p.rec)) + '</div><div class="s dim">' + BV.fmt.esc(p.L.label) + ' · ' + BV.fmt.ago(p.rec.ts) + ' · click to inspect</div>';
      placeTip(mx, my);
    }
    function showCountryTip(f, mx, my) {
      tip.style.display = 'block';
      tip.style.setProperty('--c', 'var(--muted)');
      tip.innerHTML = '<div class="t">' + BV.fmt.esc(f.name) + '</div><div class="s dim">click for a country briefing</div>';
      placeTip(mx, my);
    }
    function placeTip(mx, my) {
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      tip.style.left = Math.max(6, Math.min(W - tw - 8, mx + 14)) + 'px';
      tip.style.top = Math.max(6, Math.min(H - th - 8, my + 14)) + 'px';
    }
    function hideTip() { tip.style.display = 'none'; }

    // ---------- modes, toggles, hash ----------
    function setMode(m) {
      if (m === view.mode) return;
      view.mode = m;
      proj = m === 'globe' ? ortho : flat;
      path.projection(proj); bpath.projection(proj);
      view.z = m === 'globe' ? Math.max(0.9, view.z / 2) : Math.max(1, view.z * 2);
      clamp(); baseKey = '';
      BV.bus.emit('map:mode', m); saveHash();
    }
    function toggle(k) { opts[k] = !opts[k]; baseKey = ''; BV.bus.emit('map:opts', opts); return opts[k]; }
    let hashT = null;
    function saveHash() {
      clearTimeout(hashT);
      hashT = setTimeout(() => {
        const h = view.lat.toFixed(2) + ',' + view.lon.toFixed(2) + ',' + view.z.toFixed(2) + ',' + (view.mode === 'globe' ? 'g' : 'f');
        try { history.replaceState(null, '', '#' + h); } catch (e) { /* sandboxed frames may refuse */ }
      }, 400);
    }
    function loadHash() {
      const m = (location.hash || '').match(/^#(-?[\d.]+),(-?[\d.]+),([\d.]+),([gf])$/);
      if (!m) return false;
      if (m[4] === 'f') setMode('flat');
      view.lat = +m[1]; view.lon = +m[2]; view.z = +m[3]; clamp();
      lastInteract = performance.now();
      return true;
    }

    // ---------- wiring ----------
    BV.bus.on('record:new', (rec) => {
      const L = BV.layer(rec.layer);
      if (!L || !L.visible || rec.lat === undefined) return;
      if (L.moving && rec.layer !== 'storms') return;
      if (rec.live && rec.layer === 'news') return; // position reports on moving things would flicker constantly
      if (pulses.length > 140) pulses.shift();
      const big = (rec.layer === 'alerts' && rec.rank >= 3) || ((rec.layer === 'quakes' || rec.layer === 'lquakes') && rec.mag >= 5);
      pulses.push({ lat: rec.lat, lon: rec.lon, color: L.hex, t0: Date.now(), dur: big ? 2600 : 1600, big });
    });
    BV.bus.on('select', ({ ref, country, opts: o }) => {
      baseKey = '';
      if (o.from === 'map' || o.noFly) return;
      if (ref) {
        const rec = BV.store.get(ref.layer, ref.id);
        if (rec && rec.lat !== undefined) { stopTour(); flyTo(rec.lat, rec.lon); }
      } else if (country && country.feature) {
        const f = country.feature;
        const zz = Math.max(1.4, Math.min(8, 0.9 / Math.sqrt(f.area) * (view.mode === 'globe' ? 0.5 : 1)));
        flyTo(f.centroid[1], f.centroid[0], zz);
      }
    });

    new ResizeObserver(resize).observe(wrap);
    resize();
    if (!loadHash()) { view.lon = 20 - ((new Date().getUTCHours() - 12) * 15); clamp(); } // start over the daylit side
    requestAnimationFrame(frame);

    BV.map = {
      view, opts, regions: REGIONS, flyTo, zoomBy, pan, setMode, toggle, startFollow, stopFollow,
      isFollowing: (rec) => !!follow && rec && follow.id === rec.id, startTour, stopTour, touring: () => !!tour,
      home: () => flyTo(15, view.lon, view.mode === 'globe' ? 1 : 1), countryAt,
    };
  };
})();
