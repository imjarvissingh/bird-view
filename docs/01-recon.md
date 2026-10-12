# Phase 1 · Recon: what a modern OSINT dashboard does

Note: the `replica-skill` repository was not available to this session, so the four
replica phases (recon, entrepreneur/architecture, brand, build) were carried out by hand
and recorded in these docs.

Reference class: open-source recon dashboards in the "God's Eye" mould (situational-awareness
consoles that fuse several feeds onto one map). Patterns observed across that class:

## Core surfaces
| Surface | Job | Pattern we keep |
|---|---|---|
| Global search / command bar | Single entry point for any selector (IP, handle, domain, coords) | Auto-detects selector type, supports `key:value` filters, `/` to focus |
| Map canvas | Spatial fusion of every feed | Dark basemap, per-layer colored markers, pulse on new events, arcs for relationships |
| Layer control | Turn feeds on/off, see counts | Toggle + live count + feed health per layer |
| Data table | Exact values, sorting, export | Tab per layer, sortable columns, click row to focus map |
| Entity inspector | Deep view of one record | Key/value fields, pivots ("search this value"), related entities |
| Event stream | What just happened | Terminal-style ticker, severity colored |
| Status indicators | Trust in the data | Per-feed live/degraded/offline, latency, last update, UTC clock |

## UI flow
1. Land on the live map with all feeds streaming.
2. Type a selector in search → results grouped by layer → pick one.
3. Map flies to the entity, inspector opens, table highlights the row.
4. Pivot from any inspector value to a new search; pin interesting entities to a watchlist.
5. Pause the stream to freeze the picture; export the current table as CSV/JSON.

## Data streams to simulate
Exposed hosts, social handles, geo pings (moving devices), domain intel, threat alerts.
All mocked client-side; IPs come only from RFC 5737 documentation ranges and domains only
from reserved TLDs (`.example`, `.test`, `.invalid`) so nothing points at real systems.
