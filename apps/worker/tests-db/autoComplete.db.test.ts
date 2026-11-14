import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { AUTO_COMPLETE_AFTER_MINUTES, MS_PER_MINUTE } from '@app/core';
import { DEMO_ACCOUNTS, PrismaClient, SIM_EMAIL_DOMAIN } from '@app/db';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SNAPSHOT_STEP_MS, boundaryAtOrBefore } from '../src/clock.js';
import { notify } from '../src/notifier.js';
import { newTickState, runTick } from '../src/tick.js';

vi.mock('../src/notifier.js', () => ({ notify: vi.fn(async () => undefined) }));

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const db = new PrismaClient();

const PLACED_AT = Date.UTC(2026, 10, 17, 4, 0);
const READY_AT = PLACED_AT + 8 * MS_PER_MINUTE;
const state = newTickState();

let studentId = '';
let simId = '';
let vendorId = '';
let menuItemId = '';
const ids = { real: '', tapped: '', sim: '' };

async function tickAt(nowMs: number): Promise<void> {
  state.lastSnapshotBoundary = boundaryAtOrBefore(nowMs, SNAPSHOT_STEP_MS);
  await runTick(db, { nowMs, demoPlaying: false }, state, {
    demoMode: false,
    uniform: Math.random,
  });
}

async function readyOrder(student: string, status: 'ready' | 'completed'): Promise<string> {
  const order = await db.order.create({
    data: {
      studentId: student,
      vendorId,
      status,
      totalHkd: 20,
      placedAt: new Date(PLACED_AT),
      acceptedAt: new Date(PLACED_AT + MS_PER_MINUTE),
      readyAt: new Date(READY_AT),
      pickedUpAt: status === 'completed' ? new Date(READY_AT + 5 * MS_PER_MINUTE) : null,
      predictedPoint: new Date(PLACED_AT + 6 * MS_PER_MINUTE),
      predictedLow: new Date(PLACED_AT + 4 * MS_PER_MINUTE),
      predictedHigh: new Date(PLACED_AT + 9 * MS_PER_MINUTE),
      predictedBase: new Date(PLACED_AT + 5 * MS_PER_MINUTE),
      backlogAtPlacement: 0,
      modelVersion: 'v2',
      items: { create: [{ menuItemId, qty: 1, priceHkdSnapshot: 20, prepPriorSnapshotMin: 4 }] },
    },
  });
  return order.id;
}

const statusOf = async (id: string): Promise<string> =>
  (await db.order.findUniqueOrThrow({ where: { id }, select: { status: true } })).status;

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
  simId = (
    await db.user.findFirstOrThrow({
      where: { email: { endsWith: `@${SIM_EMAIL_DOMAIN}` } },
      select: { id: true },
    })
  ).id;
  await db.order.deleteMany({ where: { studentId } });
  await db.notification.deleteMany({ where: { userId: studentId } });
  ids.real = await readyOrder(studentId, 'ready');
  ids.tapped = await readyOrder(studentId, 'completed');
  ids.sim = await readyOrder(simId, 'ready');
}, 300_000);

afterAll(async () => {
  await db.order.deleteMany({ where: { id: { in: Object.values(ids) } } });
  await db.notification.deleteMany({ where: { userId: studentId } });
  await db.$disconnect();
});

describe('auto-complete after ready, on the demo clock', () => {
  it('keeps the wait in one constant of 30 minutes', () => {
    expect(AUTO_COMPLETE_AFTER_MINUTES).toBe(30);
  });

  it('leaves a ready order alone 29 minutes after ready_at', async () => {
    await tickAt(READY_AT + 29 * MS_PER_MINUTE);
    expect(await statusOf(ids.real)).toBe('ready');
    expect(
      await db.notification.count({ where: { userId: studentId, kind: 'order_completed' } }),
    ).toBe(0);
  });

  it('completes it 30 minutes after ready_at, without writing picked_up_at', async () => {
    await tickAt(READY_AT + 30 * MS_PER_MINUTE);
    const order = await db.order.findUniqueOrThrow({ where: { id: ids.real } });
    expect(order.status).toBe('completed');
    expect(order.pickedUpAt).toBeNull();
    expect(order.readyAt?.getTime()).toBe(READY_AT);
  });

  it('tells the student once, and tells the live screens', async () => {
    const notes = await db.notification.findMany({
      where: { userId: studentId, kind: 'order_completed' },
    });
    expect(notes).toHaveLength(1);
    expect(notes[0]?.link).toBe(`/orders/${ids.real}`);
    const calls = vi
      .mocked(notify)
      .mock.calls.filter(
        ([, channel, payload]) => channel === 'order_changed' && payload['orderId'] === ids.real,
      );
    expect(calls.map(([, , payload]) => payload['status'])).toEqual(['completed']);
    await tickAt(READY_AT + 45 * MS_PER_MINUTE);
    expect(
      await db.notification.count({ where: { userId: studentId, kind: 'order_completed' } }),
    ).toBe(1);
  });

  it('keeps the time the student really tapped, and leaves simulated orders to the demo load', async () => {
    const tapped = await db.order.findUniqueOrThrow({ where: { id: ids.tapped } });
    expect(tapped.status).toBe('completed');
    expect(tapped.pickedUpAt?.getTime()).toBe(READY_AT + 5 * MS_PER_MINUTE);
    expect(await statusOf(ids.sim)).toBe('ready');
  });
});
