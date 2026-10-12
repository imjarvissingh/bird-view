# birds view

**Live:** https://imjarvissingh.github.io/bird-view/

![birds view](docs/screenshot.png)

A lightweight, dark, multi-feed OSINT situational dashboard. Five simulated data streams
(exposed hosts, social handles, geo pings, domain intel, threat alerts) fused on one map,
with global search, a sortable data table, an entity inspector, a live event stream and
per-feed health indicators.

**Everything is simulated in the browser.** There is no backend and no network call for data.
IP addresses come only from the RFC 5737 documentation ranges (192.0.2.0/24, 198.51.100.0/24,
203.0.113.0/24), ASNs from the RFC 5398 documentation range, and domains only from reserved
TLDs (`.example`, `.test`, `.invalid`), so no record points at a real system or person.

## Run it

No install, no build.

- **Double-click `index.html`** (works from `file://` in Chrome, Edge, Firefox, Safari), or
- serve the folder: `python3 -m http.server 8080` then open http://localhost:8080

Optional: `index.html?seed=42` makes the generated data reproducible.

## Use it

| Action | How |
|---|---|
| Search anything | `/` or Ctrl/Cmd+K. Try `203.0.113`, `@ghost`, `.example`, `35.68, 139.69` |
| Filter syntax | `port:6379`, `sev:crit`, `cc:DE service:ssh`, `risk:>70`, `layer:pings kind:drone` |
| Inspect | click a marker, table row, stream line or search hit |
| Pivot | click any underlined value in the inspector to search for it |
| Pin | ☆ pin in the inspector adds the entity to the watchlist |
| Toggle layers | click in the Layers panel or press `1`–`5` |
| Pause / speed | `Space`, or the 0.5x–4x selector |
| Map | drag to pan, wheel or double-click to zoom, ⌂ to reset, ⤳ toggles arcs and tracks |
| Export | `csv` / `json` exports the current table tab with its filter applied |

## Add a data layer

1. Copy `js/layers/domains.js` to `js/layers/yourlayer.js` and change `id`, `label`, `color`,
   `generate()` and `columns`.
2. Add `<script src="js/layers/yourlayer.js"></script>` in `index.html` with the other layers.

The map, table tab, search, inspector, stream, layer toggle and feed status pick it up
automatically. The full layer contract is in `docs/02-architecture.md`.

To point a layer at a real API later, replace its feed in `js/core/mockapi.js`; the UI only
talks to `BV.store` and `BV.server.query()`, which already returns promises.

## Layout

```
index.html              app shell
css/birdsview.css       Night Heron theme + layout (responsive down to phone width)
js/core/                rng, event bus, layer registry, store, MockServer
js/data/                dotted world basemap (Natural Earth, public domain) + reference cities
js/layers/              hosts, handles, pings, domains, alerts
js/ui/                  map, panels (layers, telemetry, watchlist, inspector, stream, footer), table, search
js/app.js               bootstrap + keyboard shortcuts
docs/                   recon, architecture, brand notes
```

Font: JetBrains Mono loads from Google Fonts when online and falls back to the system monospace offline.
