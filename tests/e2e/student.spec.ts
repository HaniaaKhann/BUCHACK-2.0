import { expect, test, type Browser, type Page, type PlaywrightWorkerArgs } from '@playwright/test';
import { BASE_URL, prepareStudent, signIn } from './helpers';
import { findViolations } from './layout';

const PASSWORD = 'e2e-student-password-1';

interface Building {
  id: string;
  campus: string;
  name: string;
}

async function newStudent(
  browser: Browser,
  playwright: PlaywrightWorkerArgs['playwright'],
  width: number,
  tag: string,
): Promise<{ page: Page; email: string; close: () => Promise<void> }> {
  const email = `e2e-${tag}-${width}-${Date.now()}@example.test`;
  const api = await playwright.request.newContext({ baseURL: BASE_URL });
  const signedUp = await api.post('/api/auth/sign-up/email', {
    data: { email, password: PASSWORD, name: 'E2E Student' },
    headers: { origin: BASE_URL },
  });
  expect(signedUp.ok()).toBe(true);
  const profile = await api.patch('/api/me', {
    data: { dietTags: [], allergens: [] },
    headers: { origin: BASE_URL },
  });
  expect(profile.ok()).toBe(true);
  const buildings = ((await (await api.get('/api/buildings')).json()) as { buildings: Building[] })
    .buildings;
  await api.dispose();

  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  await page.goto('/sign-in');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL((url) => url.pathname !== '/sign-in');
  (page as Page & { buildings?: Building[] }).buildings = buildings;
  return {
    page,
    email,
    close: async () => {
      await page.request.post('/api/auth/delete-user', {
        data: { password: PASSWORD },
        headers: { origin: BASE_URL },
      });
      await context.close();
    },
  };
}

const buildingsOf = (page: Page): Building[] =>
  (page as Page & { buildings?: Building[] }).buildings ?? [];

async function openProfile(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Profile' }).click();
  await page.waitForURL((url) => url.pathname === '/onboarding');
  await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible();
}

async function save(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.waitForURL((url) => url.pathname === '/');
}

for (const width of [1280, 390] as const) {
  test(`classes stay on the profile and can be edited and removed at ${width}px`, async ({
    browser,
    playwright,
  }) => {
    const student = await newStudent(browser, playwright, width, 'classes');
    const { page } = student;
    await openProfile(page);

    await expect(page.getByText('Where are you now?')).toHaveCount(0);
    await expect(page.getByPlaceholder('Course (not saved)')).toHaveCount(0);

    for (const [index, times] of [
      ['09:00', '10:00'],
      ['14:00', '15:00'],
    ].entries()) {
      await page.getByRole('button', { name: 'Add a class' }).click();
      const row = page.locator('[data-class-row]').nth(index);
      await row.getByLabel('Day').selectOption('2');
      await row.getByLabel('Building').selectOption(buildingsOf(page)[index]?.id ?? '');
      await row.getByLabel('Start').fill(times[0] ?? '');
      await row.getByLabel('End').fill(times[1] ?? '');
    }
    expect(await findViolations(page, `${width}px profile with classes`)).toEqual([]);
    await save(page);

    await openProfile(page);
    const rows = page.locator('[data-class-row]');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).getByLabel('Start')).toHaveValue('09:00');
    await expect(rows.nth(1).getByLabel('End')).toHaveValue('15:00');

    await page.getByRole('button', { name: 'Vegetarian' }).first().click();
    await save(page);
    await openProfile(page);
    await expect(page.locator('[data-class-row]')).toHaveCount(2);

    await page.locator('[data-class-row]').nth(0).getByLabel('End').fill('10:30');
    await save(page);
    await openProfile(page);
    await expect(page.locator('[data-class-row]').nth(0).getByLabel('End')).toHaveValue('10:30');

    await page.locator('[data-class-row]').nth(0).getByRole('button', { name: 'Remove' }).click();
    await save(page);
    await openProfile(page);
    await expect(page.locator('[data-class-row]')).toHaveCount(1);
    await expect(page.locator('[data-class-row]').nth(0).getByLabel('Start')).toHaveValue('14:00');

    await student.close();
  });

  test(`the From selector replaces the building step at ${width}px`, async ({
    browser,
    playwright,
  }) => {
    const student = await newStudent(browser, playwright, width, 'from');
    const { page } = student;
    const classes = await page.request.put('/api/classes', {
      data: {
        classes: [
          { weekday: 2, startMinute: 840, endMinute: 900, buildingId: buildingsOf(page)[0]?.id },
        ],
      },
      headers: { origin: BASE_URL },
    });
    expect(classes.ok()).toBe(true);

    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('article[data-item]').first()).toBeVisible();
    await expect(page.locator('[data-schedule]')).toContainText('Next class 14:00');
    await expect(page.locator('[data-from-hint-summary]')).toHaveText(
      'Choose where you are to see a leave time',
    );
    await expect(page.locator('article[data-item]').first()).toContainText('Class at 14:00');
    await expect(page.getByText('Available now').first()).toBeVisible();
    expect(await findViolations(page, `${width}px dashboard without a from building`)).toEqual([]);

    if (width < 1024) await page.getByRole('button', { name: 'Filters and sorting' }).click();
    await expect(page.locator('[data-from-hint]')).toBeVisible();
    const target = buildingsOf(page).find((building) => building.name.includes('Ng Tor Tai'));
    await page
      .locator('[data-from-select]')
      .selectOption(target?.id ?? buildingsOf(page)[1]?.id ?? '');
    await expect(page.locator('[data-from-hint-summary]')).toHaveCount(0);
    await expect(page.locator('article[data-item]').first()).toContainText(/Leave (now|at)/);
    await expect(page.locator('article[data-item]').first()).not.toContainText('Class at 14:00');

    await student.close();
  });

  test(`adding to the cart shows a short toast, and checkout shows the wallet at ${width}px`, async ({
    browser,
    request,
  }) => {
    await prepareStudent(request);
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await signIn(page, 'student');
    await expect(page.locator('article[data-item]').first()).toBeVisible();

    const card = page.locator('article[data-item]').first();
    const name = (await card.locator('h3').innerText()).trim();
    const price = Number(/HK\$(\d+)/.exec(await card.innerText())?.[1]);
    const balance = (
      (await (await page.request.get('/api/wallet/me')).json()) as { balanceHkd: number }
    ).balanceHkd;

    const status = page
      .locator('[role="status"][aria-live="polite"]')
      .filter({ has: page.locator('[data-toast]') });
    await card.locator('[data-add]').click();
    const toast = page.locator('[data-toast]');
    await expect(toast).toBeVisible();
    const shownAt = Date.now();
    await expect(toast).toContainText(`Added to cart: ${name}`);
    await expect(status).toHaveCount(1);
    await expect(page.locator('[data-cart-button]')).toContainText('Cart (1)');
    expect(await findViolations(page, `${width}px with the toast`)).toEqual([]);
    await expect(toast).toBeHidden({ timeout: 6000 });
    const visibleFor = Date.now() - shownAt;
    expect(visibleFor).toBeGreaterThan(2000);
    expect(visibleFor).toBeLessThan(5500);

    await card.locator('[data-add]').click();
    await expect(toast).toBeVisible();
    await page.locator('[data-toast-view]').click();
    const drawer = page.getByRole('dialog', { name: 'Your cart' });
    await expect(drawer).toBeVisible();
    await expect(toast).toHaveCount(0);
    await expect(drawer.locator('[data-wallet-line]')).toContainText(
      `Wallet (demo credit): HK$${balance}`,
    );
    await expect(drawer.locator('[data-wallet-after]')).toContainText(
      `After this order: HK$${balance - 2 * price}`,
    );
    expect(await findViolations(page, `${width}px checkout`)).toEqual([]);
    await context.close();
  });
}

test('every outlet card shows a photo or a palette tile, and the header has a logo slot, without errors', async ({
  page,
  request,
}) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  await prepareStudent(request);
  await signIn(page, 'student');
  await expect(page.locator('article[data-item]').first()).toBeVisible();
  await expect(page.locator('[data-image-slot]').first()).toBeVisible();
  const total = await page.locator('[data-image-slot]').count();
  const photos = await page.locator('[data-image-slot="photo"]').count();
  const tiles = await page.locator('[data-image-slot="tile"]').count();
  expect(total).toBeGreaterThan(5);
  expect(photos + tiles).toBe(total);
  await expect(page.locator('[data-logo-slot]').first()).toBeAttached();
  expect(problems).toEqual([]);
});
