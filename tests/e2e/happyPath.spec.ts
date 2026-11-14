import { expect, test } from '@playwright/test';
import { prepareStudent, signIn, startClock } from './helpers';

const STEPS = [
  { action: 'accept', status: 'accepted' },
  { action: 'preparing', status: 'preparing' },
  { action: 'ready', status: 'ready' },
  { action: 'picked-up', status: 'picked_up' },
] as const;

test('a student filters, orders, and the vendor takes the order from Accepted to Picked up', async ({
  page,
  browser,
  request,
}) => {
  await startClock(request);
  await prepareStudent(request);
  await signIn(page, 'student');
  await expect(page.locator('[data-demo-clock]')).toBeVisible();

  const total = async (): Promise<number> => {
    const counts = await page.locator('[data-group] h2 span').allInnerTexts();
    return counts.reduce((sum, count) => sum + Number(count), 0);
  };
  await expect(page.locator('article[data-item]').first()).toBeVisible();
  const before = await total();

  await page.getByLabel('Max price').selectOption('20');
  await expect.poll(total).toBeLessThan(before);

  await page.locator('section[aria-label="Vendors"] button', { hasText: 'Bistro NTT' }).click();
  const cards = page.locator('article[data-item]');
  await expect
    .poll(async () => {
      const texts = await cards.allInnerTexts();
      return texts.length > 0 && texts.every((text) => text.includes('Bistro NTT'));
    })
    .toBe(true);
  for (const text of await cards.allInnerTexts()) {
    expect(Number(/HK\$(\d+)/.exec(text)?.[1])).toBeLessThanOrEqual(20);
  }

  const balanceBefore = (
    (await (await page.request.get('/api/wallet/me')).json()) as {
      balanceHkd: number;
    }
  ).balanceHkd;
  const price = Number(/HK\$(\d+)/.exec(await cards.first().innerText())?.[1]);
  await cards.first().locator('[data-add]').click();
  await page.locator('[data-cart-button]').click();
  await expect(page.getByRole('dialog', { name: 'Your cart' })).toBeVisible();
  await page.getByRole('button', { name: `Pay HK$${price} from demo wallet` }).click();
  await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/);

  const orderStatus = page.locator('[data-order-status]');
  await expect(orderStatus).toHaveAttribute('data-order-status', 'placed');
  const balanceAfter = (
    (await (await page.request.get('/api/wallet/me')).json()) as {
      balanceHkd: number;
    }
  ).balanceHkd;
  expect(balanceAfter).toBe(balanceBefore - price);

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await signIn(ownerPage, 'owner');
  for (const step of STEPS) {
    const button = ownerPage.locator(`[data-action="${step.action}"]`);
    await expect(button).toBeVisible({ timeout: 20_000 });
    await button.click();
    await expect(orderStatus).toHaveAttribute('data-order-status', step.status, {
      timeout: 20_000,
    });
  }
  await expect(page.locator('[data-step="picked_up"][data-done="true"]')).toBeVisible();
  await ownerContext.close();
});
