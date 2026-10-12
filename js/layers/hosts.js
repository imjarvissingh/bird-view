/* layer · Exposed Hosts: internet-facing services seen by a (mock) scanner */
(function () {
  const SERVICES = [
    // [port, service, products, weight, base risk]
    [22, 'ssh', ['OpenSSH 8.9', 'OpenSSH 9.6', 'Dropbear 2022.83'], 8, 20],
    [80, 'http', ['nginx 1.24', 'Apache httpd 2.4', 'lighttpd 1.4'], 10, 15],
    [443, 'https', ['nginx 1.25', 'Caddy 2.7', 'Envoy 1.29'], 10, 10],
    [21, 'ftp', ['vsftpd 3.0', 'ProFTPD 1.3'], 2, 45],
    [23, 'telnet', ['BusyBox telnetd'], 1, 80],
    [3389, 'rdp', ['MS Terminal Services'], 2, 65],
    [5432, 'postgres', ['PostgreSQL 15', 'PostgreSQL 13'], 2, 70],
    [6379, 'redis', ['Redis 7.2', 'Redis 6.0'], 2, 85],
    [9200, 'elastic', ['Elasticsearch 8.x', 'OpenSearch 2.x'], 2, 75],
    [27017, 'mongodb', ['MongoDB 6.0'], 1, 80],
    [554, 'rtsp', ['IP camera RTSP'], 2, 60],
    [1883, 'mqtt', ['Mosquitto 2.0'], 2, 55],
    [8080, 'http-alt', ['Jetty 9', 'Tomcat 10', 'Node.js'], 3, 35],
    [5900, 'vnc', ['RealVNC 6'], 1, 75],
  ];
  const ORGS = ['Northwind Hosting', 'Bluefin Cloud', 'Kestrel Networks', 'Arcadia Telecom', 'Juniper Lane DC',
    'Halcyon Transit', 'Basalt Colo', 'Meridian Broadband', 'Sable Edge', 'Pinecrest ISP', 'Corvid Systems', 'Lattice Fiber'];
  const TAGS = ['self-signed', 'default-creds?', 'eol-software', 'iot', 'cdn', 'vpn', 'honeypot?', 'cloud', 'residential'];

  BV.registerLayer({
    id: 'hosts', short: 'Hosts', label: 'Exposed Hosts', color: '--c-hosts', glyph: '◆', rate: 1.1, backfill: 160,
    generate(rng) {
      const s = rng.weighted(SERVICES.map((x) => [x, x[3]]));
      const p = rng.place();
      const asnIdx = rng.int(0, 11);
      const risk = Math.max(1, Math.min(99, Math.round(s[4] + rng.gauss(0, 12))));
      const tags = [];
      for (let i = 0; i < rng.int(0, 2); i++) { const t = rng.pick(TAGS); if (!tags.includes(t)) tags.push(t); }
      return {
        id: rng.id('h'), ip: rng.ip(), port: s[0], service: s[1], product: rng.pick(s[2]),
        asn: 'AS' + (64500 + asnIdx), org: ORGS[asnIdx], city: p.city, cc: p.cc, lat: p.lat, lon: p.lon,
        risk, tags, ttl: rng.pick([48, 52, 56, 60, 64, 128, 255]), os: rng.pick(['Linux', 'Linux', 'FreeBSD', 'Windows', 'Embedded']),
        banner: s[1] + '/' + s[2][0].split(' ')[0].toLowerCase() + ' ' + rng.hex(8),
      };
    },
    columns: [
      { key: 'ts', label: 'Seen', width: 84, fmt: (v) => BV.fmt.time(v) },
      { key: 'ip', label: 'IP', width: 118 },
      { key: 'port', label: 'Port', width: 56 },
      { key: 'service', label: 'Service', width: 80 },
      { key: 'product', label: 'Product', width: 150 },
      { key: 'asn', label: 'ASN', width: 76 },
      { key: 'org', label: 'Org' },
      { key: 'cc', label: 'CC', width: 44 },
      { key: 'risk', label: 'Risk', width: 56, html: (v) => riskTag(v) },
    ],
    title: (r) => r.ip + ':' + r.port,
    subtitle: (r) => r.service + ' · ' + r.product + ' · ' + r.city,
    searchText: (r) => [r.ip, r.port, r.service, r.product, r.asn, r.org, r.city, r.cc, r.os, r.tags.join(' ')].join(' '),
    fields: (r) => [
      ['ip', r.ip, true], ['port', r.port, true], ['service', r.service, true], ['product', r.product],
      ['os guess', r.os + ' (ttl ' + r.ttl + ')'], ['asn', r.asn, true], ['org', r.org, true],
      ['location', r.city + ', ' + r.cc], ['coords', BV.fmt.coord(r.lat, r.lon)], ['banner', r.banner],
      ['tags', r.tags.length ? r.tags.join(', ') : '—'],
    ],
    score: (r) => r.risk,
    links(r, store) { // other services on the same IP, plus domains resolving to it
      return store.find((x) => x !== r && ((x.layer === 'hosts' && x.ip === r.ip) || (x.layer === 'domains' && x.a === r.ip)));
    },
    logLine: (r) => `scan ${r.ip}:${r.port}/${r.service} ${r.product} [${r.asn}] ${r.cc}`,
  });

  function riskTag(v) {
    const c = v >= 75 ? 'crit' : v >= 55 ? 'high' : v >= 30 ? 'med' : 'low';
    return '<span class="sev ' + c + '">' + v + '</span>';
  }
  BV.riskTag = riskTag;
})();
