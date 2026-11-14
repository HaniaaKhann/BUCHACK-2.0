import { expect, test } from '@playwright/test';
import { BASE_URL, PASSWORD, signIn, signInApi } from './helpers';
import { findViolations } from './layout';

for (const width of [1280, 390] as const) {
  test(`the owner adds and edits a dish at ${width}px, and staff cannot`, async ({
    browser,
    playwright,
  }) => {
    const viewport = { width, height: 900 };
    const name = `E2E Dish ${width}`;
    const ownerContext = await browser.newContext({ viewport });
    const owner = await ownerContext.newPage();
    await signIn(owner, 'owner');
    await owner.goto('/vendor/menu', { waitUntil: 'networkidle' });

    const add = owner.locator('[data-dish-form]').first();
    await add.locator('[data-dish-name]').fill(name);
    await add.locator('[data-dish-price]').fill('15');
    await add.locator('[data-dish-category]').fill('Drinks');
    await add.locator('[data-dish-submit]').click();

    const card = owner.locator(`[data-item="${name}"]`);
    await expect(card).toBeVisible();
    await expect(card).toContainText('HK$15');
    await expect(card).toContainText('Drinks');
    await expect(card.locator('[data-tags-status]')).toHaveAttribute(
      'data-tags-status',
      'unverified',
    );
    await expect(card.locator('[data-tags-status]')).toHaveText('Not verified');
    expect(await findViolations(owner, `${width}px menu after adding`)).toEqual([]);

    await card.locator('[data-edit-dish]').click();
    const form = card.locator('[data-dish-form]');
    await form.locator('[data-dish-price]').fill('18');
    await form.locator('[data-dish-category]').fill('Cold drinks');
    expect(await findViolations(owner, `${width}px menu with the edit form open`)).toEqual([]);
    await form.locator('[data-dish-submit]').click();
    await expect(card).toContainText('HK$18');
    await expect(card).toContainText('Cold drinks');
    await expect(card.locator('[data-dish-form]')).toHaveCount(0);

    await owner.locator('[data-dish-form]').first().locator('[data-dish-name]').fill(name);
    await owner.locator('[data-dish-form]').first().locator('[data-dish-price]').fill('20');
    await owner.locator('[data-dish-form]').first().locator('[data-dish-category]').fill('Drinks');
    await owner.locator('[data-dish-form]').first().locator('[data-dish-submit]').click();
    await expect(owner.getByText('A dish with that name already exists.')).toBeVisible();

    const staffContext = await browser.newContext({ viewport });
    const staff = await staffContext.newPage();
    await staff.goto('/sign-in');
    await staff.fill('input[name=email]', 'staff@demo.example');
    await staff.fill('input[name=password]', PASSWORD);
    await staff.click('button[type=submit]');
    await staff.waitForURL((url) => url.pathname === '/vendor');
    await staff.goto('/vendor/menu', { waitUntil: 'networkidle' });
    await expect(staff.locator(`[data-item="${name}"]`)).toBeVisible();
    await expect(staff.locator('[data-dish-form]')).toHaveCount(0);
    await expect(staff.locator('[data-edit-dish]')).toHaveCount(0);
    expect(await findViolations(staff, `${width}px staff menu`)).toEqual([]);

    const lookup = await playwright.request.newContext({ baseURL: BASE_URL });
    await signInApi(lookup, 'student');
    const listed = (await (await lookup.get('/api/vendors')).json()) as {
      vendors: { id: string; name: string }[];
    };
    const bistro = listed.vendors.find((vendor) => vendor.name === 'Bistro NTT');
    expect(bistro).toBeDefined();
    await lookup.dispose();

    const staffApi = await playwright.request.newContext({ baseURL: BASE_URL });
    const login = await staffApi.post('/api/auth/sign-in/email', {
      data: { email: 'staff@demo.example', password: PASSWORD },
      headers: { origin: BASE_URL },
    });
    expect(login.ok()).toBe(true);
    const refused = await staffApi.post(`/api/vendor/${bistro?.id ?? ''}/menu`, {
      data: { name: 'Staff Dish', priceHkd: 10, category: 'Test' },
      headers: { origin: BASE_URL },
    });
    expect(refused.status()).toBe(403);
    await staffApi.dispose();

    await staffContext.close();
    await ownerContext.close();
  });
}
