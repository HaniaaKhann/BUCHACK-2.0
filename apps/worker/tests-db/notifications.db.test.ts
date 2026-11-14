import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MS_PER_MINUTE, ORDER_GRACE_SECONDS, leaveNowAt } from '@app/core';
import { DEMO_ACCOUNTS, PrismaClient } from '@app/db';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SNAPSHOT_STEP_MS, boundaryAtOrBefore } from '../src/clock.js';
import { newTickState, runTick } from '../src/tick.js';

vi.mock('../src/notifier.js', () => ({ notify: vi.fn(async () => undefined) }));

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const db = new PrismaClient();

const PLACED_AT = Date.UTC(2026, 10, 17, 4, 15);
const READY_AT = PLACED_AT + 12 * MS_PER_MINUTE;
const FIRE_AT = PLACED_AT + 3 * MS_PER_MINUTE;

const state = newTickState();
const ids = { scheduled: '', asap: '', ready: '', placed: '' };
let studentId = '';
let vendorId = '';
let vendorName = '';
let menuItemId = '';
let walkMinutes = 0;
let buildingId = '';

async function tickAt(nowMs: number): Promise<void> {
  state.lastSnapshotBoundary = boundaryAtOrBefore(nowMs, SNAPSHOT_STEP_MS);
  await runTick(db, { nowMs, demoPlaying: false }, state, {
    demoMode: false,
    uniform: Math.random,
  });
}

async function createOrder(status: 'placed' | 'ready', fire: number | null): Promise<string> {
  const order = await db.order.create({
    data: {
      studentId,
      vendorId,
      status,
      totalHkd: 20,
      placedAt: new Date(PLACED_AT),
      fireAt: fire === null ? null : new Date(fire),
      slotStart: fire === null ? null : new Date(READY_AT),
      predictedPoint: new Date(READY_AT),
      predictedLow: new Date(READY_AT - 2 * MS_PER_MINUTE),
      predictedHigh: new Date(READY_AT + 3 * MS_PER_MINUTE),
      predictedBase: new Date(READY_AT),
      backlogAtPlacement: 0,
      modelVersion: 'v2',
      items: { create: [{ menuItemId, qty: 1, priceHkdSnapshot: 20, prepPriorSnapshotMin: 4 }] },
    },
  });
  return order.id;
}

async function notificationsFor(orderId: string): Promise<{ kind: string; createdAt: number }[]> {
  const rows = await db.notification.findMany({
    where: { userId: studentId, link: `/orders/${orderId}` },
    orderBy: { createdAt: 'asc' },
    select: { kind: true, createdAt: true },
  });
  return rows.map((row) => ({ kind: row.kind, createdAt: row.createdAt.getTime() }));
}

beforeAll(async () => {
  const env = { ...process.env, DEMO_MODE: 'true' };
  execSync('pnpm --filter @app/db migrate:deploy', { cwd: repoRoot, env, stdio: 'pipe' });
  execSync('pnpm --filter @app/db seed', { cwd: repoRoot, env, stdio: 'pipe' });
  const student = DEMO_ACCOUNTS.find((account) => account.role === 'student');
  const owner = DEMO_ACCOUNTS.find((account) => account.role === 'vendor_owner');
  if (student === undefined || owner === undefined) throw new Error('demo accounts missing');
  studentId = student.id;
  const membership = await db.vendorMember.findFirstOrThrow({
    where: { userId: owner.id },
    include: { vendor: true },
  });
  vendorId = membership.vendorId;
  vendorName = membership.vendor.name;
  const nearest = await db.walkTime.findFirstOrThrow({
    where: { toVendorId: vendorId },
    orderBy: { minutes: 'asc' },
  });
  buildingId = nearest.fromBuildingId;
  walkMinutes = nearest.minutes;
  if (walkMinutes > 8) throw new Error('the shortest walk to the vendor is too long for this test');
  menuItemId = (await db.menuItem.findFirstOrThrow({ where: { vendorId } })).id;

  await db.notification.deleteMany({ where: { userId: studentId } });
  await db.order.deleteMany({ where: { studentId } });
  await db.studentProfile.deleteMany({ where: { userId: studentId } });
  await db.studentProfile.create({
    data: {
      userId: studentId,
      dietTags: [],
      allergens: [],
      eatMinutes: 15,
      currentBuildingId: buildingId,
    },
  });
  ids.scheduled = await createOrder('placed', FIRE_AT);
  ids.asap = await createOrder('placed', null);
  ids.ready = await createOrder('ready', null);
  ids.placed = await createOrder('placed', null);
}, 300_000);

afterAll(async () => {
  await db.notification.deleteMany({ where: { userId: studentId } });
  await db.order.deleteMany({ where: { studentId } });
  await db.studentProfile.deleteMany({ where: { userId: studentId } });
  await db.$disconnect();
});

describe('notifications made by the worker', () => {
  it('walks the demo student to a building with a known walk time', () => {
    expect(walkMinutes).toBeGreaterThan(0);
  });

  it('creates nothing while the grace period is still running', async () => {
    await tickAt(PLACED_AT + (ORDER_GRACE_SECONDS - 1) * 1000);
    expect(await db.notification.count({ where: { userId: studentId } })).toBe(0);
  });

  it('creates one "accepted" notification per order when the grace period ends, stamped with the demo clock', async () => {
    const acceptAt = PLACED_AT + ORDER_GRACE_SECONDS * 1000;
    await tickAt(acceptAt);
    await tickAt(acceptAt + 1000);
    for (const id of [ids.scheduled, ids.asap, ids.placed]) {
      expect(await notificationsFor(id)).toEqual([{ kind: 'order_accepted', createdAt: acceptAt }]);
    }
    expect(await notificationsFor(ids.ready)).toEqual([]);
    const sample = await db.notification.findFirstOrThrow({
      where: { userId: studentId, kind: 'order_accepted' },
    });
    expect(sample).toMatchObject({
      title: 'Order accepted',
      body: `${vendorName} accepted your order.`,
      readAt: null,
    });
  });

  it('creates one "preparing" notification at fire_at and none before', async () => {
    await tickAt(FIRE_AT - 1);
    expect((await notificationsFor(ids.scheduled)).map((row) => row.kind)).toEqual([
      'order_accepted',
    ]);
    await tickAt(FIRE_AT);
    await tickAt(FIRE_AT + 5000);
    expect(await notificationsFor(ids.scheduled)).toEqual([
      { kind: 'order_accepted', createdAt: PLACED_AT + ORDER_GRACE_SECONDS * 1000 },
      { kind: 'order_preparing', createdAt: FIRE_AT },
    ]);
  });

  it('says leave now once, at the predicted ready time minus the walk, for active orders only', async () => {
    const leaveAt = leaveNowAt(READY_AT, walkMinutes);
    await tickAt(leaveAt - 1);
    expect(await db.notification.count({ where: { userId: studentId, kind: 'leave_now' } })).toBe(
      0,
    );

    await tickAt(leaveAt);
    await tickAt(leaveAt + 60_000);
    const leave = await db.notification.findMany({
      where: { userId: studentId, kind: 'leave_now' },
      select: { link: true, createdAt: true, body: true },
    });
    expect(leave.map((row) => row.link).sort()).toEqual(
      [ids.scheduled, ids.asap, ids.placed].map((id) => `/orders/${id}`).sort(),
    );
    expect(new Set(leave.map((row) => row.createdAt.getTime()))).toEqual(new Set([leaveAt]));
    expect(leave[0]?.body).toContain(vendorName);
    expect(await notificationsFor(ids.ready)).toEqual([]);
  });

  it('does not say leave now to a student with no building', async () => {
    await db.notification.deleteMany({ where: { userId: studentId, kind: 'leave_now' } });
    await db.studentProfile.update({
      where: { userId: studentId },
      data: { currentBuildingId: null },
    });
    await tickAt(READY_AT + MS_PER_MINUTE);
    expect(await db.notification.count({ where: { userId: studentId, kind: 'leave_now' } })).toBe(
      0,
    );
  });
});
