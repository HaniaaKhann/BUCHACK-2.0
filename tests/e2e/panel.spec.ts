import { expect, test, type Page } from '@playwright/test';
import { prepareStudent, signIn } from './helpers';
import { findViolations } from './layout';

const insidePanel = (page: Page): Promise<boolean> =>
  page.evaluate(
    () => document.querySelector('[data-filter-panel]')?.contains(document.activeElement) ?? false,
  );

async function layoutShift(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as unknown as {
            value: number;
            hadRecentInput: boolean;
          }[]) {
            if (!entry.hadRecentInput) total += entry.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(total), 1500);
      }),
  );
}

test.describe('with motion allowed', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('at 390px the filters are a bottom sheet with a backdrop, a focus trap, Escape and focus returned', async ({
    browser,
    request,
  }) => {
    await prepareStudent(request);
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    await signIn(page, 'student');
    await expect(page.locator('article[data-item]').first()).toBeVisible();

    const toggle = page.locator('[data-filter-toggle]');
    const panel = page.locator('[data-filter-panel]');
    await expect(panel).toHaveAttribute('data-open', 'false');
    await expect(panel).toHaveAttribute('inert', '');
    await expect(panel).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('role', 'dialog');
    await expect(panel).toHaveAttribute('aria-modal', 'true');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('[data-filter-backdrop]')).toHaveCSS('opacity', '1');
    expect(await insidePanel(page)).toBe(true);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    const box = await panel.boundingBox();
    expect(box?.x).toBe(0);
    expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(844);
    expect(await findViolations(page, '390px filter sheet open')).toEqual([]);

    for (let step = 0; step < 24; step += 1) {
      await page.keyboard.press('Tab');
      expect(await insidePanel(page), `forward ${step}`).toBe(true);
    }
    for (let step = 0; step < 24; step += 1) {
      await page.keyboard.press('Shift+Tab');
      expect(await insidePanel(page), `backward ${step}`).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(panel).toHaveAttribute('inert', '');
    await expect(toggle).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');

    await toggle.click();
    await expect(panel).toBeVisible();
    await page.locator('[data-filter-backdrop]').click({ position: { x: 195, y: 40 } });
    await expect(panel).toBeHidden();
    await expect(toggle).toBeFocused();

    await toggle.click();
    await page.locator('[data-filter-close]').click();
    await expect(panel).toBeHidden();
    await expect(toggle).toBeFocused();
    await context.close();
  });

  test('at 1280px the filters are a column that is open by default, collapses with animation and is inert while closed', async ({
    browser,
    request,
  }) => {
    await prepareStudent(request);
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    await signIn(page, 'student');
    await expect(page.locator('article[data-item]').first()).toBeVisible();

    const toggle = page.locator('[data-filter-toggle]');
    const panel = page.locator('[data-filter-panel]');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-open', 'true');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect((await panel.boundingBox())?.width).toBeGreaterThan(280);
    await expect(page.locator('[data-filter-close]')).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(async () => (await panel.boundingBox())?.width ?? 0).toBeLessThan(2);
    await expect(panel).toHaveAttribute('inert', '');
    await expect(panel).toBeHidden();
    expect(await findViolations(page, '1280px filters collapsed')).toEqual([]);

    await toggle.focus();
    for (let step = 0; step < 6; step += 1) {
      await page.keyboard.press('Tab');
      expect(await insidePanel(page)).toBe(false);
    }

    await toggle.click();
    await expect(panel).toBeVisible();
    await expect.poll(async () => (await panel.boundingBox())?.width ?? 0).toBeGreaterThan(280);
    expect(await findViolations(page, '1280px filters open again')).toEqual([]);
    await context.close();
  });

  test('tiles fade in, cards react to the pointer, the cart count bumps, and the page does not shift', async ({
    browser,
    request,
  }) => {
    await prepareStudent(request);
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    await page.goto('/sign-in');
    expect(await layoutShift(page)).toBeLessThan(0.02);
    await signIn(page, 'student');
    await expect(page.locator('article[data-item]').first()).toBeVisible();

    const tile = page.locator('article[data-item]').first().locator('xpath=..');
    expect(await tile.evaluate((node) => getComputedStyle(node).animationName)).toBe('fade-up');
    const delays = await page
      .locator('section[aria-label="Vendors"] li')
      .evaluateAll((nodes) =>
        nodes.slice(0, 4).map((node) => getComputedStyle(node).animationDelay),
      );
    expect(delays).toEqual(['0s', '0.04s', '0.08s', '0.12s']);
    expect(await layoutShift(page)).toBeLessThan(0.02);

    const card = page.locator('article[data-item]').first();
    await card.hover();
    await expect
      .poll(() => card.evaluate((node) => getComputedStyle(node).transform))
      .not.toBe('none');

    const count = page.locator('[data-cart-button] span').first();
    expect(await count.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
    await card.locator('[data-add]').click();
    await expect(count).toHaveText('1');
    expect(await count.evaluate((node) => getComputedStyle(node).animationName)).toBe('bump');
    await context.close();
  });

  test('the landing page fades in without shifting', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const hero = page.locator('main header').first();
    expect(await hero.evaluate((node) => getComputedStyle(node).animationName)).toBe('fade-up');
    expect(await layoutShift(page)).toBeLessThan(0.02);
  });
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('every animation ends at once and the panel still works', async ({ browser, request }) => {
    await prepareStudent(request);
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await signIn(page, 'student');
    await expect(page.locator('article[data-item]').first()).toBeVisible();
    const tile = page.locator('article[data-item]').first().locator('xpath=..');
    expect(await tile.evaluate((node) => getComputedStyle(node).animationDuration)).toBe('1e-05s');
    const panel = page.locator('[data-filter-panel]');
    await page.locator('[data-filter-toggle]').click();
    await expect(panel).toHaveAttribute('inert', '');
    await expect.poll(async () => (await panel.boundingBox())?.width ?? 0).toBeLessThan(2);
    await page.locator('[data-filter-toggle]').click();
    await expect(panel).toBeVisible();
    await context.close();
  });
});

test('every outlet card reserves a 16 to 9 banner', async ({ page, request }) => {
  await prepareStudent(request);
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, 'student');
  await expect(page.locator('[data-image-slot]').first()).toBeVisible();
  const ratios = await page
    .locator('[data-image-slot]')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect()).map((box) => box.width / box.height),
    );
  expect(ratios.length).toBeGreaterThan(5);
  for (const ratio of ratios) expect(ratio).toBeCloseTo(16 / 9, 1);
});
