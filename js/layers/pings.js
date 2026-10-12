/* layer · Geo Pings: moving devices reporting location fixes (simulated tracks) */
(function () {
  const KINDS = [['phone', 6], ['vehicle', 3], ['tracker', 2], ['vessel', 1], ['drone', 1]];
  const SPEED = { phone: 0.02, vehicle: 0.12, tracker: 0.05, vessel: 0.06, drone: 0.18 }; // deg/sec at 1x (time-compressed)

  function newDevice(rng) {
    const p = rng.place();
    const kind = rng.weighted(KINDS);
    return {
      id: rng.id('d'), device: kind.slice(0, 2).toUpperCase() + '-' + rng.hex(4).toUpperCase(), kind,
      mac: rng.mac(), source: rng.pick(['gps', 'gps', 'wifi', 'cell', 'ble']), city: p.city, cc: p.cc,
      lat: p.lat, lon: p.lon, heading: rng.float(0, 360), speed: SPEED[kind] * rng.float(0.4, 1.4),
      accuracy: rng.int(3, 120), battery: rng.int(8, 100), fixes: 1, trail: [[p.lat, p.lon]], home: [p.lat, p.lon],
    };
  }

  BV.registerLayer({
    id: 'pings', short: 'Pings', label: 'Geo Pings', color: '--c-pings', glyph: '▲', rate: 2.2, backfill: 46,
    seed(rng, n) { return Array.from({ length: n }, () => newDevice(rng)); },
    generate(rng, ctx) {
      const existing = ctx.store.all('pings');
      if (existing.length && rng.bool(0.88)) { // a new fix from a known device
        const d = rng.pick(existing);
        d.fixes++; d.accuracy = rng.int(3, 120); d.source = rng.bool(0.8) ? d.source : rng.pick(['gps', 'wifi', 'cell']);
        d.battery = Math.max(1, d.battery - (rng.bool(0.2) ? 1 : 0));
        return d;
      }
      return newDevice(rng);
    },
    update(d, rng, dt) {
      d.heading += rng.gauss(0, 8) * dt;
      // drift back toward home so devices stay near their region
      const toHome = Math.atan2(d.home[0] - d.lat, d.home[1] - d.lon) * 180 / Math.PI;
      const far = Math.hypot(d.home[0] - d.lat, d.home[1] - d.lon);
      if (far > 2.5) d.heading += ((90 - toHome) - d.heading) * 0.02;
      const rad = d.heading * Math.PI / 180;
      d.lat = Math.max(-60, Math.min(80, d.lat + Math.cos(rad) * d.speed * dt));
      d.lon = d.lon + Math.sin(rad) * d.speed * dt;
      if (d.lon > 180) d.lon -= 360; if (d.lon < -180) d.lon += 360;
      d._acc = (d._acc || 0) + dt;
      if (d._acc > 0.6) { d._acc = 0; d.trail.push([d.lat, d.lon]); if (d.trail.length > 28) d.trail.shift(); }
    },
    columns: [
      { key: 'ts', label: 'Fix', width: 84, fmt: (v) => BV.fmt.time(v) },
      { key: 'device', label: 'Device', width: 92 },
      { key: 'kind', label: 'Kind', width: 70 },
      { key: 'source', label: 'Src', width: 50 },
      { key: 'lat', label: 'Lat', width: 80, fmt: (v) => v.toFixed(4) },
      { key: 'lon', label: 'Lon', width: 86, fmt: (v) => v.toFixed(4) },
      { key: 'accuracy', label: '±m', width: 50 },
      { key: 'speed', label: 'Kn', width: 50, fmt: (v) => Math.round(v * 400) },
      { key: 'city', label: 'Near' },
      { key: 'fixes', label: 'Fixes', width: 56 },
    ],
    title: (r) => r.device,
    subtitle: (r) => r.kind + ' · ' + r.source + ' ±' + r.accuracy + 'm · near ' + r.city,
    searchText: (r) => [r.device, r.kind, r.mac, r.source, r.city, r.cc].join(' '),
    fields: (r) => [
      ['device', r.device, true], ['kind', r.kind, true], ['mac', r.mac, true], ['source', r.source],
      ['position', BV.fmt.coord(r.lat, r.lon)], ['accuracy', '±' + r.accuracy + ' m'], ['heading', Math.round(((r.heading % 360) + 360) % 360) + '°'],
      ['speed', Math.round(r.speed * 400) + ' kn (sim)'], ['near', r.city + ', ' + r.cc], ['battery', r.battery + '%'], ['fixes', r.fixes],
    ],
    score: (r) => r.battery,
    logLine: (r) => `fix ${r.device} ${r.lat.toFixed(3)},${r.lon.toFixed(3)} ±${r.accuracy}m via ${r.source}`,
  });
})();
