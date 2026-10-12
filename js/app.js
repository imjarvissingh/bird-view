/* birds view · bootstrap */
(function () {
  const BV = window.BV;
  const $ = (s) => document.querySelector(s);

  function start() {
    BV.resolveColors();
    const seedParam = new URLSearchParams(location.search).get('seed');
    const seed = seedParam ? (parseInt(seedParam, 10) || 1) : (Date.now() & 0x7fffffff);
    BV.server = BV.MockServer(seed);
    BV.server.start();

    BV.initMap($('.mapwrap'));
    BV.initLayers($('#layers'));
    BV.initStats($('#stats'));
    BV.initWatch($('#watch'), $('#watch-count'));
    BV.initInspector($('#inspector'));
    BV.initTable($('.tablewrap'));
    BV.initStream($('#stream'));
    BV.initFooter($('#feeds'));
    BV.initSearch($('.search'));
    $('#seed').textContent = seed;

    // clock + metrics roll
    const clock = $('.clock');
    setInterval(() => {
      const d = new Date();
      clock.innerHTML = d.toISOString().slice(11, 19) + ' <small>UTC</small>';
      BV.store.rollSecond();
    }, 1000);

    // controls
    const pauseBtn = $('#pause');
    pauseBtn.onclick = () => BV.store.setPaused();
    BV.bus.on('pause', (p) => {
      pauseBtn.classList.toggle('on', p);
      pauseBtn.textContent = p ? '▶ resume' : '❚❚ pause';
      $('.paused-banner').classList.toggle('show', p);
    });
    $('#speed').onchange = (e) => { BV.store.setSpeed(+e.target.value); BV.toast('Feed speed ' + e.target.value + 'x'); };

    document.addEventListener('keydown', (e) => {
      const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
      if (e.key === '/' && !typing) { e.preventDefault(); BV.search.focus(); return; }
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); BV.search.focus(); return; }
      if (typing) return;
      if (e.key === ' ') { e.preventDefault(); BV.store.setPaused(); }
      else if (e.key === 'Escape') BV.store.select(null);
      else if (/^[1-9]$/.test(e.key) && BV.layers[+e.key - 1]) BV.store.setVisible(BV.layers[+e.key - 1].id);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
