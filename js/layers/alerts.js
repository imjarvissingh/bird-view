/* layer · Threat Alerts: correlation rules firing over the other layers */
(function () {
  const RULES = [
    // [title, source layer, severity weights]
    ['Port sweep from host', 'hosts', [['low', 3], ['med', 4], ['high', 2]]],
    ['Exposed datastore without auth', 'hosts', [['high', 3], ['crit', 2]]],
    ['Credential mention in paste', 'handles', [['med', 2], ['high', 3], ['crit', 1]]],
    ['Dormant handle reactivated', 'handles', [['low', 4], ['med', 2]]],
    ['Beacon interval match', 'domains', [['high', 3], ['crit', 2]]],
    ['Lookalike domain registered', 'domains', [['med', 3], ['high', 2]]],
    ['Certificate mismatch', 'domains', [['low', 2], ['med', 3]]],
    ['Impossible travel between fixes', 'pings', [['med', 3], ['high', 2]]],
    ['Device entered watch zone', 'pings', [['low', 3], ['med', 2], ['high', 1]]],
  ];
  const SEV_RANK = { low: 1, med: 2, high: 3, crit: 4 };

  BV.registerLayer({
    id: 'alerts', short: 'Alerts', label: 'Threat Alerts', color: '--c-alerts', glyph: '✕', rate: 0.35, backfill: 30,
    generate(rng, ctx) {
      const rule = rng.pick(RULES);
      const pool = ctx.store.all(rule[1]);
      if (!pool.length) return null;
      const src = rng.pick(pool.slice(-120));
      const L = BV.layer(rule[1]);
      const sev = rng.weighted(rule[2]);
      const target = rng.bool(0.6) ? rng.place() : null;
      return {
        id: rng.id('a'), rule: rule[0], severity: sev, rank: SEV_RANK[sev], ref: { layer: src.layer, id: src.id },
        subject: L.title(src), lat: src.lat, lon: src.lon, city: src.city, cc: src.cc,
        target: target ? { city: target.city, cc: target.cc, lat: target.lat, lon: target.lon } : null,
        confidence: rng.int(35, 98), status: rng.weighted([['new', 6], ['triaged', 2], ['suppressed', 1]]),
        rid: 'R-' + rng.int(100, 999),
      };
    },
    columns: [
      { key: 'ts', label: 'Time', width: 84, fmt: (v) => BV.fmt.time(v) },
      { key: 'severity', label: 'Sev', width: 60, sortKey: 'rank', html: (v) => '<span class="sev ' + v + '">' + v + '</span>' },
      { key: 'rule', label: 'Rule', width: 220 },
      { key: 'subject', label: 'Subject', width: 160 },
      { key: 'city', label: 'Origin', width: 110 },
      { key: 'target', label: 'Target', fmt: (v) => (v ? v.city + ', ' + v.cc : '—') },
      { key: 'confidence', label: 'Conf', width: 56, fmt: (v) => v + '%' },
      { key: 'status', label: 'Status', width: 80 },
    ],
    title: (r) => r.rule,
    subtitle: (r) => r.severity.toUpperCase() + ' · ' + r.subject + ' · ' + r.city,
    searchText: (r) => [r.rule, r.severity, r.subject, r.city, r.cc, r.target ? r.target.city : '', r.rid, r.status].join(' '),
    fields: (r) => [
      ['severity', r.severity, true], ['rule', r.rid + ' ' + r.rule], ['subject', r.subject, true], ['source layer', BV.layer(r.ref.layer).label],
      ['origin', r.city + ', ' + r.cc], ['target', r.target ? r.target.city + ', ' + r.target.cc : '—'],
      ['confidence', r.confidence + '%'], ['status', r.status, true],
    ],
    score: (r) => r.confidence,
    links(r, store) { const s = store.get(r.ref.layer, r.ref.id); return s ? [s] : []; },
    logLine: (r) => `${r.rid} ${r.rule} :: ${r.subject}`,
    level: (r) => r.severity,
  });
})();
