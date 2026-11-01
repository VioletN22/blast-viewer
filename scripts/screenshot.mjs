// Screenshots of the dev server at t=0 and at the end of the blast.
// Usage: node scripts/screenshot.mjs [baseUrl]  (default http://localhost:5179/blast-viewer/)
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const base = process.argv[2] ?? 'http://localhost:5179/blast-viewer/'
mkdirSync('artifacts', { recursive: true })
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(base)
await page.waitForFunction(() => window.__blast?.getState().scenario, null, { timeout: 30000 })
const shot = async (name, at) => {
  await page.evaluate((at) => {
    const s = window.__blast.getState()
    s.setTime(at === 'end' ? s.scenario.durationMs : at)
  }, at)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `artifacts/${name}.png` })
}
await shot('t0', 0)
if (process.env.MID) await shot('tmid', Number(process.env.MID))
await shot('tend', 'end')
const info = await page.evaluate(() => {
  const s = window.__blast.getState()
  return { holes: s.scenario.holes.length, fragments: s.scenario.fragments.count, durationMs: s.scenario.durationMs }
})
console.log(JSON.stringify(info), errors.length ? `errors: ${errors.join(' | ')}` : 'no console errors')
await browser.close()
