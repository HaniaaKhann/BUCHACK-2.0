import { DEMO_ACCOUNTS, PrismaClient, SIM_EMAIL_DOMAIN } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as salesRoute } from '../src/app/api/vendor/[id]/sales/route';
import type { SalesView } from '../src/server/salesService';
import { asAccount, prepareSessions, type AccountKey } from './support/session';

const db = new PrismaClient();
let cookies = new Map<AccountKey, string>();
let vendorId = '';
let otherVendorId = '';
let studentId = '';
let simId = '';
let menuItemId = '';
let originalClock: { mode: 'real' | 'demo'; currentTime: Date; speed: number } | null = null;

const NOW = Date.UTC(2026, 10, 17, 4, 15);
const MIDNIGHT = Date.UTC(2026, 10, 16, 16, 0);
const MINUTE = 60_000;

async function get(
  range: string | null,
  key: AccountKey | null = 'owner',
  vendor = vendorId,
): Promise<{ status: number; json: SalesView & { error?: string } }> {
  const query = range === null ? '' : `?range=${range}`;
  const response = await salesRoute(
    asAccount(cookies, `/api/vendor/${vendor}/sales${query}`, key),
    {
      params: Promise.resolve({ id: vendor }),
    },
  );
  return {
    status: response.status,
    json: (await response.json()) as SalesView & { error?: string },
  };
}

async function order(
  student: string,
  status: 'completed' | 'cancelled' | 'preparing',
  total: number,
  minutesAgo: number,
  target = vendorId,
): Promise<string> {
  const placed = NOW - minutesAgo * MINUTE;
  const created = await db.order.create({
    data: {
      studentId: student,
      vendorId: target,
      status,
      totalHkd: total,
      placedAt: new Date(placed),
      predictedPoint: new Date(placed + 6 * MINUTE),
      predictedLow: new Date(placed + 4 * MINUTE),
      predictedHigh: new Date(placed + 9 * MINUTE),
      predictedBase: new Date(placed + 5 * MINUTE),
      backlogAtPlacement: 0,
      modelVersion: 'v2',
      items: {
        create: [{ menuItemId, qty: 2, priceHkdSnapshot: total / 2, prepPriorSnapshotMin: 3 }],
      },
    },
  });
  return created.id;
}

beforeAll(async () => {
  cookies = await prepareSessions();
  studentId = DEMO_ACCOUNTS.find((account) => account.role === 'student')?.id ?? '';
  const ownerId = DEMO_ACCOUNTS.find((account) => account.email.startsWith('owner@'))?.id ?? '';
  vendorId = (await db.vendorMember.findFirstOrThrow({ where: { userId: ownerId } })).vendorId;
  otherVendorId = (await db.vendor.findFirstOrThrow({ where: { id: { not: vendorId } } })).id;
  menuItemId = (await db.menuItem.findFirstOrThrow({ where: { vendorId } })).id;
  simId = (
    await db.user.findFirstOrThrow({
      where: { email: { endsWith: `@${SIM_EMAIL_DOMAIN}` } },
      select: { id: true },
    })
  ).id;
  await db.order.deleteMany({ where: { studentId } });
  const clock = await db.systemClock.findUniqueOrThrow({ where: { id: 1 } });
  originalClock = { mode: clock.mode, currentTime: clock.currentTime, speed: clock.speed };
  await db.systemClock.update({
    where: { id: 1 },
    data: { mode: 'demo', currentTime: new Date(NOW), speed: 0, updatedAt: new Date() },
  });
}, 180_000);

afterAll(async () => {
  await db.order.deleteMany({ where: { studentId } });
  await db.order.deleteMany({ where: { studentId: simId, placedAt: new Date(NOW - 7 * MINUTE) } });
  if (originalClock) await db.systemClock.update({ where: { id: 1 }, data: originalClock });
  await db.session.deleteMany({
    where: { user: { email: { in: DEMO_ACCOUNTS.map((a) => a.email) } } },
  });
  await db.$disconnect();
});

describe('who can read the sales', () => {
  it('lets the owner of that vendor only', async () => {
    expect((await get('today')).status).toBe(200);
    expect((await get('today', 'staff')).status).toBe(403);
    expect((await get('today', 'student')).status).toBe(403);
    expect((await get('today', 'admin')).status).toBe(403);
    expect((await get('today', null)).status).toBe(401);
    expect((await get('today', 'owner', otherVendorId)).status).toBe(403);
  });

  it('checks the period and the vendor id', async () => {
    expect((await get('month')).status).toBe(400);
    expect((await get('')).status).toBe(400);
    expect((await get('today', 'owner', 'not-a-uuid')).status).toBe(400);
    expect((await get(null)).json.range).toBe('today');
  });
});

describe('the demo is never empty', () => {
  it('has sample orders for this vendor for today and for the last 7 days, and no one else', async () => {
    const week = await get('7d');
    const today = await get('today');
    const start = new Date(MIDNIGHT - 6 * 86_400_000);
    expect(week.json.counts.sample).toBe(
      await db.sampleVendorOrder.count({ where: { vendorId, placedAt: { gte: start } } }),
    );
    expect(week.json.counts.sample).toBeGreaterThan(today.json.counts.sample);
    expect(today.json.counts.sample).toBeGreaterThan(0);
    expect(today.json.today.orders).toBeGreaterThan(0);
    expect(today.json.top.length).toBeGreaterThan(0);
    expect(today.json.hourly.some((bar) => bar.orders > 0)).toBe(true);
    expect(week.json.sampleOrders.length).toBeLessThanOrEqual(100);
  });
});

describe('real orders sit apart from the sample data', () => {
  it('lists an app order above the sample data, counts it in the totals, and leaves out the simulated walk-in load', async () => {
    const before = (await get('today')).json;
    const real = await order(studentId, 'completed', 40, 10);
    const cancelled = await order(studentId, 'cancelled', 90, 9);
    const simulated = await order(simId, 'completed', 500, 7);
    const after = (await get('today')).json;

    expect(after.appOrders.map((entry) => entry.id).sort()).toEqual([cancelled, real].sort());
    expect(after.appOrders.some((entry) => entry.id === simulated)).toBe(false);
    expect(after.counts.app).toBe(2);
    expect(after.counts.sample).toBe(before.counts.sample);
    expect(after.sampleOrders.map((entry) => entry.id)).toEqual(
      before.sampleOrders.map((entry) => entry.id),
    );
    expect(after.today.orders).toBe(before.today.orders + 1);
    expect(after.today.revenueHkd).toBe(before.today.revenueHkd + 40);
    expect(after.appOrders.find((entry) => entry.id === cancelled)?.status).toBe('cancelled');
    expect(after.appOrders.find((entry) => entry.id === real)?.items).toEqual([
      expect.objectContaining({ qty: 2 }),
    ]);
  });

  it("shows another vendor's real orders to nobody here", async () => {
    await order(studentId, 'completed', 60, 5, otherVendorId);
    const mine = (await get('today')).json;
    expect(mine.appOrders.every((entry) => entry.totalHkd !== 60)).toBe(true);
  });

  it("loses a deleted student's orders from the list and keeps the sample data as it was", async () => {
    const before = (await get('today')).json;
    await db.order.deleteMany({ where: { studentId } });
    const after = (await get('today')).json;
    expect(after.appOrders).toEqual([]);
    expect(after.counts.sample).toBe(before.counts.sample);
    expect(after.sampleOrders).toEqual(before.sampleOrders);
  });
});
