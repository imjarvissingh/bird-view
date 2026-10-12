/* birds view · seeded randomness + fake-data helpers.
   Everything generated here is fictional. IPv4 addresses come only from the
   RFC 5737 documentation ranges, domains only from reserved TLDs. */
(function () {
  const BV = (window.BV = window.BV || {});

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const SYL = ['ka', 'ro', 'vex', 'nyx', 'zel', 'mar', 'tik', 'lo', 'sha', 'dra', 'quin', 'bit', 'ash', 'vo', 'ryn',
    'kai', 'mox', 'fen', 'jun', 'pix', 'oro', 'sly', 'tor', 'neo', 'hex', 'ula', 'zor', 'cyr', 'ven', 'ix'];
  const WORDS = ['ghost', 'raven', 'static', 'cipher', 'drift', 'ember', 'night', 'lumen', 'void', 'echo', 'shard',
    'pulse', 'quartz', 'nova', 'flux', 'onyx', 'pixel', 'wire', 'harbor', 'signal', 'atlas', 'delta', 'kite', 'moth'];
  const DOC_NETS = ['192.0.2', '198.51.100', '203.0.113'];
  const TLDS = ['example', 'test', 'invalid', 'example', 'test'];
  const HEX = '0123456789abcdef';

  function RNG(seed) {
    const r = mulberry32(seed >>> 0);
    const api = {
      next: r,
      float: (a = 0, b = 1) => a + r() * (b - a),
      int: (a, b) => Math.floor(a + r() * (b - a + 1)),
      bool: (p = 0.5) => r() < p,
      pick: (arr) => arr[Math.floor(r() * arr.length)],
      weighted(pairs) { // [[value, weight], ...]
        let t = 0; for (const p of pairs) t += p[1];
        let x = r() * t;
        for (const p of pairs) { if ((x -= p[1]) <= 0) return p[0]; }
        return pairs[pairs.length - 1][0];
      },
      gauss(mu = 0, sd = 1) {
        const u = 1 - r(), v = r();
        return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      },
      exp(rate) { return -Math.log(1 - r()) / rate; },
      hex(n) { let s = ''; for (let i = 0; i < n; i++) s += HEX[Math.floor(r() * 16)]; return s; },
      id(prefix) { return prefix + '-' + api.hex(6); },
      ip() { return api.pick(DOC_NETS) + '.' + api.int(1, 254); },
      ipv6() { return '2001:db8:' + api.hex(4) + ':' + api.hex(4) + '::' + api.hex(3); },
      mac() { const p = []; for (let i = 0; i < 6; i++) p.push(api.hex(2)); p[0] = '02'; return p.join(':'); },
      handle() {
        const style = api.int(0, 3);
        if (style === 0) return api.pick(WORDS) + '_' + api.pick(WORDS) + api.int(1, 99);
        if (style === 1) return api.pick(SYL) + api.pick(SYL) + api.pick(SYL);
        if (style === 2) return api.pick(WORDS) + '.' + api.pick(SYL) + api.int(10, 9999);
        return api.pick(SYL) + api.pick(WORDS) + '_' + api.hex(2);
      },
      word: () => api.pick(WORDS),
      domain() {
        const base = api.bool(0.5) ? api.pick(WORDS) + '-' + api.pick(WORDS) : api.pick(SYL) + api.pick(SYL) + api.pick(WORDS);
        return base + '.' + api.pick(TLDS);
      },
      place() { // a reference city with jitter
        const p = api.pick(BV.PLACES);
        return {
          city: p[0], cc: p[1],
          lat: p[2] + api.gauss(0, 0.35),
          lon: p[3] + api.gauss(0, 0.45),
        };
      },
    };
    return api;
  }

  BV.RNG = RNG;
  BV.fmt = {
    time(ts) { const d = new Date(ts); return d.toISOString().slice(11, 19); },
    datetime(ts) { return new Date(ts).toISOString().replace('T', ' ').slice(0, 19) + 'Z'; },
    ago(ts) {
      const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
      if (s < 60) return s + 's ago';
      if (s < 3600) return Math.floor(s / 60) + 'm ago';
      if (s < 86400) return Math.floor(s / 3600) + 'h ago';
      return Math.floor(s / 86400) + 'd ago';
    },
    num(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n); },
    coord(lat, lon) { return lat.toFixed(4) + ', ' + lon.toFixed(4); },
    esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  };
})();
