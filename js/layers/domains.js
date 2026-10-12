/* layer · Domain Intel: registrations, DNS and certificate observations */
(function () {
  const REGISTRARS = ['Registrar Nine', 'Quillmark Names', 'Harbor Domains', 'NameLattice', 'Orbit Registry Svc', 'Tallow & Co'];
  const CAS = ['Example Trust CA', 'Placeholder Root R3', 'Test Assurance G2', 'self-signed'];
  const FLAGS = [['newly-registered', 3], ['typosquat-like', 2], ['parked', 2], ['fast-flux', 1], ['privacy-proxy', 3], ['mx-missing', 1], ['clean', 6]];

  BV.registerLayer({
    id: 'domains', group: 'Cyber', short: 'Domains', label: 'Domain Intel', color: '--c-domains', glyph: '■', rate: 0.6, backfill: 90,
    generate(rng, ctx) {
      const hosts = ctx.store.all('hosts');
      const reuse = hosts.length && rng.bool(0.4) ? rng.pick(hosts) : null; // resolves to a known host
      const p = reuse ? { city: reuse.city, cc: reuse.cc, lat: reuse.lat, lon: reuse.lon } : rng.place();
      const ageDays = rng.bool(0.3) ? rng.int(0, 14) : rng.int(15, 6000);
      const flags = [];
      for (let i = 0; i < rng.int(1, 2); i++) { const f = rng.weighted(FLAGS); if (!flags.includes(f)) flags.push(f); }
      if (ageDays < 15 && !flags.includes('newly-registered')) flags.unshift('newly-registered');
      const risk = Math.min(99, Math.round(10 + (ageDays < 15 ? 30 : 0) + flags.filter((f) => f !== 'clean').length * 18 + rng.float(0, 15)));
      const domain = rng.domain();
      return {
        id: rng.id('n'), domain, registrar: rng.pick(REGISTRARS), created: Date.now() - ageDays * 86400000, ageDays,
        a: reuse ? reuse.ip : rng.ip(), aaaa: rng.bool(0.4) ? rng.ipv6() : null,
        ns: 'ns' + rng.int(1, 4) + '.' + rng.pick(['dnshost', 'nameops', 'zonecraft']) + '.example',
        ca: rng.pick(CAS), subdomains: rng.int(0, 40), flags, risk,
        city: p.city, cc: p.cc, lat: p.lat + rng.gauss(0, 0.1), lon: p.lon + rng.gauss(0, 0.1),
      };
    },
    columns: [
      { key: 'ts', label: 'Seen', width: 84, fmt: (v) => BV.fmt.time(v) },
      { key: 'domain', label: 'Domain', width: 200 },
      { key: 'a', label: 'A', width: 118 },
      { key: 'registrar', label: 'Registrar', width: 140 },
      { key: 'ageDays', label: 'Age', width: 60, fmt: (v) => v + 'd' },
      { key: 'flags', label: 'Flags', html: (v) => v.map((t) => '<span class="tag">' + t + '</span>').join('') },
      { key: 'risk', label: 'Risk', width: 56, html: (v) => BV.riskTag(v) },
    ],
    title: (r) => r.domain,
    subtitle: (r) => 'A ' + r.a + ' · ' + r.registrar + ' · ' + r.ageDays + 'd old',
    searchText: (r) => [r.domain, r.a, r.aaaa || '', r.registrar, r.ns, r.ca, r.flags.join(' '), r.city, r.cc].join(' '),
    fields: (r) => [
      ['domain', r.domain, true], ['A', r.a, true], ['AAAA', r.aaaa || '—'], ['NS', r.ns, true],
      ['registrar', r.registrar, true], ['created', BV.fmt.datetime(r.created).slice(0, 10) + ' (' + r.ageDays + 'd)'],
      ['cert issuer', r.ca, true], ['subdomains', r.subdomains], ['flags', r.flags.join(', ')], ['hosting', r.city + ', ' + r.cc],
    ],
    score: (r) => r.risk,
    links(r, store) {
      return store.find((x) => x !== r && ((x.layer === 'hosts' && x.ip === r.a) || (x.layer === 'handles' && x.email && x.email.endsWith('@' + r.domain)) || (x.layer === 'domains' && x.a === r.a)));
    },
    logLine: (r) => `dns ${r.domain} -> ${r.a} [${r.flags.join(',')}]`,
  });
})();
