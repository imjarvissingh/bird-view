/* layer · Wildfire: simulated satellite thermal-anomaly detections in fire-prone regions */
(function () {
  function fire(rng, ts) {
    const z = rng.weighted(BV.FIRE.map((f) => [f, f[4]]));
    const frp = Math.round(Math.exp(rng.float(0.5, 6.2)) * 10) / 10;
    return {
      id: rng.id('w'), region: z[0], lat: z[2] + rng.gauss(0, z[3] * 0.45), lon: z[1] + rng.gauss(0, z[3] * 0.45),
      frp, brightness: Math.round(300 + frp * 0.6 + rng.float(0, 40)), confidence: rng.weighted([['nominal', 6], ['high', 3], ['low', 1]]),
      sensor: rng.pick(['BV-VIIRS (sim)', 'BV-MODIS (sim)', 'BV-GEO-IR (sim)']), daynight: rng.bool(0.6) ? 'day' : 'night',
      areaHa: Math.round(frp * rng.float(2, 18)), city: z[0], cc: '—', ts,
    };
  }
  BV.registerLayer({
    id: 'fires', group: 'Earth', short: 'Fires', label: 'Wildfire', color: '--c-fires', glyph: '▴', shape: 'fire',
    rate: 0.7, backfill: 260, cap: 520,
    seed(rng, n) { return Array.from({ length: n }, (_, i) => fire(rng, Date.now() - (n - i) * rng.int(20, 200) * 1000)); },
    generate: (rng) => fire(rng),
    columns: [
      { key: 'ts', label: 'Detected', width: 84, fmt: (v) => BV.fmt.time(v) },
      { key: 'region', label: 'Region', width: 170 },
      { key: 'frp', label: 'FRP MW', width: 76 },
      { key: 'brightness', label: 'Bright K', width: 76 },
      { key: 'areaHa', label: 'Area ha', width: 76 },
      { key: 'confidence', label: 'Conf', width: 74 },
      { key: 'daynight', label: 'D/N', width: 56 },
      { key: 'sensor', label: 'Sensor' },
    ],
    title: (r) => 'Fire · ' + r.region,
    subtitle: (r) => r.frp + ' MW · ' + r.areaHa + ' ha · ' + r.confidence + ' confidence',
    searchText: (r) => ['fire', r.region, r.sensor, r.confidence, r.daynight].join(' '),
    fields: (r) => [
      ['region', r.region, true], ['radiative power', r.frp + ' MW'], ['brightness', r.brightness + ' K'], ['est. area', r.areaHa + ' ha'],
      ['confidence', r.confidence, true], ['sensor', r.sensor], ['pass', r.daynight], ['position', BV.fmt.coord(r.lat, r.lon)],
    ],
    score: (r) => Math.min(99, Math.round(Math.log10(r.frp + 1) * 35)),
    links(r, store) { return store.find((x) => x !== r && x.layer === 'fires' && x.region === r.region && BV.geo.km([x.lon, x.lat], [r.lon, r.lat]) < 150).slice(-8); },
    logLine: (r) => `fire ${r.region} ${r.frp}MW ${r.confidence}`,
  });
})();
