import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { clockNowMs, nextClockAnchor } from '@app/core';
import { DEMO_ACCOUNTS, DEMO_CLOCK_START, PrismaClient } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runDemoReset, type DemoResetResult } from '../src/demoReset.js';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const db = new PrismaClient();
const expectedFingerprint = process.env['EXPECT_FINGERPRINT'];

interface ItemState {
  stockStatus: string;
  dietTags: string[];
  allergens: string[];
  tagsStatus: string;
}

interface VendorState {
  paused: boolean;
  busyState: string;
  busyUntil: number | null;
}

async function itemStates(): Promise<Map<string, ItemState>> {
  const rows = await db.menuItem.findMany({
    select: { id: true, stockStatus: true, dietTags: true, allergens: true, tagsStatus: true },
  });
  return new Map(
    rows.map((row) => [
      row.id,
      {
        stockStatus: row.stockStatus,
        dietTags: [...row.dietTags].sort(),
        allergens: [...row.allergens].sort(),
        tagsStatus: row.tagsStatus,
      },
    ]),
  );
}

async function vendorStates(): Promise<Map<string, VendorState>> {
  const rows = await db.vendor.findMany({
    select: { id: true, paused: true, busyState: true, busyUntil: true },
  });
  return new Map(
    rows.map((row) => [
      row.id,
      { paused: row.paused, busyState: row.busyState, busyUntil: row.busyUntil?.getTime() ?? null },
    ]),
  );
}

const student = DEMO_ACCOUNTS.find((account) => account.role === 'student');
const owner = DEMO_ACCOUNTS.find((account) => account.role === 'vendor_owner');

let seededItems = new Map<string, ItemState>();
let seededVendors = new Map<string, VendorState>();
let first: DemoResetResult;
let second: DemoResetResult;
let dirtyVendors = new Map<string, VendorState>();
let dirtyItems = new Map<string, ItemState>();
let dirtyCounts = { orders: 0, slots: 0, events: 0, walletRows: 0 };
let pausedVendorId = '';
let rushVendorId = '';
let outOfStockItemId = '';
let halalItemId = '';

beforeAll(async () => {
  const env = { ...process.env, DEMO_MODE: 'true' };
  execSync('pnpm --filter @app/db migrate:deploy', { cwd: repoRoot, env, stdio: 'pipe' });
  execSync('pnpm --filter @app/db seed', { cwd: repoRoot, env, stdio: 'pipe' });
  if (student === undefined || owner === undefined) throw new Error('demo accounts missing');

  seededItems = await itemStates();
  seededVendors = await vendorStates();
  first = await runDemoReset(db);

  const vendors = await db.vendor.findMany({
    where: { name: { in: ['Bistro NTT', 'Main Canteen'] } },
    select: { id: true, name: true },
  });
  pausedVendorId = vendors.find((vendor) => vendor.name === 'Bistro NTT')?.id ?? '';
  rushVendorId = vendors.find((vendor) => vendor.name === 'Main Canteen')?.id ?? '';
  const outItem = await db.menuItem.findFirstOrThrow({ where: { vendorId: rushVendorId } });
  const halalItem = await db.menuItem.findFirstOrThrow({ where: { vendorId: pausedVendorId } });
  outOfStockItemId = outItem.id;
  halalItemId = halalItem.id;

  await db.vendor.update({ where: { id: pausedVendorId }, data: { paused: true } });
  await db.vendor.update({
    where: { id: rushVendorId },
    data: { busyState: 'rush', busyUntil: new Date(Date.now() + 86_400_000) },
  });
  await db.busyEvent.create({
    data: { vendorId: rushVendorId, state: 'rush', setAt: new Date(), expiresAt: null },
  });
  await db.menuItem.update({
    where: { id: outOfStockItemId },
    data: { stockStatus: 'out_of_stock' },
  });
  await db.menuItem.update({
    where: { id: halalItemId },
    data: {
      dietTags: { set: [...halalItem.dietTags, 'halal'] },
      tagsStatus: 'verified',
      tagsVerifiedBy: owner.id,
      tagsVerifiedAt: new Date(),
    },
  });
  const order = await db.order.create({
    data: {
      studentId: student.id,
      vendorId: rushVendorId,
      status: 'ready',
      totalHkd: 50,
      placedAt: new Date(),
      predictedPoint: new Date(),
      predictedLow: new Date(),
      predictedHigh: new Date(),
      predictedBase: new Date(),
      backlogAtPlacement: 3,
      modelVersion: 'v2',
      items: {
        create: [
          { menuItemId: outOfStockItemId, qty: 1, priceHkdSnapshot: 50, prepPriorSnapshotMin: 4 },
        ],
      },
    },
  });
  await db.walletLedger.create({
    data: {
      userId: student.id,
      deltaHkd: -50,
      reason: 'pay',
      refOrderId: order.id,
      createdAt: new Date(),
    },
  });
  await db.pickupSlot.create({
    data: {
      vendorId: rushVendorId,
      slotStart: new Date(Date.now() + 3_600_000),
      cap: 4,
      bookedCount: 1,
    },
  });
  await db.systemClock.update({ where: { id: 1 }, data: { mode: 'real', speed: 1 } });

  dirtyVendors = await vendorStates();
  dirtyItems = await itemStates();
  dirtyCounts = {
    orders: await db.order.count(),
    slots: await db.pickupSlot.count(),
    events: await db.busyEvent.count(),
    walletRows: await db.walletLedger.count({ where: { userId: student.id } }),
  };

  second = await runDemoReset(db);
}, 300_000);

afterAll(async () => {
  await db.$disconnect();
});

describe('demo reset after every kind of change', () => {
  it('had really changed the state before the second reset', () => {
    expect(dirtyVendors.get(pausedVendorId)?.paused).toBe(true);
    expect(dirtyVendors.get(rushVendorId)).toMatchObject({ busyState: 'rush' });
    expect(dirtyItems.get(outOfStockItemId)?.stockStatus).toBe('out_of_stock');
    expect(dirtyItems.get(halalItemId)?.dietTags).toContain('halal');
    expect(dirtyCounts).toEqual({ orders: 1, slots: 1, events: 1, walletRows: 2 });
  });

  it('leaves a freshly seeded database unchanged on the first reset', () => {
    expect(first.fingerprint).toBe(second.fingerprint);
  });

  it('unpauses the vendor and clears the rush with no worker running', async () => {
    expect(await vendorStates()).toEqual(seededVendors);
    expect(await db.busyEvent.count()).toBe(0);
  });

  it('puts stock, halal tags and verification back to the seeded values', async () => {
    const after = await itemStates();
    expect(after.get(outOfStockItemId)?.stockStatus).toBe('in_stock');
    expect(after.get(halalItemId)?.dietTags).not.toContain('halal');
    expect(after).toEqual(seededItems);
    expect([...after.values()].some((item) => item.dietTags.includes('halal'))).toBe(false);
  });

  it('removes orders and slots and restores the 300 starting wallet', async () => {
    expect(await db.order.count()).toBe(0);
    expect(await db.pickupSlot.count()).toBe(0);
    const rows = await db.walletLedger.findMany({ where: { userId: student?.id ?? '' } });
    expect(rows.map((row) => [row.reason, row.deltaHkd])).toEqual([['seed', 300]]);
  });

  it('fixes the clock at the demo start with speed 0', async () => {
    const clock = await db.systemClock.findUniqueOrThrow({ where: { id: 1 } });
    expect([clock.mode, clock.speed, clock.currentTime.getTime()]).toEqual([
      'demo',
      0,
      Date.parse(DEMO_CLOCK_START),
    ]);
  });

  it('gives the same waits and fire times as the clean state', () => {
    expect(second.lines).toEqual(first.lines);
    expect(second.lines.length).toBeGreaterThan(0);
    if (expectedFingerprint !== undefined) expect(second.fingerprint).toBe(expectedFingerprint);
  });
  it('puts the clock and the waits back after the admin has jumped the clock and set a speed', async () => {
    const before = await db.systemClock.findUniqueOrThrow({ where: { id: 1 } });
    const now = Date.now();
    const jumped = nextClockAnchor(before, now, { kind: 'jump', minutes: 1440 });
    await db.systemClock.update({
      where: { id: 1 },
      data: {
        currentTime: new Date(jumped.currentTimeMs),
        speed: 60,
        updatedAt: new Date(now),
      },
    });
    const moved = await db.systemClock.findUniqueOrThrow({ where: { id: 1 } });
    expect(clockNowMs(moved, now)).toBe(Date.parse(DEMO_CLOCK_START) + 86_400_000);

    const third = await runDemoReset(db);
    const clock = await db.systemClock.findUniqueOrThrow({ where: { id: 1 } });
    expect([clock.speed, clock.currentTime.getTime()]).toEqual([0, Date.parse(DEMO_CLOCK_START)]);
    expect(third.fingerprint).toBe(second.fingerprint);
  });
});
