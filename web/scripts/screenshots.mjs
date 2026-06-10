// Captures README screenshots from the running app using Playwright.
// Run from the web/ directory with the full stack up:
//   node ./node_modules/@playwright/test/cli.js  (no) -> use: node scripts/screenshots.mjs
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const OUT = '../docs/screenshots';
const PASSWORD = 'password123';
const USERS = {
  sales: 'sales@flowdesk.dev',
  accounts: 'accounts@flowdesk.dev',
  manager: 'manager@flowdesk.dev',
};

const browser = await chromium.launch();

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  return ctx.newPage();
}

async function login(page, email) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
}

async function shoot(page, name, fullPage = true) {
  await page.waitForTimeout(400); // let layout/data settle
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log(`captured ${name}.png`);
}

async function openRequestByTitle(page, title) {
  await page.goto(`${BASE}/requests`);
  await page.getByRole('row', { name: new RegExp(title) }).getByRole('link').first().click();
  await page.getByText('Activity history').waitFor();
}

// 1. Login page (with demo accounts)
{
  const page = await newPage();
  await page.goto(`${BASE}/login`);
  await page.getByText('Demo accounts').waitFor();
  await shoot(page, '01-login');
  await page.context().close();
}

// 2. Manager dashboard (organisation-wide metrics + status breakdown)
{
  const page = await newPage();
  await login(page, USERS.manager);
  await page.getByText('Requests by status').waitFor();
  await shoot(page, '02-dashboard');
  await page.context().close();
}

// 3. Billing requests list (all statuses + filters)
{
  const page = await newPage();
  await login(page, USERS.manager);
  await page.getByRole('link', { name: 'Billing Requests' }).click();
  await page.getByRole('table').waitFor();
  await shoot(page, '03-requests-list');
  await page.context().close();
}

// 4. New request form (Sales)
{
  const page = await newPage();
  await login(page, USERS.sales);
  await page.getByRole('link', { name: 'New request' }).first().click();
  await page.getByLabel('Title').waitFor();
  await page.getByLabel('Title').fill('Q3 Managed Services Retainer');
  await page.getByLabel('Customer').fill('Northwind Traders');
  await page.getByLabel('Amount').fill('5400.00');
  await shoot(page, '04-new-request');
  await page.context().close();
}

// 5. Request detail with audit timeline (a fully-processed request)
{
  const page = await newPage();
  await login(page, USERS.manager);
  await openRequestByTitle(page, 'Security Audit Engagement');
  await shoot(page, '05-request-detail');
  await page.context().close();
}

// 6. Approval page (Accounts viewing a SUBMITTED request → Approve/Reject)
{
  const page = await newPage();
  await login(page, USERS.accounts);
  await openRequestByTitle(page, 'Annual License Renewal');
  await page.getByRole('button', { name: 'Approve' }).waitFor();
  await shoot(page, '06-approval');
  await page.context().close();
}

// 7. Invoices list
{
  const page = await newPage();
  await login(page, USERS.manager);
  await page.getByRole('link', { name: 'Invoices' }).click();
  await page.getByRole('table').waitFor();
  await shoot(page, '07-invoices-list');
  await page.context().close();
}

// 8. Invoice detail (an ISSUED invoice; Accounts can mark it paid)
{
  const page = await newPage();
  await login(page, USERS.accounts);
  await page.goto(`${BASE}/invoices`);
  await page.getByRole('row', { name: /Adventure Works/ }).getByRole('link').first().click();
  await page.getByText('Source request').waitFor();
  await shoot(page, '08-invoice-detail');
  await page.context().close();
}

await browser.close();
console.log('All screenshots captured to docs/screenshots/');
