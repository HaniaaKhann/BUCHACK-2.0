import { expect, test } from '@playwright/test';
import { prepareStudent, signIn, startClock } from './helpers';

const STEPS = [
  { action: 'accept', status: 'accepted' },
  { action: 'preparing', status: 'preparing' },
  { action: 'ready', status: 'ready' },
] as const;

test('a student filters, orders, the vendor takes the order to Ready, and the student completes it', async ({
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
  const dishName = (await cards.first().locator('h3').innerText()).trim();
  await cards.first().locator('[data-add]').click();
  await expect(page.locator('[data-toast]')).toContainText(`Added to cart: ${dishName}`);
  await expect(page.locator('[data-cart-button]')).toContainText('Cart (1)');
  await page.locator('[data-toast-view]').click();
  const drawer = page.getByRole('dialog', { name: 'Your cart' });
  await expect(drawer).toBeVisible();
  await expect(drawer.locator('[data-wallet-line]')).toContainText(
    `Wallet (demo credit): HK$${balanceBefore}`,
  );
  await expect(drawer.locator('[data-wallet-after]')).toContainText(
    `After this order: HK$${balanceBefore - price}`,
  );
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
    if (step.action === 'accept') {
      await expect(page.locator('[data-bell-count]')).toHaveText('2', { timeout: 20_000 });
      await expect(page.locator('[data-bell]')).toHaveAttribute(
        'aria-label',
        'Notifications, 2 unread',
      );
    }
  }
  await expect(page.locator('[data-step="ready"][data-done="true"]')).toBeVisible();

  await expect(ownerPage.locator('[data-action="ready"]')).toHaveCount(0);
  await expect(ownerPage.locator('[data-action="picked-up"]')).toHaveCount(0);
  const doneOrder = ownerPage.locator('[data-done-today] [data-done-order]');
  await expect(doneOrder).toHaveCount(1);
  await expect(doneOrder).toHaveAttribute('data-done-status', 'ready');
  await expect(doneOrder).toContainText('Waiting for pickup');
  await expect(page.locator('[data-status-message]')).toContainText('completes by itself');

  await page.getByRole('button', { name: 'I picked it up' }).click();
  await expect(orderStatus).toHaveAttribute('data-order-status', 'completed');
  await expect(page.locator('[data-step="completed"][data-done="true"]')).toBeVisible();
  await expect(page.locator('[data-status-label]')).toHaveText('Completed');
  await expect(doneOrder).toHaveAttribute('data-done-status', 'completed', { timeout: 20_000 });
  await expect(doneOrder).toContainText('Completed');

  const bellCount = page.locator('[data-bell-count]');
  await expect(bellCount).toHaveText('4');
  await page.locator('[data-bell]').click();
  for (const kind of ['order_accepted', 'leave_now', 'order_preparing', 'order_ready']) {
    await expect(page.locator(`[data-notification="${kind}"]`)).toHaveCount(1);
  }
  await expect(page.locator('[data-notification="order_ready"]')).toContainText('Order ready');
  await page.locator('[data-bell-mark-all]').click();
  await expect(bellCount).toHaveCount(0);
  await ownerContext.close();
});
