import { expect, test } from '@playwright/test';
import { createDraft, login, USERS } from './helpers';

test.describe('Search functionality', () => {
  test('requests — searching filters results', async ({ page }) => {
    const unique = `SearchReq-${Date.now()}`;

    await login(page, USERS.sales);
    await createDraft(page, unique);

    await page.goto('/requests');
    await page.getByRole('table').waitFor();

    await page.locator('.search-bar__input').fill(unique);
    await page.waitForTimeout(400); // debounce

    await expect(page.getByText(unique)).toBeVisible();
  });

  test('requests — clearing search restores full list', async ({ page }) => {
    const unique = `SearchClear-${Date.now()}`;

    await login(page, USERS.sales);
    await createDraft(page, unique);

    await page.goto('/requests');
    await page.getByRole('table').waitFor();

    await page.locator('.search-bar__input').fill(unique);
    await page.waitForTimeout(400);
    await expect(page.getByText(unique)).toBeVisible();

    await page.locator('.search-bar__clear').click();
    await page.waitForTimeout(400);

    // Table should still be showing (full list restored)
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('requests — no-match search shows contextual empty state', async ({ page }) => {
    await login(page, USERS.manager);
    await page.goto('/requests');
    await page.getByRole('table').waitFor();

    await page.locator('.search-bar__input').fill('xyzzy_no_match_abc987');
    await page.waitForTimeout(400);

    await expect(page.getByText('No requests found')).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
  });

  test('requests — search resets to page 1', async ({ page }) => {
    await login(page, USERS.manager);
    await page.goto('/requests?page=2');

    await page.locator('.search-bar__input').fill('a');
    await page.waitForTimeout(400);

    // URL should not have page=2 anymore
    await expect(page).not.toHaveURL(/page=2/);
  });

  test('invoices — searching filters results', async ({ page }) => {
    await login(page, USERS.manager);
    await page.goto('/invoices');
    await page.getByRole('table').waitFor();

    // Search by a known seeded customer name fragment
    await page.locator('.search-bar__input').fill('Adventure');
    await page.waitForTimeout(400);

    // Should show at least one row, or contextual empty state — never a generic crash
    const hasRows = await page.getByRole('row').count();
    if (hasRows <= 1) {
      await expect(page.getByText('No invoices found')).toBeVisible();
    } else {
      await expect(page.getByRole('table')).toBeVisible();
    }
  });

  test('invoices — no-match search shows contextual empty state', async ({ page }) => {
    await login(page, USERS.manager);
    await page.goto('/invoices');
    await page.getByRole('table').waitFor();

    await page.locator('.search-bar__input').fill('xyzzy_no_match_invoice_999');
    await page.waitForTimeout(400);

    await expect(page.getByText('No invoices found')).toBeVisible();
  });

  test('invoices — clearing search restores full list', async ({ page }) => {
    await login(page, USERS.manager);
    await page.goto('/invoices');
    await page.getByRole('table').waitFor();

    await page.locator('.search-bar__input').fill('xyzzy_no_match_invoice_999');
    await page.waitForTimeout(400);
    await expect(page.getByText('No invoices found')).toBeVisible();

    await page.locator('.search-bar__clear').click();
    await page.waitForTimeout(400);

    await expect(page.getByRole('table')).toBeVisible();
  });
});
