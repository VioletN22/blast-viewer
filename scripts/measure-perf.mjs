// Perf numbers for the README: the stats overlay after 5 s of playing, at stress scales 1 and 4.
// Needs the e2e build (window.__blast) served at baseUrl:
//   VITE_E2E=1 npm run build && npm run preview -- --port 4173
//   node scripts/measure-perf.mjs [baseUrl]
import { loadavg } from 'node:os'
import { chromium } from '@playwright/test'

const base = process.argv[2] ?? 'http://localhost:4173/blast-viewer/'
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu'] })
const rows = []
for (const scale of [1, 4]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  await page.goto(base)
  await page.waitForFunction(() => window.__blast?.getState().scenario, null, { timeout: 30000 })
  await page.evaluate((scale) => {
    const s = window.__blast.getState()
    s.setScale(scale)
    s.setShowPerf(true)
    s.setTime(0)
    s.play()
  }, scale)
  await page.waitForTimeout(5000)
  const lines = await page.getByRole('status', { name: 'Performance' }).locator('div').allTextContents()
  const sc = await page.evaluate(() => {
    const s = window.__blast.getState()
    return { holes: s.scenario.holes.length, rocks: s.scenario.fragments.count, playing: s.playing }
  })
  rows.push({ scale, ...sc, overlay: lines })
  await page.close()
}
console.log(JSON.stringify({ loadavg: loadavg().map((v) => v.toFixed(2)), rows }, null, 2))
await browser.close()
