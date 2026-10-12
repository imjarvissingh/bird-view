/* layer · Live Earthquakes: the USGS real-time feed (worldwide M4.5+ for the past week,
   plus every event of the past day), refreshed every minute. */
(function () {
  const BASE = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/';
  let loadedWeek = false;
  const roman = (n) => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][Math.round(n) - 1] || '—';

  function toRec(f) {
    const p = f.properties || {}, c = (f.geometry && f.geometry.coordinates) || [];
    if (typeof c[0] !== 'number' || typeof p.mag !== 'number') return null;
    const place = p.place || 'Unknown location';
    const region = place.includes(' of ') ? place.split(' of ').pop() : place;
    return {
      id: 'usgs-' + f.id, mag: Math.round(p.mag * 10) / 10, magType: p.magType || '', place, region: region.trim(), lat: c[1], lon: c[0],
      depth: Math.round((c[2] || 0) * 10) / 10, ts: p.time, updated: p.updated, url: p.url, felt: p.felt || 0, tsunami: !!p.tsunami,
      mmi: p.mmi || 0, alert: p.alert || '', status: p.status || '', sig: p.sig || 0, net: (p.net || '').toUpperCase(), city: region.trim(), cc: '',
    };
  }

  BV.registerLayer({
    id: 'lquakes', live: true, source: 'USGS', fallback: 'quakes',
    group: 'Live', short: 'Quakes', label: 'Live Earthquakes', color: '--c-quakes', glyph: '◎', shape: 'quake',
    interval: 60000, cap: 3000, maxAge: 7 * 86400000, fade: 86400,
    async poll(api) {
      const out = [];
      if (!loadedWeek) {
        const w = await api.fetchJSON(BASE + '4.5_week.geojson');
        out.push(...(w.features || []));
        loadedWeek = true;
      }
      const d = await api.fetchJSON(BASE + 'all_day.geojson');
      out.push(...(d.features || []));
      return out.map(toRec).filter(Boolean);
    },
    merge(cur, r) { Object.assign(cur, r); },
    columns: [
      { key: 'ts', label: 'Time (UTC)', width: 120, fmt: (v) => BV.fmt.datetime(v).slice(5, 16) },
      { key: 'mag', label: 'Mag', width: 56, html: (v) => '<span class="sev ' + (v >= 6 ? 'crit' : v >= 5 ? 'high' : v >= 4 ? 'med' : 'low') + '">M' + v.toFixed(1) + '</span>' },
      { key: 'place', label: 'Location', width: 280 },
      { key: 'depth', label: 'Depth km', width: 76 },
      { key: 'felt', label: 'Felt', width: 56 },
      { key: 'tsunami', label: 'Tsunami', width: 70, fmt: (v) => (v ? 'flag' : '—') },
      { key: 'alert', label: 'PAGER', width: 66, fmt: (v) => v || '—' },
      { key: 'status', label: 'Status' },
    ],
    title: (r) => 'M' + r.mag.toFixed(1) + ' · ' + r.region,
    subtitle: (r) => r.place + ' · ' + r.depth + ' km deep · ' + BV.fmt.ago(r.ts),
    searchText: (r) => ['earthquake quake', 'M' + r.mag, r.place, r.status, r.alert, r.tsunami ? 'tsunami' : ''].join(' '),
    fields: (r) => [
      ['magnitude', 'M' + r.mag.toFixed(1) + ' ' + r.magType], ['location', r.place], ['region', r.region, true], ['time', BV.fmt.datetime(r.ts) + ' UTC'],
      ['depth', r.depth + ' km'], ['intensity', r.mmi ? 'MMI ' + roman(r.mmi) : '—'], ['felt reports', r.felt.toLocaleString()],
      ['tsunami', r.tsunami ? 'flagged by USGS, check official warnings' : 'none'], ['PAGER alert', r.alert || 'none'], ['status', r.status + ' · ' + r.net],
      ['epicenter', BV.fmt.coord(r.lat, r.lon)],
    ],
    actions: (r) => [['USGS event page ↗', r.url]],
    score: (r) => Math.min(99, Math.max(1, Math.round(r.mag * 11))),
    links(r, store) { return store.all('lquakes').filter((x) => x !== r && BV.geo.km([r.lon, r.lat], [x.lon, x.lat]) < 300).slice(-8); },
    logLine: (r) => `usgs M${r.mag.toFixed(1)} ${r.place} d=${r.depth}km`,
    level: (r) => (r.mag >= 6 ? 'crit' : r.mag >= 5 ? 'high' : r.mag >= 4 ? 'med' : 'low'),
  });
})();
