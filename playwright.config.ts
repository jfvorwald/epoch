import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 30_000, fullyParallel: false, workers: 1,
  reporter: 'list', use: { baseURL: 'http://127.0.0.1:5173', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop-chrome', use: { browserName: 'chromium', channel: 'chrome', viewport: { width: 1440, height: 1000 } } },
    { name: 'iphone-webkit-simulation', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
  webServer: { command: 'pnpm dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
});
