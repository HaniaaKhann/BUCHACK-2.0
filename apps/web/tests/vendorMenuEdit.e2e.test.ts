import { DEMO_ACCOUNTS, PrismaClient } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as listRoute, POST as createRoute } from '../src/app/api/vendor/[id]/menu/route';
import { PATCH as editRoute } from '../src/app/api/vendor/[id]/menu/[itemId]/route';
import { asAccount, jsonInit, prepareSessions, type AccountKey } from './support/session';

const db = new PrismaClient();
let cookies = new Map<AccountKey, string>();
let vendorId = '';
let otherVendorId = '';
let otherItemId = '';

interface ItemBody {
  item: {
    id: string;
    name: string;
    priceHkd: number;
    category: string;
    inStock: boolean;
    dietTags: string[];
    allergens: string[];
    tagsVerified: boolean;
  };
}

const ctx = (params: Record<string, string>): { params: Promise<never> } => ({
  params: Promise.resolve(params as never),
});

async function create(
  body: unknown,
  key: AccountKey | null = 'owner',
  vendor: string = vendorId,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await createRoute(
    asAccount(cookies, `/api/vendor/${vendor}/menu`, key, jsonInit('POST', body)),
    ctx({ id: vendor }),
  );
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

async function edit(
  itemId: string,
  body: unknown,
  key: AccountKey | null = 'owner',
  vendor: string = vendorId,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await editRoute(
    asAccount(cookies, `/api/vendor/${vendor}/menu/${itemId}`, key, jsonInit('PATCH', body)),
    ctx({ id: vendor, itemId }),
  );
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

async function created(name: string): Promise<ItemBody['item']> {
  const result = await create({ name, priceHkd: 20, category: 'Test' });
  expect(result.status).toBe(201);
  return (result.json as unknown as ItemBody).item;
}

beforeAll(async () => {
  cookies = await prepareSessions();
  const owner = DEMO_ACCOUNTS.find((account) => account.email.startsWith('owner@'));
  vendorId = (await db.vendorMember.findFirstOrThrow({ where: { userId: owner?.id ?? '' } }))
    .vendorId;
  const other = await db.vendor.findFirstOrThrow({
    where: { id: { not: vendorId }, menuItems: { some: {} } },
  });
  otherVendorId = other.id;
  otherItemId = (await db.menuItem.findFirstOrThrow({ where: { vendorId: otherVendorId } })).id;
  await db.menuItem.deleteMany({ where: { isDemo: false } });
}, 180_000);

afterAll(async () => {
  await db.menuItem.deleteMany({ where: { isDemo: false } });
  await db.session.deleteMany({
    where: { user: { email: { in: DEMO_ACCOUNTS.map((account) => account.email) } } },
  });
  await db.$disconnect();
});

describe('adding a dish', () => {
  it('lets the owner add one, with unverified tags and a prep time taken from the vendor', async () => {
    const result = await create({ name: '  Test Noodles  ', priceHkd: 28, category: ' Mains ' });
    expect(result.status).toBe(201);
    const { item } = result.json as unknown as ItemBody;
    expect(item).toMatchObject({
      name: 'Test Noodles',
      priceHkd: 28,
      category: 'Mains',
      inStock: true,
      dietTags: [],
      allergens: [],
      tagsVerified: false,
    });
    const row = await db.menuItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(row).toMatchObject({
      vendorId,
      tagsStatus: 'unverified',
      tagsVerifiedBy: null,
      tagsVerifiedAt: null,
      isDemo: false,
    });
    const seeded = await db.menuItem.findMany({ where: { vendorId, isDemo: true } });
    const prep = seeded.map((entry) => entry.prepPriorMin).sort((a, b) => a - b);
    expect(prep).toContain(row.prepPriorMin);
  });

  it('shows the new dish in the owner menu list', async () => {
    const response = await listRoute(
      asAccount(cookies, `/api/vendor/${vendorId}/menu`, 'owner'),
      ctx({ id: vendorId }),
    );
    const { items } = (await response.json()) as {
      items: { name: string; tagsVerified: boolean }[];
    };
    expect(items.find((entry) => entry.name === 'Test Noodles')?.tagsVerified).toBe(false);
  });

  it('rejects a bad name, price or category and any extra field', async () => {
    const good = { name: 'Valid Dish', priceHkd: 20, category: 'Test' };
    for (const body of [
      {},
      { ...good, name: '' },
      { ...good, name: ' '.repeat(5) },
      { ...good, name: 'x'.repeat(81) },
      { ...good, priceHkd: 0 },
      { ...good, priceHkd: 501 },
      { ...good, priceHkd: 12.5 },
      { ...good, priceHkd: '20' },
      { ...good, category: '' },
      { ...good, category: 'c'.repeat(41) },
      { ...good, tagsStatus: 'verified' },
      { ...good, dietTags: ['halal'] },
    ]) {
      expect((await create(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect(await db.menuItem.count({ where: { name: 'Valid Dish' } })).toBe(0);
  });

  it('refuses a name the vendor already has', async () => {
    const result = await create({ name: 'Test Noodles', priceHkd: 30, category: 'Mains' });
    expect(result).toMatchObject({ status: 409, json: { error: 'name_taken' } });
  });

  it('gives staff, students and admins 403, nobody 401, and the owner no access to another vendor', async () => {
    const body = { name: 'Not Allowed', priceHkd: 20, category: 'Test' };
    for (const key of ['staff', 'student', 'admin'] as const) {
      expect((await create(body, key)).status, key).toBe(403);
    }
    expect((await create(body, null)).status).toBe(401);
    expect((await create(body, 'owner', otherVendorId)).status).toBe(403);
    expect(await db.menuItem.count({ where: { name: 'Not Allowed' } })).toBe(0);
  });
});

describe('editing a dish', () => {
  it('changes the price and the category without touching verification', async () => {
    const item = await created('Edit Me');
    await db.menuItem.update({
      where: { id: item.id },
      data: { tagsStatus: 'verified', tagsVerifiedBy: 'demo-owner', tagsVerifiedAt: new Date() },
    });
    expect((await edit(item.id, { priceHkd: 35 })).status).toBe(200);
    const result = await edit(item.id, { category: 'Specials' });
    expect(result.status).toBe(200);
    expect((result.json as unknown as ItemBody).item).toMatchObject({
      priceHkd: 35,
      category: 'Specials',
      tagsVerified: true,
    });
  });

  it('puts the tags back to unverified when the name changes, because it may be another dish', async () => {
    const item = await created('Rename Me');
    await db.menuItem.update({
      where: { id: item.id },
      data: { tagsStatus: 'verified', tagsVerifiedBy: 'demo-owner', tagsVerifiedAt: new Date() },
    });
    const result = await edit(item.id, { name: 'Renamed Dish' });
    expect(result.status).toBe(200);
    expect((result.json as unknown as ItemBody).item).toMatchObject({
      name: 'Renamed Dish',
      tagsVerified: false,
    });
    const row = await db.menuItem.findUniqueOrThrow({ where: { id: item.id } });
    expect([row.tagsStatus, row.tagsVerifiedBy, row.tagsVerifiedAt]).toEqual([
      'unverified',
      null,
      null,
    ]);
  });

  it('keeps verification when the name is sent unchanged', async () => {
    const item = await created('Same Name');
    await db.menuItem.update({ where: { id: item.id }, data: { tagsStatus: 'verified' } });
    expect((await edit(item.id, { name: 'Same Name', priceHkd: 22 })).status).toBe(200);
    expect((await db.menuItem.findUniqueOrThrow({ where: { id: item.id } })).tagsStatus).toBe(
      'verified',
    );
  });

  it('refuses a name another dish has, an empty change and unknown fields', async () => {
    const item = await created('Needs A Name');
    expect(await edit(item.id, { name: 'Test Noodles' })).toMatchObject({
      status: 409,
      json: { error: 'name_taken' },
    });
    for (const body of [
      {},
      { priceHkd: 0 },
      { name: '' },
      { tagsStatus: 'verified' },
      { stockStatus: 'out_of_stock' },
    ]) {
      expect((await edit(item.id, body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it('gives staff, students and admins 403, nobody 401, and 404 for another vendor dish', async () => {
    const item = await created('Locked Dish');
    for (const key of ['staff', 'student', 'admin'] as const) {
      expect((await edit(item.id, { priceHkd: 99 }, key)).status, key).toBe(403);
    }
    expect((await edit(item.id, { priceHkd: 99 }, null)).status).toBe(401);
    expect((await edit(otherItemId, { priceHkd: 99 })).status).toBe(404);
    expect((await db.menuItem.findUniqueOrThrow({ where: { id: item.id } })).priceHkd).toBe(20);
    expect((await db.menuItem.findUniqueOrThrow({ where: { id: otherItemId } })).priceHkd).not.toBe(
      99,
    );
  });
});
