import { expect, test } from '@playwright/test';
import { BASE_URL, PASSWORD, prepareStudent } from './helpers';
import { findViolations } from './layout';

for (const width of [1280, 390] as const) {
  test(`a student deletes their own account with a confirm step at ${width}px`, async ({
    browser,
    playwright,
  }) => {
    const email = `e2e-delete-${width}-${Date.now()}@example.test`;
    const password = 'e2e-delete-password-1';
    const api = await playwright.request.newContext({ baseURL: BASE_URL });
    const signedUp = await api.post('/api/auth/sign-up/email', {
      data: { email, password, name: 'E2E Delete' },
      headers: { origin: BASE_URL },
    });
    expect(signedUp.ok()).toBe(true);
    await api.patch('/api/me', {
      data: { dietTags: [], allergens: [] },
      headers: { origin: BASE_URL },
    });
    await api.dispose();

    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.goto('/sign-in');
    await page.fill('input[name=email]', email);
    await page.fill('input[name=password]', password);
    await page.click('button[type=submit]');
    await page.waitForURL((url) => url.pathname !== '/sign-in');

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: 'Profile' }).click();
    await page.waitForURL((url) => url.pathname === '/onboarding');
    await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible();
    await expect(page.locator('[data-delete-confirm]')).toHaveCount(0);
    await page.locator('[data-delete-start]').click();
    const submit = page.locator('[data-delete-submit]');
    await expect(submit).toBeDisabled();
    await page.locator('[data-delete-password]').fill('wrong password');
    await expect(submit).toBeDisabled();
    await page.locator('[data-delete-understand]').check();
    await expect(submit).toBeEnabled();
    expect(await findViolations(page, `${width}px delete panel`)).toEqual([]);

    await submit.click();
    await expect(page.getByText(/invalid password/i)).toBeVisible();

    await page.locator('[data-delete-cancel]').click();
    await expect(page.locator('[data-delete-confirm]')).toHaveCount(0);
    await page.locator('[data-delete-start]').click();
    await page.locator('[data-delete-password]').fill(password);
    await page.locator('[data-delete-understand]').check();
    await submit.click();
    await page.waitForURL((url) => url.pathname === '/');
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();

    const again = await playwright.request.newContext({ baseURL: BASE_URL });
    const retry = await again.post('/api/auth/sign-in/email', {
      data: { email, password },
      headers: { origin: BASE_URL },
    });
    expect(retry.status()).not.toBe(200);
    await again.dispose();
    await context.close();
  });
}

test('the demo student cannot delete the demo account, and sees why', async ({
  browser,
  request,
}) => {
  await prepareStudent(request);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto('/sign-in');
  await page.fill('input[name=email]', 'student@demo.example');
  await page.fill('input[name=password]', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL((url) => url.pathname === '/');
  await page.goto('/onboarding', { waitUntil: 'networkidle' });
  await page.locator('[data-delete-start]').click();
  await page.locator('[data-delete-password]').fill(PASSWORD);
  await page.locator('[data-delete-understand]').check();
  await page.locator('[data-delete-submit]').click();
  await expect(page.getByText('Demo accounts cannot be deleted')).toBeVisible();
  const check = await request.post('/api/auth/sign-in/email', {
    data: { email: 'student@demo.example', password: PASSWORD },
    headers: { origin: BASE_URL },
  });
  expect(check.status()).toBe(200);
  await context.close();
});
