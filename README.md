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
- **Hole details.** Click a collar, or pick a hole from the keyboard Holes list, to see its depth, charge, delay, and whether it has fired.
- **A stress scale.** Scales 1 to 4 rebuild the scenario with more holes and up to ten times the fragments, so you can watch the cost in the stats overlay.
- **Phones.** A phone is a window under 768 px wide or 500 px tall or less (the same rule as the phone CSS), so a phone held in landscape counts too. On a phone the viewer starts light, at scale 1 with vectors off, and the view options sit behind a Layers sheet. In portrait the camera looks down more steeply, so the block fills about 75% of the width.
- **No WebGL.** If the browser cannot start WebGL, the page plays a recording of the live viewer instead (`public/fallback/blast.mp4`) and never builds the scenario. If the WebGL context is lost, the viewer waits about 3 s for the browser to restore it (a phone tab coming back from the background) and carries on if it does. If it does not, or the renderer fails, the recording plays with a note that the 3D view stopped, and choosing another stress scale tries the live view again.

Keys: Space plays and pauses. Left and Right step 100 ms, and so do Up and Down on the scrubber. PageUp and PageDown step 500 ms on the scrubber, and Home and End jump to the start and the end. Escape closes the topmost panel (the Layers sheet, then the hole card). A `?t=<ms>` or `?t=end` link opens the viewer at a given time, and a linked time does not autoplay. With reduced motion turned on, the viewer does not autoplay.

### Keyboard access

What works from the keyboard:

- Every DOM control: the header links, the colour and stress-scale radios, the overlay switches, the Layers toggle (phones), play and pause, the time scrubber, the speed menu, and the hole card's close button. All have visible focus rings and labels.
- Holes, through the **Holes** list in the view options. It is visually hidden and shows a hint line while it has focus; it comes after the stress scale in the tab order (on a phone, inside the Layers sheet). Up and Down (or Home and End) move through the holes, and Enter or Space opens the hole's card and moves focus to it. Escape or the close button closes the card and returns focus to the list (on a phone, to the Layers button).
- The hole card is a live region, so screen readers announce it when it opens.

What does not: the 3D camera. Orbit, zoom and pan are pointer and touch only, and clicking a collar in the 3D view needs a pointer (the Holes list is the keyboard route to the same card).

## Stack

React 19, TypeScript, Vite, three.js through React Three Fiber and drei, zustand for state, Vitest, Playwright (Chromium) and GitHub Actions. The site is deployed to GitHub Pages.

## How the data is synthesised

Everything comes from a single seed (`public/scenarios/default.json`) through a seeded PRNG, so a given seed always builds the same scenario. A bench profile is generated first: a bench top, a sloped free face, a pit floor and a back wall, with seeded noise. A staggered burden-by-spacing drill pattern is laid on the bench top. Delays fan out from an initiation column, with a hole-to-hole delay along each row and a row-to-row delay behind it. Rock fragments are sampled through the blasted block and the face wedge. Each fragment gets its end point from a displacement field. The field throws rock forward through the free face, with the throw decaying with distance behind the crest, scales it with the local charge, and drops the result onto a muck-pile surface that heaves at the back and slumps across the floor. Fragments start moving when their nearest hole fires and follow an eased arc, over a flight time that grows with distance. The ore zone is a closed outline that is pushed through the same field. None of this is a physical blast model. It is a plausible shape for exercising a visualisation.

## Architecture

```
src/sim/     pure, seeded model: rng, terrain, pattern, fire, field, blast, scenario, params
             validation, easing (no three.js, unit-tested)
src/lib/     small pure helpers: phone detection and defaults, timeline and perf formatting,
             hasWebGL() feature probe
src/state/   zustand store: scenario, time, playback, view toggles, stress scale; perf stats store
src/scene/   React Three Fiber: Stage (canvas, framing, camera clamp, player, context loss),
             terrain mesh, instanced holes and fragments, vectors, ore-zone dig line, perf probe,
             error boundary
src/ui/      DOM overlays: header, view controls, keyboard hole list, legend, hole card, timeline,
             perf overlay, WebGL fallback
```

Imports point one way: `ui` and `scene` use `state`, `lib` and `sim` (and `ui` shares `scene`'s colour ramps); `state` uses `lib` and `sim`; `lib` uses only `sim` types; `sim` imports nothing from the app.

- **Sim layer.** `buildScenario(params)` returns the terrain, holes, the resolved pattern options, fragments (typed arrays of the from and to positions and the fire and flight times) and the duration. It is deterministic, and the whole layer is covered by Vitest.
- **Store.** The UI and the scene read one store. `setScale` rebuilds the scenario and keeps the playhead at the same fraction of the duration. Components subscribe to narrow selectors: only the scrubber and the readout re-render on each playing frame.
- **Scene.** Fragments and holes are instanced meshes whose matrices and colours are written in place in `useFrame`, with no per-frame allocations. Outside playback the canvas renders on demand. The camera frames the block once per scenario and is clamped above the terrain. A renderer error, or a WebGL context that is not restored within about 3 s, is caught by an error boundary, which swaps the canvas, the stats and the timeline dock for the recording in one render and resets when the scenario changes.
- **UI.** Plain React and CSS over the canvas. Every DOM control has a label and keyboard access; the 3D camera does not (see Keyboard access).

## Tests and CI

| Gate | Count |
| --- | --- |
| `npx tsc --noEmit` | strict, 0 errors |
| `npx vitest run` | 76 tests in 16 files (sim, scene maths, store, formatting, phone rules, WebGL probe) |
| `npm run build` | type check, then the production build |
| `npx playwright test` | 24 end-to-end tests in Chromium: smoke (2), UI (7), robustness (15) |

The UI specs cover scrubbing, the play and step keys, clicking a hole, the keyboard Holes list (focus to the card and back), the 375 px phone layout, and `?t=` links. The robustness specs cover the fallback without WebGL (and that it never fetches the scenario), that the WebGL path never fetches the recording, a lost context that is restored and one that is not, a renderer error that a new scenario retries, the phone layout and portrait framing, the stress scale raising the instance count, no console errors on load, Escape order, the scrubber keys, the landscape Layers sheet scrolling, an 844x390 landscape phone, and turning reduced motion on mid-load. The smoke specs check the page renders with no console errors and that the static HTML carries the loading line and share metadata.

CI (`.github/workflows/ci.yml`) runs every gate on pushes to `main` and on pull requests. Playwright runs against an e2e build (`VITE_E2E=1`), which exposes the store and test hooks on `window`; on CI it retries once and uploads the HTML report and traces when it fails. The deployed build strips the hooks. The `deploy` job in the same workflow needs the test job, so only a tested commit on `main` reaches GitHub Pages.

## Performance

Measured with `scripts/measure-perf.mjs`: the stats overlay after 5 s of playing at 0.25x, 1440x900 at device pixel ratio 2. The setup was **headless Chromium on an Apple-silicon MacBook with dev load present** (load average about 4 to 6). Treat the fps as a floor, not a benchmark.

| Stress scale | Holes | Rocks | fps | Draw calls | Triangles | Instances |
| --- | --- | --- | --- | --- | --- | --- |
| 1 (default) | 120 | 2,880 | 60 | 4 | 109k | 3,000 |
| 4 | 300 | 28,800 | 60 | 4 | 676k | 29,100 |

Both scales hold the display's 60 fps cap, so the numbers show headroom rather than a limit. Draw calls are the overlay's count with the ore zone off; the rock and the collars are instanced, so the count does not grow with scale.

Everything in `dist` except the media is about 331 kB gzipped, as Vite reports it (HTML, CSS and JS; three.js alone is 184.29 kB), plus the 63-byte scenario file. The budget for the initial JS is 1.2 MB. The fallback recording (6.8 MB) and its poster (0.26 MB) are fetched only when the fallback is shown.

## Run it

```
npm ci
npm run dev            # http://localhost:5173/blast-viewer/
node scripts/screenshot.mjs --size 1440x900,844x390   # screenshots of the dev server into artifacts/
npm test               # Vitest
npm run build          # type check and production build into dist/
npx playwright install chromium
npx playwright test    # builds the e2e bundle and serves it on :4173
```

The fallback recording is frame-stepped and repeatable: the store is paused and stepped one frame at a time, and each frame is screenshotted at 1920x1080 and 30 fps, then encoded with ffmpeg (H.264). It is not byte-for-byte identical across machines, since the output depends on the GPU and the ffmpeg build. The script uses `ffmpeg` on PATH, or the binary named in `FFMPEG`, and replaces the committed files only when the whole run succeeds.

```
VITE_E2E=1 npm run build && npm run preview -- --port 4173
node scripts/capture-fallback.mjs
```

## Licence

MIT, see [LICENSE](LICENSE).

## Author

Built by [VioletN22](https://github.com/VioletN22). All data is synthetic and generated from a seed. It is an illustrative model, not a prediction.
