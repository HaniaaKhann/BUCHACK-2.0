import { expect, test, type Page } from '@playwright/test';
import { findViolations } from './layout';
import { prepareStudent, signIn } from './helpers';

async function ask(page: Page, text: string, replies: number): Promise<void> {
  await page.fill('[data-chat-input]', text);
  await page.click('[data-chat-send]');
  await expect(page.locator('[data-chat-message="bot"]')).toHaveCount(replies);
}

for (const width of [1280, 390] as const) {
  test(`the chat reads typos, reports a fixed diet word, asks about an unsure allergen and falls back plainly at ${width}px`, async ({
    browser,
    request,
  }) => {
    await prepareStudent(request);
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await signIn(page, 'student');
    await expect(page.locator('article[data-item]').first()).toBeVisible();
    await page.locator('[data-chat-open]').click();

    await ask(page, 'hallal food', 2);
    const bots = page.locator('[data-chat-message="bot"]');
    await expect(bots.nth(1)).toContainText('I read this as halal.');
    await expect(bots.nth(1)).toContainText('Check the dish tags before you order');

    await ask(page, 'food with no shelfsh', 3);
    await expect(bots.nth(2)).toContainText('Which allergen do you mean?');
    await expect(bots.nth(2)).toContainText('I will not guess');
    await expect(page.locator('[data-chat-suggestion]')).toHaveCount(1);

    await ask(page, 'thnaks', 4);
    await expect(bots.nth(3)).toContainText('You are welcome');

    await ask(page, 'qwerty zzz', 5);
    await expect(bots.nth(4)).toContainText('I could not match that');
    await expect(page.locator('[data-chat-suggestion]')).toHaveCount(4);
    expect(await findViolations(page, `${width}px chat with typo replies`)).toEqual([]);

    await page.locator('[data-chat-suggestion]').first().click();
    await expect(bots).toHaveCount(6);
    await context.close();
  });
}
