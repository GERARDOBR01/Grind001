import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 390, height: 844 },
    locale: 'es-MX',
    permissions: ['camera'],
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
    screenshot: 'only-on-failure',
  },
  webServer: { command: 'node tests/serve.mjs', url: 'http://localhost:4173/index.html', reuseExistingServer: !process.env.CI },
});
