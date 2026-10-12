/* layer · Tropical Storms: simulated cyclones that form in real basins, recurve poleward and decay */
(function () {
  const TIME = 900; // storms are slow; compress hard so the track is visible
  function cat(kt) { return kt >= 137 ? 5 : kt >= 113 ? 4 : kt >= 96 ? 3 : kt >= 83 ? 2 : kt >= 64 ? 1 : kt >= 34 ? 0 : -1; }
  const catLabel = (c) => (c >= 1 ? 'Category ' + c : c === 0 ? 'Tropical storm' : 'Depression');

  function storm(rng) {
    const b = rng.pick(BV.BASINS);
    const s = {
      id: rng.id('c'), name: rng.pick(BV.STORM_NAMES), basin: b[0], hemi: b[4],
      lat: b[2] + rng.gauss(0, 3), lon: b[1] + rng.gauss(0, 6), heading: b[3] + rng.gauss(0, 10),
      wind: rng.int(35, 70), peak: rng.int(70, 160), age: 0, speedKt: rng.float(8, 14), trail: [], city: b[0], cc: '—', advisory: 1,
    };
    s.pressure = Math.round(1010 - (s.wind - 25) * 0.75);
    s.cat = cat(s.wind);
    for (let k = 8; k >= 1; k--) s.trail.push(BV.geo.dest([s.lon, s.lat], s.heading + 180, k * 45));
    return s;
  }

  BV.registerLayer({
    id: 'storms', group: 'Earth', short: 'Storms', label: 'Tropical Storms', color: '--c-storms', glyph: '๑', shape: 'storm',
    rate: 0.18, backfill: 5, cap: 24, moving: true,
    seed(rng, n) { return Array.from({ length: n }, () => storm(rng)); },
    generate(rng, ctx) {
      const all = ctx.store.all('storms').filter((s) => !s.ended);
      if (all.length < 4 || (all.length < 7 && rng.bool(0.03))) return storm(rng);
      const s = rng.pick(all);
      if (s) s.advisory++;
      return s || null;
    },
    update(s, rng, dt, ctx) {
      if (s.ended) return;
      const h = dt * TIME / 3600; // simulated hours
      s.age += h;
      // recurvature: drift heading toward the pole as the storm ages
      const target = s.hemi > 0 ? 20 : 160;
      if (s.age > 40) s.heading += Math.sign(((target - s.heading + 540) % 360) - 180) * 2.2 * h;
      s.heading += rng.gauss(0, 1.2) * h;
      const p = BV.geo.dest([s.lon, s.lat], s.heading, s.speedKt * 1.852 * h);
      s.lon = p[0]; s.lat = p[1];
      // intensify until peak, then weaken (faster over cold water / high latitude)
      const grow = s.age < 60 ? 0.9 : -0.6 - Math.max(0, Math.abs(s.lat) - 28) * 0.15;
      s.wind = Math.max(15, Math.min(s.peak, s.wind + grow * h));
      s.pressure = Math.round(1010 - (s.wind - 25) * 0.75);
      s.cat = cat(s.wind);
      s.spin = (s.spin || 0) + dt * 2.4 * s.hemi;
      s._t = (s._t || 0) + h;
      if (s._t > 3) { s._t = 0; s.trail.push([s.lon, s.lat]); if (s.trail.length > 60) s.trail.shift(); }
      if (s.wind <= 22 || Math.abs(s.lat) > 52) ctx.store.remove('storms', s.id);
    },
    columns: [
      { key: 'ts', label: 'Advisory', width: 84, fmt: (v) => BV.fmt.time(v) },
      { key: 'name', label: 'Name', width: 110 },
      { key: 'cat', label: 'Class', width: 130, sortKey: 'wind', fmt: catLabel },
      { key: 'wind', label: 'Wind kt', width: 74, fmt: (v) => Math.round(v) },
      { key: 'pressure', label: 'hPa', width: 64 },
      { key: 'heading', label: 'Moving', width: 74, fmt: (v) => BV.geo.compass(v) },
      { key: 'basin', label: 'Basin' },
    ],
    title: (r) => (r.cat >= 1 ? 'Cyclone ' : 'Storm ') + r.name,
    subtitle: (r) => catLabel(r.cat) + ' · ' + Math.round(r.wind) + ' kt · ' + r.basin,
    searchText: (r) => ['storm cyclone typhoon hurricane', r.name, r.basin, catLabel(r.cat)].join(' '),
    fields: (r) => [
      ['name', r.name, true], ['classification', catLabel(r.cat)], ['max wind', Math.round(r.wind) + ' kt (' + Math.round(r.wind * 1.852) + ' km/h)'],
      ['pressure', r.pressure + ' hPa'], ['movement', BV.geo.compass(r.heading) + ' at ' + Math.round(r.speedKt) + ' kt'], ['basin', r.basin, true],
      ['center', BV.fmt.coord(r.lat, r.lon)], ['advisory #', r.advisory], ['age', Math.round(r.age) + ' h (sim)'],
    ],
    score: (r) => Math.min(99, Math.round(r.wind / 1.6)),
    logLine: (r) => `wx ${r.name} ${catLabel(r.cat)} ${Math.round(r.wind)}kt ${r.pressure}hPa ${BV.geo.compass(r.heading)}`,
    level: (r) => (r.cat >= 3 ? 'crit' : r.cat >= 1 ? 'high' : 'med'),
  });
})();
