import { createHash } from 'node:crypto';
import {
  MS_PER_MINUTE,
  SLOT_MINUTES,
  computeLiveWait,
  fireAt,
  formatHktTime,
  median,
} from '@app/core';
import {
  ACTIVE_VENDOR_WHERE,
  DEMO_ACCOUNTS,
  DEMO_CLOCK_START,
  type PrismaClient,
  grantStartingCredit,
  readSnapshotPayload,
  toWaitSnapshot,
  verifyDemoMenus,
} from '@app/db';
import { SNAPSHOT_STEP_MS, boundaryAtOrBefore } from './clock.js';
import { runEngineSnapshots } from './jobs/engineSnapshot.js';

const SLOT_MS = SLOT_MINUTES * MS_PER_MINUTE;

async function resetData(db: PrismaClient, startMs: number): Promise<void> {
  const accountIds = DEMO_ACCOUNTS.map((account) => account.id);
  await db.$transaction([
    db.order.deleteMany({}),
    db.pickupSlot.deleteMany({}),
    db.busyEvent.deleteMany({}),
    db.engineSnapshot.deleteMany({}),
    db.walletLedger.deleteMany({ where: { userId: { in: accountIds } } }),
    db.freeWindow.deleteMany({ where: { userId: { in: accountIds } } }),
    db.studentProfile.deleteMany({ where: { userId: { in: accountIds } } }),
    db.vendor.updateMany({ data: { paused: false, busyState: 'normal', busyUntil: null } }),
    db.menuItem.updateMany({
      data: {
        stockStatus: 'in_stock',
        tagsStatus: 'unverified',
        tagsVerifiedBy: null,
        tagsVerifiedAt: null,
      },
    }),
    db.$executeRaw`UPDATE menu_items SET "dietTags" = array_remove("dietTags", 'halal')`,
    db.systemClock.update({
      where: { id: 1 },
      data: { mode: 'demo', currentTime: new Date(startMs), speed: 0 },
    }),
  ]);
  await verifyDemoMenus(db);
  for (const account of DEMO_ACCOUNTS) await grantStartingCredit(db, account.id);
}

async function report(db: PrismaClient, nowMs: number): Promise<string[]> {
  const vendors = await db.vendor.findMany({
    where: ACTIVE_VENDOR_WHERE,
    select: { id: true, name: true, menuItems: { select: { prepPriorMin: true } } },
  });
  vendors.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const slotStart = (Math.floor(nowMs / SLOT_MS) + 2) * SLOT_MS;
  const lines: string[] = [];
  for (const vendor of vendors) {
    const row = await db.engineSnapshot.findFirst({
      where: { vendorId: vendor.id, computedAt: { lte: new Date(nowMs) } },
      orderBy: { computedAt: 'desc' },
      select: { payload: true },
    });
    const payload = row === null ? null : readSnapshotPayload(row.payload);
    if (payload === null) {
      lines.push(`${vendor.name} | no snapshot`);
      continue;
    }
    const prepMinutes = median(vendor.menuItems.map((item) => item.prepPriorMin));
    const live = computeLiveWait({
      snapshot: toWaitSnapshot(payload),
      now: nowMs,
      appArrivalTimes: [],
      prepMinutes,
    });
    const { lowMinutes, pointMinutes, highMinutes, queueDelayMinutes } = live.prediction;
    const fire = fireAt({
      slotStart,
      forecastQueueDelayMinutes: queueDelayMinutes,
      prepMinutes,
    });
    lines.push(
      `${vendor.name} | backlog ${live.backlog.toFixed(2)} | wait ${lowMinutes.toFixed(1)}-${highMinutes.toFixed(1)} min (point ${pointMinutes.toFixed(1)}) | slot ${formatHktTime(slotStart)} fires at ${formatHktTime(fire)}`,
    );
  }
  return lines;
}

export interface DemoResetResult {
  startMs: number;
  lines: string[];
  fingerprint: string;
}

export async function runDemoReset(db: PrismaClient): Promise<DemoResetResult> {
  const startMs = Date.parse(DEMO_CLOCK_START);
  await resetData(db, startMs);
  await runEngineSnapshots(db, [boundaryAtOrBefore(startMs, SNAPSHOT_STEP_MS)]);
  const lines = await report(db, startMs);
  const fingerprint = createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 12);
  return { startMs, lines, fingerprint };
}
