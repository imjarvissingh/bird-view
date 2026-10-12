/* layer · Live Natural Events: NASA EONET's open events (wildfires, severe storms, volcanoes,
   floods, sea ice, dust, landslides …) with their source reports. Storm tracks are kept. */
(function () {
  const URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=45';
  const CAT = {
    wildfires: ['Wildfire', 'fire'], severeStorms: ['Severe storm', 'storm'], volcanoes: ['Volcano', 'volcano'], floods: ['Flood', 'flood'],
    seaLakeIce: ['Sea & lake ice', 'ice'], earthquakes: ['Earthquake', 'quake'], landslides: ['Landslide', 'slide'], drought: ['Drought', 'dry'],
    dustHaze: ['Dust & haze', 'dust'], manmade: ['Man-made', 'dot'], snow: ['Snow', 'ice'], tempExtremes: ['Temperature extreme', 'dot'], waterColor: ['Water color', 'flood'],
  };

  function centroid(g) {
    if (g.type === 'Point') return g.coordinates;
    if (g.type === 'Polygon') return d3.geoCentroid({ type: 'Polygon', coordinates: g.coordinates });
    return null;
  }

  function toRec(e) {
    const geos = (e.geometry || []).filter((g) => g && g.coordinates);
    if (!geos.length) return null;
    const last = geos[geos.length - 1];
    const c = centroid(last);
    if (!c || typeof c[0] !== 'number') return null;
    const catId = (e.categories && e.categories[0] && e.categories[0].id) || 'manmade';
    const cat = CAT[catId] || [(e.categories && e.categories[0] && e.categories[0].title) || 'Event', 'dot'];
    const track = geos.filter((g) => g.type === 'Point').map((g) => g.coordinates);
    const first = Date.parse(geos[0].date), lastT = Date.parse(last.date);
    return {
      id: 'eonet-' + e.id, title: e.title, catId, category: cat[0], icon: cat[1], lat: c[1], lon: c[0], ts: lastT || Date.now(), since: first || lastT,
      mag: last.magnitudeValue || null, magUnit: last.magnitudeUnit || '', reports: geos.length, track: track.length > 1 ? track : null,
      link: e.link, sources: (e.sources || []).map((s) => [s.id, s.url]), city: e.title, cc: '', hemi: c[1] >= 0 ? 1 : -1,
      wind: catId === 'severeStorms' && last.magnitudeUnit === 'kts' ? last.magnitudeValue : catId === 'severeStorms' ? 60 : 0,
    };
  }

  BV.registerLayer({
    id: 'events', live: true, source: 'NASA EONET', fallback: ['storms', 'fires'],
    group: 'Live', short: 'Disasters', label: 'Natural Events', color: '--c-events', glyph: '▲', shape: 'event',
    interval: 10 * 60000, cap: 2000, snapshot: true, fade: 30 * 86400,
    async poll(api) { const j = await api.fetchJSON(URL, { timeout: 25000 }); return (j.events || []).map(toRec).filter(Boolean); },
    merge(cur, r) { Object.assign(cur, r); },
    columns: [
      { key: 'ts', label: 'Latest', width: 120, fmt: (v) => BV.fmt.datetime(v).slice(5, 16) },
      { key: 'category', label: 'Type', width: 130 },
      { key: 'title', label: 'Event', width: 320 },
      { key: 'mag', label: 'Magnitude', width: 110, fmt: (v, r) => (v ? v + ' ' + r.magUnit : '—') },
      { key: 'reports', label: 'Reports', width: 70 },
      { key: 'since', label: 'Since', fmt: (v) => BV.fmt.ago(v) },
    ],
    title: (r) => r.title,
    subtitle: (r) => r.category + ' · updated ' + BV.fmt.ago(r.ts) + (r.mag ? ' · ' + r.mag + ' ' + r.magUnit : ''),
    searchText: (r) => ['disaster natural event', r.category, r.title, r.catId].join(' '),
    fields: (r) => [
      ['event', r.title], ['type', r.category, true], ['latest report', BV.fmt.datetime(r.ts) + ' UTC'], ['active since', BV.fmt.datetime(r.since).slice(0, 10)],
      ['magnitude', r.mag ? r.mag + ' ' + r.magUnit : '—'], ['observations', r.reports], ['location', BV.fmt.coord(r.lat, r.lon)],
      ['sources', r.sources.map((s) => s[0]).join(', ') || '—'],
    ],
    actions: (r) => r.sources.slice(0, 3).map((s) => [s[0] + ' report ↗', s[1]]).concat([['NASA EONET ↗', r.link]]),
    score: (r) => Math.min(99, 20 + r.reports * 3),
    links(r, store) { return store.all('events').filter((x) => x !== r && x.catId === r.catId && BV.geo.km([r.lon, r.lat], [x.lon, x.lat]) < 800).slice(0, 8); },
    logLine: (r) => `eonet ${r.category.toLowerCase()} · ${r.title}`,
    level: (r) => (r.catId === 'volcanoes' || r.catId === 'severeStorms' ? 'high' : r.catId === 'wildfires' || r.catId === 'floods' ? 'med' : 'low'),
  });
})();
