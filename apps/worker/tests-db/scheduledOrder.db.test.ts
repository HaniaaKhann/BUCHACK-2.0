import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MS_PER_MINUTE, ORDER_GRACE_SECONDS, fireAt } from '@app/core';
import { DEMO_ACCOUNTS, PrismaClient } from '@app/db';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SNAPSHOT_STEP_MS, boundaryAtOrBefore } from '../src/clock.js';
import { notify } from '../src/notifier.js';
import { newTickState, runTick } from '../src/tick.js';

vi.mock('../src/notifier.js', () => ({ notify: vi.fn(async () => undefined) }));

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const db = new PrismaClient();

const PLACED_AT = Date.UTC(2026, 10, 17, 4, 15);
const SLOT_START = PLACED_AT + 30 * MS_PER_MINUTE;
const QUEUE_DELAY_MINUTES = 2;
const PREP_MINUTES = 4;
const FIRE_AT = fireAt({
  slotStart: SLOT_START,
  forecastQueueDelayMinutes: QUEUE_DELAY_MINUTES,
  prepMinutes: PREP_MINUTES,
});
const LATER_FIRE_AT = FIRE_AT + 15 * MS_PER_MINUTE;

const state = newTickState();
const ids: Record<'due' | 'later' | 'asap' | 'cancelled', string> = {
  due: '',
  later: '',
  asap: '',
  cancelled: '',
};
let studentId = '';
let vendorId = '';
let menuItemId = '';

async function tickAt(nowMs: number): Promise<void> {
  state.lastSnapshotBoundary = boundaryAtOrBefore(nowMs, SNAPSHOT_STEP_MS);
  await runTick(db, { nowMs, demoPlaying: false }, state, {
    demoMode: false,
    uniform: Math.random,
  });
}

async function statuses(): Promise<Record<keyof typeof ids, string>> {
  const rows = await db.order.findMany({
    where: { id: { in: Object.values(ids) } },
    select: { id: true, status: true },
  });
  const byId = new Map(rows.map((row) => [row.id, row.status]));
  return {
    due: byId.get(ids.due) ?? 'missing',
    later: byId.get(ids.later) ?? 'missing',
    asap: byId.get(ids.asap) ?? 'missing',
    cancelled: byId.get(ids.cancelled) ?? 'missing',
  };
}

async function createOrder(
  status: 'placed' | 'cancelled',
  fire: number | null,
  slot: number | null,
): Promise<string> {
  const order = await db.order.create({
    data: {
      studentId,
      vendorId,
      status,
      totalHkd: 20,
      placedAt: new Date(PLACED_AT),
      fireAt: fire === null ? null : new Date(fire),
      slotStart: slot === null ? null : new Date(slot),
      predictedPoint: new Date(slot ?? PLACED_AT + 6 * MS_PER_MINUTE),
      predictedLow: new Date(slot ?? PLACED_AT + 4 * MS_PER_MINUTE),
      predictedHigh: new Date((slot ?? PLACED_AT) + 9 * MS_PER_MINUTE),
      predictedBase: new Date(slot ?? PLACED_AT + 5 * MS_PER_MINUTE),
      backlogAtPlacement: 0,
      modelVersion: 'v2',
      items: { create: [{ menuItemId, qty: 1, priceHkdSnapshot: 20, prepPriorSnapshotMin: 4 }] },
    },
  });
  return order.id;
}

function changesFor(orderId: string): string[] {
  return vi
    .mocked(notify)
    .mock.calls.filter(
      ([, channel, payload]) => channel === 'order_changed' && payload['orderId'] === orderId,
    )
    .map(([, , payload]) => payload['status'] ?? '');
}

beforeAll(async () => {
  const env = { ...process.env, DEMO_MODE: 'true' };
  execSync('pnpm --filter @app/db migrate:deploy', { cwd: repoRoot, env, stdio: 'pipe' });
  execSync('pnpm --filter @app/db seed', { cwd: repoRoot, env, stdio: 'pipe' });
  const student = DEMO_ACCOUNTS.find((account) => account.role === 'student');
  const owner = DEMO_ACCOUNTS.find((account) => account.role === 'vendor_owner');
  if (student === undefined || owner === undefined) throw new Error('demo accounts missing');
  studentId = student.id;
  vendorId = (await db.vendorMember.findFirstOrThrow({ where: { userId: owner.id } })).vendorId;
  menuItemId = (await db.menuItem.findFirstOrThrow({ where: { vendorId } })).id;
  await db.order.deleteMany({ where: { studentId } });

  ids.due = await createOrder('placed', FIRE_AT, SLOT_START);
  ids.later = await createOrder('placed', LATER_FIRE_AT, SLOT_START + 15 * MS_PER_MINUTE);
  ids.asap = await createOrder('placed', null, null);
  ids.cancelled = await createOrder('cancelled', FIRE_AT, SLOT_START);
}, 300_000);

afterAll(async () => {
  await db.order.deleteMany({ where: { studentId } });
  await db.$disconnect();
});

describe('a scheduled order through the worker loop', () => {
  it('starts at the slot start minus the queue delay and the prep time', () => {
    expect(FIRE_AT).toBe(SLOT_START - (QUEUE_DELAY_MINUTES + PREP_MINUTES) * MS_PER_MINUTE);
  });

  it('stays placed until the grace period is over, then is accepted', async () => {
    await tickAt(PLACED_AT + (ORDER_GRACE_SECONDS - 1) * 1000);
    expect(await statuses()).toEqual({
      due: 'placed',
      later: 'placed',
      asap: 'placed',
      cancelled: 'cancelled',
    });

    await tickAt(PLACED_AT + ORDER_GRACE_SECONDS * 1000);
    expect(await statuses()).toEqual({
      due: 'accepted',
      later: 'accepted',
      asap: 'accepted',
      cancelled: 'cancelled',
    });
    expect(changesFor(ids.due)).toEqual(['accepted']);
    expect(changesFor(ids.cancelled)).toEqual([]);
  });

  it('does nothing one millisecond before fire_at', async () => {
    await tickAt(FIRE_AT - 1);
    expect(await statuses()).toMatchObject({
      due: 'accepted',
      later: 'accepted',
      asap: 'accepted',
    });
    expect(changesFor(ids.due)).toEqual(['accepted']);
  });

  it('starts exactly the due order at fire_at and tells the student and the vendor once', async () => {
    await tickAt(FIRE_AT);
    expect(await statuses()).toEqual({
      due: 'preparing',
      later: 'accepted',
      asap: 'accepted',
      cancelled: 'cancelled',
    });
    expect(changesFor(ids.due)).toEqual(['accepted', 'preparing']);
    const [, , payload] =
      vi
        .mocked(notify)
        .mock.calls.find(([, , p]) => p['orderId'] === ids.due && p['status'] === 'preparing') ??
      [];
    expect(payload).toEqual({
      orderId: ids.due,
      vendorId,
      studentId,
      status: 'preparing',
    });

    await tickAt(FIRE_AT + 30_000);
    expect(changesFor(ids.due)).toEqual(['accepted', 'preparing']);
    expect((await statuses()).later).toBe('accepted');
  });

  it('starts the later scheduled order at its own fire_at, and never starts an ASAP or cancelled order', async () => {
    await tickAt(LATER_FIRE_AT);
    expect(await statuses()).toEqual({
      due: 'preparing',
      later: 'preparing',
      asap: 'accepted',
      cancelled: 'cancelled',
    });
    await tickAt(SLOT_START + 60 * MS_PER_MINUTE);
    expect((await statuses()).asap).toBe('accepted');
    expect((await statuses()).cancelled).toBe('cancelled');
    expect(changesFor(ids.cancelled)).toEqual([]);
  });

  it('records when the order was accepted', async () => {
    const row = await db.order.findUniqueOrThrow({ where: { id: ids.due } });
    expect(row.acceptedAt?.getTime()).toBe(PLACED_AT + ORDER_GRACE_SECONDS * 1000);
    expect(row.fireAt?.getTime()).toBe(FIRE_AT);
  });
});
