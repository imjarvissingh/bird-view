/* layer · Air Traffic: simulated flights on great-circle routes between major airports.
   Movement is time-compressed (TIME x real time) so aircraft visibly cross the map. */
(function () {
  const TIME = 30;
  const KT = 1.852; // km per nautical mile

  function pickRoute(rng) {
    const w = BV.AIRPORTS.map((a) => [a, a[5]]);
    for (let i = 0; i < 20; i++) {
      const a = rng.weighted(w), b = rng.weighted(w);
      if (a === b) continue;
      const km = BV.geo.km([a[4], a[3]], [b[4], b[3]]);
      if (km > 450 && km < 15500) return { a, b, km };
    }
    return null;
  }

  function newFlight(rng, progress) {
    const r = pickRoute(rng);
    if (!r) return null;
    const op = rng.pick(BV.OPERATORS);
    const longHaul = r.km > 4200;
    const ac = rng.weighted(BV.AIRCRAFT.filter((x) => (longHaul ? x[1] >= 480 : x[1] < 480)).map((x) => [x, x[3]]));
    const f = {
      id: rng.id('f'), callsign: op[0] + rng.int(10, 9899), operator: op[1], type: ac[0],
      from: r.a[0], fromCity: r.a[1], to: r.b[0], toCity: r.b[1], cc: r.a[2], city: r.a[1],
      routeKm: Math.round(r.km), cruiseKt: ac[1] + rng.int(-15, 20), cruiseFt: ac[2] - rng.pick([0, 0, 1000, 2000, 4000]),
      squawk: String(rng.int(1000, 6999)).replace(/[89]/g, '7'), progress: progress || 0, trail: [],
      route: [[r.a[4], r.a[3]], [r.b[4], r.b[3]]], hex: rng.hex(6).toUpperCase(),
    };
    f.interp = d3.geoInterpolate(f.route[0], f.route[1]);
    place(f);
    // seed a short trail so in-flight aircraft show where they came from
    for (let k = 6; k >= 1; k--) { const q = f.interp(Math.max(0, f.progress - k * 0.006)); f.trail.push(q); }
    return f;
  }

  function place(f) {
    const p = Math.min(1, f.progress);
    const pos = f.interp(p);
    const ahead = f.interp(Math.min(1, p + 0.002));
    f.lon = pos[0]; f.lat = pos[1];
    if (p < 0.998) f.heading = BV.geo.bearing(pos, ahead);
    const edge = Math.min(p / 0.07, (1 - p) / 0.09, 1);
    f.alt = Math.max(0, Math.round((f.cruiseFt * Math.min(1, edge)) / 100) * 100);
    f.gs = Math.round(f.cruiseKt * (0.55 + 0.45 * Math.min(1, edge * 1.4)));
    f.phase = p < 0.07 ? 'climb' : p > 0.91 ? 'descent' : 'cruise';
    f.remainKm = Math.round(f.routeKm * (1 - p));
  }

  BV.registerLayer({
    id: 'flights', group: 'Movement', short: 'Flights', label: 'Air Traffic', color: '--c-flights', glyph: '✈', shape: 'plane',
    rate: 0.32, backfill: 190, cap: 420, moving: true,
    seed(rng, n) { return Array.from({ length: n }, () => newFlight(rng, rng.float(0.02, 0.97))); },
    generate(rng) { return newFlight(rng, 0); },
    update(f, rng, dt, ctx) {
      if (f.ended) return;
      const kmPerSec = (f.gs * KT) / 3600 * TIME;
      f.progress += (kmPerSec * dt) / f.routeKm;
      f._t = (f._t || 0) + dt;
      if (f._t > 1.2) { f._t = 0; f.trail.push([f.lon, f.lat]); if (f.trail.length > 30) f.trail.shift(); }
      if (f.progress >= 1) { f.progress = 1; place(f); f.phase = 'landed'; ctx.store.remove('flights', f.id); return; }
      place(f);
    },
    columns: [
      { key: 'ts', label: 'Seen', width: 84, fmt: (v) => BV.fmt.time(v) },
      { key: 'callsign', label: 'Callsign', width: 90 },
      { key: 'type', label: 'Type', width: 64 },
      { key: 'from', label: 'From', width: 56 },
      { key: 'to', label: 'To', width: 56 },
      { key: 'alt', label: 'Alt ft', width: 74, fmt: (v) => v.toLocaleString() },
      { key: 'gs', label: 'GS kt', width: 64 },
      { key: 'phase', label: 'Phase', width: 74 },
      { key: 'progress', label: 'Prog', width: 60, fmt: (v) => Math.round(v * 100) + '%' },
      { key: 'operator', label: 'Operator' },
    ],
    title: (r) => r.callsign,
    subtitle: (r) => r.from + ' → ' + r.to + ' · ' + r.type + ' · FL' + String(Math.round(r.alt / 100)).padStart(3, '0'),
    searchText: (r) => [r.callsign, r.operator, r.type, r.from, r.fromCity, r.to, r.toCity, r.hex, r.squawk, r.phase].join(' '),
    fields: (r) => [
      ['callsign', r.callsign, true], ['operator', r.operator, true], ['aircraft', r.type, true], ['icao hex', r.hex],
      ['route', r.from + ' ' + r.fromCity + ' → ' + r.to + ' ' + r.toCity], ['altitude', r.alt.toLocaleString() + ' ft (' + r.phase + ')'],
      ['ground speed', r.gs + ' kt'], ['heading', Math.round(r.heading) + '° ' + BV.geo.compass(r.heading)], ['squawk', r.squawk],
      ['position', BV.fmt.coord(r.lat, r.lon)], ['remaining', r.remainKm.toLocaleString() + ' km of ' + r.routeKm.toLocaleString()],
    ],
    extra: (r) => '<div class="route"><span>' + r.from + '</span><div class="bar"><i style="width:' + Math.round(r.progress * 100) + '%"></i><b style="left:' + Math.round(r.progress * 100) + '%">✈</b></div><span>' + r.to + '</span></div>',
    score: (r) => Math.round(r.progress * 99),
    links(r, store) { return store.find((x) => x !== r && x.layer === 'flights' && x.callsign.slice(0, 3) === r.callsign.slice(0, 3) && x.from === r.from).slice(0, 6); },
    logLine: (r) => `adsb ${r.callsign} ${r.from}→${r.to} FL${String(Math.round(r.alt / 100)).padStart(3, '0')} ${r.gs}kt ${r.phase}`,
  });
})();
