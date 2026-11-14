import { DEMO_ACCOUNTS, PrismaClient } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PATCH as busyRoute } from '../src/app/api/vendor/[id]/busy/route';
import { PATCH as stockRoute } from '../src/app/api/vendor/[id]/menu/[itemId]/stock/route';
import { POST as verifyRoute } from '../src/app/api/vendor/[id]/menu/[itemId]/verify-tags/route';
import { PATCH as pauseRoute } from '../src/app/api/vendor/[id]/pause/route';
import { asAccount, jsonInit, prepareSessions, type AccountKey } from './support/session';

const db = new PrismaClient();
let cookies = new Map<AccountKey, string>();
let vendorId = '';
let itemId = '';
let original: {
  stockStatus: 'in_stock' | 'out_of_stock';
  dietTags: string[];
  allergens: string[];
  tagsStatus: 'verified' | 'unverified';
  tagsVerifiedBy: string | null;
  tagsVerifiedAt: Date | null;
};

const NOW = Date.UTC(2026, 10, 17, 4, 15);
let originalClock: { mode: 'real' | 'demo'; currentTime: Date; speed: number } | null = null;

const ctx = (params: Record<string, string>): { params: Promise<never> } => ({
  params: Promise.resolve(params as never),
});

async function call(
  route: (request: Request, context: { params: Promise<never> }) => Promise<Response>,
  path: string,
  key: AccountKey | null,
  init: RequestInit,
  params: Record<string, string>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await route(asAccount(cookies, path, key, init), ctx(params));
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

beforeAll(async () => {
  cookies = await prepareSessions();
  const ownerId = DEMO_ACCOUNTS.find((account) => account.email.startsWith('owner@'))?.id ?? '';
  vendorId = (await db.vendorMember.findFirstOrThrow({ where: { userId: ownerId } })).vendorId;
  const item = await db.menuItem.findFirstOrThrow({ where: { vendorId, deletedAt: null } });
  itemId = item.id;
  original = {
    stockStatus: item.stockStatus,
    dietTags: item.dietTags,
    allergens: item.allergens,
    tagsStatus: item.tagsStatus,
    tagsVerifiedBy: item.tagsVerifiedBy,
    tagsVerifiedAt: item.tagsVerifiedAt,
  };
  await db.menuItem.update({
    where: { id: itemId },
    data: { tagsStatus: 'unverified', tagsVerifiedBy: null, tagsVerifiedAt: null },
  });
  const clock = await db.systemClock.findUniqueOrThrow({ where: { id: 1 } });
  originalClock = { mode: clock.mode, currentTime: clock.currentTime, speed: clock.speed };
  await db.systemClock.update({
    where: { id: 1 },
    data: { mode: 'demo', currentTime: new Date(NOW), speed: 0 },
  });
}, 180_000);

afterAll(async () => {
  await db.menuItem.update({
    where: { id: itemId },
    data: original,
  });
  await db.vendor.update({
    where: { id: vendorId },
    data: { busyState: 'normal', busyUntil: null, paused: false },
  });
  await db.busyEvent.deleteMany({ where: { vendorId } });
  if (originalClock) await db.systemClock.update({ where: { id: 1 }, data: originalClock });
  await db.session.deleteMany({
    where: { user: { email: { in: DEMO_ACCOUNTS.map((a) => a.email) } } },
  });
  await db.$disconnect();
});

describe('busy and pause', () => {
  const busy = (state: unknown, key: AccountKey | null = 'owner') =>
    call(busyRoute, `/api/vendor/${vendorId}/busy`, key, jsonInit('PATCH', { state }), {
      id: vendorId,
    });

  it('sets rush for 30 clock minutes and records the event', async () => {
    expect((await busy('rush')).status).toBe(200);
    const vendor = await db.vendor.findUniqueOrThrow({ where: { id: vendorId } });
    expect(vendor.busyState).toBe('rush');
    expect(vendor.busyUntil?.getTime()).toBe(NOW + 30 * 60_000);
    expect(await db.busyEvent.count({ where: { vendorId, state: 'rush' } })).toBe(1);
  });

  it('clears the expiry when set back to normal', async () => {
    expect((await busy('normal')).status).toBe(200);
    const vendor = await db.vendor.findUniqueOrThrow({ where: { id: vendorId } });
    expect([vendor.busyState, vendor.busyUntil]).toEqual(['normal', null]);
  });

  it('rejects a bad state, a student and nobody', async () => {
    expect((await busy('chaos')).status).toBe(400);
    expect((await busy('rush', 'student')).status).toBe(403);
    expect((await busy('rush', null)).status).toBe(401);
  });

  it('pauses and resumes the vendor', async () => {
    const pause = (paused: boolean) =>
      call(pauseRoute, `/api/vendor/${vendorId}/pause`, 'staff', jsonInit('PATCH', { paused }), {
        id: vendorId,
      });
    expect((await pause(true)).status).toBe(200);
    expect((await db.vendor.findUniqueOrThrow({ where: { id: vendorId } })).paused).toBe(true);
    expect((await pause(false)).status).toBe(200);
    expect((await db.vendor.findUniqueOrThrow({ where: { id: vendorId } })).paused).toBe(false);
  });
});

describe('stock and tag confirmation', () => {
  const stock = (inStock: boolean, key: AccountKey | null = 'staff') =>
    call(
      stockRoute,
      `/api/vendor/${vendorId}/menu/${itemId}/stock`,
      key,
      jsonInit('PATCH', { inStock }),
      { id: vendorId, itemId },
    );
  const verify = (body: unknown, key: AccountKey | null = 'owner') =>
    call(
      verifyRoute,
      `/api/vendor/${vendorId}/menu/${itemId}/verify-tags`,
      key,
      body === undefined ? { method: 'POST' } : jsonInit('POST', body),
      { id: vendorId, itemId },
    );

  it('toggles stock for staff', async () => {
    expect((await stock(false)).status).toBe(200);
    expect((await db.menuItem.findUniqueOrThrow({ where: { id: itemId } })).stockStatus).toBe(
      'out_of_stock',
    );
    expect((await stock(true)).status).toBe(200);
  });

  it('lets only the owner confirm tags, never staff', async () => {
    expect((await verify(undefined, 'staff')).status).toBe(403);
    expect((await verify(undefined, 'student')).status).toBe(403);
    expect((await db.menuItem.findUniqueOrThrow({ where: { id: itemId } })).tagsStatus).toBe(
      'unverified',
    );
  });

  it('rejects tags outside the vocabulary and leaves the item unverified', async () => {
    expect((await verify({ dietTags: ['gluten_free'], allergens: [] })).status).toBe(400);
    expect((await verify({ dietTags: [], allergens: ['nuts'] })).status).toBe(400);
    expect((await db.menuItem.findUniqueOrThrow({ where: { id: itemId } })).tagsStatus).toBe(
      'unverified',
    );
  });

  it('confirms halal only through the owner action and records who and when', async () => {
    const ownerId = DEMO_ACCOUNTS.find((account) => account.email.startsWith('owner@'))?.id;
    expect((await verify({ dietTags: ['halal'], allergens: ['soy'] })).status).toBe(200);
    const item = await db.menuItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(item).toMatchObject({
      tagsStatus: 'verified',
      tagsVerifiedBy: ownerId,
      dietTags: ['halal'],
      allergens: ['soy'],
    });
    expect(item.tagsVerifiedAt?.getTime()).toBe(NOW);
  });
});
