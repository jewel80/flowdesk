import { expect, Page } from '@playwright/test';

export const DEMO_PASSWORD = 'password123';

export const USERS = {
  sales: 'sales@flowdesk.dev',
  accounts: 'accounts@flowdesk.dev',
  manager: 'manager@flowdesk.dev',
} as const;

/** Logs in through the UI and waits for the dashboard to render. */
export async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

/** Asserts the status badge with the given status is visible (e.g. 'submitted'). */
export function expectStatus(page: Page, status: string) {
  return expect(page.locator(`.badge--${status}`).first()).toBeVisible();
}

/**
 * Creates a draft billing request via the UI and returns its detail-page URL.
 * Must be called while logged in as a Sales user.
 */
export async function createDraft(
  page: Page,
  title: string,
  amount = '1500.00',
): Promise<string> {
  await page.getByRole('link', { name: 'New request' }).first().click();
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Customer').fill('Playwright Co');
  await page.getByLabel('Amount').fill(amount);
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expectStatus(page, 'draft');
  return page.url();
}

/**
 * Reloads the detail page until the expected status badge appears — used to wait
 * for the asynchronous invoice worker to flip a request to INVOICED.
 */
export async function waitForStatus(
  page: Page,
  status: string,
  timeout = 25_000,
): Promise<void> {
  await expect(async () => {
    await page.reload();
    await expect(page.locator(`.badge--${status}`).first()).toBeVisible({
      timeout: 2_000,
    });
  }).toPass({ timeout });
}
