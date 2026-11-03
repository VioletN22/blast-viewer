// Perf numbers for the README: frame rate over 10 s of a playing blast, plus the stats overlay.
// Needs the e2e build (window.__blast) served at baseUrl:
//   VITE_E2E=1 npm run build && npm run preview -- --port 4173
//   node scripts/measure-perf.mjs [baseUrl]
// Rows: the synthetic bench at stress scales 1 and 4, and the Super Pit at scale 1 in both views.
// The blast plays at 0.25x, so it runs for the whole 10 s window. Min fps is the slowest 1 s window.
import { loadavg } from 'node:os'
import { launch } from './browser.mjs'

const base = process.argv[2] ?? 'http://localhost:4173/blast-viewer/'
const RUNS = [
  { terrain: 'bench', scale: 1 },
  { terrain: 'bench', scale: 4 },
  { terrain: 'pit', scale: 1, view: 'pit' },
  { terrain: 'pit', scale: 1, view: 'blast' },
]
const browser = await launch()
const rows = []
for (const run of RUNS) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  await page.goto(`${base}?terrain=${run.terrain}`)
  await page.waitForFunction(() => window.__blast?.getState().scenario, null, { timeout: 30000 })
  await page.evaluate((run) => {
    const s = window.__blast.getState()
    s.setScale(run.scale)
    if (run.view) s.setView(run.view)
    s.setShowPerf(true)
    s.setSpeed(0.25)
    s.setTime(0)
    s.play()
  }, run)
  const fps = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const times = []
        const t0 = performance.now()
        const tick = (t) => {
          times.push(t)
          if (t - t0 < 10000) requestAnimationFrame(tick)
          else {
            let min = Infinity
            for (let w = t0; w + 1000 <= t; w += 250) {
              const n = times.filter((x) => x >= w && x < w + 1000).length
              min = Math.min(min, n)
            }
            resolve({ avg: Number(((times.length - 1) / ((t - times[0]) / 1000)).toFixed(1)), min })
          }
        }
        requestAnimationFrame(tick)
      }),
  )
  const lines = await page.getByRole('status', { name: 'Performance' }).locator('div').allTextContents()
  const sc = await page.evaluate(() => {
    const s = window.__blast.getState()
    return { holes: s.scenario.holes.length, rocks: s.scenario.fragments.count, playing: s.playing }
  })
  rows.push({ ...run, ...sc, fps, overlay: lines })
  await page.close()
}
console.log(JSON.stringify({ loadavg: loadavg().map((v) => v.toFixed(2)), rows }, null, 2))
await browser.close()
