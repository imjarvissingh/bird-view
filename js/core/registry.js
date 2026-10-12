/* birds view · layer registry: the single plug-in point for data layers.
   See docs/02-architecture.md for the layer contract. */
(function () {
  const BV = (window.BV = window.BV || {});
  const layers = [];

  BV.registerLayer = function (def) {
    if (!def || !def.id) throw new Error('layer needs an id');
    if (layers.some((l) => l.id === def.id)) throw new Error('duplicate layer ' + def.id);
    const layer = Object.assign({
      label: def.id, glyph: '●', rate: 1, backfill: 40, visible: true,
      columns: [], title: (r) => r.id, subtitle: () => '', searchText: (r) => JSON.stringify(r),
      fields: null, links: null, update: null, seed: null, severity: null, logLine: null,
    }, def);
    layer.cssColor = def.color || '--accent';
    layers.push(layer);
    return layer;
  };

  BV.layers = layers;
  BV.layer = (id) => layers.find((l) => l.id === id);

  // Resolve CSS custom properties into concrete colors once the stylesheet is loaded.
  BV.resolveColors = function () {
    const cs = getComputedStyle(document.documentElement);
    for (const l of layers) {
      l.hex = l.cssColor.startsWith('--') ? cs.getPropertyValue(l.cssColor).trim() || '#4ef2c2' : l.cssColor;
    }
  };
})();
