import { defineConfig } from '@playwright/test'

const PORT = 4173

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: `http://localhost:${PORT}/blast-viewer/`,
    channel: 'chromium',
  },
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/blast-viewer/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
