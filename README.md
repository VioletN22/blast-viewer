# Bench blast viewer

An interactive 3D viewer for blast movement on an open-pit bench: drill holes fire on their delays, the rock mass moves into a muck pile, and the ore zone is shown before and after. It is a portfolio demo of interactive 3D blast-movement visualisation, built on synthetic data.

**Live:** https://violetn22.github.io/blast-viewer/

> Synthetic data. Illustrative model, not a prediction. Nothing here is calibrated to a real site, rock mass or explosive, and it should not be used to plan or assess a blast.

![Desktop: mid-blast with a hole selected and the ore zone on](docs/desktop.jpg)

| End of the blast, ore zone before (dashed) and after | Phone, portrait |
| --- | --- |
| ![The muck pile at the end of the blast with the moved ore zone](docs/end-ore-zone.jpg) | ![The viewer on a 375 px wide phone](docs/phone.jpg) |

## What it shows

- **The firing sequence.** Each hole collar is coloured by its firing delay. Press play, or scrub the timeline, which has one tick per delay. Holes fire in order and the rock around them moves.
- **Rock movement.** About 2,900 rock fragments at the default scale are coloured by how far they moved (a viridis-like ramp with a legend in metres) or by delay. Optional vectors draw the displacement for a sample of fragments.
- **The ore zone.** A dig line at mid-bench: dashed white for the outline before the blast, solid amber for the outline after. The amber outline moves with the rock while the blast plays.
- **The pre-blast surface**, as an optional ghost over the muck pile.
- **Hole details.** Click a collar to see its depth, charge, delay, and whether it has fired.
- **A stress scale.** Scales 1 to 4 rebuild the scenario with more holes and up to ten times the fragments, so you can watch the cost in the stats overlay.
- **Phones.** On a phone the viewer starts light, at scale 1 with vectors off. The view options sit behind a Layers sheet. In portrait the camera looks down more steeply, so the block fills about 70% of the width.
- **No WebGL.** If the browser cannot start WebGL, the renderer fails, or the WebGL context is lost, the page plays a recording of the live viewer instead (`public/fallback/blast.mp4`). After a renderer failure, choosing another stress scale tries the live view again.

Controls: Space plays and pauses. Left and Right step 100 ms, and so do Up and Down on the scrubber. PageUp and PageDown step 500 ms, and Home and End jump to the start and the end. Escape closes the topmost panel. A `?t=<ms>` or `?t=end` link opens the viewer at a given time. With reduced motion turned on, the viewer does not autoplay.

## Stack

React 19, TypeScript, Vite, three.js through React Three Fiber and drei, zustand for state, Vitest, Playwright (Chromium) and GitHub Actions. The site is deployed to GitHub Pages.

## How the data is synthesised

Everything comes from a single seed (`public/scenarios/default.json`) through a seeded PRNG, so a given seed always builds the same scenario. A bench profile is generated first: a bench top, a sloped free face, a pit floor and a back wall, with seeded noise. A staggered burden-by-spacing drill pattern is laid on the bench top. Delays fan out from an initiation column, with a hole-to-hole delay along each row and a row-to-row delay behind it. Rock fragments are sampled through the blasted block and the face wedge. Each fragment gets its end point from a displacement field. The field throws rock forward through the free face, with the throw decaying with distance behind the crest, scales it with the local charge, and drops the result onto a muck-pile surface that heaves at the back and slumps across the floor. Fragments start moving when their nearest hole fires and follow an eased arc, over a flight time that grows with distance. The ore zone is a closed outline that is pushed through the same field. None of this is a physical blast model. It is a plausible shape for exercising a visualisation.

## Architecture

```
src/sim/     pure, seeded model: rng, terrain, pattern, fire, field, blast, scenario (no three.js, unit-tested)
src/state/   zustand store: scenario, time, playback, view toggles, stress scale; perf stats store
src/scene/   React Three Fiber: Stage (canvas, framing, camera clamp, player), terrain mesh,
             instanced holes and fragments, vectors, ore-zone dig line, perf probe, error boundary
src/ui/      DOM overlays: header, view controls, legend, hole card, timeline, perf overlay, WebGL fallback
src/lib/     hasWebGL() feature probe
```

- **Sim layer.** `buildScenario(params)` returns the terrain, holes, fragments (typed arrays of the from and to positions and the fire and flight times) and the duration. It is deterministic, and the whole layer is covered by Vitest.
- **Store.** The UI and the scene read one store. `setScale` rebuilds the scenario and keeps the playhead at the same fraction of the duration. Components subscribe to narrow selectors: only the scrubber and the readout re-render on each playing frame.
- **Scene.** Fragments and holes are instanced meshes whose matrices and colours are written in place in `useFrame`, with no per-frame allocations. Outside playback the canvas renders on demand. The camera frames the block once per scenario and is clamped above the terrain. A renderer error or a lost WebGL context is caught by an error boundary, which shows the recording and resets when the scenario changes.
- **UI.** Plain React and CSS over the canvas, with keyboard access and ARIA labels on every control.

## Tests and CI

| Gate | Count |
| --- | --- |
| `npx tsc --noEmit` | strict, 0 errors |
| `npx vitest run` | 70 tests in 15 files (sim, scene maths, store, formatting, autoplay, WebGL probe) |
| `npm run build` | type check, then the production build |
| `npx playwright test` | 18 end-to-end tests in Chromium: smoke (1), UI (5), robustness (12) |

The robustness specs cover the fallback without WebGL, a lost context, a renderer error that a new scenario retries, the phone layout and portrait framing, the stress scale raising the instance count, no console errors on load, Escape order, the scrubber keys, the landscape Layers sheet, and turning reduced motion on mid-load. CI (`.github/workflows/ci.yml`) runs every gate on each push and pull request. Playwright runs against an e2e build (`VITE_E2E=1`), which exposes the store and test hooks on `window`. The deployed build strips them. `pages.yml` deploys `main` to GitHub Pages.

## Performance

Measured with `scripts/measure-perf.mjs`: the stats overlay after 5 s of playing at 0.25x, 1440x900 at device pixel ratio 2. The setup was **headless Chromium on an Apple-silicon MacBook with dev load present** (load average about 4 to 6). Treat the fps as a floor, not a benchmark.

| Stress scale | Holes | Rocks | fps | Draw calls | Triangles | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| 1 (default) | 120 | 2,880 | 60 | 4 | 109k | 3,000 |
| 4 | 300 | 28,800 | 60 | 4 | 676k | 29,100 |

Both scales hold the display's 60 fps cap, so the numbers show headroom rather than a limit. Draw calls are the overlay's count with the ore zone off; the rock and the collars are instanced, so the count does not grow with scale.

Everything in `dist` except the media is 326 kB gzipped (HTML, CSS, JS and the scenario; three.js alone is 181 kB), against a budget of 1.2 MB for the initial JS. The fallback recording (6.8 MB) and its poster (0.26 MB) are fetched only when the fallback is shown.

## Run it

```
npm ci
npm run dev            # http://localhost:5173/blast-viewer/
npm test               # Vitest
npm run build          # type check and production build into dist/
npx playwright install chromium
npx playwright test    # builds the e2e bundle and serves it on :4173
```

The fallback recording is regenerated deterministically: the store is paused and stepped one frame at a time, and each frame is screenshotted at 1920x1080 and 30 fps, then encoded with ffmpeg (H.264).

```
VITE_E2E=1 npm run build && npm run preview -- --port 4173
node scripts/capture-fallback.mjs
```

## Author

Built by [VioletN22](https://github.com/VioletN22). All data is synthetic and generated from a seed. It is an illustrative model, not a prediction.
