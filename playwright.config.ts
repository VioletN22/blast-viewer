import { defineConfig } from '@playwright/test'

const PORT = 4173

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: `http://localhost:${PORT}/blast-viewer/`,
    channel: 'chromium',
  },
  webServer: {
    // VITE_E2E keeps the dev-only test hooks (window.__blast, window.__blastTest) in this build; the deployed build has none.
    command: `VITE_E2E=1 npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/blast-viewer/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
