import { defineConfig, devices } from '@playwright/test';

/**
 * Frontend end-to-end tests. They drive a real browser against the running app
 * (the web container on :8080 by default), so the full stack must be up:
 *
 *   docker compose up --build           # in the repo root
 *   cd web && npm run test:e2e:install  # one-time: download Chromium
 *   npm run test:e2e
 *
 * Override the target with E2E_BASE_URL (e.g. http://localhost:5173 for `vite dev`).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // tests share seeded backend state; run them serially
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
