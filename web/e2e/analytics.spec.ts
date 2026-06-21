import { expect, test } from '@playwright/test';
import { login, USERS } from './helpers';

test.describe('Dashboard analytics charts', () => {
  test('bar chart and pie chart are visible on PI Dashboard', async ({ page }) => {
    await login(page, USERS.manager);
    await page.goto('/dashboard/pi');

    await expect(page.locator('.status-trend-chart')).toBeVisible();
    await expect(page.locator('.status-pie-chart')).toBeVisible();
    await expect(page.getByText('Monthly Status Trend')).toBeVisible();
    await expect(page.getByText('Status Snapshot')).toBeVisible();
  });

  test('bar chart — switching to a month with no data shows empty state', async ({ page }) => {
    await login(page, USERS.manager);
    await page.goto('/dashboard/pi');
    await expect(page.locator('.status-trend-chart')).toBeVisible();

    // 2020-01 is well before any seeded data
    await page.locator('#month-select').fill('2020-01');

    await expect(
      page.locator('.status-trend-chart').getByText('No activity this month'),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('bar chart — switching back to current month shows chart or data', async ({ page }) => {
    await login(page, USERS.manager);
    await page.goto('/dashboard/pi');
    await expect(page.locator('.status-trend-chart')).toBeVisible();

    // Go to empty month first
    await page.locator('#month-select').fill('2020-01');
    await expect(
      page.locator('.status-trend-chart').getByText('No activity this month'),
    ).toBeVisible({ timeout: 10_000 });

    // Return to current month — data should load (chart OR empty state, no crash)
    const now = new Date().toISOString().slice(0, 7);
    await page.locator('#month-select').fill(now);

    // No loading error should appear
    await expect(page.locator('.state--error')).toHaveCount(0);
    await expect(page.locator('.status-trend-chart')).toBeVisible();
  });

  test('pie chart — switching to a date with no data shows empty state', async ({ page }) => {
    await login(page, USERS.manager);
    await page.goto('/dashboard/pi');
    await expect(page.locator('.status-pie-chart')).toBeVisible();

    // 2020-01-01 is well before any seeded data
    await page.locator('#date-select').fill('2020-01-01');

    await expect(
      page.locator('.status-pie-chart').getByText('No activity on this date'),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('pie chart — switching date updates the chart', async ({ page }) => {
    await login(page, USERS.manager);
    await page.goto('/dashboard/pi');
    await expect(page.locator('.status-pie-chart')).toBeVisible();

    // Set to a no-data date
    await page.locator('#date-select').fill('2020-01-01');
    await expect(
      page.locator('.status-pie-chart').getByText('No activity on this date'),
    ).toBeVisible({ timeout: 10_000 });

    // Change back to today — no error
    const today = new Date().toISOString().slice(0, 10);
    await page.locator('#date-select').fill(today);

    await expect(page.locator('.state--error')).toHaveCount(0);
    await expect(page.locator('.status-pie-chart')).toBeVisible();
  });
});
