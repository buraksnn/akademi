import { defineConfig } from '@playwright/test';
import 'dotenv/config';
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: process.env.APP_URL || 'http://localhost:3000',
    headless: true,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox'],
      env: {
        ...process.env,
        XDG_CONFIG_HOME: process.cwd() + '/work/chromium-config',
        XDG_CACHE_HOME: process.cwd() + '/work/chromium-cache',
      },
    },
    screenshot: 'only-on-failure',
  },
  reporter: [['list'], ['json', { outputFile: 'work/e2e-results.json' }]],
});
