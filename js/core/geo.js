/* birds view · small spherical-geometry helpers on top of d3-geo */
(function () {
  const BV = (window.BV = window.BV || {});
  const R = 6371; // km
  const RAD = Math.PI / 180;

  const geo = {
    R,
    // great-circle distance in km between [lon, lat] points
    km: (a, b) => d3.geoDistance(a, b) * R,
    // initial compass bearing from a to b in degrees
    bearing(a, b) {
      const [l1, p1] = [a[0] * RAD, a[1] * RAD], [l2, p2] = [b[0] * RAD, b[1] * RAD];
      const y = Math.sin(l2 - l1) * Math.cos(p2);
      const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(l2 - l1);
      return (Math.atan2(y, x) / RAD + 360) % 360;
    },
    // point reached travelling `dist` km from p on compass bearing `brg`
    dest(p, brg, dist) {
      const d = dist / R, b = brg * RAD, l1 = p[0] * RAD, p1 = p[1] * RAD;
      const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
      const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
      return [((l2 / RAD + 540) % 360) - 180, p2 / RAD];
    },
    // polyline helper: precompute cumulative km and sample position at distance
    polyline(pts) {
      const segs = [];
      let total = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const len = geo.km(pts[i], pts[i + 1]);
        segs.push({ a: pts[i], b: pts[i + 1], start: total, len, f: d3.geoInterpolate(pts[i], pts[i + 1]) });
        total += len;
      }
      return {
        total,
        at(dist) {
          dist = Math.max(0, Math.min(total, dist));
          let s = segs[segs.length - 1];
          for (const x of segs) if (dist <= x.start + x.len) { s = x; break; }
          const t = s.len ? (dist - s.start) / s.len : 0;
          return { p: s.f(t), seg: s };
        },
      };
    },
    compass(deg) { return ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]; },
    // sub-solar point for a timestamp (approximate, good to ~1°)
    sun(ts) {
      const d = new Date(ts);
      const start = Date.UTC(d.getUTCFullYear(), 0, 0);
      const day = (ts - start) / 864e5;
      const decl = -23.44 * Math.cos((2 * Math.PI / 365) * (day + 10));
      const utcH = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
      const eot = 9.87 * Math.sin(2 * (2 * Math.PI * (day - 81) / 364)) - 7.53 * Math.cos(2 * Math.PI * (day - 81) / 364) - 1.5 * Math.sin(2 * Math.PI * (day - 81) / 364);
      const lon = -15 * (utcH - 12 + eot / 60);
      return [((lon + 540) % 360) - 180, decl];
    },
  };

  BV.geo = geo;
})();
