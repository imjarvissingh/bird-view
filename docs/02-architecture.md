# Phase 2 · Architecture

Goal: zero-build, zero-backend, opens from `index.html` (works over `file://`), and a new
data layer is one file.

```
index.html            shell + script tags (order matters)
css/birdsview.css     design tokens + layout
js/core/rng.js        seeded PRNG + fake-data helpers (IPs, handles, domains, places)
js/core/bus.js        tiny pub/sub event bus
js/core/registry.js   BV.registerLayer(def): the plug-in point for data layers
js/core/store.js      entity store per layer (ring buffer), selection, filters, watchlist
js/core/mockapi.js    MockServer: per-feed streaming with latency, jitter, degradations
js/core/geo.js        great-circle helpers, polylines, sub-solar point (day/night)
js/vendor/            d3-geo + d3-array + topojson-client, vendored for offline use
js/data/world110.js   Natural Earth 1:110m countries (public domain); world50.js loads after for zoom
js/data/georef.js     airports, shipping lanes, seismic/fire regions, cyclone basins, satellite families
js/data/places.js     reference cities
js/layers/*.js        one file per data layer (11 layers)
js/ui/globe.js        orthographic globe + equirectangular map on canvas via d3-geo
js/ui/*.js            panels (layers, telemetry, watchlist, inspector, stream, footer), table, search
js/app.js             bootstrap and keyboard shortcuts
```

## Layer contract
```js
BV.registerLayer({
  id: 'hosts', label: 'Exposed Hosts', color: '--c-hosts', glyph: '◆',
  rate: 1.2,                     // mean events / second from the mock feed
  seed(rng, n) {},               // optional initial backfill -> array of records
  generate(rng, ctx) {},         // one new record (ctx gives store + other layers)
  update(rec, rng, dt) {},       // optional: mutate moving entities each tick
  columns: [{ key, label, fmt?, width? }],
  title(rec), subtitle(rec),     // used by search results + inspector
  searchText(rec),               // haystack for full-text search
  links(rec, store) {}           // optional: related entities -> drawn as links when selected
  group: 'Movement',             // layer panel group
  shape: 'plane',                // marker: plane, ship, sat, quake, fire, storm, or a layer id
  moving: true,                  // shows tracks, enables follow
  cap: 400,                      // ring-buffer size
  extra(rec) {},                 // optional extra inspector HTML (e.g. route progress)
  level(rec) {},                 // optional severity for the event stream
});
```
Every record has `id`, `layer`, `ts`, optional `lat`/`lon`. The map, table, search,
inspector and status bar all read layer definitions, so they never need editing when a
layer is added: drop a file in `js/layers/`, add one `<script>` tag, done.

## Data flow
MockServer ticks (`setInterval`, 10 Hz) → each feed emits records with simulated latency →
`store.add()` → bus `record:new` → globe pulses, table/stream/status update. Moving entities
are advanced every animation frame by `BV.server.advance(dt)` so motion is smooth; layers can
end entities (a flight lands, a storm dissipates) with `store.remove()`.
Selection is a single `{layer,id}` in the store; every view subscribes to `select`.

## Performance
Canvas map (no DOM per marker), offscreen-cached basemap, table renders only visible rows,
ring buffers cap memory (default 600 records per layer), UI work batched per animation frame.
