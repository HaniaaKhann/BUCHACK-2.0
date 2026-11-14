import { expect, test } from '@playwright/test';
import { BASE_URL, signIn, signInApi } from './helpers';
import { findViolations } from './layout';
import { sql } from './stack';

for (const width of [1280, 390] as const) {
  test(`the owner sees the sales page with labelled sample data, and staff do not at ${width}px`, async ({
    browser,
    playwright,
  }) => {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await signIn(page, 'owner');
    await page.getByRole('link', { name: 'Sales' }).click();
    await page.waitForURL((url) => url.pathname === '/vendor/sales');

    await expect(page.locator('[data-stat="revenue"]')).toContainText('Revenue today');
    await expect(page.locator('[data-stat="orders"]')).toBeVisible();
    await expect(page.locator('[data-stat="average"]')).toBeVisible();
    await expect(page.locator('[data-top-dishes] li')).toHaveCount(5);
    await expect(page.locator('[data-hour-bars]')).toBeAttached();
    await expect(page.locator('[data-hour-table]')).toBeVisible();
    await expect(page.locator('[data-sample-orders] h2')).toContainText('Sample data for the demo');
    await expect(page.locator('[data-sample-orders]')).toContainText(
      'never used by the wait-time engine',
    );
    await expect(page.locator('[data-sales-row="sample"]').first()).toContainText('Sample');
    const appBefore = await page.locator('[data-app-orders] h2').innerText();
    expect(appBefore).toMatch(/Orders from the app \(\d+\)/);
    expect(await findViolations(page, `${width}px sales today`)).toEqual([]);

    const todayCount = await page.locator('[data-sample-orders] h2').innerText();
    await page.getByRole('button', { name: 'Last 7 days' }).click();
    await expect(page.locator('[data-sales-view="7d"]')).toBeVisible();
    const weekCount = await page.locator('[data-sample-orders] h2').innerText();
    expect(Number(/\((\d+)\)/.exec(weekCount)?.[1])).toBeGreaterThan(
      Number(/\((\d+)\)/.exec(todayCount)?.[1]),
    );
    expect(await findViolations(page, `${width}px sales last 7 days`)).toEqual([]);

    const api = await playwright.request.newContext({ baseURL: BASE_URL });
    await signInApi(api, 'staff');
    const bistro = sql(`select id from vendors where name='Bistro NTT'`);
    expect((await api.get(`/api/vendor/${bistro}/sales`)).status()).toBe(403);
    await api.dispose();

    const staffContext = await browser.newContext({ viewport: { width, height: 900 } });
    const staff = await staffContext.newPage();
    await signIn(staff, 'staff');
    await expect(staff.getByRole('link', { name: 'Sales' })).toHaveCount(0);
    await expect(staff.locator('[data-done-today]')).toBeVisible();
    await staff.goto('/vendor/sales');
    await staff.waitForURL((url) => url.pathname === '/vendor');
    await staffContext.close();
    await context.close();
  });
}
