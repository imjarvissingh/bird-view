/* layer · Maritime: simulated AIS vessel positions along major shipping lanes (time-compressed) */
(function () {
  const TIME = 420;
  const PREFIX = ['MV', 'MV', 'MT', 'MSC-', 'SS'];
  const NAMES = ['Grey Heron', 'Basalt Star', 'Northwind', 'Kestrel Bay', 'Ocean Lattice', 'Pinecrest', 'Sable Tide', 'Halcyon Sea', 'Arcadia Spirit',
    'Juniper Lane', 'Corvid Trader', 'Meridian Dawn', 'Quartz Harbor', 'Silver Moth', 'Lumen Drift', 'Ember Coast', 'Atlas Venture', 'Delta Wren',
    'Onyx Pioneer', 'Signal Point', 'Cipher Reach', 'Static Bloom', 'Nova Strait', 'Echo Mariner'];
  let lanes = null;
  const L = () => lanes || (lanes = BV.LANES.map((l) => Object.assign({ line: BV.geo.polyline(l.pts) }, l)));

  function newVessel(rng) {
    const lane = rng.pick(L());
    const t = rng.weighted(BV.VESSEL_TYPES.map((x) => [x, x[1]]));
    const v = {
      id: rng.id('v'), name: (rng.pick(PREFIX) + ' ' + rng.pick(NAMES)).replace('- ', '-'), mmsi: String(rng.int(200000000, 799999999)),
      imo: 'IMO ' + rng.int(9000000, 9899999), kind: t[0], sog: t[2] + rng.float(-2.5, 2.5), lane: lane.name, laneRef: lane,
      dir: rng.bool() ? 1 : -1, dist: rng.float(0, lane.line.total), draught: rng.float(6, 16).toFixed(1), flag: rng.pick(['PA', 'LR', 'MH', 'SG', 'MT', 'BS', 'GR', 'NO', 'CY', 'HK']),
      length: rng.int(120, 400), trail: [], cc: '—',
    };
    v.city = v.dir > 0 ? lane.to : lane.from;
    place(v);
    for (let k = 6; k >= 1; k--) { const q = lane.line.at(v.dist - v.dir * k * 60).p; v.trail.push(q); }
    return v;
  }
  function place(v) {
    const ln = v.laneRef.line;
    const { p } = ln.at(v.dist);
    const ahead = ln.at(v.dist + v.dir * 20).p;
    v.lon = p[0]; v.lat = p[1];
    v.heading = BV.geo.bearing(p, ahead);
    v.dest = v.dir > 0 ? v.laneRef.to : v.laneRef.from;
    v.city = v.dest;
    v.remainKm = Math.round(v.dir > 0 ? ln.total - v.dist : v.dist);
  }

  BV.registerLayer({
    id: 'vessels', group: 'Movement', short: 'Vessels', label: 'Maritime AIS', color: '--c-vessels', glyph: '⛴', shape: 'ship',
    rate: 1.1, backfill: 96, cap: 160, moving: true,
    seed(rng, n) { return Array.from({ length: n }, () => newVessel(rng)); },
    generate(rng, ctx) {
      const all = ctx.store.all('vessels');
      if (all.length < 150 && rng.bool(0.04)) return newVessel(rng);
      const v = rng.pick(all); // an AIS position report from a known ship
      if (v) v.sog = Math.max(4, v.sog + rng.gauss(0, 0.3));
      return v || null;
    },
    update(v, rng, dt) {
      const km = (v.sog * 1.852 / 3600) * TIME * dt;
      v.dist += v.dir * km;
      const total = v.laneRef.line.total;
      if (v.dist >= total || v.dist <= 0) { v.dist = Math.max(0, Math.min(total, v.dist)); v.dir *= -1; v.trail = []; }
      place(v);
      v._t = (v._t || 0) + dt;
      if (v._t > 2) { v._t = 0; v.trail.push([v.lon, v.lat]); if (v.trail.length > 24) v.trail.shift(); }
    },
    columns: [
      { key: 'ts', label: 'Report', width: 84, fmt: (v) => BV.fmt.time(v) },
      { key: 'name', label: 'Vessel', width: 160 },
      { key: 'kind', label: 'Type', width: 104 },
      { key: 'mmsi', label: 'MMSI', width: 96 },
      { key: 'sog', label: 'SOG kn', width: 70, fmt: (v) => v.toFixed(1) },
      { key: 'heading', label: 'COG', width: 56, fmt: (v) => Math.round(v) + '°' },
      { key: 'dest', label: 'Destination', width: 120 },
      { key: 'lane', label: 'Lane' },
    ],
    title: (r) => r.name,
    subtitle: (r) => r.kind + ' · ' + r.sog.toFixed(1) + ' kn → ' + r.dest,
    searchText: (r) => [r.name, r.mmsi, r.imo, r.kind, r.lane, r.dest, r.flag].join(' '),
    fields: (r) => [
      ['vessel', r.name, true], ['type', r.kind, true], ['mmsi', r.mmsi, true], ['imo', r.imo], ['flag', r.flag, true],
      ['length', r.length + ' m'], ['draught', r.draught + ' m'], ['speed', r.sog.toFixed(1) + ' kn'], ['course', Math.round(r.heading) + '° ' + BV.geo.compass(r.heading)],
      ['destination', r.dest, true], ['lane', r.lane, true], ['to go', r.remainKm.toLocaleString() + ' km'], ['position', BV.fmt.coord(r.lat, r.lon)],
    ],
    extra: (r) => { const p = Math.round(100 * (r.dir > 0 ? r.dist : r.laneRef.line.total - r.dist) / r.laneRef.line.total); return '<div class="route"><span>' + BV.fmt.esc(r.dir > 0 ? r.laneRef.from : r.laneRef.to) + '</span><div class="bar"><i style="width:' + p + '%"></i><b style="left:' + p + '%">⛴</b></div><span>' + BV.fmt.esc(r.dest) + '</span></div>'; },
    score: (r) => Math.min(99, Math.round(r.sog * 4)),
    links(r, store) { return store.find((x) => x !== r && x.layer === 'vessels' && x.lane === r.lane).slice(0, 8); },
    logLine: (r) => `ais ${r.mmsi} ${r.name} ${r.sog.toFixed(1)}kn cog ${Math.round(r.heading)} → ${r.dest}`,
  });
})();
