/* birds view · explore: Live TV (news channels) and the place viewer (street view, satellite,
   weather, what's happening nearby). Both are modals built on demand. Embeds come from
   YouTube and Google Maps; where a browser or host blocks them, the links beside them still work. */
(function () {
  const BV = (window.BV = window.BV || {});
  const esc = (s) => BV.fmt.esc(s);
  const CHANNELS = [
    ['Al Jazeera English', 'UCNye-wNBqNL5ZzHSJj3l8Bg', 'Qatar'], ['DW News', 'UCknLrEdhRCp1aegoMqRaCZg', 'Germany'], ['France 24 English', 'UCQfwfsi5VrQ8yKZ-UWmAEFg', 'France'],
    ['Sky News', 'UCoMdktPbSTixAyNGwb-UYkQ', 'UK'], ['Euronews', 'UCSrZ3UV4jOidv8ppoVuvW9Q', 'Europe'], ['TRT World', 'UC7fWeaHhqgM4Ry-RMpM2YYw', 'Turkey'],
    ['NBC News', 'UCeY0bbntWzzVIaj2z3QigXg', 'USA'], ['ABC News', 'UCBi2mrWuNuyYy4gbM6fU18Q', 'USA'], ['CBS News', 'UC8p1vwvWtl6T73JiExfWzNw', 'USA'],
    ['LiveNOW from FOX', 'UCJg9wBPyKMNA5sRDnvzmkdg', 'USA'], ['Bloomberg', 'UCIALMKvObZNtJ6AmdCLP7Lg', 'Business'], ['CNA', 'UC83jt4dlz1Gjl58fzQrrKZg', 'Singapore'],
    ['WION', 'UC_gUM8rL-Lrg6O3adPW9K1g', 'India'], ['NDTV 24x7', 'UCZFMm1mMw0F81Z37aaEzTUA', 'India'], ['India Today', 'UCYPvAwZP8pZhSMW8qs7cVCw', 'India'],
    ['NASA', 'UCLA_DiR1FfKNvjuUpBHmylQ', 'Space'],
  ];
  const WX = { 0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers', 95: 'Thunderstorm', 96: 'Thunderstorm, hail', 99: 'Severe thunderstorm' };
  let tv, view, openEl = null, lastFocus = null;

  function modal(id, title) {
    const m = document.createElement('div');
    m.className = 'modal'; m.id = id; m.hidden = true; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', title);
    m.innerHTML = '<div class="modal-card wide"><div class="modal-h"><h2></h2><button class="btn icon-btn" data-close aria-label="Close">×</button></div><div class="mbody"></div></div>';
    m.querySelector('h2').textContent = title;
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) close(); });
    document.body.appendChild(m);
    return m;
  }
  function show(m) { lastFocus = document.activeElement; if (openEl) close(); openEl = m; m.hidden = false; m.querySelector('[data-close]').focus(); }
  function close() {
    if (!openEl) return;
    openEl.hidden = true;
    const f = openEl.querySelector('iframe'); if (f) f.src = 'about:blank'; // stop playback
    openEl = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // ---------- Live TV ----------
  function playChannel(i) {
    const c = CHANNELS[i];
    tv.querySelectorAll('.ch').forEach((el, k) => el.classList.toggle('on', k === i));
    const p = tv.querySelector('.player');
    p.innerHTML = '<iframe title="' + esc(c[0]) + ' live" src="https://www.youtube-nocookie.com/embed/live_stream?channel=' + c[1] + '&autoplay=1&mute=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>' +
      '<div class="pfall">If the player stays blank (blocked by the broadcaster or this network), <a href="https://www.youtube.com/channel/' + c[1] + '/live" target="_blank" rel="noopener">open ' + esc(c[0]) + ' live on YouTube ↗</a></div>';
    try { localStorage.setItem('birdsview.tv', String(i)); } catch (e) { /* ignore */ }
  }
  function openTV() {
    if (!tv) {
      tv = modal('tv', 'Live news channels');
      tv.querySelector('.mbody').innerHTML = '<div class="tvgrid"><div class="chlist" role="listbox" aria-label="Channels">' +
        CHANNELS.map((c, i) => '<button class="ch" role="option" data-i="' + i + '"><b>' + esc(c[0]) + '</b><span>' + esc(c[2]) + '</span></button>').join('') + '</div><div class="player"></div></div>';
      tv.querySelector('.chlist').addEventListener('click', (e) => { const b = e.target.closest('.ch'); if (b) playChannel(+b.dataset.i); });
    }
    show(tv);
    let i = 0; try { i = Math.min(CHANNELS.length - 1, +localStorage.getItem('birdsview.tv') || 0); } catch (e) { /* ignore */ }
    playChannel(i);
  }

  // ---------- place viewer ----------
  const near = (lat, lon, km) => BV.store.find((r) => r.lat !== undefined && !r.ended && r.live && BV.geo.km([lon, lat], [r.lon, r.lat]) < km);
  function frame(kind, lat, lon) {
    const url = kind === 'street'
      ? 'https://maps.google.com/maps?layer=c&cbll=' + lat + ',' + lon + '&cbp=12,0,0,0,0&output=svembed'
      : 'https://maps.google.com/maps?q=' + lat + ',' + lon + '&t=k&z=17&output=embed';
    return '<iframe title="' + (kind === 'street' ? 'Street view' : 'Satellite view') + '" src="' + url + '" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>';
  }
  function openView(lat, lon, title, kind) {
    lat = +lat.toFixed(5); lon = +lon.toFixed(5);
    if (!view) {
      view = modal('place', 'Place');
      view.addEventListener('click', (e) => {
        const t = e.target.closest('[data-kind]');
        if (t) { view._kind = t.dataset.kind; renderFrame(); }
        const r = e.target.closest('[data-sel]');
        if (r) { close(); BV.store.select({ layer: r.dataset.l, id: r.dataset.sel }); }
      });
    }
    view._at = { lat, lon, title }; view._kind = kind || 'street';
    view.querySelector('h2').textContent = title || BV.fmt.coord(lat, lon);
    view.querySelector('.mbody').innerHTML = '<div class="pv"><div class="pvmain"><div class="pvtabs"><button class="btn small" data-kind="street">Street view</button><button class="btn small" data-kind="sat">Satellite</button></div>' +
      '<div class="pvframe"></div><div class="pfall"></div></div><div class="pvside"><div class="wx"><div class="empty">Loading weather…</div></div><div class="nb"></div></div></div>';
    show(view); renderFrame(); renderNear(); weather(lat, lon);
  }
  function renderFrame() {
    const { lat, lon } = view._at, k = view._kind;
    view.querySelectorAll('[data-kind]').forEach((b) => b.classList.toggle('on', b.dataset.kind === k));
    view.querySelector('.pvframe').innerHTML = frame(k, lat, lon);
    view.querySelector('.pfall').innerHTML = (k === 'street'
      ? 'No street imagery here, or it stays blank? <a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + lat + ',' + lon + '" target="_blank" rel="noopener">Open Street View ↗</a>'
      : '<a href="https://www.google.com/maps/@' + lat + ',' + lon + ',17z/data=!3m1!1e3" target="_blank" rel="noopener">Open satellite map ↗</a>') +
      ' · <a href="https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lon + '#map=15/' + lat + '/' + lon + '" target="_blank" rel="noopener">OpenStreetMap ↗</a> · <a href="https://www.mapillary.com/app/?lat=' + lat + '&lng=' + lon + '&z=16" target="_blank" rel="noopener">Mapillary ↗</a>';
  }
  function renderNear() {
    const { lat, lon } = view._at;
    const items = near(lat, lon, 400).sort((a, b) => BV.geo.km([lon, lat], [a.lon, a.lat]) - BV.geo.km([lon, lat], [b.lon, b.lat])).slice(0, 12);
    const f = near(lat, lon, 80).filter((r) => r.layer === 'lflights').length;
    view.querySelector('.nb').innerHTML = '<div class="subh">Nearby right now · ' + f + ' aircraft within 80 km</div>' + (items.length ? items.map((o) => {
      const OL = BV.layer(o.layer);
      return '<div class="rel" data-l="' + o.layer + '" data-sel="' + esc(o.id) + '" style="--c:' + OL.hex + '" role="button" tabindex="0"><span class="g">' + OL.glyph + '</span><span class="rt">' + esc(OL.title(o)) + '</span><span class="rs">' + Math.round(BV.geo.km([lon, lat], [o.lon, o.lat])) + ' km</span></div>';
    }).join('') : '<div class="empty">No live events or news within 400 km.</div>');
  }
  function weather(lat, lon) {
    const box = view.querySelector('.wx');
    BV.live.fetchJSON('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,precipitation,is_day&timezone=auto', { timeout: 10000 })
      .then((j) => {
        if (!view || view._at.lat !== lat) return;
        const c = j.current, local = new Date(Date.now() + (j.utc_offset_seconds || 0) * 1000).toISOString().slice(11, 16);
        box.innerHTML = '<div class="subh">Weather now</div><div class="wxbig">' + Math.round(c.temperature_2m) + '°C <small>' + esc(WX[c.weather_code] || 'Conditions') + '</small></div>' +
          '<div class="kv"><div class="k">feels like</div><div class="v">' + Math.round(c.apparent_temperature) + '°C</div><div class="k">humidity</div><div class="v">' + c.relative_humidity_2m + '%</div>' +
          '<div class="k">wind</div><div class="v">' + Math.round(c.wind_speed_10m) + ' km/h ' + BV.geo.compass(c.wind_direction_10m) + '</div><div class="k">precip</div><div class="v">' + c.precipitation + ' mm</div>' +
          '<div class="k">local time</div><div class="v">' + local + ' ' + (c.is_day ? '(day)' : '(night)') + ' · ' + esc(j.timezone_abbreviation || '') + '</div><div class="k">position</div><div class="v">' + BV.fmt.coord(lat, lon) + '</div></div>';
      })
      .catch(() => { if (view && view._at.lat === lat) box.innerHTML = '<div class="subh">Weather now</div><div class="empty">Weather service unreachable. Position ' + BV.fmt.coord(lat, lon) + '.</div>'; });
  }

  BV.explore = {
    openTV, openView, close,
    isOpen: () => !!openEl,
    // street view of the selection, else the map center
    viewHere() {
      const s = BV.store.selected();
      if (s && s.lat !== undefined) return openView(s.lat, s.lon, BV.layer(s.layer).title(s));
      const v = BV.map.view; openView(v.lat, v.lon, 'Map center');
    },
  };
})();
