import { DEMO_ACCOUNTS, PrismaClient } from '@app/db';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PATCH as cancelRoute } from '../src/app/api/orders/[id]/cancel/route';
import { PATCH as pickUpRoute } from '../src/app/api/orders/[id]/pick-up/route';
import { GET as getOrderRoute } from '../src/app/api/orders/[id]/route';
import { GET as listOrdersRoute, POST as postOrderRoute } from '../src/app/api/orders/route';
import { GET as slotsRoute } from '../src/app/api/slots/[vendorId]/route';
import { GET as walletRoute } from '../src/app/api/wallet/me/route';
import { createTokenBuckets, type TokenBuckets } from '../src/server/tokenBucket';
import {
  ALL_ACCOUNTS,
  asAccount,
  jsonInit,
  prepareSessions,
  type AccountKey,
} from './support/session';

const db = new PrismaClient();
let cookies = new Map<AccountKey, string>();
let studentId = '';
let mainCanteenId = '';
let itemA = { id: '', priceHkd: 0 };
let itemB = { id: '', priceHkd: 0 };
let otherVendorItemId = '';
let originalClock: { mode: 'real' | 'demo'; currentTime: Date; speed: number } | null = null;

const NOW = Date.UTC(2026, 10, 17, 4, 15);
const MINUTE = 60_000;
const SLOT = 15 * MINUTE;

type Json = Record<string, unknown>;
const globalBuckets = globalThis as unknown as { orderBuckets?: TokenBuckets };
const unlimited: TokenBuckets = { take: () => true };

const request = (path: string, key: AccountKey | null, init?: RequestInit): Request =>
  asAccount(cookies, path, key, init);
const ctx = <T extends Record<string, string>>(params: T): { params: Promise<T> } => ({
  params: Promise.resolve(params),
});

async function placeOrder(
  body: unknown,
  key: AccountKey | null = 'student',
): Promise<{ status: number; json: Json }> {
  const response = await postOrderRoute(request('/api/orders', key, jsonInit('POST', body)));
  return { status: response.status, json: (await response.json()) as Json };
}

const asap = (
  items: { menuItemId: string; qty: number }[] = [{ menuItemId: itemA.id, qty: 1 }],
): Json => ({
  vendorId: mainCanteenId,
  items,
  pickup: { kind: 'asap' },
});

const scheduled = (slotStart: number, qty = 1): Json => ({
  vendorId: mainCanteenId,
  items: [{ menuItemId: itemA.id, qty }],
  pickup: { kind: 'scheduled', slotStart },
});

async function patch(
  route: typeof cancelRoute,
  id: string,
  key: AccountKey | null = 'student',
): Promise<{ status: number; json: Json }> {
  const response = await route(request(`/api/orders/${id}`, key, { method: 'PATCH' }), ctx({ id }));
  return { status: response.status, json: (await response.json()) as Json };
}

async function setBalance(hkd: number): Promise<void> {
  await db.walletLedger.deleteMany({ where: { userId: studentId } });
  await db.walletLedger.create({
    data: {
      userId: studentId,
      deltaHkd: hkd,
      reason: 'seed',
      createdAt: new Date(NOW - 3_600_000),
    },
  });
}

async function balance(): Promise<number> {
  const total = await db.walletLedger.aggregate({
    where: { userId: studentId },
    _sum: { deltaHkd: true },
  });
  return total._sum.deltaHkd ?? 0;
}

async function cleanOrders(): Promise<void> {
  await db.walletLedger.deleteMany({ where: { userId: studentId } });
  await db.order.deleteMany({ where: { studentId } });
  await db.pickupSlot.deleteMany({ where: { vendorId: mainCanteenId } });
}

function orderOf(json: Json): Json {
  return json['order'] as Json;
}

beforeAll(async () => {
  cookies = await prepareSessions();
  studentId = DEMO_ACCOUNTS.find((account) => account.role === 'student')?.id ?? '';
  const clock = await db.systemClock.findUniqueOrThrow({ where: { id: 1 } });
  originalClock = { mode: clock.mode, currentTime: clock.currentTime, speed: clock.speed };
  await db.systemClock.update({
    where: { id: 1 },
    data: { mode: 'demo', currentTime: new Date(NOW), speed: 0 },
  });
  await db.engineSnapshot.deleteMany({});

  const mainCanteen = await db.vendor.findUniqueOrThrow({ where: { name: 'Main Canteen' } });
  mainCanteenId = mainCanteen.id;
  const [first, second] = await db.menuItem.findMany({
    where: { vendorId: mainCanteenId, stockStatus: 'in_stock', deletedAt: null },
    orderBy: { priceHkd: 'asc' },
    take: 2,
  });
  itemA = { id: first?.id ?? '', priceHkd: first?.priceHkd ?? 0 };
  itemB = { id: second?.id ?? '', priceHkd: second?.priceHkd ?? 0 };
  const bistro = await db.vendor.findUniqueOrThrow({ where: { name: 'Bistro NTT' } });
  otherVendorItemId = (await db.menuItem.findFirstOrThrow({ where: { vendorId: bistro.id } })).id;
  globalBuckets.orderBuckets = unlimited;
  await cleanOrders();
  await setBalance(300);
}, 180_000);

afterAll(async () => {
  await cleanOrders();
  await db.vendor.update({ where: { id: mainCanteenId }, data: { paused: false } });
  await db.menuItem.updateMany({
    where: { vendorId: mainCanteenId },
    data: { stockStatus: 'in_stock', deletedAt: null },
  });
  if (originalClock) await db.systemClock.update({ where: { id: 1 }, data: originalClock });
  await db.session.deleteMany({
    where: { user: { email: { in: DEMO_ACCOUNTS.map((a) => a.email) } } },
  });
  await db.$disconnect();
});

describe('student-only order routes', () => {
  it('give 200 or the proper error to a student, 403 to the other roles and 401 to nobody', async () => {
    const unknown = '00000000-0000-4000-8000-000000000000';
    const calls: {
      name: string;
      run: (key: AccountKey | null) => Promise<Response>;
      ok: number;
    }[] = [
      { name: 'GET /api/orders', run: (k) => listOrdersRoute(request('/api/orders', k)), ok: 200 },
      {
        name: 'POST /api/orders',
        run: (k) => postOrderRoute(request('/api/orders', k, jsonInit('POST', {}))),
        ok: 400,
      },
      {
        name: 'GET /api/orders/:id',
        run: (k) => getOrderRoute(request(`/api/orders/${unknown}`, k), ctx({ id: unknown })),
        ok: 404,
      },
      {
        name: 'PATCH cancel',
        run: (k) =>
          cancelRoute(
            request(`/api/orders/${unknown}`, k, { method: 'PATCH' }),
            ctx({ id: unknown }),
          ),
        ok: 404,
      },
      {
        name: 'PATCH pick-up',
        run: (k) =>
          pickUpRoute(
            request(`/api/orders/${unknown}`, k, { method: 'PATCH' }),
            ctx({ id: unknown }),
          ),
        ok: 404,
      },
      {
        name: 'GET /api/wallet/me',
        run: (k) => walletRoute(request('/api/wallet/me', k)),
        ok: 200,
      },
      {
        name: 'GET /api/slots/:vendor',
        run: (k) =>
          slotsRoute(request(`/api/slots/${mainCanteenId}`, k), ctx({ vendorId: mainCanteenId })),
        ok: 200,
      },
    ];
    for (const call of calls) {
      for (const key of ALL_ACCOUNTS) {
        expect((await call.run(key)).status, `${call.name} as ${key}`).toBe(
          key === 'student' ? call.ok : 403,
        );
      }
      expect((await call.run(null)).status, `${call.name} anonymous`).toBe(401);
    }
  });
});

describe('placing an ASAP order', () => {
  it('prices from the database, charges the wallet once, stores the prediction inputs and notifies', async () => {
    const listener = new pg.Client({ connectionString: process.env['DATABASE_URL'] });
    await listener.connect();
    const messages: string[] = [];
    listener.on('notification', (message) => messages.push(message.payload ?? ''));
    await listener.query('LISTEN order_changed');

    const { status, json } = await placeOrder(asap([{ menuItemId: itemA.id, qty: 2 }]));
    expect(status).toBe(201);
    const order = orderOf(json);
    const total = 2 * itemA.priceHkd;
    expect(order).toMatchObject({
      status: 'placed',
      totalHkd: total,
      canCancel: true,
      canPickUp: false,
    });
    expect(order['graceSecondsLeft']).toBeLessThanOrEqual(60);

    const row = await db.order.findUniqueOrThrow({
      where: { id: String(order['id']) },
      include: { items: true },
    });
    expect(row.studentId).toBe(studentId);
    expect(row.modelVersion).toBe('v2');
    expect(row.fireAt).toBeNull();
    expect(row.slotStart).toBeNull();
    expect(row.backlogAtPlacement).toBeGreaterThanOrEqual(0);
    expect(row.placedAt.getTime()).toBe(NOW);
    expect(row.predictedLow.getTime()).toBeLessThanOrEqual(row.predictedPoint.getTime());
    expect(row.predictedPoint.getTime()).toBeLessThanOrEqual(row.predictedHigh.getTime());
    expect(row.predictedBase.getTime()).toBeGreaterThanOrEqual(NOW);
    expect(row.items).toHaveLength(1);
    expect(row.items[0]).toMatchObject({ qty: 2, priceHkdSnapshot: itemA.priceHkd });

    const ledger = await db.walletLedger.findMany({ where: { refOrderId: row.id } });
    expect(ledger.map((entry) => [entry.reason, entry.deltaHkd])).toEqual([['pay', -total]]);
    expect(await balance()).toBe(300 - total);

    await new Promise((resolve) => setTimeout(resolve, 500));
    await listener.end();
    expect(messages.map((payload) => JSON.parse(payload))).toContainEqual({
      orderId: row.id,
      vendorId: mainCanteenId,
      studentId,
      status: 'placed',
    });
  });

  it('lists the order and shows it by id with names and the price paid', async () => {
    const { orders } = (await (
      await listOrdersRoute(request('/api/orders', 'student'))
    ).json()) as { orders: Json[] };
    expect(orders.length).toBeGreaterThan(0);
    const id = String(orders[0]?.['id']);
    const response = await getOrderRoute(request(`/api/orders/${id}`, 'student'), ctx({ id }));
    const order = orderOf((await response.json()) as Json);
    expect(order['vendor']).toMatchObject({ id: mainCanteenId, name: 'Main Canteen' });
    expect((order['items'] as Json[])[0]).toMatchObject({ qty: 2, priceHkd: itemA.priceHkd });
  });

  it('refuses requests it should not trust or cannot serve, without charging', async () => {
    const before = await balance();
    const fiesta = await db.vendor.findUniqueOrThrow({ where: { name: 'BU Fiesta' } });
    const bad: [string, unknown, number, string][] = [
      ['client price', { ...asap(), totalHkd: 1 }, 400, ''],
      ['quantity over the limit', asap([{ menuItemId: itemA.id, qty: 6 }]), 400, ''],
      [
        'same item twice',
        asap([
          { menuItemId: itemA.id, qty: 1 },
          { menuItemId: itemA.id, qty: 1 },
        ]),
        400,
        '',
      ],
      ['hidden vendor', { ...asap(), vendorId: fiesta.id }, 409, 'vendor_unavailable'],
      [
        'unknown vendor',
        { ...asap(), vendorId: '00000000-0000-4000-8000-000000000000' },
        409,
        'vendor_unavailable',
      ],
      [
        'item from another vendor',
        asap([{ menuItemId: otherVendorItemId, qty: 1 }]),
        409,
        'item_unavailable',
      ],
    ];
    for (const [label, body, status, code] of bad) {
      const result = await placeOrder(body);
      expect(result.status, label).toBe(status);
      if (code) expect(result.json['error'], label).toBe(code);
    }
    expect(await balance()).toBe(before);
  });

  it('refuses an out of stock or removed item, a paused vendor and a closed vendor', async () => {
    const before = await balance();
    await db.menuItem.update({ where: { id: itemA.id }, data: { stockStatus: 'out_of_stock' } });
    expect((await placeOrder(asap())).json['error']).toBe('item_unavailable');
    await db.menuItem.update({
      where: { id: itemA.id },
      data: { stockStatus: 'in_stock', deletedAt: new Date() },
    });
    expect((await placeOrder(asap())).json['error']).toBe('item_unavailable');
    await db.menuItem.update({ where: { id: itemA.id }, data: { deletedAt: null } });

    await db.vendor.update({ where: { id: mainCanteenId }, data: { paused: true } });
    expect((await placeOrder(asap())).json['error']).toBe('vendor_paused');
    await db.vendor.update({ where: { id: mainCanteenId }, data: { paused: false } });

    await db.systemClock.update({
      where: { id: 1 },
      data: { currentTime: new Date('2026-11-16T19:00:00Z') },
    });
    expect((await placeOrder(asap())).json['error']).toBe('vendor_closed');
    await db.systemClock.update({ where: { id: 1 }, data: { currentTime: new Date(NOW) } });
    expect(await balance()).toBe(before);
  });

  it('refuses a total over the limit', async () => {
    const dear = await db.menuItem.findMany({
      where: { vendorId: mainCanteenId, stockStatus: 'in_stock', deletedAt: null },
      orderBy: { priceHkd: 'desc' },
      take: 8,
    });
    const items = dear.map((item) => ({ menuItemId: item.id, qty: 5 }));
    const result = await placeOrder(asap(items));
    expect(result).toMatchObject({ status: 400, json: { error: 'total_too_high' } });
  });

  it('refuses with 402 and writes nothing when the wallet is too low', async () => {
    await cleanOrders();
    await setBalance(itemA.priceHkd - 1);
    const result = await placeOrder(asap());
    expect(result).toMatchObject({
      status: 402,
      json: {
        error: 'insufficient_balance',
        balanceHkd: itemA.priceHkd - 1,
        totalHkd: itemA.priceHkd,
      },
    });
    expect(await db.order.count({ where: { studentId } })).toBe(0);
    expect(await balance()).toBe(itemA.priceHkd - 1);
    await setBalance(300);
  });

  it('never lets two simultaneous orders spend more than the balance', async () => {
    await cleanOrders();
    await setBalance(Math.floor(itemA.priceHkd * 1.5));
    const results = await Promise.all([placeOrder(asap()), placeOrder(asap())]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 402]);
    expect(await db.order.count({ where: { studentId } })).toBe(1);
    expect(await balance()).toBeGreaterThanOrEqual(0);
    await cleanOrders();
    await setBalance(300);
  });

  it('limits how fast one student can place orders', async () => {
    globalBuckets.orderBuckets = createTokenBuckets({ capacity: 5, refillPerSecond: 0.0001 });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) statuses.push((await placeOrder({})).status);
    expect(statuses).toEqual([400, 400, 400, 400, 400, 429]);
    globalBuckets.orderBuckets = unlimited;
  });
});

describe('cancel and pick up', () => {
  it('refunds in full when cancelled inside the grace window, and only once', async () => {
    await cleanOrders();
    await setBalance(300);
    const id = String(
      orderOf((await placeOrder(asap([{ menuItemId: itemB.id, qty: 1 }]))).json)['id'],
    );
    expect(await balance()).toBe(300 - itemB.priceHkd);

    const cancelled = await patch(cancelRoute, id);
    expect(cancelled.status).toBe(200);
    expect(orderOf(cancelled.json)).toMatchObject({ status: 'cancelled', canCancel: false });
    expect(await balance()).toBe(300);

    expect((await patch(cancelRoute, id)).status).toBe(200);
    expect(await balance()).toBe(300);
    const reasons = (await db.walletLedger.findMany({ where: { refOrderId: id } }))
      .map((row) => row.reason)
      .sort();
    expect(reasons).toEqual(['pay', 'refund']);
  });

  it('cannot cancel once the order is accepted, and nothing is refunded', async () => {
    const id = String(orderOf((await placeOrder(asap())).json)['id']);
    await db.order.update({
      where: { id },
      data: { status: 'accepted', acceptedAt: new Date(NOW) },
    });
    const before = await balance();
    expect(await patch(cancelRoute, id)).toMatchObject({
      status: 409,
      json: { error: 'not_cancellable' },
    });
    expect(await balance()).toBe(before);
  });

  it('completes from ready only, idempotently, and refuses in every earlier state', async () => {
    const placed = String(orderOf((await placeOrder(asap())).json)['id']);
    for (const earlier of ['placed', 'accepted', 'preparing'] as const) {
      await db.order.update({ where: { id: placed }, data: { status: earlier } });
      expect(await patch(pickUpRoute, placed)).toMatchObject({
        status: 409,
        json: { error: 'not_ready' },
      });
    }
    expect((await db.order.findUniqueOrThrow({ where: { id: placed } })).pickedUpAt).toBeNull();

    await db.order.update({
      where: { id: placed },
      data: { status: 'ready', readyAt: new Date(NOW) },
    });
    const first = await patch(pickUpRoute, placed);
    expect(first.status).toBe(200);
    expect(orderOf(first.json)).toMatchObject({ status: 'completed', canPickUp: false });
    expect(orderOf(first.json)['pickedUpAt']).not.toBeNull();
    const again = await patch(pickUpRoute, placed);
    expect(again.status).toBe(200);
    expect(orderOf(again.json)['pickedUpAt']).toBe(orderOf(first.json)['pickedUpAt']);
  });

  it('refuses to pick up a cancelled order', async () => {
    const id = String(orderOf((await placeOrder(asap())).json)['id']);
    await patch(cancelRoute, id);
    expect(await patch(pickUpRoute, id)).toMatchObject({
      status: 409,
      json: { error: 'not_ready' },
    });
  });

  it('shows another student order as not found for every action', async () => {
    const other = await db.order.create({
      data: {
        studentId: 'demo-admin',
        vendorId: mainCanteenId,
        status: 'placed',
        totalHkd: 10,
        placedAt: new Date(NOW),
        predictedPoint: new Date(NOW),
        predictedLow: new Date(NOW),
        predictedHigh: new Date(NOW),
        predictedBase: new Date(NOW),
        backlogAtPlacement: 0,
        modelVersion: 'v2',
      },
    });
    const response = await getOrderRoute(
      request(`/api/orders/${other.id}`, 'student'),
      ctx({ id: other.id }),
    );
    expect(response.status).toBe(404);
    expect((await patch(cancelRoute, other.id)).status).toBe(404);
    expect((await patch(pickUpRoute, other.id)).status).toBe(404);
    await db.order.delete({ where: { id: other.id } });
  });
});

describe('wallet', () => {
  it('reports the balance as the sum of the ledger with the newest entries first', async () => {
    await cleanOrders();
    await setBalance(300);
    const id = String(orderOf((await placeOrder(asap())).json)['id']);
    const wallet = (await (await walletRoute(request('/api/wallet/me', 'student'))).json()) as {
      balanceHkd: number;
      entries: { reason: string; deltaHkd: number; orderId: string | null }[];
    };
    expect(wallet.balanceHkd).toBe(300 - itemA.priceHkd);
    expect(wallet.entries[0]).toMatchObject({
      reason: 'pay',
      deltaHkd: -itemA.priceHkd,
      orderId: id,
    });
    expect(wallet.entries.at(-1)).toMatchObject({ reason: 'seed', deltaHkd: 300 });
  });
});

describe('scheduled orders and slot throttling', () => {
  interface Slots {
    earliestSlotStart: number;
    slots: { slotStart: number; cap: number; booked: number; free: boolean }[];
  }
  const slots = async (): Promise<Slots> =>
    (await (
      await slotsRoute(
        request(`/api/slots/${mainCanteenId}?items=${itemA.id}:1`, 'student'),
        ctx({ vendorId: mainCanteenId }),
      )
    ).json()) as Slots;

  it('offers 15-minute slots from the earliest one that still lets the kitchen start in time', async () => {
    await cleanOrders();
    await setBalance(300);
    const view = await slots();
    expect(view.slots).toHaveLength(12);
    expect(view.earliestSlotStart % SLOT).toBe(0);
    expect(view.earliestSlotStart).toBeGreaterThan(NOW);
    expect(view.slots[0]?.slotStart).toBe(view.earliestSlotStart);
    expect(view.slots.every((slot) => slot.free && slot.booked === 0)).toBe(true);
  });

  it('books a slot, stores the fire time and the lateness prediction, and counts the booking', async () => {
    const view = await slots();
    const slotStart = view.slots[0]?.slotStart ?? 0;
    const result = await placeOrder(scheduled(slotStart));
    expect(result.status).toBe(201);
    const row = await db.order.findUniqueOrThrow({
      where: { id: String(orderOf(result.json)['id']) },
    });
    expect(row.slotStart?.getTime()).toBe(slotStart);
    expect(row.fireAt).not.toBeNull();
    expect(row.fireAt?.getTime() ?? 0).toBeLessThanOrEqual(slotStart);
    expect(row.fireAt?.getTime() ?? 0).toBeGreaterThanOrEqual(NOW);
    expect(row.predictedLow.getTime()).toBe(slotStart);
    expect(row.predictedPoint.getTime()).toBe(slotStart);
    expect(row.predictedHigh.getTime()).toBe(slotStart + 3 * MINUTE);
    const slot = await db.pickupSlot.findFirstOrThrow({
      where: { vendorId: mainCanteenId, slotStart: new Date(slotStart) },
    });
    expect(slot.bookedCount).toBe(1);
    expect((await slots()).slots.find((entry) => entry.slotStart === slotStart)?.booked).toBe(1);
  });

  it('refuses a full slot with the next free one and charges nothing', async () => {
    const view = await slots();
    const slotStart = view.slots[0]?.slotStart ?? 0;
    await db.pickupSlot.updateMany({
      where: { vendorId: mainCanteenId, slotStart: new Date(slotStart) },
      data: { cap: 1 },
    });
    const before = await balance();
    const orders = await db.order.count({ where: { studentId } });

    const full = await placeOrder(scheduled(slotStart));
    expect(full).toMatchObject({
      status: 409,
      json: { error: 'slot_full', nextSlotStart: slotStart + SLOT },
    });
    expect(await balance()).toBe(before);
    expect(await db.order.count({ where: { studentId } })).toBe(orders);

    expect((await placeOrder(scheduled(slotStart + SLOT))).status).toBe(201);
  });

  it('gives the booking back when the order is cancelled inside the grace window', async () => {
    const view = await slots();
    const target = view.slots.find((slot) => slot.free && slot.booked === 0)?.slotStart ?? 0;
    const id = String(orderOf((await placeOrder(scheduled(target))).json)['id']);
    const cancelled = await patch(cancelRoute, id);
    expect(cancelled.status).toBe(200);
    const slot = await db.pickupSlot.findFirstOrThrow({
      where: { vendorId: mainCanteenId, slotStart: new Date(target) },
    });
    expect(slot.bookedCount).toBe(0);
  });

  it('rolls the booking back when the wallet is too low', async () => {
    const view = await slots();
    const target = view.slots.find((slot) => slot.free && slot.booked === 0)?.slotStart ?? 0;
    await setBalance(1);
    expect((await placeOrder(scheduled(target))).status).toBe(402);
    const slot = await db.pickupSlot.findFirst({
      where: { vendorId: mainCanteenId, slotStart: new Date(target) },
    });
    expect(slot?.bookedCount ?? 0).toBe(0);
    await setBalance(300);
  });

  it('refuses a slot that is off the grid, too soon, too far away or outside opening hours', async () => {
    const view = await slots();
    const first = view.earliestSlotStart;
    const cases: [string, number][] = [
      ['off the 15 minute grid', first + MINUTE],
      ['before the earliest slot', first - SLOT],
      ['in the past', NOW - SLOT],
      ['more than 12 hours ahead', NOW + 13 * 60 * MINUTE],
      ['outside opening hours', Date.UTC(2026, 10, 17, 18, 0)],
    ];
    for (const [label, slotStart] of cases) {
      const result = await placeOrder(scheduled(slotStart));
      expect(result.status, label).toBe(409);
      expect(result.json['error'], label).toBe('slot_invalid');
    }
    const tooSoon = await placeOrder(scheduled(first - SLOT));
    expect(tooSoon.json['earliestSlotStart']).toBe(first);
  });

  it('rejects bad slot queries', async () => {
    const bad = await slotsRoute(
      request(`/api/slots/${mainCanteenId}?items=nope`, 'student'),
      ctx({ vendorId: mainCanteenId }),
    );
    expect(bad.status).toBe(400);
    const missing = await slotsRoute(
      request('/api/slots/00000000-0000-4000-8000-000000000000', 'student'),
      ctx({ vendorId: '00000000-0000-4000-8000-000000000000' }),
    );
    expect(missing.status).toBe(404);
  });
});
