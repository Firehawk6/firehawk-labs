# Langton’s Ant migration

Route: /projects/langtons-ant. The homepage and project directory discover it through src/data/projects.ts.
The original Firehawk6/langtons-ant repository and its hosting are unchanged.
Ported from commit 435d1b5b48f43f8c5a4d420353c8571c5531b8f5.

## Architecture
The VM serves static assets; each visitor runs a private simulation in their browser.
No new Python service, port, database, or Nginx route is needed.

The engine uses sparse 32×32 Uint8Array chunks, removes empty chunks, and pauses before exceeding 65,536 chunks (64 MiB of cell arrays at capacity).
Collision spawning retains the original at-most-one-new-ant-per-tick behavior, with an explicit cap (default and maximum 1,500). Reaching the population cap disables spawning only; existing ants continue moving. The separate memory limit still pauses the simulation.
One-ant starts are centered and deterministic; multi-ant starts use unique positions.
Rendering visits only visible chunks, caching each chunk raster until changed, with a reusable 8,192-slot RGBA atlas (32 MiB) and one reusable upload buffer. No per-chunk canvases are allocated. A 5 ms simulation budget per animation frame prevents catch-up loops from monopolizing the main thread; speed is a target, not a guarantee.
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
