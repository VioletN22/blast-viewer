// Mid-blast with vectors + dig line + perf overlay on, and the end with the dig line on.
// Usage: MID=1100 node scripts/screenshot-overlays.mjs [baseUrl]  (dev server on 5179)
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const base = process.argv[2] ?? 'http://localhost:5179/blast-viewer/'
const mid = Number(process.env.MID ?? 1100)
mkdirSync('artifacts', { recursive: true })
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(base)
await page.waitForFunction(() => window.__blast?.getState().scenario, null, { timeout: 30000 })
await page.evaluate(() => {
  const s = window.__blast.getState()
  s.setShowVectors(true)
  s.setShowDigLine(true)
  s.setShowPerf(true)
})
const shot = async (name, at) => {
  await page.evaluate((at) => {
    const s = window.__blast.getState()
    s.setTime(at === 'end' ? s.scenario.durationMs : at)
  }, at)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `artifacts/${name}.png` })
}
await shot('mid-vectors', mid)
console.log('overlay:', await page.locator('.perf-overlay').innerText())
await page.evaluate(() => window.__blast.getState().setShowVectors(false))
await shot('end-digline', 'end')
console.log('overlay:', await page.locator('.perf-overlay').innerText())
console.log(errors.length ? `errors: ${errors.join(' | ')}` : 'no console errors')
await browser.close()
