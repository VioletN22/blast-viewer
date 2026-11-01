// Screenshots of the viewer into artifacts/ (git-ignored), one per size and time.
// Needs the test hooks, so point it at the dev server (npm run dev) or the VITE_E2E build.
//
//   node scripts/screenshot.mjs [baseUrl] [options]
//
//   baseUrl            default http://localhost:5173/blast-viewer/ (the Vite dev server)
//   --size WxH[,WxH]   viewports, default 1440x900; a shorter side under 768 px is emulated as a phone
//   --at T[,T]         times in ms, or "end"; default 0,end
//   --dpr N            device pixel ratio, default 1
//   --overlays         vectors, ore zone and stats on
//   --hole             open the card of a hole that fires after the first time in --at
//   --layers           open the Layers sheet (phones)
//   --name PREFIX      file name prefix, default "shot"
//
// Files: artifacts/<prefix>-<W>x<H>-<t>.png. Prints the scenario size and any console errors.
import { mkdirSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { collectErrors, launch, waitForScenario } from './browser.mjs'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    size: { type: 'string', default: '1440x900' },
    at: { type: 'string', default: '0,end' },
    dpr: { type: 'string', default: '1' },
    overlays: { type: 'boolean', default: false },
    hole: { type: 'boolean', default: false },
    layers: { type: 'boolean', default: false },
    name: { type: 'string', default: 'shot' },
  },
})
const base = positionals[0] ?? 'http://localhost:5173/blast-viewer/'
const sizes = values.size.split(',').map((s) => s.split('x').map(Number))
const times = values.at.split(',').map((t) => (t === 'end' ? 'end' : Number(t)))
mkdirSync('artifacts', { recursive: true })

const browser = await launch()
const errors = []
try {
  for (const [width, height] of sizes) {
    const phone = Math.min(width, height) < 768
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: Number(values.dpr), reducedMotion: 'reduce', isMobile: phone, hasTouch: phone })
    collectErrors(page, errors)
    await page.goto(base)
    await waitForScenario(page)
    await page.waitForTimeout(500)
    if (values.overlays) {
      await page.evaluate(() => {
        const s = window.__blast.getState()
        s.setShowVectors(true)
        s.setShowDigLine(true)
        s.setShowPerf(true)
      })
    }
    if (values.hole) {
      const after = typeof times[0] === 'number' ? times[0] : 0
      // A visible hole that fires after the first shot, near the middle of the view, selected at t = 0.
      await page.evaluate((after) => {
        const s = window.__blast.getState()
        let best = null
        for (const h of s.scenario.holes) {
          if (h.delayMs <= after + 120) continue
          const p = window.__blastTest.holeScreen(h.id)
          if (!p || document.elementFromPoint(p.x, p.y)?.tagName !== 'CANVAS') continue
          const d = Math.hypot(p.x - innerWidth * 0.55, p.y - innerHeight * 0.45)
          if (!best || d < best.d) best = { id: h.id, d }
        }
        if (best) s.selectHole(best.id)
      }, after)
    }
    if (values.layers) await page.getByRole('button', { name: 'Layers' }).click()
    for (const at of times) {
      await page.evaluate((at) => {
        const s = window.__blast.getState()
        s.setTime(at === 'end' ? s.scenario.durationMs : at)
      }, at)
      await page.waitForTimeout(1200)
      const path = `artifacts/${values.name}-${width}x${height}-${at}.png`
      await page.screenshot({ path })
      console.log(path)
    }
    const info = await page.evaluate(() => {
      const s = window.__blast.getState()
      return { holes: s.scenario.holes.length, rocks: s.scenario.fragments.count, durationMs: Math.round(s.scenario.durationMs) }
    })
    console.log(`${width}x${height}`, JSON.stringify(info))
    await page.close()
  }
} finally {
  await browser.close()
}
console.log(errors.length ? `errors: ${errors.join(' | ')}` : 'no console errors')
