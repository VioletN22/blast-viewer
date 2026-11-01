import { expect, test, type Page } from '@playwright/test'

// Reduced motion keeps the page paused at t = 0, so every test starts from a known frame.
test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

type Hooks = {
  __blast: { getState(): { scenario: unknown; playing: boolean; timeMs: number } }
  __blastTest: { holeOnScreen(): { id: string; x: number; y: number } | null }
}

async function ready(page: Page) {
  await page.goto('./')
  await page.waitForFunction(() => {
    const w = window as unknown as Partial<Hooks>
    return !!w.__blast?.getState().scenario && !!w.__blastTest
  })
  // A few frames for the camera framing to settle.
  await page.waitForTimeout(400)
}

const readout = (page: Page) => page.getByTestId('time-readout')

test('scrubbing to the end shows the muck pile', async ({ page }) => {
  await ready(page)
  const scrubber = page.getByRole('slider', { name: 'Blast time' })
  const box = (await scrubber.boundingBox())!
  await page.mouse.move(box.x + 4, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 })
  await page.mouse.move(box.x + box.width + 40, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()
  const text = (await readout(page).textContent()) ?? ''
  const m = text.match(/^t = ([\d,]+) ms \/ ([\d,]+) ms$/)
  expect(m, text).not.toBeNull()
  expect(m![1]).toBe(m![2])
  expect(m![2]).not.toBe('0')
})

test('space toggles play', async ({ page }) => {
  await ready(page)
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as Hooks).__blast.getState().playing)).toBe(true)
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as Hooks).__blast.getState().playing)).toBe(false)
})

test('arrow keys step 100 ms', async ({ page }) => {
  await ready(page)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(readout(page)).toHaveText(/^t = 200 ms \//)
  await page.keyboard.press('ArrowLeft')
  await expect(readout(page)).toHaveText(/^t = 100 ms \//)
})

test('clicking a hole opens its card', async ({ page }) => {
  await ready(page)
  const hole = await page.evaluate(() => (window as unknown as Hooks).__blastTest.holeOnScreen())
  expect(hole).not.toBeNull()
  await page.mouse.click(hole!.x, hole!.y)
  const card = page.getByRole('dialog', { name: `Hole ${hole!.id}` })
  await expect(card).toBeVisible()
  await expect(card).toContainText('waiting')
  await expect(card).toContainText('Charge')
  await page.keyboard.press('Escape')
  await expect(card).toBeHidden()
})

test('phone layout fits 375 px with no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await ready(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await expect(page.getByRole('slider', { name: 'Blast time' })).toBeVisible()
  const toggle = page.getByRole('button', { name: 'Layers' })
  await expect(toggle).toBeVisible()
  await toggle.click()
  await expect(page.getByRole('group', { name: 'View options' })).toBeVisible()
  const vectors = await page.evaluate(() => (window as unknown as { __blast: { getState(): { showVectors: boolean } } }).__blast.getState().showVectors)
  expect(vectors).toBe(false)
})
