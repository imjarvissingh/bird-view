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
js/data/landmask.js   dotted world basemap (Natural Earth, public domain), run-length encoded
js/data/places.js     reference cities for plausible geolocation
js/layers/*.js        one file per data layer (hosts, handles, pings, domains, alerts)
js/ui/*.js            map, layers panel, table, inspector, search, stream, statusbar
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
  links(rec, store) {}           // optional: related entities [{layer,id}] -> map arcs
});
```
Every record has `id`, `layer`, `ts`, optional `lat`/`lon`. The map, table, search,
inspector and status bar all read layer definitions, so they never need editing when a
layer is added: drop a file in `js/layers/`, add one `<script>` tag, done.

## Data flow
MockServer ticks (rAF-independent `setInterval`) → each feed emits records with simulated
latency → `store.add()` → bus `record:new` → map pulses, table/stream/statusbar update.
Selection is a single `{layer,id}` in the store; every view subscribes to `select`.

## Performance
Canvas map (no DOM per marker), offscreen-cached basemap, table renders only visible rows,
ring buffers cap memory (default 600 records per layer), UI work batched per animation frame.
