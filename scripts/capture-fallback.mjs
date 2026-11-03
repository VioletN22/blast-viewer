// Records the no-WebGL fallback: an 1080p loop of the default scenario, frame by frame, then
// ffmpeg to H.264 (yuv420p, +faststart, under 8 MB) and a poster JPG from the final frame.
//
// Frame-stepped and repeatable: the e2e build's window.__blast is paused and stepped with setTime
// for every frame, and each frame is a page.screenshot (Playwright's own video is too low a
// bitrate). The output is not byte-for-byte identical across machines: it depends on the GPU,
// the ffmpeg build and the settle time.
//   VITE_E2E=1 npm run build && npm run preview -- --port 4173
//   node scripts/capture-fallback.mjs [baseUrl]
// ffmpeg comes from the FFMPEG environment variable, or `ffmpeg` on PATH.
// Frames go to a temporary directory outside the repo, deleted at the end. The video and poster
// are encoded to temporary files next to the committed ones and renamed over them only when
// everything has succeeded, so a failed run leaves the committed files as they were.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launch } from './browser.mjs'

const base = process.argv[2] ?? 'http://localhost:4173/blast-viewer/'
const FFMPEG = process.env.FFMPEG || 'ffmpeg'
const OUT_DIR = 'public/fallback'
const FPS = 30
const W = 1920
const H = 1080
const HOLD_START_S = 1.5
const SPEED = 0.2
const HOLD_END_S = 3
/** Total camera turn over the blast, radians (eased in and out). */
const ORBIT_RAD = (16 * Math.PI) / 180
const MAX_BYTES = 8 * 1024 * 1024

const frames = mkdtempSync(join(tmpdir(), 'blast-capture-'))
mkdirSync(OUT_DIR, { recursive: true })
const mp4 = join(OUT_DIR, 'blast.mp4')
const poster = join(OUT_DIR, 'poster.jpg')
// Same directory as the targets, so the final rename is atomic (no cross-device move).
const mp4Tmp = join(OUT_DIR, 'blast.tmp.mp4')
const posterTmp = join(OUT_DIR, 'poster.tmp.jpg')
const browser = await launch()
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  // The recording is the 3D view and its legend: the page chrome (header, layers, timeline) is the
  // live page's own and would be dead buttons in a video. Injected before load, so the camera
  // framing sees the full 1920x1080 canvas.
  await page.addInitScript(() => {
    const css = '.app-header,.controls,.timeline,.perf-overlay,.hole-card{display:none!important}.viewport>.stage{right:0!important}'
    const add = () => document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }))
    if (document.head) add()
    else document.addEventListener('DOMContentLoaded', add)
  })
  // The bench: the default ground is the pit, where the blast is too small to read in a recording.
  await page.goto(`${base}?terrain=bench`)
  await page.waitForFunction(() => window.__blast?.getState().scenario && window.__blastTest, null, { timeout: 30000 })
  const dur = await page.evaluate(() => {
    const s = window.__blast.getState()
    s.pause()
    s.setShowVectors(false)
    s.setShowDigLine(false)
    s.setTime(0)
    return s.scenario.durationMs
  })
  // Let the framing and shadows settle.
  await page.waitForTimeout(800)

  const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  const startN = Math.round(HOLD_START_S * FPS)
  const blastN = Math.ceil(dur / ((1000 / FPS) * SPEED))
  const endN = Math.round(HOLD_END_S * FPS)
  const total = startN + blastN + endN
  const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))
  let turned = 0
  for (let i = 0; i < total; i++) {
    const b = Math.min(1, Math.max(0, (i - startN) / blastN))
    const t = b * dur
    const want = ease(b) * ORBIT_RAD
    const step = want - turned
    turned = want
    // The ore zone comes on for the closing hold.
    const digLine = i >= startN + blastN
    await page.evaluate(
      ({ t, step, digLine }) => {
        const s = window.__blast.getState()
        s.setTime(t)
        if (s.showDigLine !== digLine) s.setShowDigLine(digLine)
        if (step) window.__blastTest.orbitBy(step)
      },
      { t, step, digLine },
    )
    await settle()
    await page.screenshot({ path: join(frames, `${String(i).padStart(4, '0')}.png`) })
    if (i % 60 === 0) process.stdout.write(`frame ${i}/${total}\n`)
  }
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`)

  let crf = 20
  for (;;) {
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, '%04d.png'), '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4Tmp])
    const size = statSync(mp4Tmp).size
    console.log(`crf ${crf}: ${(size / 1024 / 1024).toFixed(2)} MB`)
    if (size < MAX_BYTES || crf >= 34) break
    crf += 2
  }
  const last = readdirSync(frames).sort().at(-1)
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', join(frames, last), '-q:v', '3', posterTmp])
  if (statSync(mp4Tmp).size >= MAX_BYTES) throw new Error(`the video is still ${MAX_BYTES} bytes or more at crf ${crf}; the committed files are unchanged`)
  renameSync(mp4Tmp, mp4)
  renameSync(posterTmp, poster)
  console.log(`${total} frames (${(total / FPS).toFixed(1)} s) -> ${mp4}, ${poster}`)
} finally {
  await browser.close()
  rmSync(frames, { recursive: true, force: true })
  rmSync(mp4Tmp, { force: true })
  rmSync(posterTmp, { force: true })
}
