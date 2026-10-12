/* layer · Live News: worldwide headlines from the GDELT project (updated every 15 minutes
   upstream). Each story is placed where its headline says it happened (city or country
   named in the title), falling back to the publisher's country. */
(function () {
  const Q = '(earthquake OR flood OR wildfire OR hurricane OR typhoon OR cyclone OR storm OR volcano OR tsunami OR explosion OR crash OR attack OR protest OR election OR war OR ceasefire OR missile OR evacuation OR outbreak OR summit OR strike) sourcelang:english';
  const DOC = 'https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist&format=json&sort=datedesc&maxrecords=250';
  const ALIAS = {
    'U.S.': 'United States of America', 'US': 'United States of America', 'USA': 'United States of America', 'United States': 'United States of America', 'America': 'United States of America', 'American': 'United States of America',
    'UK': 'United Kingdom', 'Britain': 'United Kingdom', 'British': 'United Kingdom', 'England': 'United Kingdom', 'Scotland': 'United Kingdom',
    'Russian': 'Russia', 'Chinese': 'China', 'Beijing': 'China', 'Indian': 'India', 'Israeli': 'Israel', 'Ukrainian': 'Ukraine', 'Iranian': 'Iran', 'Tehran': 'Iran',
    'Japanese': 'Japan', 'French': 'France', 'German': 'Germany', 'Canadian': 'Canada', 'Mexican': 'Mexico', 'Brazilian': 'Brazil', 'Pakistani': 'Pakistan',
    'Syrian': 'Syria', 'Lebanese': 'Lebanon', 'Taiwanese': 'Taiwan', 'Korean': 'South Korea', 'Pyongyang': 'North Korea', 'Australian': 'Australia', 'Turkish': 'Turkey', 'Turkiye': 'Turkey', 'Türkiye': 'Turkey',
    'Philippine': 'Philippines', 'Filipino': 'Philippines', 'Indonesian': 'Indonesia', 'Italian': 'Italy', 'Spanish': 'Spain', 'Greek': 'Greece', 'Egyptian': 'Egypt', 'Saudi': 'Saudi Arabia',
    'Nigerian': 'Nigeria', 'Kenyan': 'Kenya', 'Ethiopian': 'Ethiopia', 'Sudanese': 'Sudan', 'Afghan': 'Afghanistan', 'Iraqi': 'Iraq', 'Yemeni': 'Yemen', 'Venezuelan': 'Venezuela', 'Colombian': 'Colombia',
    'Argentine': 'Argentina', 'Chilean': 'Chile', 'Peruvian': 'Peru', 'Cuban': 'Cuba', 'Haitian': 'Haiti', 'Polish': 'Poland', 'Dutch': 'Netherlands', 'Swedish': 'Sweden', 'Norwegian': 'Norway',
    'Gaza': [31.42, 34.36], 'West Bank': [31.95, 35.25], 'Kyiv': [50.45, 30.52], 'Kiev': [50.45, 30.52], 'Kharkiv': [49.99, 36.23], 'Odesa': [46.48, 30.72], 'Crimea': [45.0, 34.1], 'Donbas': [48.0, 37.8],
    'Hawaii': [20.8, -156.3], 'California': [36.8, -119.4], 'Texas': [31.0, -99.0], 'Florida': [27.8, -81.7], 'Alaska': [64.2, -149.5], 'Puerto Rico': [18.2, -66.5], 'Kashmir': [34.1, 74.8],
    'Congo': 'Dem. Rep. Congo', 'DRC': 'Dem. Rep. Congo', 'Czech Republic': 'Czechia', 'Bosnia': 'Bosnia and Herz.', 'South Sudan': 'S. Sudan', 'Ivory Coast': "Côte d'Ivoire", 'UAE': 'United Arab Emirates', 'Dubai': [25.2, 55.27],
  };
  let index = null;

  function buildIndex() {
    const byName = new Map((BV.countries || []).map((f) => [f.name, f]));
    const out = [];
    const add = (name, ll, weight) => { if (ll) out.push({ re: new RegExp('(^|[^A-Za-z])' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z])', name.length <= 3 ? '' : 'i'), ll, weight, name }); };
    const country = (n) => { const f = byName.get(n); return f ? [f.centroid[1], f.centroid[0]] : null; };
    for (const [k, v] of Object.entries(ALIAS)) add(k, Array.isArray(v) ? v : country(v), Array.isArray(v) ? 3 : 1);
    for (const f of BV.countries || []) if (f.name.length > 3) add(f.name, [f.centroid[1], f.centroid[0]], 1);
    for (const c of BV.PLACES || []) add(c[0], [c[2], c[3]], 3);
    for (const a of BV.AIRPORTS || []) if (a[1].length > 3) add(a[1], [a[3], a[4]], 2);
    out.sort((a, b) => b.weight - a.weight || b.name.length - a.name.length);
    return out;
  }
  BV.newsGeo = function (text) {
    if (!index) index = buildIndex();
    for (const e of index) if (e.re.test(text)) return { lat: e.ll[0], lon: e.ll[1], place: e.name };
    return null;
  };

  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  function when(s) { const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s || ''); return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : Date.now(); }

  BV.newsArticles = function (api, query, timespan, max) {
    return api.fetchJSON(DOC + '&query=' + encodeURIComponent(query) + '&timespan=' + (timespan || '6h') + (max ? '&maxrecords=' + max : ''), { timeout: 20000 })
      .then((j) => (j.articles || []).map((a) => ({ title: (a.title || '').trim(), url: a.url, domain: a.domain, country: a.sourcecountry, ts: when(a.seendate), image: a.socialimage || '' })));
  };

  BV.registerLayer({
    id: 'news', live: true, source: 'GDELT Project',
    group: 'Live', short: 'News', label: 'Live News', color: '--c-news', glyph: '◆', shape: 'news',
    interval: 10 * 60000, cap: 1200, maxAge: 24 * 3600000, fade: 6 * 3600,
    async poll(api) {
      const arts = await BV.newsArticles(api, Q, '6h');
      const seen = new Set();
      const out = [];
      for (const a of arts) {
        if (!a.title || !a.url) continue;
        const key = a.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').slice(0, 80);
        if (seen.has(key)) continue; // syndicated copies of the same story
        seen.add(key);
        let g = BV.newsGeo(a.title), placed = 'headline';
        if (!g && a.country) { g = BV.newsGeo(a.country); placed = 'publisher'; }
        if (!g) continue;
        const id = 'news-' + hash(a.url);
        const j = parseInt(id.slice(-4), 36) || 0; // stable jitter so stacked stories fan out
        out.push({
          id, title: a.title, url: a.url, domain: a.domain, srcCountry: a.country || '', image: a.image, ts: a.ts, place: g.place, placed,
          lat: g.lat + ((j % 97) / 97 - 0.5) * 1.2, lon: g.lon + (((j / 97) | 0) % 89 / 89 - 0.5) * 1.6, city: g.place, cc: '',
        });
      }
      return out;
    },
    merge() { /* stories don't change */ },
    columns: [
      { key: 'ts', label: 'Seen', width: 84, fmt: (v) => BV.fmt.time(v) },
      { key: 'place', label: 'Where', width: 130 },
      { key: 'title', label: 'Headline', width: 460 },
      { key: 'domain', label: 'Source' },
    ],
    title: (r) => r.title,
    subtitle: (r) => r.domain + ' · ' + r.place + ' · ' + BV.fmt.ago(r.ts),
    searchText: (r) => ['news', r.title, r.domain, r.place, r.srcCountry].join(' '),
    fields: (r) => [
      ['headline', r.title], ['publisher', r.domain, true], ['publisher country', r.srcCountry || '—'], ['placed at', r.place + (r.placed === 'publisher' ? ' (publisher location)' : ' (named in headline)'), true],
      ['seen', BV.fmt.datetime(r.ts) + ' UTC'],
    ],
    extra: (r) => (r.image ? '<a class="photo" href="' + BV.fmt.esc(r.url) + '" target="_blank" rel="noopener"><img src="' + BV.fmt.esc(r.image) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></a>' : ''),
    actions: (r) => [['Read article ↗', r.url]],
    links(r, store) { return store.all('news').filter((x) => x !== r && x.place === r.place).slice(-8); },
    logLine: (r) => `news ${r.place}: ${r.title}`,
  });
})();
