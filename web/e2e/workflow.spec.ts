import { expect, test } from '@playwright/test';
import {
  createDraft,
  expectStatus,
  login,
  logout,
  USERS,
  waitForStatus,
} from './helpers';

test.describe('FlowDesk billing-approval workflow (UI E2E)', () => {
  test('full happy path: create → submit → approve → invoice → paid', async ({
    page,
  }) => {
    const title = `E2E Happy ${Date.now()}`;

    // --- Sales: create a draft and submit it ---
    await login(page, USERS.sales);
    const requestUrl = await createDraft(page, title, '1999.99');
    await page.getByRole('button', { name: 'Submit for review' }).click();
    await expectStatus(page, 'submitted');
    await logout(page);

    // --- Accounts: approve it ---
    await login(page, USERS.accounts);
    await page.goto(requestUrl);
    await page.getByRole('button', { name: 'Approve' }).click();

    // --- Async worker generates the invoice (request → INVOICED) ---
    await waitForStatus(page, 'invoiced');

    // --- Open the generated invoice and mark it paid ---
    await page.getByRole('link', { name: /View invoice/ }).click();
    await expectStatus(page, 'issued');
    await page.getByRole('button', { name: 'Mark as paid' }).click();
    await expectStatus(page, 'paid');
  });

  test('reject → revise & reopen loop', async ({ page }) => {
    const title = `E2E Reject ${Date.now()}`;
    const reason = 'Missing PO number — please attach and resubmit.';

    await login(page, USERS.sales);
    const requestUrl = await createDraft(page, title);
    await page.getByRole('button', { name: 'Submit for review' }).click();
    await expectStatus(page, 'submitted');
    await logout(page);

    // Accounts rejects with a reason.
    await login(page, USERS.accounts);
    await page.goto(requestUrl);
    await page.getByRole('button', { name: 'Reject' }).click();
    await page
      .getByPlaceholder('Reason for rejection (required)')
      .fill(reason);
    await page.getByRole('button', { name: 'Confirm rejection' }).click();
    await expectStatus(page, 'rejected');
    await logout(page);

    // Sales sees the reason and reopens the request to a draft.
    await login(page, USERS.sales);
    await page.goto(requestUrl);
    await expect(page.getByText(reason)).toBeVisible();
    await page.getByRole('button', { name: /Revise/ }).click();
    await expectStatus(page, 'draft');
  });

  test('RBAC: Sales cannot approve and Manager is read-only', async ({
    page,
  }) => {
    const title = `E2E RBAC ${Date.now()}`;

    await login(page, USERS.sales);
    const requestUrl = await createDraft(page, title);
    await page.getByRole('button', { name: 'Submit for review' }).click();
    await expectStatus(page, 'submitted');

    // Sales must not see review actions on a submitted request.
    await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Reject' })).toHaveCount(0);
    await logout(page);

    // Manager is read-only everywhere.
    await login(page, USERS.manager);
    await page.goto(requestUrl);
    await expect(page.getByText('No actions available to you.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('dashboard shows metrics and status breakdown', async ({ page }) => {
    await login(page, USERS.manager);
    await expect(page.getByText('Organisation-wide')).toBeVisible();
    await expect(page.getByText('Total requests')).toBeVisible();
    await expect(page.getByText('Outstanding invoices')).toBeVisible();
    // The status breakdown links through to the filtered list.
    await page.getByText('Requests by status').waitFor();
  });
});
