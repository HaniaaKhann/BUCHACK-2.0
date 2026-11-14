import { DEMO_ACCOUNTS, PrismaClient } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as listRoute, PATCH as readRoute } from '../src/app/api/notifications/route';
import { PATCH as actionRoute } from '../src/app/api/vendor/[id]/orders/[orderId]/[action]/route';
import { asAccount, jsonInit, prepareSessions, type AccountKey } from './support/session';

const db = new PrismaClient();
let cookies = new Map<AccountKey, string>();
let studentId = '';
let ownerId = '';
let vendorId = '';
let menuItemId = '';
let orderId = '';
let originalClock: { mode: 'real' | 'demo'; currentTime: Date; speed: number } | null = null;

const NOW = Date.UTC(2026, 10, 17, 4, 15);

interface ListBody {
  notifications: { id: string; kind: string; title: string; read: boolean; createdAt: number }[];
  unread: number;
}

async function list(
  key: AccountKey | null = 'student',
): Promise<{ status: number; body: ListBody }> {
  const response = await listRoute(asAccount(cookies, '/api/notifications', key));
  return { status: response.status, body: (await response.json()) as ListBody };
}

async function read(body: unknown, key: AccountKey | null = 'student'): Promise<number> {
  const response = await readRoute(
    asAccount(cookies, '/api/notifications', key, jsonInit('PATCH', body)),
  );
  return response.status;
}

async function vendorAction(action: string): Promise<number> {
  const path = `/api/vendor/${vendorId}/orders/${orderId}/${action}`;
  const response = await actionRoute(asAccount(cookies, path, 'owner', { method: 'PATCH' }), {
    params: Promise.resolve({ id: vendorId, orderId, action } as never),
  });
  return response.status;
}

beforeAll(async () => {
  cookies = await prepareSessions();
  studentId = DEMO_ACCOUNTS.find((account) => account.role === 'student')?.id ?? '';
  ownerId = DEMO_ACCOUNTS.find((account) => account.role === 'vendor_owner')?.id ?? '';
  vendorId = (await db.vendorMember.findFirstOrThrow({ where: { userId: ownerId } })).vendorId;
  menuItemId = (await db.menuItem.findFirstOrThrow({ where: { vendorId } })).id;
  const clock = await db.systemClock.findUniqueOrThrow({ where: { id: 1 } });
  originalClock = { mode: clock.mode, currentTime: clock.currentTime, speed: clock.speed };
  await db.systemClock.update({
    where: { id: 1 },
    data: { mode: 'demo', currentTime: new Date(NOW), speed: 0 },
  });
  await db.notification.deleteMany({ where: { userId: { in: [studentId, ownerId] } } });
  await db.order.deleteMany({ where: { studentId } });
  const order = await db.order.create({
    data: {
      studentId,
      vendorId,
      status: 'placed',
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
  orderId = order.id;
}, 180_000);

afterAll(async () => {
  await db.notification.deleteMany({ where: { userId: { in: [studentId, ownerId] } } });
  await db.order.deleteMany({ where: { studentId } });
  if (originalClock) await db.systemClock.update({ where: { id: 1 }, data: originalClock });
  await db.session.deleteMany({});
  await db.$disconnect();
});

describe('who can read notifications', () => {
  it('lets only a student, and shows an empty list at first', async () => {
    expect(await list()).toEqual({ status: 200, body: { notifications: [], unread: 0 } });
    for (const key of ['owner', 'staff', 'admin'] as const) {
      expect((await list(key)).status).toBe(403);
      expect(await read({ all: true }, key)).toBe(403);
    }
    expect((await list(null)).status).toBe(401);
    expect(await read({ all: true }, null)).toBe(401);
  });
});

describe('notifications made by the vendor taps', () => {
  it('creates one notification per status change, stamped with the demo clock, and none for a repeated tap', async () => {
    expect(await vendorAction('accept')).toBe(200);
    expect(await vendorAction('accept')).toBe(200);
    expect(await vendorAction('preparing')).toBe(200);
    expect(await vendorAction('ready')).toBe(200);
    expect(await vendorAction('picked-up')).toBe(200);
    expect(await vendorAction('picked-up')).toBe(200);

    const { body } = await list();
    expect(body.unread).toBe(4);
    expect(body.notifications.map((item) => item.kind).sort()).toEqual([
      'order_accepted',
      'order_picked_up',
      'order_preparing',
      'order_ready',
    ]);
    expect(body.notifications.every((item) => !item.read && item.createdAt === NOW)).toBe(true);
    const ready = body.notifications.find((item) => item.kind === 'order_ready');
    expect(ready?.title).toBe('Order ready');
  });

  it('creates nothing when the tap is refused', async () => {
    const before = (await list()).body.unread;
    expect(await vendorAction('ready')).toBe(409);
    expect((await list()).body.unread).toBe(before);
  });
});

describe('marking notifications read', () => {
  it('marks one, then the rest, and never touches another user', async () => {
    const mine = (await list()).body.notifications;
    const other = await db.notification.create({
      data: {
        userId: ownerId,
        kind: 'order_ready',
        title: 'Not yours',
        body: 'Another user',
        link: null,
        createdAt: new Date(NOW),
      },
    });

    expect(await read({ ids: [other.id] })).toBe(200);
    expect(
      (await db.notification.findUniqueOrThrow({ where: { id: other.id } })).readAt,
    ).toBeNull();

    const first = mine[0];
    expect(await read({ ids: [first?.id ?? ''] })).toBe(200);
    const afterOne = (await list()).body;
    expect(afterOne.unread).toBe(3);
    expect(afterOne.notifications.find((item) => item.id === first?.id)?.read).toBe(true);

    expect(await read({ all: true })).toBe(200);
    const afterAll = (await list()).body;
    expect(afterAll.unread).toBe(0);
    expect(afterAll.notifications.every((item) => item.read)).toBe(true);
    expect(
      (await db.notification.findUniqueOrThrow({ where: { id: other.id } })).readAt,
    ).toBeNull();
    const marked = await db.notification.findFirstOrThrow({ where: { userId: studentId } });
    expect(marked.readAt?.getTime()).toBe(NOW);
  });

  it('rejects anything but all or a list of ids', async () => {
    const uuids = Array.from({ length: 51 }, () => '0f8fad5b-d9cb-469f-a165-70867728950e');
    for (const body of [
      {},
      { all: false },
      { ids: [] },
      { ids: ['nope'] },
      { ids: uuids },
      { all: true, extra: 1 },
      'all',
    ]) {
      expect(await read(body), JSON.stringify(body)).toBe(400);
    }
  });
});
