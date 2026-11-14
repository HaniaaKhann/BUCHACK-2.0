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
let originalClock: { mode: 'real' | 'demo'; currentTime: Date; speed: number } | null = null;

const NOW = Date.UTC(2026, 10, 17, 4, 15);
const MINUTE = 60_000;

const ctx = (params: Record<string, string>): { params: Promise<never> } => ({
  params: Promise.resolve(params as never),
});

async function createOrder(
  status: 'placed' | 'preparing' | 'ready' | 'completed' | 'picked_up',
  readyAt: number | null = null,
): Promise<string> {
  const order = await db.order.create({
    data: {
      studentId,
      vendorId,
      status,
      totalHkd: 20,
      placedAt: new Date(NOW),
      readyAt: readyAt === null ? null : new Date(readyAt),
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

interface Board {
  status: number;
  json: {
    orders: { id: string; status: string }[];
    done: { id: string; status: string; readyAt: number }[];
  };
}

async function getBoard(key: AccountKey | null = 'owner', vendor = vendorId): Promise<Board> {
  const response = await listRoute(asAccount(cookies, `/api/vendor/${vendor}/orders`, key), {
    params: Promise.resolve({ id: vendor }),
  });
  return { status: response.status, json: (await response.json()) as Board['json'] };
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
  const clock = await db.systemClock.findUniqueOrThrow({ where: { id: 1 } });
  originalClock = { mode: clock.mode, currentTime: clock.currentTime, speed: clock.speed };
  await db.systemClock.update({
    where: { id: 1 },
    data: { mode: 'demo', currentTime: new Date(NOW), speed: 0, updatedAt: new Date() },
  });
}, 180_000);

afterAll(async () => {
  await db.order.deleteMany({ where: { studentId } });
  if (originalClock) await db.systemClock.update({ where: { id: 1 }, data: originalClock });
  await db.session.deleteMany({
    where: { user: { email: { in: DEMO_ACCOUNTS.map((a) => a.email) } } },
  });
  await db.$disconnect();
});

describe('the vendor Ready tap is the last step', () => {
  it('moves a preparing order to ready, stamps ready_at, and the order leaves the board', async () => {
    const id = await createOrder('preparing');
    expect(await act(id, 'ready')).toMatchObject({ status: 200, json: { status: 'ready' } });
    const row = await db.order.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('ready');
    expect(row.readyAt).not.toBeNull();
    expect(row.pickedUpAt).toBeNull();
    const board = await getBoard();
    expect(board.json.orders.some((order) => order.id === id)).toBe(false);
    expect(board.json.done.find((order) => order.id === id)?.status).toBe('ready');
  });

  it('has no picked-up action any more, for anyone', async () => {
    const id = await createOrder('ready', NOW);
    for (const key of ['owner', 'staff', 'student', 'admin'] as const) {
      expect((await act(id, 'picked-up', key)).status, key).toBe(400);
    }
    expect((await act(id, 'picked-up', null)).status).toBe(400);
    expect((await db.order.findUniqueOrThrow({ where: { id } })).status).toBe('ready');
  });

  it('refuses ready from any other state, and treats a repeat as done', async () => {
    const placed = await createOrder('placed');
    expect(await act(placed, 'ready')).toMatchObject({
      status: 409,
      json: { error: 'wrong_state', status: 'placed' },
    });
    expect((await db.order.findUniqueOrThrow({ where: { id: placed } })).status).toBe('placed');
    const already = await createOrder('ready', NOW);
    expect(await act(already, 'ready')).toMatchObject({ status: 200 });
  });

  it('refuses another vendor, a student, an admin and nobody', async () => {
    const id = await createOrder('preparing');
    expect((await act(id, 'ready', 'owner', otherVendorId)).status).toBe(403);
    expect((await act(id, 'ready', 'student')).status).toBe(403);
    expect((await act(id, 'ready', 'admin')).status).toBe(403);
    expect((await act(id, 'ready', null)).status).toBe(401);
    expect((await act(id, 'explode')).status).toBe(400);
    expect((await db.order.findUniqueOrThrow({ where: { id } })).status).toBe('preparing');
  });
});

describe('the vendor board and Done today', () => {
  it("keeps only active orders on the board and lists today's ready and completed orders as done, for owner and staff", async () => {
    const waiting = await createOrder('ready', NOW - 5 * MINUTE);
    const completed = await createOrder('completed', NOW - 40 * MINUTE);
    const legacy = await createOrder('picked_up', NOW - 50 * MINUTE);
    const yesterday = await createOrder('completed', NOW - 26 * 60 * MINUTE);
    for (const key of ['owner', 'staff'] as const) {
      const board = await getBoard(key);
      expect(board.status).toBe(200);
      for (const order of board.json.orders) {
        expect(['placed', 'accepted', 'preparing']).toContain(order.status);
      }
      const done = new Map(board.json.done.map((order) => [order.id, order.status]));
      expect(done.get(waiting)).toBe('ready');
      expect(done.get(completed)).toBe('completed');
      expect(done.get(legacy)).toBe('completed');
      expect(done.has(yesterday)).toBe(false);
    }
  });

  it('shows a vendor nothing of another vendor', async () => {
    expect((await getBoard('owner', otherVendorId)).status).toBe(403);
  });
});
