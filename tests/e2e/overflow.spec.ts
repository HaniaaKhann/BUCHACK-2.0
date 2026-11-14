import { expect, test, type Page } from '@playwright/test';
import {
  BASE_URL,
  longestOutletName,
  prepareStudent,
  signIn,
  signInApi,
  startClock,
} from './helpers';
import { sql } from './stack';

const WIDTHS = [1280, 768, 390] as const;
const LONGEST = longestOutletName();
const SWAP_VENDOR = process.env['E2E_VENDOR_SWAP'] !== '0';

let orderId = '';

async function findViolations(page: Page, label: string): Promise<string[]> {
  return page.evaluate((where) => {
    const found: string[] = [];
    const width = window.innerWidth;
    const root = document.documentElement;
    if (root.scrollWidth > width + 1) {
      found.push(`${where}: the page is ${root.scrollWidth}px wide in a ${width}px window`);
    }
    const insideScroller = (element: Element): boolean => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const overflow = getComputedStyle(parent).overflowX;
        if (overflow === 'auto' || overflow === 'scroll' || overflow === 'hidden') return true;
      }
      return false;
    };
    for (const element of document.querySelectorAll('body *')) {
      const style = getComputedStyle(element);
      if (style.display === 'none') continue;
      const box = element.getBoundingClientRect();
      if (box.width === 0) continue;
      const name = `<${element.tagName.toLowerCase()} class="${String(element.className).slice(0, 60)}">`;
      if (style.position === 'fixed') {
        if (box.left < -1 || box.right > width + 1)
          found.push(`${where}: fixed ${name} leaves the window`);
      } else if (box.right > width + 1 && !insideScroller(element)) {
        found.push(`${where}: ${name} ends at ${Math.round(box.right)}px`);
      }
      if (found.length >= 6) break;
    }
    const banner = document.querySelector('[role="note"]');
    if (banner === null) {
      found.push(`${where}: the yellow banner is missing`);
    } else {
      const box = banner.getBoundingClientRect();
      if (banner.scrollWidth > banner.clientWidth + 1)
        found.push(`${where}: the banner text is clipped`);
      if (box.left < -1 || box.right > width + 1)
        found.push(`${where}: the banner leaves the window`);
    }
    return found;
  }, label);
}

async function visit(page: Page, path: string, label: string, name?: string): Promise<string[]> {
  await page.goto(path, { waitUntil: 'networkidle' });
  if (name !== undefined) await expect(page.getByText(name).first()).toBeAttached();
  return findViolations(page, label);
}

function swapOwnerToLongestVendor(): void {
  const owner = sql(`select id from users where email='owner@demo.example'`);
  const vendor = sql(`select id from vendors where name='${LONGEST.replace(/'/g, "''")}'`);
  sql(
    `delete from vendor_members where "userId"='${owner}'; insert into vendor_members (id, "userId", "vendorId", role) values (gen_random_uuid(), '${owner}', '${vendor}', 'owner')`,
  );
}

function restoreOwnerMembership(): void {
  const owner = sql(`select id from users where email='owner@demo.example'`);
  const vendor = sql(`select id from vendors where name='${LONGEST.replace(/'/g, "''")}'`);
  sql(
    `delete from vendor_members where "userId"='${owner}' and "vendorId"='${vendor}'; insert into vendor_members (id, "userId", "vendorId", role) select gen_random_uuid(), '${owner}', id, 'owner' from vendors where name='Bistro NTT' on conflict ("userId", "vendorId") do nothing`,
  );
}

test.describe('no horizontal overflow, with the longest outlet name', () => {
  test.beforeAll(async ({ playwright }) => {
    if (SWAP_VENDOR) restoreOwnerMembership();
    const request = await playwright.request.newContext({ baseURL: BASE_URL });
    await startClock(request);
    await prepareStudent(request);
    const vendors = (await (await request.get('/api/vendors')).json()) as {
      vendors: { id: string; name: string }[];
    };
    const vendor = vendors.vendors.find((entry) => entry.name === LONGEST);
    if (vendor === undefined) throw new Error('the longest outlet is not in the vendor list');
    const menu = (await (await request.get(`/api/menu-items?vendor=${vendor.id}`)).json()) as {
      items: { id: string }[];
    };
    const item = menu.items[0];
    if (item === undefined) throw new Error('the longest outlet has no orderable dish');
    const placed = await request.post('/api/orders', {
      data: {
        vendorId: vendor.id,
        items: [{ menuItemId: item.id, qty: 1 }],
        pickup: { kind: 'asap' },
      },
      headers: { origin: BASE_URL },
    });
    expect(placed.status()).toBe(201);
    orderId = ((await placed.json()) as { order: { id: string } }).order.id;
    await request.dispose();

    if (SWAP_VENDOR) {
      swapOwnerToLongestVendor();
      const ownerRequest = await playwright.request.newContext({ baseURL: BASE_URL });
      await signInApi(ownerRequest, 'owner');
      for (const action of ['accept', 'preparing', 'ready']) {
        const moved = await ownerRequest.patch(
          `/api/vendor/${vendor.id}/orders/${orderId}/${action}`,
          { headers: { origin: BASE_URL } },
        );
        expect(moved.status()).toBe(200);
      }
      await ownerRequest.dispose();
      restoreOwnerMembership();
    }
  });

  test.afterAll(() => {
    if (SWAP_VENDOR) restoreOwnerMembership();
  });

  for (const width of WIDTHS) {
    test(`at ${width}px every page fits`, async ({ browser }) => {
      const problems: string[] = [];
      const viewport = { width, height: width === 390 ? 900 : 800 };
      const at = (path: string): string => `${width}px ${path}`;

      const visitor = await browser.newContext({ viewport });
      const publicPage = await visitor.newPage();
      for (const path of ['/sign-in', '/sign-up']) {
        problems.push(...(await visit(publicPage, path, at(path))));
      }
      await visitor.close();

      const studentContext = await browser.newContext({ viewport });
      const student = await studentContext.newPage();
      await signIn(student, 'student');
      problems.push(...(await visit(student, '/', at('/'), LONGEST)));
      problems.push(...(await visit(student, '/onboarding', at('/onboarding'))));
      await student.goto('/', { waitUntil: 'networkidle' });
      await expect(student.locator('[data-bell]')).toBeVisible();
      await student.locator('[data-bell]').click();
      await expect(student.locator('[data-bell-panel]')).toBeVisible();
      if (SWAP_VENDOR) {
        await expect(student.locator('[data-bell-panel]')).toContainText(LONGEST);
      }
      problems.push(...(await findViolations(student, at('/ with the bell open'))));
      problems.push(...(await visit(student, '/orders', at('/orders'), LONGEST)));
      await student.locator('[data-bell]').click();
      await expect(student.locator('[data-bell-panel]')).toBeVisible();
      problems.push(...(await findViolations(student, at('/orders with the bell open'))));
      problems.push(...(await visit(student, `/orders/${orderId}`, at('/orders/[id]'), LONGEST)));

      await student.goto('/', { waitUntil: 'networkidle' });
      await student.locator('[data-chat-open]').click();
      await student.fill(
        '[data-chat-input]',
        'I have 20 min, under 40 HKD, something spicy and halal',
      );
      await student.click('[data-chat-send]');
      await expect(student.locator('[data-chat-message="bot"]')).toHaveCount(2);
      await student.click('[data-chat-suggestion]:first-child');
      await expect(student.locator('[data-chat-message="bot"]')).toHaveCount(3);
      problems.push(...(await findViolations(student, at('/ with the chat open'))));

      await student.goto('/', { waitUntil: 'networkidle' });
      await student.locator('section[aria-label="Vendors"] button', { hasText: LONGEST }).click();
      await student.locator('article[data-item] [data-add]').first().click();
      await student.locator('[data-cart-button]').click();
      await expect(student.getByRole('dialog', { name: 'Your cart' })).toContainText(LONGEST);
      problems.push(...(await findViolations(student, at('/ with the cart open'))));
      await studentContext.close();

      const ownerContext = await browser.newContext({ viewport });
      const owner = await ownerContext.newPage();
      await signIn(owner, 'owner');
      problems.push(...(await visit(owner, '/vendor', at('/vendor'))));
      problems.push(...(await visit(owner, '/vendor/menu', at('/vendor/menu'))));
      if (SWAP_VENDOR) {
        swapOwnerToLongestVendor();
        problems.push(...(await visit(owner, '/vendor', at('/vendor (long name)'), LONGEST)));
        problems.push(...(await visit(owner, '/vendor/menu', at('/vendor/menu (long name)'))));
        restoreOwnerMembership();
      }
      await ownerContext.close();

      const adminContext = await browser.newContext({ viewport });
      const admin = await adminContext.newPage();
      await signIn(admin, 'admin');
      problems.push(...(await visit(admin, '/admin', at('/admin'))));
      problems.push(...(await visit(admin, '/admin/accuracy', at('/admin/accuracy'))));
      await adminContext.close();

      expect(problems).toEqual([]);
    });
  }
});
