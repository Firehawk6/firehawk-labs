# Langton’s Ant migration

Route: /projects/langtons-ant. The homepage and project directory discover it through src/data/projects.ts.
The original Firehawk6/langtons-ant repository and its hosting are unchanged.
Ported from commit 435d1b5b48f43f8c5a4d420353c8571c5531b8f5.

## Architecture
The VM serves static assets; each visitor runs a private simulation in their browser.
No new Python service, port, database, or Nginx route is needed.

The engine uses sparse 32×32 Uint8Array chunks, removes empty chunks, and pauses before exceeding 65,536 chunks (64 MiB of exact cell arrays plus 20 MiB of density arrays at capacity).
Collision spawning retains the original at-most-one-new-ant-per-tick behavior, with an explicit cap (default and maximum 1,500). Reaching the population cap disables spawning only; existing ants continue moving. The separate memory limit still pauses the simulation.
One-ant starts are centered and deterministic; multi-ant starts use unique positions.
Rendering visits only visible chunks, caching each chunk raster until changed, with a reusable 8,192-slot RGBA atlas (32 MiB) and reusable upload buffers. No per-chunk canvases are allocated. A simulation budget of 18% of elapsed frame time, capped at 3 ms per frame, prevents catch-up loops from monopolizing the main thread; speed is a target, not a guarantee.
Hidden/offscreen simulations suspend. Requested run state resumes when visible.
There is no persistent save state; image export saves the current viewport.

## Validation
Run with the repository's supported Node version:

```sh
node tests/ant-engine.test.mjs
npm ci
npm run build
```

Engine regression tests were executed in a JavaScript runtime during preparation. They cover a 100,000-tick reference comparison, negative coordinates, chunk reclamation, memory limits, collision spawning and caps, and a multi-ant run.
Full Astro build and browser validation were NOT available in the preparation environment.

Before deployment, preview and check:
- /, /projects and /projects/langtons-ant links, with no duplicate generated route.
- Play/pause, single-step, reset during playback, speed 1 and 30,000.
- Apply 100 ants with spawning and a cap of 100; verify population never exceeds cap.
- All five palettes, pan, zoom buttons/wheel, follow, PNG export.
- Mobile width 375px, touch dragging, keyboard focus and arrow-key panning.
- Tab hide/show and canvas scrolling out of view; no catch-up burst on return.
- Long run at high speed and observe actual ticks/s, controls and memory.
- Existing visitor globe and collector remain functional.

## Deploy after validation
Use the normal static build/copy process. Do not rerun or change the visitor collector.

### Large-world rendering

The renderer retains a viewport-sized trail canvas and updates only chunks changed
since the previous frame. Deleted chunks are cleared too; offscreen changes are
picked up on the next camera redraw. Pan, zoom, follow, palette changes and resize
invalidate the viewport. Integer device-pixel boundaries prevent seams at fractional
zoom. The atlas remains bounded at 32 MiB; the extra viewport layer uses four bytes
per backing pixel. Ant markers are drawn in one path, independently of the trails.

For long runs, turn off follow to benefit most from retained trails. Camera motion
still redraws all visible chunks, and 1,500 ants at high tick rates remain limited
by the visitor's browser/device (the simulation is not running on the VM).

Regression checks:
`node tests/ant-engine.test.mjs`, `node tests/ant-raster-cache.test.mjs`, and
`node tests/ant-trail-layer.test.mjs`. The retained-layer test exercises 10,000
visible chunks beyond atlas capacity, localized mutations, deletion, offscreen
changes, pan, palette changes and reset. These are operation-count/correctness
checks, not browser FPS measurements.


### Watching the wide view

Below one CSS pixel per cell, presentation is capped at 30 FPS and ant markers
become one-pixel dots so they do not obscure the trails. Simulation still uses
exact cell states and the full ant population. Camera interactions render promptly.
At <= 0.5 device pixels per cell, rendering uses incremental 2×2 density counts;
at <= 0.25 it uses 4×4 counts. The latter uploads 64 rather than 1,024 pixels per
changed chunk. Density opacity is square-root boosted to retain faint isolated
paths; zooming back in restores exact cell rendering. These display summaries
never feed back into the simulation. Extra density storage is 320 bytes per chunk.

The simulation CPU budget scales with elapsed time to avoid using more CPU on
120/144 Hz monitors. Actual tick rate can be below the selected target under load.
`node tests/ant-detail.test.mjs` checks density against exact cells and zoom transitions;
`node tests/ant-cadence.test.mjs` checks wide-view cadence and CPU scheduling with a
mock 120 Hz clock. Browser FPS and GPU cost still need real-device validation.
