import { defineConfig } from '@playwright/test'

const PORT = 4173
const CI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  // One retry on CI absorbs a slow software-GL frame; locally a failure fails.
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/blast-viewer/`,
    channel: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // VITE_E2E keeps the dev-only test hooks (window.__blast, window.__blastTest) in this build; the deployed build has none.
    command: `VITE_E2E=1 npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/blast-viewer/`,
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
})
