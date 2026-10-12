/* layer · Orbital: simulated satellites on circular orbits with real orbital periods (time x TIME) */
(function () {
  const TIME = 6;
  const MU = 398600.4418, RE = 6371, WE = 7.2921159e-5; // km^3/s^2, km, rad/s
  const RAD = Math.PI / 180;

  function position(s, t) {
    if (s.family === 'geostationary') return [s.raan, 0];
    const u = s.u0 + (2 * Math.PI * t) / s.period;
    const i = s.inc * RAD;
    const lat = Math.asin(Math.sin(i) * Math.sin(u));
    const lon = s.raan * RAD + Math.atan2(Math.cos(i) * Math.sin(u), Math.cos(u)) - WE * t;
    return [(((lon / RAD) % 360) + 540) % 360 - 180, lat / RAD];
  }

  BV.registerLayer({
    id: 'sats', group: 'Movement', short: 'Satellites', label: 'Orbital', color: '--c-sats', glyph: '✦', shape: 'sat',
    rate: 0.5, backfill: 45, cap: 80, moving: true,
    seed(rng) {
      const out = [];
      for (const [family, n, inc, alt, prefix] of BV.SAT_FAMILIES) {
        for (let k = 0; k < n; k++) {
          const a = RE + alt + rng.float(-15, 15);
          const s = {
            id: rng.id('s'), name: n === 1 ? prefix : prefix + (k + 1 + rng.int(0, 3) * 10), family, inc: inc + rng.gauss(0, 0.05),
            altKm: Math.round(a - RE), period: 2 * Math.PI * Math.sqrt((a * a * a) / MU), vel: Math.sqrt(MU / a),
            raan: family === 'geostationary' ? -150 + k * 42 + rng.float(-6, 6) : rng.float(-180, 180), u0: rng.float(0, Math.PI * 2),
            norad: String(rng.int(60000, 69999)), t: 0, trail: [], cc: '—', city: 'orbit',
            operator: rng.pick(['Lattice Orbital', 'Kestrel Space', 'Meridian Aero', 'Open Earth Obs.', 'Halcyon Comms']),
          };
          if (family === 'comms constellation') { s.raan = (k % 7) * 51 + rng.float(-3, 3); s.u0 = Math.floor(k / 7) * Math.PI + rng.float(0, 0.6); }
          const p = position(s, 0); s.lon = p[0]; s.lat = p[1];
          out.push(s);
        }
      }
      return out;
    },
    generate(rng, ctx) { const all = ctx.store.all('sats'); return all.length ? rng.pick(all) : null; }, // telemetry pass
    update(s, rng, dt) {
      s.t += dt * TIME;
      const prev = [s.lon, s.lat];
      const p = position(s, s.t);
      s.lon = p[0]; s.lat = p[1];
      if (s.family !== 'geostationary') s.heading = BV.geo.bearing(prev, p);
      s._t = (s._t || 0) + dt;
      if (s._t > 1) { s._t = 0; s.trail.push(p); if (s.trail.length > 40) s.trail.shift(); }
    },
    // future ground track for the selected satellite
    groundTrack(s) {
      if (s.family === 'geostationary') return [];
      const out = [];
      for (let k = 0; k <= 120; k++) out.push(position(s, s.t + (s.period * k) / 120));
      return out;
    },
    footprintDeg: (s) => Math.acos(RE / (RE + s.altKm)) / RAD,
    columns: [
      { key: 'ts', label: 'Pass', width: 84, fmt: (v) => BV.fmt.time(v) },
      { key: 'name', label: 'Satellite', width: 150 },
      { key: 'family', label: 'Class', width: 150 },
      { key: 'altKm', label: 'Alt km', width: 76, fmt: (v) => v.toLocaleString() },
      { key: 'inc', label: 'Inc', width: 60, fmt: (v) => v.toFixed(1) + '°' },
      { key: 'period', label: 'Period', width: 76, fmt: (v) => Math.round(v / 60) + ' min' },
      { key: 'lat', label: 'Lat', width: 70, fmt: (v) => v.toFixed(2) },
      { key: 'lon', label: 'Lon', width: 76, fmt: (v) => v.toFixed(2) },
      { key: 'operator', label: 'Operator' },
    ],
    title: (r) => r.name,
    subtitle: (r) => r.family + ' · ' + r.altKm.toLocaleString() + ' km · ' + r.vel.toFixed(2) + ' km/s',
    searchText: (r) => [r.name, r.family, r.norad, r.operator].join(' '),
    fields: (r) => [
      ['name', r.name, true], ['class', r.family, true], ['catalog #', r.norad + ' (sim)'], ['operator', r.operator, true],
      ['altitude', r.altKm.toLocaleString() + ' km'], ['velocity', r.vel.toFixed(2) + ' km/s'], ['inclination', r.inc.toFixed(2) + '°'],
      ['period', (r.period / 60).toFixed(1) + ' min'], ['sub-point', BV.fmt.coord(r.lat, r.lon)],
      ['footprint', 'radius ' + Math.round(BV.geo.R * Math.acos(6371 / (6371 + r.altKm))).toLocaleString() + ' km'],
    ],
    score: (r) => Math.min(99, Math.round(Math.log10(r.altKm) * 22)),
    links(r, store) { return store.find((x) => x !== r && x.layer === 'sats' && x.family === r.family).slice(0, 8); },
    logLine: (r) => `tle ${r.name} alt ${r.altKm}km sub ${r.lat.toFixed(1)},${r.lon.toFixed(1)}`,
  });
})();
