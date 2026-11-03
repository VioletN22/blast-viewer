import { expect, test, type Page } from '@playwright/test'

// Reduced motion keeps the page paused at t = 0, so every test starts from a known frame.
test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

type Store = {
  scenario: { durationMs: number } | null
  scale: number
  timeMs: number
  setScale(s: number): void
  setShowPerf(v: boolean): void
  selectHole(id: string | null): void
}
type Hooks = {
  __blast: { getState(): Store }
  __blastTest: { holeOnScreen(): { id: string; x: number; y: number } | null; blockSpan(): number | null }
  __failGL?: boolean
}
const NOTE = 'Your browser could not start WebGL, so this is a recording of the live viewer.'
const STOPPED = 'The 3D view stopped working, so this is a recording of the live viewer.'

async function ready(page: Page) {
  await page.goto('./?terrain=bench')
  await page.waitForFunction(() => {
    const w = window as unknown as Partial<Hooks>
    return !!w.__blast?.getState().scenario && !!w.__blastTest
  })
  // A few frames for the camera framing to settle.
  await page.waitForTimeout(400)
}

/** The instance count the stats overlay shows, once it has sampled at least once. */
async function overlayInstances(page: Page): Promise<number> {
  const line = page.getByRole('status', { name: 'Performance' }).getByText(/instances?$/)
  await expect(line).toBeVisible()
  await expect(line).not.toHaveText(/^0 instances$/)
  return Number(((await line.textContent()) ?? '').replace(/[^\d]/g, ''))
}

test('shows fallback without WebGL', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = function () {
      return null
    } as typeof HTMLCanvasElement.prototype.getContext
  })
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  // The default ground is the pit: without WebGL neither its terrain nor the scenario is fetched.
  await page.goto('./')
  const video = page.locator('video')
  await expect(video).toBeVisible()
  await expect(page.getByText(NOTE)).toBeVisible()
  const attrs = await video.evaluate((v: HTMLVideoElement) => ({ muted: v.muted, loop: v.loop, inline: v.playsInline, poster: v.poster, src: v.currentSrc || v.src }))
  expect(attrs).toMatchObject({ muted: true, loop: true, inline: true })
  expect(attrs.poster).toMatch(/\/blast-viewer\/fallback\/poster\.jpg$/)
  expect(attrs.src).toMatch(/\/blast-viewer\/fallback\/blast\.mp4$/)
  await expect(page.locator('canvas')).toHaveCount(0)
  // The heading and the synthetic-data note stay.
  await expect(page.getByRole('heading', { name: 'Bench blast viewer' })).toBeVisible()
  // Nothing reads the scenario without WebGL, so it is never fetched.
  expect(requests.filter((u) => u.includes('/scenarios/') || u.includes('/terrain/'))).toEqual([])
})

test('the WebGL path never requests the recording or its poster', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  await ready(page)
  await page.waitForTimeout(600)
  expect(requests.some((u) => u.includes('/scenarios/default.json'))).toBe(true)
  expect(requests.filter((u) => u.includes('/fallback/'))).toEqual([])
})

test('phone layout', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await ready(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible()
  await page.getByRole('button', { name: 'Controls' }).click()
  await expect(page.getByRole('slider', { name: 'Scale' })).toHaveValue('1')
  expect(await page.evaluate(() => (window as unknown as Hooks).__blast.getState().scale)).toBe(1)
})

test('stress scale raises instances', async ({ page }) => {
  await ready(page)
  // The drawn box sits under the transparent input; force skips the hit test on the styled label.
  await page.getByRole('checkbox', { name: 'Stats' }).check({ force: true })
  const base = await overlayInstances(page)
  await page.getByRole('slider', { name: 'Scale' }).fill('4')
  // The scale 4 rebuild plus a sampled frame is slow under software GL on CI runners.
  await expect.poll(() => overlayInstances(page), { timeout: 20_000 }).toBeGreaterThan(base)
})

test('no console errors on load', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  await ready(page)
  await page.waitForTimeout(600)
  expect(errors).toEqual([])
})

test('context loss shows the fallback', async ({ page }) => {
  await ready(page)
  await page.evaluate(() => {
    const c = document.querySelector('canvas')!
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext
    gl.getExtension('WEBGL_lose_context')!.loseContext()
  })
  // The page waits about 3 s for the context to come back before giving up.
  await expect(page.getByText(STOPPED)).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('video')).toBeVisible()
  // The dock goes with the canvas; the controls stay so another scale can retry.
  await expect(page.getByRole('slider', { name: 'Blast time' })).toHaveCount(0)
  await expect(page.getByRole('slider', { name: 'Scale' })).toBeAttached()
})

test('a context restored within the wait keeps the live view', async ({ page }) => {
  await ready(page)
  await page.evaluate(async () => {
    const c = document.querySelector('canvas')!
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext
    const ext = gl.getExtension('WEBGL_lose_context')!
    const lost = new Promise((r) => c.addEventListener('webglcontextlost', r, { once: true }))
    ext.loseContext()
    await lost
    await new Promise((r) => setTimeout(r, 500))
    // restoreContext only works when the page called preventDefault on the loss.
    ext.restoreContext()
  })
  await page.waitForTimeout(3500)
  await expect(page.locator('canvas')).toHaveCount(1)
  await expect(page.getByTestId('fallback')).toHaveCount(0)
  await expect(page.getByRole('slider', { name: 'Blast time' })).toBeVisible()
})

test('renderer error shows the fallback and a new scenario retries', async ({ page }) => {
  // The feature probe (a detached canvas) passes; the renderer's own canvas, in the page, gets no context.
  await page.addInitScript(() => {
    const w = window as unknown as Hooks
    w.__failGL = true
    const orig = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof orig>) {
      if (w.__failGL && this.isConnected) return null
      return orig.apply(this, args)
    } as typeof orig
  })
  await page.goto('./?terrain=bench')
  await page.waitForFunction(() => !!(window as unknown as Partial<Hooks>).__blast?.getState().scenario)
  await expect(page.getByText(STOPPED)).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
  await page.evaluate(() => {
    const w = window as unknown as Hooks
    w.__failGL = false
    w.__blast.getState().setScale(2)
  })
  await expect(page.locator('canvas')).toHaveCount(1)
  await expect(page.getByText(STOPPED)).toHaveCount(0)
})

test('portrait framing fills the width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await ready(page)
  const span = await page.evaluate(() => (window as unknown as Hooks).__blastTest.blockSpan())
  expect(span).not.toBeNull()
  expect(span!).toBeGreaterThanOrEqual(0.68)
  expect(span!).toBeLessThanOrEqual(0.9)
})

test('escape closes the topmost layer first', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await ready(page)
  const hole = await page.evaluate(() => (window as unknown as Hooks).__blastTest.holeOnScreen())
  expect(hole).not.toBeNull()
  await page.evaluate((id) => (window as unknown as Hooks).__blast.getState().selectHole(id), hole!.id)
  const card = page.getByRole('region', { name: `Hole ${hole!.id}` })
  await expect(card).toBeVisible()
  await page.getByRole('button', { name: 'Controls' }).click()
  const sheet = page.getByRole('group', { name: 'View options' })
  await expect(sheet).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(card).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(card).toBeHidden()
})

test('scrubber keys step 100 ms and 500 ms', async ({ page }) => {
  await ready(page)
  const readout = page.getByTestId('time-readout')
  await page.getByRole('slider', { name: 'Blast time' }).focus()
  await page.keyboard.press('ArrowUp')
  await expect(readout).toHaveText(/^t = 100 ms \//)
  await page.keyboard.press('PageUp')
  await expect(readout).toHaveText(/^t = 600 ms \//)
  await page.keyboard.press('ArrowDown')
  await expect(readout).toHaveText(/^t = 500 ms \//)
  await page.keyboard.press('PageDown')
  await expect(readout).toHaveText(/^t = 0 ms \//)
  await page.keyboard.press('ArrowRight')
  await expect(readout).toHaveText(/^t = 100 ms \//)
})

test('landscape phone layers sheet scrolls inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 740, height: 360 })
  await ready(page)
  await page.getByRole('button', { name: 'Controls' }).click()
  const sheet = page.getByRole('group', { name: 'View options' })
  await expect(sheet).toBeVisible()
  const { bottom, overflowY, scrollHeight, clientHeight } = await sheet.evaluate((el) => ({
    bottom: el.getBoundingClientRect().bottom,
    overflowY: getComputedStyle(el).overflowY,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }))
  expect(bottom).toBeLessThanOrEqual(360)
  expect(overflowY).toBe('auto')
  // The content is taller than the sheet, and the sheet really scrolls.
  expect(scrollHeight).toBeGreaterThan(clientHeight)
  const box = (await sheet.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, 200)
  await expect.poll(() => sheet.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
})

test('landscape phone at 844x390 gets the phone layout', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await ready(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  const rect = (sel: string) => page.locator(sel).first().evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
  })
  type R = Awaited<ReturnType<typeof rect>>
  const overlaps = (a: R, b: R) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  // Closed, the controls are only the sheet's handle; it must not sit over the legend or the timeline.
  await expect(page.getByRole('button', { name: 'Controls' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'View options' })).toBeHidden()
  const controls = await rect('.controls-toggle')
  expect(overlaps(controls, await rect('.legend'))).toBe(false)
  expect(overlaps(controls, await rect('.timeline'))).toBe(false)
  const st = await page.evaluate(() => {
    const s = (window as unknown as { __blast: { getState(): { scale: number; showVectors: boolean } } }).__blast.getState()
    return { scale: s.scale, showVectors: s.showVectors }
  })
  expect(st).toEqual({ scale: 1, showVectors: false })
})

test.describe('reduced motion changes', () => {
  test.use({ reducedMotion: 'no-preference' })
  const playing = (page: Page) => page.evaluate(() => (window as unknown as { __blast: { getState(): { playing: boolean } } }).__blast.getState().playing)

  test('turning reduced motion on cancels a pending autoplay', async ({ page }) => {
    await page.goto('./?terrain=bench')
    await page.waitForFunction(() => !!(window as unknown as Partial<Hooks>).__blast?.getState().scenario)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForTimeout(1500)
    expect(await playing(page)).toBe(false)
  })

  test('turning reduced motion on pauses the autoplay', async ({ page }) => {
    await page.goto('./?terrain=bench')
    await page.waitForFunction(() => (window as unknown as { __blast?: { getState(): { playing: boolean } } }).__blast?.getState().playing === true)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect.poll(() => playing(page)).toBe(false)
  })
})
