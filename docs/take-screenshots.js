// Screenshot capture script for FlowDesk README
// Run: node docs/take-screenshots.js
// Requires: docker compose up + npm install in web/

const { chromium } = require('../web/node_modules/playwright-core');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
const OUT_DIR = path.join(__dirname, 'screenshots');

const USERS = {
  manager:  { email: 'manager@flowdesk.dev',  password: 'password123' },
  sales:    { email: 'sales@flowdesk.dev',     password: 'password123' },
  accounts: { email: 'accounts@flowdesk.dev',  password: 'password123' },
};

async function login(page, user) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/$/, { timeout: 15000 });
  await page.waitForTimeout(1500); // let charts render
}

async function shot(page, filename, waitFor) {
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT_DIR, filename), fullPage: false });
  console.log(`  ✓ ${filename}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  console.log('\n== FlowDesk Screenshots ==\n');

  // 1. Login page
  await page.goto(`${BASE_URL}/login`);
  await page.waitForTimeout(600);
  await shot(page, '01-login.png', 'form');

  // 2. Overview dashboard (manager sees org-wide data)
  await login(page, USERS.manager);
  await page.waitForSelector('.kpi-card', { timeout: 10000 });
  await page.waitForTimeout(1200); // charts need time
  await shot(page, '02-overview-dashboard.png', '.status-trend-chart');

  // 3. Billing Requests list
  await page.goto(`${BASE_URL}/requests`);
  await shot(page, '03-billing-requests.png', '.table');

  // 4. Request Detail (pick first request)
  const firstReqLink = await page.locator('table tbody tr:first-child td:first-child a').first();
  if (await firstReqLink.count() > 0) {
    await firstReqLink.click();
    await page.waitForTimeout(800);
    await shot(page, '04-request-detail.png', '.page__head');
  }

  // 5. Invoices list
  await page.goto(`${BASE_URL}/invoices`);
  await shot(page, '05-invoices.png', '.invoices-table');

  // 6. Invoice detail
  const firstInvLink = await page.locator('.invoice-link').first();
  if (await firstInvLink.count() > 0) {
    await firstInvLink.click();
    await page.waitForTimeout(800);
    await shot(page, '06-invoice-detail.png', '.invoice-doc');
  }

  // 7. Overview as Sales user (shows "New request" button)
  await page.getByRole('button', { name: 'Sign out' }).click();
  await login(page, USERS.sales);
  await page.waitForSelector('.kpi-card', { timeout: 10000 });
  await page.waitForTimeout(1000);
  await shot(page, '07-overview-sales-view.png', '.kpi-grid');

  // 8. New request form
  await page.goto(`${BASE_URL}/requests/new`);
  await shot(page, '08-new-request-form.png', 'form');

  await browser.close();
  console.log(`\nAll screenshots saved to: ${OUT_DIR}\n`);
})();
