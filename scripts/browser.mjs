// Shared Chromium launch for the scripts: Playwright's bundled Chromium with the GPU on.
// ANGLE's Metal backend is the only macOS-specific flag, and it is added only on macOS.
import { chromium } from '@playwright/test'

export function launch() {
  const args = ['--enable-gpu', '--ignore-gpu-blocklist']
  if (process.platform === 'darwin') args.push('--use-angle=metal')
  return chromium.launch({ channel: 'chromium', args })
}

/** Collects console errors and page errors from a page. */
export function collectErrors(page, errors = []) {
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

/** Waits for the store and the test hooks (the dev server or the VITE_E2E build has them). */
export async function waitForScenario(page) {
  await page.waitForFunction(() => window.__blast?.getState().scenario && window.__blastTest, null, { timeout: 30000 })
}
