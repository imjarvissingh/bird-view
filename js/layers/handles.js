/* layer · Social Handles: public accounts surfaced by (mock) keyword monitors */
(function () {
  const PLATFORMS = [['microblog', 6], ['forum', 4], ['imageboard', 2], ['code-host', 3], ['video', 2], ['messenger', 2], ['paste-site', 1]];
  const LANGS = ['en', 'en', 'en', 'es', 'de', 'fr', 'pt', 'ru', 'ja', 'hi', 'ar', 'tr'];
  const TOPICS = ['crypto', 'infosec', 'gaming', 'travel', 'leaks', 'devops', 'photography', 'politics', 'ai', 'drones', 'ham radio', 'music'];

  BV.registerLayer({
    id: 'handles', group: 'People', short: 'Handles', label: 'Social Handles', color: '--c-handles', glyph: '●', rate: 0.8, backfill: 120,
    generate(rng) {
      const p = rng.place();
      const platform = rng.weighted(PLATFORMS);
      const created = Date.now() - rng.int(3, 4200) * 86400000;
      const topics = [];
      for (let i = 0; i < rng.int(1, 3); i++) { const t = rng.pick(TOPICS); if (!topics.includes(t)) topics.push(t); }
      const handle = rng.handle();
      return {
        id: rng.id('u'), handle, platform, followers: Math.round(Math.exp(rng.float(1, 11))),
        posts: rng.int(0, 24000), created, lang: rng.pick(LANGS), topics,
        email: rng.bool(0.35) ? handle.replace(/[^a-z0-9]/g, '') + '@' + rng.domain() : null,
        sentiment: Math.round(rng.gauss(0, 0.45) * 100) / 100,
        city: p.city, cc: p.cc, lat: p.lat, lon: p.lon, verified: rng.bool(0.06),
        geoConf: rng.pick(['exif', 'self-reported', 'timezone', 'ip-inferred']),
      };
    },
    columns: [
      { key: 'ts', label: 'Seen', width: 84, fmt: (v) => BV.fmt.time(v) },
      { key: 'handle', label: 'Handle', width: 170, fmt: (v) => '@' + v },
      { key: 'platform', label: 'Platform', width: 96 },
      { key: 'followers', label: 'Followers', width: 84, fmt: (v) => BV.fmt.num(v) },
      { key: 'topics', label: 'Topics', html: (v) => v.map((t) => '<span class="tag">' + t + '</span>').join('') },
      { key: 'lang', label: 'Lang', width: 50 },
      { key: 'city', label: 'Geo', width: 110 },
      { key: 'sentiment', label: 'Tone', width: 60, fmt: (v) => (v > 0 ? '+' : '') + v.toFixed(2) },
    ],
    title: (r) => '@' + r.handle,
    subtitle: (r) => r.platform + ' · ' + BV.fmt.num(r.followers) + ' followers · ' + r.city,
    searchText: (r) => ['@' + r.handle, r.platform, r.lang, r.topics.join(' '), r.city, r.cc, r.email || ''].join(' '),
    fields: (r) => [
      ['handle', '@' + r.handle, true], ['platform', r.platform, true], ['followers', r.followers.toLocaleString()],
      ['posts', r.posts.toLocaleString()], ['created', BV.fmt.datetime(r.created).slice(0, 10)], ['language', r.lang, true],
      ['topics', r.topics.join(', ')], ['email', r.email || '—', !!r.email], ['verified', r.verified ? 'yes' : 'no'],
      ['geo', r.city + ', ' + r.cc + ' (' + r.geoConf + ')'], ['coords', BV.fmt.coord(r.lat, r.lon)],
      ['tone', (r.sentiment > 0 ? '+' : '') + r.sentiment.toFixed(2)],
    ],
    score: (r) => Math.min(99, Math.round(Math.log10(r.followers + 1) * 20)),
    links(r, store) {
      const dom = r.email ? r.email.split('@')[1] : null;
      return store.find((x) => x !== r && ((dom && x.layer === 'domains' && x.domain === dom) || (x.layer === 'handles' && x.handle === r.handle)));
    },
    logLine: (r) => `mention @${r.handle} on ${r.platform} (${r.topics.join(',')}) ~${r.city}`,
  });
})();
