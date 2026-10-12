/* layer · Live Flights: real aircraft positions from public ADS-B networks.
   - adsb.lol (fallback airplanes.live) around the point you're looking at, refreshed often
   - the same API rotated across the world's busiest airspace so the whole globe fills in
   - OpenSky Network's global snapshot when it's reachable (anonymous quota is small, so rarely)
   Between reports each aircraft is dead-reckoned along its track at its ground speed. */
(function () {
  const POINT_APIS = [
    (la, lo, nm) => 'https://api.adsb.lol/v2/point/' + la + '/' + lo + '/' + nm,
    (la, lo, nm) => 'https://api.airplanes.live/v2/point/' + la + '/' + lo + '/' + nm,
  ];
  const OPENSKY = 'https://opensky-network.org/api/states/all';
  const HUBS = [
    [40.7, -74], [41.9, -87.9], [33.6, -84.4], [32.9, -97], [39.8, -104.7], [34, -118.4], [37.6, -122.4], [47.4, -122.3],
    [25.8, -80.3], [43.7, -79.6], [19.4, -99.1], [-23.4, -46.5], [4.7, -74.1], [-33.4, -70.8], [51.5, -0.4], [49, 2.5],
    [50, 8.6], [40.5, -3.6], [41.8, 12.2], [52.3, 4.8], [41.3, 28.8], [55.8, 37.4], [25.25, 55.4], [24.9, 46.7],
    [28.6, 77.1], [19.1, 72.9], [13, 77.6], [1.35, 104], [13.7, 100.7], [22.3, 113.9], [31.1, 121.8], [40.1, 116.6],
    [30.6, 104], [37.5, 126.8], [35.6, 139.8], [-33.9, 151.2], [-37.7, 144.8], [-26.1, 28.2], [30.1, 31.4], [6.6, 3.3],
    [-1.3, 36.9], [61.2, -150], [21.3, -157.9], [55, -30], [64, -22], [45.5, -73.6], [-12, -77], [14.5, 121],
  ];
  const KT = 1.852;
  const routes = new Map(), planes = new Map(); // adsbdb lookups by callsign / hex
  let api = 0, hub = 0, tick = 0, lastFocus = null, openskyAt = 0, openskyOk = 0, openskyOff = 0;

  const ft = (v) => (typeof v === 'number' ? Math.round(v) : 0);
  function fromAdsb(a, now, nowApi) {
    if (typeof a.lat !== 'number' || typeof a.lon !== 'number' || !a.hex) return null;
    const ground = a.alt_baro === 'ground';
    const call = (a.flight || '').trim();
    const sq = a.squawk || '';
    return {
      id: 'adsb-' + a.hex.toLowerCase(), hex: a.hex.toUpperCase().replace(/^~/, ''), callsign: call || a.r || a.hex.toUpperCase(),
      reg: a.r || '', type: a.t || '', desc: a.desc || '', operator: a.ownOp || '', lat: a.lat, lon: a.lon,
      alt: ground ? 0 : ft(a.alt_baro || a.alt_geom), gs: Math.round(a.gs || 0), heading: typeof a.track === 'number' ? a.track : (a.true_heading || 0),
      vr: a.baro_rate || a.geom_rate || 0, squawk: sq, onGround: ground, category: a.category || '',
      emergency: sq === '7700' || sq === '7600' || sq === '7500' || (a.emergency && a.emergency !== 'none'),
      posAt: now - (a.seen_pos || a.seen || 0) * 1000, src: 'ADS-B', city: '', cc: '',
    };
  }
  function fromOpenSky(s, now) {
    if (typeof s[5] !== 'number' || typeof s[6] !== 'number') return null;
    const sq = s[14] || '';
    return {
      id: 'adsb-' + s[0].toLowerCase(), hex: s[0].toUpperCase(), callsign: (s[1] || '').trim() || s[0].toUpperCase(), reg: '', type: '', desc: '',
      operator: '', country: s[2] || '', lat: s[6], lon: s[5], alt: Math.round((s[7] || s[13] || 0) * 3.28084), gs: Math.round((s[9] || 0) * 1.94384),
      heading: s[10] || 0, vr: Math.round((s[11] || 0) * 196.85), squawk: sq, onGround: !!s[8], emergency: sq === '7700' || sq === '7600' || sq === '7500',
      posAt: (s[3] || s[4] || now / 1000) * 1000, src: 'OpenSky', city: '', cc: '',
    };
  }

  async function point(liveApi, lat, lon, nm) {
    let lastErr;
    for (let k = 0; k < POINT_APIS.length; k++) {
      const i = (api + k) % POINT_APIS.length;
      try {
        const j = await liveApi.fetchJSON(POINT_APIS[i](lat.toFixed(3), lon.toFixed(3), nm), { timeout: 12000 });
        api = i;
        const now = Date.now();
        return (j.ac || j.aircraft || []).map((a) => fromAdsb(a, now)).filter(Boolean);
      } catch (e) { lastErr = e; }
    }
    throw lastErr;
  }

  BV.registerLayer({
    id: 'lflights', live: true, source: 'adsb.lol · airplanes.live · OpenSky', fallback: 'flights',
    group: 'Live', short: 'Flights', label: 'Live Flights', color: '--c-flights', glyph: '✈', shape: 'plane',
    interval: 4000, ttl: 300000, cap: 9000, moving: true,
    async poll(liveApi, opts) {
      tick++;
      const now = Date.now();
      const v = BV.map ? BV.map.view : { lat: 20, lon: 0, z: 1 };
      // 1) OpenSky global snapshot, sparingly
      if (now - openskyAt > 150000 && now > openskyOff && !opts.focus) {
        openskyAt = now;
        try {
          const j = await liveApi.fetchJSON(OPENSKY, { timeout: 20000 });
          openskyOk = now;
          return (j.states || []).map((s) => fromOpenSky(s, now)).filter(Boolean);
        } catch (e) { openskyOff = now + 600000; /* quota or CORS: fall through to ADS-B points */ }
      }
      // 2) where the user is looking (or an explicit focus), else 3) the next hub
      const focus = opts.focus || { lat: v.lat, lon: v.lon };
      const moved = !lastFocus || BV.geo.km([focus.lon, focus.lat], [lastFocus.lon, lastFocus.lat]) > 150;
      const globalOk = now - openskyOk < 150000; // a fresh global snapshot covers the hubs
      if (opts.focus || moved || tick % 3 === 0) {
        lastFocus = { lat: focus.lat, lon: focus.lon };
        return point(liveApi, focus.lat, focus.lon, 250);
      }
      if (globalOk && tick % 2) return [];
      const h = HUBS[hub++ % HUBS.length];
      return point(liveApi, h[0], h[1], 250);
    },
    merge(cur, r) {
      if (r.posAt < (cur.posAt || 0) - 1000) return; // older report than we already have
      if (cur.trail && (Math.abs(cur.lat - r.lat) > 0.02 || Math.abs(cur.lon - r.lon) > 0.02)) { cur.trail.push([cur.lon, cur.lat]); if (cur.trail.length > 40) cur.trail.shift(); }
      for (const k of Object.keys(r)) if (r[k] !== '' && r[k] !== undefined) cur[k] = r[k];
      cur.ts = Date.now();
    },
    update(f, rng, dt) {
      if (!f.trail) f.trail = [];
      if (f.onGround || f.gs < 40) return;
      const age = (Date.now() - f.posAt) / 1000;
      if (age > 240) return; // don't guess for too long
      const p = BV.geo.dest([f.lon, f.lat], f.heading, (f.gs * KT / 3600) * dt);
      f.lon = p[0]; f.lat = p[1];
    },
    enrich(f) {
      const jobs = [];
      const cs = (f.callsign || '').replace(/\s/g, '');
      if (/^[A-Z]{3}\d/.test(cs) && !routes.has(cs)) {
        routes.set(cs, null);
        jobs.push(BV.live.fetchJSON('https://api.adsbdb.com/v0/callsign/' + cs, { timeout: 8000 }).then((j) => routes.set(cs, j && j.response && j.response.flightroute || null), () => {}));
      }
      if (f.hex && !planes.has(f.hex)) {
        planes.set(f.hex, null);
        jobs.push(BV.live.fetchJSON('https://api.adsbdb.com/v0/aircraft/' + f.hex, { timeout: 8000 }).then((j) => planes.set(f.hex, j && j.response && j.response.aircraft || null), () => {}));
      }
      return Promise.all(jobs).then(() => {
        const r = routes.get(cs), a = planes.get(f.hex);
        if (r && r.origin && r.destination) {
          f.from = r.origin.iata_code || r.origin.icao_code; f.fromCity = r.origin.municipality || r.origin.name;
          f.to = r.destination.iata_code || r.destination.icao_code; f.toCity = r.destination.municipality || r.destination.name;
          f.route = [[r.origin.longitude, r.origin.latitude], [r.destination.longitude, r.destination.latitude]];
          if (r.airline && r.airline.name) f.operator = r.airline.name;
        }
        if (a) {
          f.reg = f.reg || a.registration; f.type = f.type || a.icao_type; f.desc = [a.manufacturer, a.type].filter(Boolean).join(' ');
          f.owner = a.registered_owner; f.photo = a.url_photo_thumbnail || ''; f.photoLink = a.url_photo || '';
        }
      });
    },
    columns: [
      { key: 'ts', label: 'Seen', width: 84, fmt: (v) => BV.fmt.time(v) },
      { key: 'callsign', label: 'Callsign', width: 90 },
      { key: 'type', label: 'Type', width: 60 },
      { key: 'reg', label: 'Reg', width: 80 },
      { key: 'alt', label: 'Alt ft', width: 74, fmt: (v, r) => (r.onGround ? 'ground' : v.toLocaleString()) },
      { key: 'gs', label: 'GS kt', width: 60 },
      { key: 'heading', label: 'Trk', width: 52, fmt: (v) => Math.round(v) + '°' },
      { key: 'squawk', label: 'Sqk', width: 56 },
      { key: 'hex', label: 'Hex', width: 70 },
      { key: 'src', label: 'Source' },
    ],
    title: (r) => r.callsign,
    subtitle: (r) => [r.from && r.to ? r.from + ' → ' + r.to : '', r.type, r.onGround ? 'on ground' : 'FL' + String(Math.round(r.alt / 100)).padStart(3, '0'), r.gs + ' kt'].filter(Boolean).join(' · '),
    searchText: (r) => ['flight', r.callsign, r.reg, r.type, r.desc, r.hex, r.squawk, r.operator, r.owner, r.country, r.from, r.to, r.fromCity, r.toCity, r.emergency ? 'emergency' : ''].join(' '),
    fields: (r) => [
      ['callsign', r.callsign, true], ['registration', r.reg || '—', !!r.reg], ['aircraft', [r.type, r.desc].filter(Boolean).join(' · ') || '—'],
      ['operator', r.operator || r.owner || '—'], ['route', r.from ? r.from + ' ' + (r.fromCity || '') + ' → ' + r.to + ' ' + (r.toCity || '') : 'looking up…'],
      ['altitude', r.onGround ? 'on ground' : r.alt.toLocaleString() + ' ft' + (r.vr ? (r.vr > 0 ? ' ↑ ' : ' ↓ ') + Math.abs(Math.round(r.vr)) + ' fpm' : '')],
      ['ground speed', r.gs + ' kt (' + Math.round(r.gs * KT) + ' km/h)'], ['track', Math.round(r.heading) + '° ' + BV.geo.compass(r.heading)],
      ['squawk', (r.squawk || '—') + (r.emergency ? '  EMERGENCY' : '')], ['icao hex', r.hex, true], ['position', BV.fmt.coord(r.lat, r.lon)],
      ['last report', BV.fmt.ago(r.posAt) + ' via ' + r.src],
    ],
    extra: (r) => (r.photo ? '<a class="photo" href="' + BV.fmt.esc(r.photoLink || r.photo) + '" target="_blank" rel="noopener"><img src="' + BV.fmt.esc(r.photo) + '" alt="Photo of ' + BV.fmt.esc(r.reg || r.callsign) + '" loading="lazy"></a>' : '') +
      (r.from && r.route ? (function () {
        const tot = BV.geo.km(r.route[0], r.route[1]), left = BV.geo.km([r.lon, r.lat], r.route[1]);
        const pct = Math.max(0, Math.min(100, Math.round((1 - left / Math.max(1, tot)) * 100)));
        return '<div class="route"><span>' + BV.fmt.esc(r.from) + '</span><div class="bar"><i style="width:' + pct + '%"></i><b style="left:' + pct + '%">✈</b></div><span>' + BV.fmt.esc(r.to) + '</span></div>';
      })() : ''),
    actions: (r) => [
      ['Track live ↗', 'https://globe.adsb.lol/?icao=' + r.hex.toLowerCase()],
      ['Flightradar24 ↗', 'https://www.flightradar24.com/' + encodeURIComponent((r.callsign || '').replace(/\s/g, ''))],
      ['FlightAware ↗', 'https://www.flightaware.com/live/flight/' + encodeURIComponent((r.callsign || '').replace(/\s/g, ''))],
    ],
    score: (r) => Math.min(99, Math.round(r.alt / 450)),
    links(r, store) { const p = (r.callsign || '').slice(0, 3); return /^[A-Z]{3}$/.test(p) ? store.all('lflights').filter((x) => x !== r && x.callsign.slice(0, 3) === p).slice(0, 8) : []; },
    logLine: (r) => `adsb ${r.callsign} ${r.type || ''} ${r.onGround ? 'GND' : 'FL' + String(Math.round(r.alt / 100)).padStart(3, '0')} ${r.gs}kt sq${r.squawk || '----'}`,
  });
})();
