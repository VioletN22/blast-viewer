import { expect, test } from '@playwright/test'

test('app root renders with no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('./')
  await expect(page.getByTestId('app-root')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bench blast viewer' })).toBeVisible()
  expect(errors).toEqual([])
})

test('the static page has loading text, a noscript line and share metadata', async ({ page, request }) => {
  const html = await (await request.get('./')).text()
  expect(html).toContain('<div id="root"><p class="boot">Loading the 3D viewer…</p></div>')
  expect(html).toContain('<noscript>')
  expect(html).toMatch(/<meta name="description" content="[^"]+"/)
  expect(html).toContain('<meta property="og:image" content="https://violetn22.github.io/blast-viewer/og.jpg"')
  // React replaces the loading line.
  await page.goto('./')
  await expect(page.getByTestId('app-root')).toBeVisible()
  await expect(page.getByText('Loading the 3D viewer…')).toHaveCount(0)
})

test('the two self-hosted faces are preloaded and used', async ({ page, request }) => {
  const html = await (await request.get('./')).text()
  expect(html).toContain('<link rel="preload" href="/blast-viewer/fonts/instrument-sans-var.woff2" as="font" type="font/woff2" crossorigin')
  expect(html).toContain('<link rel="preload" href="/blast-viewer/fonts/jetbrains-mono-var.woff2" as="font" type="font/woff2" crossorigin')
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Bench blast viewer' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')).sort())
  expect(loaded).toEqual(['Instrument Sans', 'JetBrains Mono'])
})
