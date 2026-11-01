// UI screenshots of the dev server: desktop mid-blast with a hole card open, and a phone at t = 0.
// Usage: node scripts/screenshot-ui.mjs [baseUrl]  (default http://localhost:5179/blast-viewer/)
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const base = process.argv[2] ?? 'http://localhost:5179/blast-viewer/'
const mid = Number(process.env.MID ?? 380)
mkdirSync('artifacts', { recursive: true })
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu'] })
const errors = []

async function open(viewport, extra = {}) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2, reducedMotion: 'reduce', ...extra })
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(base)
  await page.waitForFunction(() => window.__blast?.getState().scenario && window.__blastTest, null, { timeout: 30000 })
  await page.waitForTimeout(500)
  return page
}

// Desktop: pick a hole that fires after `mid`, select it at t = 0, then move to mid-blast.
const desk = await open({ width: 1440, height: 900 })
await desk.evaluate(() => window.__blast.getState().setShowDigLine(true))
const hole = await desk.evaluate((mid) => {
  const s = window.__blast.getState()
  const late = s.scenario.holes.filter((h) => h.delayMs > mid + 120).map((h) => h.id)
  let best = null
  for (const id of late) {
    const p = window.__blastTest.holeScreen(id)
    if (!p || document.elementFromPoint(p.x, p.y)?.tagName !== 'CANVAS') continue
    const d = Math.hypot(p.x - innerWidth * 0.55, p.y - innerHeight * 0.45)
    if (!best || d < best.d) best = { id, ...p, d }
  }
  return best
}, mid)
if (hole) await desk.mouse.click(hole.x, hole.y)
await desk.evaluate((mid) => window.__blast.getState().setTime(mid), mid)
await desk.waitForTimeout(800)
await desk.screenshot({ path: 'artifacts/ui-desktop.png' })

const phone = await open({ width: 375, height: 812 }, { isMobile: true, hasTouch: true })
await phone.evaluate((mid) => window.__blast.getState().setTime(mid), mid)
await phone.waitForTimeout(800)
await phone.screenshot({ path: 'artifacts/ui-phone.png' })
if (process.env.OPEN_LAYERS) {
  await phone.getByRole('button', { name: 'Layers' }).click()
  await phone.waitForTimeout(300)
  await phone.screenshot({ path: 'artifacts/ui-phone-layers.png' })
}
console.log(JSON.stringify({ hole: hole?.id ?? null }), errors.length ? `errors: ${errors.join(' | ')}` : 'no console errors')
await browser.close()
