import { DEMO_ACCOUNTS, PrismaClient } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as listRoute } from '../src/app/api/vendor/[id]/orders/route';
import { PATCH as actionRoute } from '../src/app/api/vendor/[id]/orders/[orderId]/[action]/route';
import { asAccount, prepareSessions, type AccountKey } from './support/session';

const db = new PrismaClient();
let cookies = new Map<AccountKey, string>();
let vendorId = '';
let otherVendorId = '';
let studentId = '';
let menuItemId = '';

const NOW = Date.UTC(2026, 10, 17, 4, 15);

const ctx = (params: Record<string, string>): { params: Promise<never> } => ({
  params: Promise.resolve(params as never),
});

async function createOrder(
  status: 'placed' | 'ready' | 'picked_up',
  target = vendorId,
): Promise<string> {
  const order = await db.order.create({
    data: {
      studentId,
      vendorId: target,
      status,
      totalHkd: 20,
      placedAt: new Date(NOW),
      predictedPoint: new Date(NOW + 360_000),
      predictedLow: new Date(NOW + 240_000),
      predictedHigh: new Date(NOW + 540_000),
      predictedBase: new Date(NOW + 300_000),
      backlogAtPlacement: 0,
      modelVersion: 'v2',
      items: { create: [{ menuItemId, qty: 1, priceHkdSnapshot: 20, prepPriorSnapshotMin: 3 }] },
    },
  });
  return order.id;
}

async function act(
  orderId: string,
  action: string,
  key: AccountKey | null = 'owner',
  vendor = vendorId,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const path = `/api/vendor/${vendor}/orders/${orderId}/${action}`;
  const response = await actionRoute(
    asAccount(cookies, path, key, { method: 'PATCH' }),
    ctx({ id: vendor, orderId, action }),
  );
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

beforeAll(async () => {
  cookies = await prepareSessions();
  studentId = DEMO_ACCOUNTS.find((account) => account.role === 'student')?.id ?? '';
  const ownerId = DEMO_ACCOUNTS.find((account) => account.email.startsWith('owner@'))?.id ?? '';
  const membership = await db.vendorMember.findFirstOrThrow({ where: { userId: ownerId } });
  vendorId = membership.vendorId;
  const other = await db.vendor.findFirstOrThrow({ where: { id: { not: vendorId } } });
  otherVendorId = other.id;
  menuItemId = (await db.menuItem.findFirstOrThrow({ where: { vendorId } })).id;
  await db.order.deleteMany({ where: { studentId } });
}, 180_000);

afterAll(async () => {
  await db.order.deleteMany({ where: { studentId } });
  await db.session.deleteMany({
    where: { user: { email: { in: DEMO_ACCOUNTS.map((a) => a.email) } } },
  });
  await db.$disconnect();
});

describe('vendor picked-up route', () => {
  it('moves a ready order to picked_up and stamps the time', async () => {
    const id = await createOrder('ready');
    const result = await act(id, 'picked-up');
    expect(result).toMatchObject({ status: 200, json: { status: 'picked_up' } });
    const row = await db.order.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('picked_up');
    expect(row.pickedUpAt).not.toBeNull();
  });

  it('refuses an order that is not ready with 409 wrong_state and leaves it unchanged', async () => {
    const id = await createOrder('placed');
    const result = await act(id, 'picked-up');
    expect(result).toMatchObject({ status: 409, json: { error: 'wrong_state', status: 'placed' } });
    expect((await db.order.findUniqueOrThrow({ where: { id } })).status).toBe('placed');
  });

  it('treats a second tap as done without an error', async () => {
    const id = await createOrder('picked_up');
    expect(await act(id, 'picked-up')).toMatchObject({ status: 200 });
  });

  it('refuses another vendor, a student, nobody and an unknown action', async () => {
    const id = await createOrder('ready');
    expect((await act(id, 'picked-up', 'owner', otherVendorId)).status).toBe(403);
    expect((await act(id, 'picked-up', 'student')).status).toBe(403);
    expect((await act(id, 'picked-up', null)).status).toBe(401);
    expect((await act(id, 'explode')).status).toBe(400);
    expect((await db.order.findUniqueOrThrow({ where: { id } })).status).toBe('ready');
  });

  it('lists only active orders for the vendor board', async () => {
    const id = await createOrder('ready');
    const response = await listRoute(
      asAccount(cookies, `/api/vendor/${vendorId}/orders`, 'owner'),
      { params: Promise.resolve({ id: vendorId }) },
    );
    const json = (await response.json()) as { orders: { id: string; status: string }[] };
    expect(json.orders.find((order) => order.id === id)?.status).toBe('ready');
    expect(json.orders.every((order) => order.status !== 'picked_up')).toBe(true);
  });
});
