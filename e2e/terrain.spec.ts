import { expect, test, type Page } from '@playwright/test'

// Reduced motion keeps the page paused at t = 0 (no autoplay).
test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

type Site = { x: number; z: number; angle: number; floorY: number }
type State = {
  scenario: { durationMs: number; site: Site | null; holes: { x: number; z: number; collarY: number }[]; dem: { heightAt(x: number, z: number): number } | null } | null
  view: string
  timeMs: number
  playing: boolean
  cloud: { count: number } | null
  setSpeed(v: number): void
  openPoints(file?: File): Promise<void>
}
type Hooks = {
  __blast: { getState(): State }
  __blastTest: { groundScreen(x: number, z: number): { x: number; y: number } | null }
}

const PIT_NOTE = 'Ground: SRTM elevation of the Super Pit. The blast is a synthetic model, not a prediction.'
const SYNTHETIC_NOTE = 'Synthetic data. Illustrative model, not a prediction.'

function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

async function ready(page: Page, url = './') {
  await page.goto(url)
  await page.waitForFunction(() => {
    const w = window as unknown as Partial<Hooks>
    return !!w.__blast?.getState().scenario && !!w.__blastTest
  })
  await page.waitForTimeout(400)
}

const state = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as Hooks).__blast.getState()
    return { site: s.scenario?.site ?? null, view: s.view, timeMs: s.timeMs, playing: s.playing, durationMs: s.scenario?.durationMs ?? 0, cloud: s.cloud?.count ?? null }
  })

test('the pit is the default and the terrain picker switches ground', async ({ page }) => {
  const errors = watchErrors(page)
  await ready(page)
  expect((await state(page)).site).not.toBeNull()
  expect((await state(page)).view).toBe('pit')
  await expect(page.getByText(PIT_NOTE)).toBeVisible()

  await page.getByRole('radio', { name: 'Synthetic bench' }).check()
  await expect.poll(async () => (await state(page)).site).toBeNull()
  await expect(page.getByText(SYNTHETIC_NOTE)).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Frame the whole pit' })).toHaveCount(0)

  await page.getByRole('radio', { name: 'Super Pit, real elevation' }).check()
  await expect.poll(async () => (await state(page)).site).not.toBeNull()
  await expect(page.getByText(PIT_NOTE)).toBeVisible()
  expect(errors).toEqual([])
})

test('a click on the pit lays the pattern on a bench there, and the blast plays', async ({ page }) => {
  const errors = watchErrors(page)
  await ready(page)
  const before = (await state(page)).site!
  // A point on the pit's inner wall, north of the centre (z is south): it has a bench and face within reach.
  const p = await page.evaluate(() => (window as unknown as Hooks).__blastTest.groundScreen(0, 400))
  expect(p).not.toBeNull()
  await page.mouse.click(p!.x, p!.y)
  await expect.poll(async () => (await state(page)).view).toBe('blast')
  const after = (await state(page)).site!
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(100)
  await expect(page.getByTestId('site-note')).toHaveText('Click the pit to move the blast.')

  // Every collar is on the real surface: model height plus the floor equals the DEM under it.
  const offsets = await page.evaluate(() => {
    const sc = (window as unknown as Hooks).__blast.getState().scenario!
    const s = sc.site!
    const c = Math.cos(s.angle)
    const n = Math.sin(s.angle)
    return sc.holes.map((h) => Math.abs(s.floorY + h.collarY - sc.dem!.heightAt(s.x + h.x * c + h.z * n, s.z - h.x * n + h.z * c)))
  })
  expect(Math.max(...offsets)).toBeLessThan(0.5)

  await page.evaluate(() => (window as unknown as Hooks).__blast.getState().setSpeed(4))
  await page.getByRole('button', { name: 'Play' }).click()
  await expect.poll(async () => (await state(page)).timeMs).toBeGreaterThan(0)
  await expect.poll(async () => { const s = await state(page); return !s.playing && s.timeMs === s.durationMs }, { timeout: 15000 }).toBe(true)
  expect(errors).toEqual([])
})

test('the sample points load and show their count', async ({ page }) => {
  const errors = watchErrors(page)
  await ready(page)
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page.getByTestId('points-count')).toHaveText('5,000 points')
  expect((await state(page)).cloud).toBe(5000)
  await expect(page.getByText('Sample points taken from the SRTM grid of the Super Pit.')).toBeVisible()
  await expect(page.getByRole('group', { name: 'Legend' }).getByText('Height (m)')).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.getByRole('button', { name: 'Back to the blast' }).click()
  await expect.poll(async () => (await state(page)).cloud).toBeNull()
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible()
  expect(errors).toEqual([])
})

test('bad lines are skipped and counted', async ({ page }) => {
  await ready(page)
  await page.getByTestId('points-file').setInputFiles({ name: 'survey.csv', mimeType: 'text/csv', buffer: Buffer.from('x,y,z\n1,2,3\nnot a point\n4,5,6\n7,8\n') })
  await expect(page.getByTestId('points-count')).toHaveText('2 points · 2 lines skipped')
})

test('a wrong file and a file over the limit show a message, not a crash', async ({ page }) => {
  const errors = watchErrors(page)
  await ready(page)
  await page.getByTestId('points-file').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]) })
  await expect(page.getByTestId('points-error')).toHaveText('No points found. Each line needs x, y and z.')
  expect((await state(page)).cloud).toBeNull()

  await page.evaluate(() => {
    const big = new File([new Uint8Array(101 * 1024 * 1024)], 'huge.xyz')
    return (window as unknown as Hooks).__blast.getState().openPoints(big)
  })
  await expect(page.getByTestId('points-error')).toHaveText('That file is 101 MB. The limit is 100 MB.')
  // The blast view is still there and still works.
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible()
  await expect(page.getByTestId('app-root')).toBeVisible()
  expect(errors).toEqual([])
})

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })
  test('the pit on a 375 px phone has no horizontal scroll', async ({ page }) => {
    const errors = watchErrors(page)
    await ready(page)
    expect((await state(page)).site).not.toBeNull()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    await page.getByRole('button', { name: 'Layers' }).click()
    await expect(page.getByRole('radio', { name: 'Frame the blast' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    expect(errors).toEqual([])
  })
})
