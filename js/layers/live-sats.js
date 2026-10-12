/* layer · Live Satellites: real orbital elements from CelesTrak, propagated in the browser
   with SGP4 (satellite.js). Positions are computed for the actual current time, so the ISS
   you see is where the ISS is. Elements are cached for 6 hours to respect CelesTrak's limits. */
(function () {
  const GROUPS = [['stations', 'space station'], ['visual', 'bright / visible'], ['weather', 'weather'], ['gps-ops', 'GPS'], ['science', 'science'], ['geo', 'geostationary']];
  const MAX_GEO = 60;
  const RAD = 180 / Math.PI;
  const MU = 398600.4418, RE = 6371;

  function parseTLE(text, group) {
    const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
    const out = [];
    for (let i = 0; i + 2 < lines.length + 1; i++) {
      if (lines[i + 1] && lines[i + 1][0] === '1' && lines[i + 2] && lines[i + 2][0] === '2') {
        out.push({ name: lines[i].trim(), l1: lines[i + 1], l2: lines[i + 2], group });
        i += 2;
      }
    }
    return out;
  }

  function locate(s, date) {
    const pv = satellite.propagate(s.satrec, date);
    if (!pv || !pv.position || isNaN(pv.position.x)) return null;
    const g = satellite.eciToGeodetic(pv.position, satellite.gstime(date));
    const v = pv.velocity;
    return { lat: g.latitude * RAD, lon: satellite.degreesLong(g.longitude), alt: g.height, vel: Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) };
  }

  function build(t) {
    let satrec;
    try { satrec = satellite.twoline2satrec(t.l1, t.l2); } catch (e) { return null; }
    if (!satrec || satrec.error) return null;
    const norad = t.l1.slice(2, 7).trim();
    const s = {
      id: 'sat-' + norad, name: t.name, norad, intl: t.l1.slice(9, 17).trim(), group: t.group, satrec,
      inc: satrec.inclo * RAD, period: (2 * Math.PI) / satrec.no * 60, // seconds
      epoch: Date.UTC(2000 + +t.l1.slice(18, 20) - (+t.l1.slice(18, 20) > 56 ? 100 : 0), 0, 1) + (+t.l1.slice(20, 32) - 1) * 86400000,
      trail: [], city: 'orbit', cc: '', ts: Date.now(),
    };
    const p = locate(s, new Date());
    if (!p) return null;
    Object.assign(s, { lat: p.lat, lon: p.lon, altKm: Math.round(p.alt), vel: p.vel });
    return s;
  }

  async function elements(api) {
    const cached = api.cache.get('tle.v1', 6 * 3600000);
    if (cached && cached.length) return cached;
    const all = [];
    let lastErr = null;
    for (const [g, label] of GROUPS) {
      try {
        const txt = await api.fetchText('https://celestrak.org/NORAD/elements/gp.php?GROUP=' + g + '&FORMAT=tle', { timeout: 15000 });
        let list = parseTLE(txt, label);
        if (g === 'geo') list = list.slice(0, MAX_GEO);
        all.push(...list);
      } catch (e) { lastErr = e; }
    }
    if (!all.length) throw lastErr || new Error('no elements');
    const seen = new Set();
    const uniq = all.filter((t) => { const k = t.l1.slice(2, 7); if (seen.has(k)) return false; seen.add(k); return true; });
    api.cache.set('tle.v1', uniq);
    return uniq;
  }

  BV.registerLayer({
    id: 'lsats', live: true, source: 'CelesTrak + SGP4', fallback: 'sats',
    group: 'Live', short: 'Satellites', label: 'Live Satellites', color: '--c-sats', glyph: '✦', shape: 'sat',
    interval: 6 * 3600000, cap: 1200, moving: true,
    async poll(api) {
      if (typeof satellite === 'undefined') throw new Error('SGP4 library missing');
      return (await elements(api)).map(build).filter(Boolean);
    },
    merge(cur, r) { cur.satrec = r.satrec; cur.epoch = r.epoch; cur.group = r.group; },
    update(s, rng, dt) {
      s._t = (s._t || 0) + dt;
      if (s._t < 0.4) return; // SGP4 is cheap but not free; 2.5 Hz is smooth at globe scale
      s._t = 0;
      const p = locate(s, new Date());
      if (!p) return;
      if (s.lat !== undefined) {
        s.heading = BV.geo.bearing([s.lon, s.lat], [p.lon, p.lat]);
        s._tr = (s._tr || 0) + 1;
        if (s._tr % 5 === 0) { s.trail.push([s.lon, s.lat]); if (s.trail.length > 40) s.trail.shift(); }
      }
      s.lat = p.lat; s.lon = p.lon; s.altKm = Math.round(p.alt); s.vel = p.vel;
    },
    groundTrack(s) {
      if (s.period > 80000) return [];
      const out = [], now = Date.now();
      for (let k = 0; k <= 120; k++) { const p = locate(s, new Date(now + (s.period * 1000 * k) / 120)); if (p) out.push([p.lon, p.lat]); }
      return out;
    },
    footprintDeg: (s) => Math.acos(RE / (RE + Math.max(1, s.altKm))) * RAD,
    columns: [
      { key: 'name', label: 'Satellite', width: 170 },
      { key: 'group', label: 'Group', width: 120 },
      { key: 'norad', label: 'NORAD', width: 70 },
      { key: 'altKm', label: 'Alt km', width: 76, fmt: (v) => v.toLocaleString() },
      { key: 'vel', label: 'km/s', width: 60, fmt: (v) => v.toFixed(2) },
      { key: 'inc', label: 'Inc', width: 60, fmt: (v) => v.toFixed(1) + '°' },
      { key: 'period', label: 'Period', width: 76, fmt: (v) => Math.round(v / 60) + ' min' },
      { key: 'lat', label: 'Lat', width: 70, fmt: (v) => v.toFixed(2) },
      { key: 'lon', label: 'Lon', fmt: (v) => v.toFixed(2) },
    ],
    title: (r) => r.name,
    subtitle: (r) => r.group + ' · ' + r.altKm.toLocaleString() + ' km · ' + r.vel.toFixed(2) + ' km/s',
    searchText: (r) => ['satellite', r.name, r.group, r.norad, r.intl, /ISS|ZARYA/.test(r.name) ? 'iss space station' : ''].join(' '),
    fields: (r) => [
      ['name', r.name, true], ['group', r.group], ['NORAD id', r.norad, true], ['launch id', r.intl], ['altitude', r.altKm.toLocaleString() + ' km'],
      ['velocity', r.vel.toFixed(2) + ' km/s (' + Math.round(r.vel * 3600).toLocaleString() + ' km/h)'], ['inclination', r.inc.toFixed(2) + '°'],
      ['period', (r.period / 60).toFixed(1) + ' min'], ['sub-point', BV.fmt.coord(r.lat, r.lon)],
      ['footprint', 'radius ' + Math.round(BV.geo.R * Math.acos(RE / (RE + r.altKm))).toLocaleString() + ' km'], ['elements', 'epoch ' + BV.fmt.ago(r.epoch)],
    ],
    actions: (r) => [['N2YO ↗', 'https://www.n2yo.com/satellite/?s=' + r.norad], ['CelesTrak ↗', 'https://celestrak.org/satcat/table-satcat.php?CATNR=' + r.norad]],
    score: (r) => Math.min(99, Math.round(Math.log10(Math.max(10, r.altKm)) * 22)),
    links(r, store) { return store.all('lsats').filter((x) => x !== r && x.group === r.group).slice(0, 8); },
    logLine: (r) => `tle ${r.name} #${r.norad} alt ${r.altKm}km`,
  });
})();
