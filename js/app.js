/* birds view · bootstrap, controls, keyboard, preferences, help */
(function () {
  const BV = window.BV;
  const $ = (s) => document.querySelector(s);
  const PREF_KEY = 'birdsview.prefs.v3';

  function loadPrefs() { try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch (e) { return {}; } }
  function savePrefs() {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({
        hidden: BV.layers.filter((L) => !L.visible).map((L) => L.id), speed: BV.store.state.speed,
        opts: BV.map && BV.map.opts, mode: BV.map && BV.map.view.mode,
      }));
    } catch (e) { /* storage unavailable: preferences just won't persist */ }
  }

  // Surface unexpected errors instead of failing silently.
  window.addEventListener('error', (e) => { console.error(e.error || e.message); if (BV.toast) BV.toast('Something went wrong: ' + (e.message || 'unknown error')); });

  function start() {
    try { boot(); } catch (err) {
      console.error(err);
      const m = $('#splash-msg');
      if (m) m.textContent = 'Could not start: ' + err.message + '. Try reloading the page.';
    }
  }

  function boot() {
    BV.resolveColors();
    const prefs = loadPrefs();
    for (const L of BV.layers) if (prefs.hidden && prefs.hidden.includes(L.id) && L.live) L.visible = false;

    const seedParam = new URLSearchParams(location.search).get('seed');
    const seed = seedParam ? (parseInt(seedParam, 10) || 1) : (Date.now() & 0x7fffffff);
    BV.server = BV.MockServer(seed);
    // simulated twins of live layers stay hidden unless their live source fails (live.js turns them on)
    const twins = new Set(BV.layers.filter((L) => L.live && L.fallback).flatMap((L) => [].concat(L.fallback)));
    twins.forEach((id) => { BV.layer(id).visible = false; });
    BV.server.start();
    BV.live.start();
    if (prefs.speed) { BV.store.setSpeed(prefs.speed); $('#speed').value = String(prefs.speed); }

    BV.initMap($('.mapwrap'));
    if (prefs.opts) for (const k of Object.keys(BV.map.opts)) if (typeof prefs.opts[k] === 'boolean' && BV.map.opts[k] !== prefs.opts[k]) BV.map.toggle(k);
    if (prefs.mode === 'flat' && !location.hash) BV.map.setMode('flat');

    BV.initLayers($('#layers'));
    BV.initStats($('#stats'));
    BV.initWatch($('#watch'), $('#watch-count'));
    BV.initInspector($('#inspector'));
    BV.initTable($('.tablewrap'));
    BV.initStream($('#stream'), $('#stream-filter'));
    BV.initFooter($('#feeds'));
    BV.initSearch($('.search'));
    $('#seed').textContent = seed;

    // clock + metrics roll
    const clock = $('.clock');
    const tickClock = () => { clock.innerHTML = new Date().toISOString().slice(11, 19) + ' <small>UTC</small>'; };
    tickClock();
    setInterval(() => { tickClock(); BV.store.rollSecond(); }, 1000);

    // ---------- top controls ----------
    const badge = $('#mode-badge');
    const paintBadge = () => {
      const fs = BV.live.feeds(), n = fs.filter((f) => f.status === 'live').length;
      const connecting = fs.some((f) => f.status === 'connecting') && !n;
      badge.textContent = connecting ? 'CONNECTING' : n ? 'LIVE · ' + n + '/' + fs.length : 'SIMULATED';
      badge.classList.toggle('live', n > 0);
    };
    paintBadge(); setInterval(paintBadge, 1500);
    $('#tv-btn').onclick = () => BV.explore.openTV();
    $('#street-btn').onclick = () => BV.explore.viewHere();
    const pauseBtn = $('#pause');
    pauseBtn.onclick = () => BV.store.setPaused();
    BV.bus.on('pause', (p) => {
      pauseBtn.classList.toggle('on', p);
      pauseBtn.setAttribute('aria-pressed', String(p));
      pauseBtn.textContent = p ? '▶ resume' : '❚❚ pause';
      $('.paused-banner').classList.toggle('show', p);
    });
    $('#speed').onchange = (e) => { BV.store.setSpeed(+e.target.value); BV.toast('Simulation speed ' + e.target.value + '×'); savePrefs(); };

    // ---------- map controls ----------
    const ctrl = $('.map-ctrl');
    const syncCtrl = () => {
      for (const k of ['spin', 'night', 'labels', 'trails']) ctrl.querySelector('[data-act=' + k + ']').classList.toggle('on', BV.map.opts[k]);
      const m = ctrl.querySelector('[data-act=mode]');
      m.textContent = BV.map.view.mode === 'globe' ? '◐' : '▭';
      m.title = BV.map.view.mode === 'globe' ? 'Switch to flat map (G)' : 'Switch to globe (G)';
      const t = ctrl.querySelector('[data-act=tour]');
      t.classList.toggle('on', BV.map.touring()); t.textContent = BV.map.touring() ? '■' : '▶';
      t.setAttribute('aria-label', BV.map.touring() ? 'Stop tour' : 'Start tour');
    };
    const actions = {
      zin: () => BV.map.zoomBy(1.6), zout: () => BV.map.zoomBy(1 / 1.6), home: () => BV.map.home(),
      mode: () => { BV.map.setMode(BV.map.view.mode === 'globe' ? 'flat' : 'globe'); BV.toast(BV.map.view.mode === 'globe' ? 'Globe view' : 'Flat map'); },
      spin: () => BV.toast('Auto-rotate ' + (BV.map.toggle('spin') ? 'on' : 'off')),
      night: () => BV.toast('Day/night ' + (BV.map.toggle('night') ? 'on' : 'off')),
      labels: () => BV.toast('Labels ' + (BV.map.toggle('labels') ? 'on' : 'off')),
      trails: () => BV.toast('Tracks ' + (BV.map.toggle('trails') ? 'on' : 'off')),
      tour: () => { if (BV.map.touring()) BV.map.stopTour(); else { BV.map.startTour(); BV.toast('Touring hotspots. Press Esc to stop.'); } },
    };
    ctrl.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) { actions[b.dataset.act](); syncCtrl(); savePrefs(); } });
    BV.bus.on('tour', syncCtrl); BV.bus.on('map:mode', syncCtrl); BV.bus.on('map:opts', syncCtrl);
    syncCtrl();

    const region = $('#region');
    region.innerHTML = '<option value="">Jump to…</option>' + BV.map.regions.map((r, i) => '<option value="' + i + '">' + r[0] + '</option>').join('');
    region.onchange = () => { const r = BV.map.regions[+region.value]; if (r) BV.map.flyTo(r[1], r[2], BV.map.view.mode === 'globe' ? r[3] : r[3] * 2); region.value = ''; };

    BV.bus.on('layers:change', savePrefs);

    // ---------- help ----------
    const help = $('#help');
    let lastFocus = null;
    const openHelp = () => { lastFocus = document.activeElement; help.hidden = false; help.querySelector('[data-close]').focus(); };
    const closeHelp = () => { help.hidden = true; if (lastFocus) lastFocus.focus(); };
    $('#help-btn').onclick = openHelp;
    help.addEventListener('click', (e) => { if (e.target === help || e.target.closest('[data-close]')) closeHelp(); });

    // ---------- keyboard ----------
    document.addEventListener('keydown', (e) => {
      const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
      if (BV.explore.isOpen()) { if (e.key === 'Escape') BV.explore.close(); return; }
      if (!help.hidden) { if (e.key === 'Escape') closeHelp(); return; }
      if ((e.key === '/' && !typing) || ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey))) { e.preventDefault(); BV.search.focus(); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === ' ') { e.preventDefault(); BV.store.setPaused(); }
      else if (k === 'Escape') { BV.map.stopTour(); BV.map.stopFollow(); BV.store.select(null); BV.store.selectCountry(null); }
      else if (k === '?') openHelp();
      else if (k === 'b' || k === 'B') BV.explore.openTV();
      else if (k === 'v' || k === 'V') BV.explore.viewHere();
      else if (k === 't' || k === 'T') actions.tour();
      else if (k === 'g' || k === 'G') actions.mode();
      else if (k === 'h' || k === 'H') actions.home();
      else if (k === 'n' || k === 'N') actions.night();
      else if (k === 'l' || k === 'L') actions.labels();
      else if (k === 'k' || k === 'K') actions.trails();
      else if (k === 'r' || k === 'R') actions.spin();
      else if (k === 'f' || k === 'F') { const s = BV.store.selected(); if (s && BV.layer(s.layer).moving) { if (BV.map.isFollowing(s)) BV.map.stopFollow(); else BV.map.startFollow(s); } else BV.toast('Select a flight, ship, satellite or storm to follow'); }
      else if (k === '+' || k === '=') BV.map.zoomBy(1.4);
      else if (k === '-' || k === '_') BV.map.zoomBy(1 / 1.4);
      else if (k === 'ArrowLeft') { e.preventDefault(); BV.map.pan(-12, 0); }
      else if (k === 'ArrowRight') { e.preventDefault(); BV.map.pan(12, 0); }
      else if (k === 'ArrowUp') { e.preventDefault(); BV.map.pan(0, 8); }
      else if (k === 'ArrowDown') { e.preventDefault(); BV.map.pan(0, -8); }
      else {
        const i = '1234567890'.indexOf(k);
        if (i >= 0 && BV.layers[i]) { BV.store.setVisible(BV.layers[i].id); BV.toast(BV.layers[i].label + (BV.layers[i].visible ? ' shown' : ' hidden')); }
        else return;
      }
      syncCtrl(); savePrefs();
    });

    // ---------- splash ----------
    const splash = $('#splash');
    $('#splash-msg').textContent = 'Connecting ' + BV.layers.filter((L) => L.live).length + ' live feeds · ' + BV.layers.filter((L) => !L.live).length + ' simulated';
    setTimeout(() => { splash.classList.add('done'); setTimeout(() => splash.remove(), 600); }, 650);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
