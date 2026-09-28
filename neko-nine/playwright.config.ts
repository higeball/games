import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4175',
    ...devices['iPhone 13'],
    browserName: 'chromium',
    channel: 'chrome',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175/games/neko-nine/',
    reuseExistingServer: false,
    timeout: 120_000
  }
})
