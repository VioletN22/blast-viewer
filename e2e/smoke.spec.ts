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
