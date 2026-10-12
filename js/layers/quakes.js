/* layer · Seismic: simulated earthquakes along real plate-boundary regions (Gutenberg-Richter magnitudes) */
(function () {
  function quake(rng, ts) {
    const z = rng.weighted(BV.SEISMIC.map((s) => [s, s[4]]));
    const mag = Math.min(8.7, 2.5 - Math.log10(1 - rng.next() * 0.9995) * 0.95);
    const depth = rng.weighted([[rng.float(2, 35), 6], [rng.float(35, 120), 2], [rng.float(120, 660), 1]]);
    const off = rng.float(5, 140);
    const lat = z[2] + rng.gauss(0, z[3] * 0.5), lon = z[1] + rng.gauss(0, z[3] * 0.5);
    return {
      id: rng.id('q'), mag: Math.round(mag * 10) / 10, depth: Math.round(depth * 10) / 10, region: z[0],
      place: Math.round(off) + ' km ' + rng.pick(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'NNE', 'SSW', 'ENE', 'WSW']) + ' of ' + z[0],
      lat, lon, city: z[0], cc: '—', network: rng.pick(['bv-seis', 'bv-seis', 'regional', 'teleseismic']),
      felt: mag > 4 ? Math.round(Math.pow(10, mag - 3.2) * rng.float(0.3, 2)) : 0,
      tsunami: mag >= 7 && depth < 70 && rng.bool(0.7), status: rng.bool(0.7) ? 'automatic' : 'reviewed', ts,
      mmi: Math.max(1, Math.min(10, Math.round(mag * 1.25 - Math.log10(depth + 10) * 1.6))),
    };
  }
  const roman = (n) => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] || 'I';

  BV.registerLayer({
    id: 'quakes', group: 'Earth', short: 'Quakes', label: 'Seismic', color: '--c-quakes', glyph: '◎', shape: 'quake',
    rate: 0.14, backfill: 110, cap: 300,
    seed(rng, n) { return Array.from({ length: n }, (_, i) => quake(rng, Date.now() - (n - i) * rng.int(200, 1500) * 1000)).sort((a, b) => a.ts - b.ts); },
    generate: (rng) => quake(rng),
    columns: [
      { key: 'ts', label: 'Time', width: 84, fmt: (v) => BV.fmt.time(v) },
      { key: 'mag', label: 'Mag', width: 56, html: (v) => '<span class="sev ' + (v >= 6 ? 'crit' : v >= 5 ? 'high' : v >= 4 ? 'med' : 'low') + '">M' + v.toFixed(1) + '</span>' },
      { key: 'place', label: 'Location', width: 260 },
      { key: 'depth', label: 'Depth km', width: 80 },
      { key: 'mmi', label: 'MMI', width: 52, fmt: roman },
      { key: 'felt', label: 'Felt', width: 60 },
      { key: 'tsunami', label: 'Tsunami', width: 70, fmt: (v) => (v ? 'watch' : '—') },
      { key: 'status', label: 'Status' },
    ],
    title: (r) => 'M' + r.mag.toFixed(1) + ' · ' + r.region,
    subtitle: (r) => r.place + ' · ' + r.depth + ' km deep',
    searchText: (r) => ['M' + r.mag, r.region, r.place, r.status, r.tsunami ? 'tsunami' : ''].join(' '),
    fields: (r) => [
      ['magnitude', 'M' + r.mag.toFixed(1) + (r.mag >= 6 ? ' (strong)' : r.mag >= 5 ? ' (moderate)' : r.mag >= 4 ? ' (light)' : ' (minor)')],
      ['location', r.place], ['region', r.region, true], ['depth', r.depth + ' km'], ['intensity', 'MMI ' + roman(r.mmi)],
      ['felt reports', r.felt.toLocaleString()], ['tsunami', r.tsunami ? 'watch issued (sim)' : 'none'], ['network', r.network], ['status', r.status],
      ['epicenter', BV.fmt.coord(r.lat, r.lon)],
    ],
    score: (r) => Math.min(99, Math.round(r.mag * 11)),
    links(r, store) { return store.find((x) => x !== r && x.layer === 'quakes' && x.region === r.region).slice(-8); },
    logLine: (r) => `seis M${r.mag.toFixed(1)} ${r.place} d=${r.depth}km`,
    level: (r) => (r.mag >= 6 ? 'crit' : r.mag >= 5 ? 'high' : r.mag >= 4 ? 'med' : 'low'),
  });
})();
