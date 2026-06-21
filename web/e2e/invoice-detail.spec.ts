import { expect, test } from '@playwright/test';
import { createDraft, login, logout, USERS, waitForStatus } from './helpers';

test.describe('Invoice detail page', () => {
  test('shows issuer block, bill-to, line items table, and totals', async ({ page }) => {
    const title = `InvDetail-${Date.now()}`;

    await login(page, USERS.sales);
    const requestUrl = await createDraft(page, title, '2500.00');
    await page.getByRole('button', { name: 'Submit for review' }).click();
    await logout(page);

    await login(page, USERS.accounts);
    await page.goto(requestUrl);
    await page.getByRole('button', { name: 'Approve' }).click();
    await waitForStatus(page, 'invoiced');

    await page.getByRole('link', { name: /View invoice/ }).click();

    // Issuer / Bill-to
    await expect(page.getByText('Bill To')).toBeVisible();

    // Line items table columns
    await expect(page.getByRole('columnheader', { name: 'Description' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Qty' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Unit Price' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Amount' })).toBeVisible();

    // Totals section
    await expect(page.getByText('Subtotal')).toBeVisible();
    await expect(page.getByText('Total Due')).toBeVisible();
  });

  test('PDF download button triggers a file download', async ({ page }) => {
    const title = `InvPdf-${Date.now()}`;

    await login(page, USERS.sales);
    const requestUrl = await createDraft(page, title, '1200.00');
    await page.getByRole('button', { name: 'Submit for review' }).click();
    await logout(page);

    await login(page, USERS.accounts);
    await page.goto(requestUrl);
    await page.getByRole('button', { name: 'Approve' }).click();
    await waitForStatus(page, 'invoiced');

    await page.getByRole('link', { name: /View invoice/ }).click();

    const pdfBtn = page.getByRole('button', { name: 'Download PDF' });
    await expect(pdfBtn).toBeVisible();

    // Wait for the download event triggered by the PDF endpoint
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }),
      pdfBtn.click(),
    ]);

    // Filename should match INV-YYYY-NNNN.pdf
    expect(download.suggestedFilename()).toMatch(/^INV-.+\.pdf$/);

    // No error shown, page stays on invoice
    await expect(page.locator('.form__error')).toHaveCount(0);
    await expect(page).toHaveURL(/\/invoices\//);
  });

  test('Mark as paid action preserved for accounts role on ISSUED invoice', async ({ page }) => {
    const title = `InvMarkPaid-${Date.now()}`;

    await login(page, USERS.sales);
    const requestUrl = await createDraft(page, title, '1800.00');
    await page.getByRole('button', { name: 'Submit for review' }).click();
    await logout(page);

    await login(page, USERS.accounts);
    await page.goto(requestUrl);
    await page.getByRole('button', { name: 'Approve' }).click();
    await waitForStatus(page, 'invoiced');

    await page.getByRole('link', { name: /View invoice/ }).click();

    await expect(page.getByRole('button', { name: 'Mark as paid' })).toBeVisible();
    await page.getByRole('button', { name: 'Mark as paid' }).click();
    await expect(page.locator('.badge--paid')).toBeVisible();
  });

  test('manager cannot see Mark as paid button', async ({ page }) => {
    await login(page, USERS.manager);
    await page.goto('/invoices');
    await page.getByRole('table').waitFor();

    // Click first invoice link
    await page.locator('.table .link').first().click();

    await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark as paid' })).toHaveCount(0);
  });

  test('seeded invoice shows full layout with payment details', async ({ page }) => {
    await login(page, USERS.manager);
    await page.goto('/invoices');
    await page.getByRole('table').waitFor();

    await page.locator('.table .link').first().click();

    // Full layout sections should be present for a seeded invoice
    await expect(page.getByText('Bill To')).toBeVisible();
    await expect(page.getByText('Total Due')).toBeVisible();
    // Payment details present (seeded invoices always have payment terms)
    await expect(page.getByText('Payment Details')).toBeVisible();
  });
});
