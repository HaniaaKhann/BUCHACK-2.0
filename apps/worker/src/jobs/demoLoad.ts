import {
  MS_PER_MINUTE,
  computeLiveWait,
  hktDate,
  isOpenAt,
  itemPrep,
  openRangesOn,
  orderPrep,
} from '@app/core';
import {
  ACTIVE_VENDOR_WHERE,
  SIM_EMAIL_DOMAIN,
  openingHoursSchema,
  readSnapshotPayload,
  toWaitSnapshot,
  type PrismaClient,
  type StoredSnapshotPayload,
} from '@app/db';
import { DEMO_APP_ORDER_SHARE, DEMO_CATCH_UP_MINUTES } from '../config.js';
import {
  drawItemCount,
  forecastSlotAt,
  isLastMinuteOfSlot,
  pickupDueAt,
  poisson,
  readyDueAt,
  slotStartOf,
  type Uniform,
} from '../demoLoadPlan.js';
import { notify } from '../notifier.js';

export interface DemoLoadState {
  lastMinute: number | null;
  simStudentIds: string[] | null;
  holidays: Set<string> | null;
}

export function newDemoLoadState(): DemoLoadState {
  return { lastMinute: null, simStudentIds: null, holidays: null };
}

async function latestPayload(
  db: PrismaClient,
  vendorId: string,
  atMs: number,
): Promise<StoredSnapshotPayload | null> {
  const row = await db.engineSnapshot.findFirst({
    where: { vendorId, computedAt: { lte: new Date(atMs) } },
    orderBy: { computedAt: 'desc' },
    select: { payload: true },
  });
  return row === null ? null : readSnapshotPayload(row.payload);
}

async function simStudents(db: PrismaClient, state: DemoLoadState): Promise<string[]> {
  if (state.simStudentIds === null) {
    const rows = await db.user.findMany({
      where: { email: { endsWith: `@${SIM_EMAIL_DOMAIN}` } },
      select: { id: true },
    });
    state.simStudentIds = rows.map((row) => row.id);
  }
  return state.simStudentIds;
}

async function holidayDates(db: PrismaClient, state: DemoLoadState): Promise<Set<string>> {
  if (state.holidays === null) {
    const rows = await db.publicHoliday.findMany({ select: { date: true } });
    state.holidays = new Set(rows.map((row) => row.date.toISOString().slice(0, 10)));
  }
  return state.holidays;
}

function pickDistinct<T>(items: readonly T[], count: number, uniform: Uniform): T[] {
  const pool = [...items];
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) {
    const [chosen] = pool.splice(Math.floor(uniform() * pool.length), 1);
    if (chosen !== undefined) picked.push(chosen);
  }
  return picked;
}

async function placeSimOrder(
  db: PrismaClient,
  vendorId: string,
  placedAt: number,
  payload: StoredSnapshotPayload,
  students: readonly string[],
  uniform: Uniform,
): Promise<void> {
  const studentId = students[Math.floor(uniform() * students.length)];
  const menu = await db.menuItem.findMany({
    where: { vendorId, stockStatus: 'in_stock', deletedAt: null },
    select: { id: true, name: true, priceHkd: true, prepPriorMin: true },
  });
  if (studentId === undefined || menu.length === 0) return;

  const items = pickDistinct(menu, drawItemCount(uniform, menu.length), uniform);
  const sinceSnapshot = await db.order.findMany({
    where: {
      vendorId,
      status: { not: 'cancelled' },
      placedAt: { gte: new Date(payload.computedAt), lt: new Date(placedAt) },
    },
    select: { placedAt: true },
  });
  const { prediction, backlog } = computeLiveWait({
    snapshot: toWaitSnapshot(payload),
    now: placedAt,
    appArrivalTimes: sinceSnapshot.map((row) => row.placedAt.getTime()),
    prepMinutes: orderPrep(
      items.map((item) =>
        itemPrep({
          learned: payload.prep[item.name]?.minutes ?? null,
          vendorPrior: item.prepPriorMin,
          categoryPrior: item.prepPriorMin,
        }),
      ),
    ),
  });
  const at = (minutes: number): Date => new Date(placedAt + minutes * MS_PER_MINUTE);
  const order = await db.order.create({
    data: {
      studentId,
      vendorId,
      status: 'placed',
      totalHkd: items.reduce((sum, item) => sum + item.priceHkd, 0),
      placedAt: new Date(placedAt),
      predictedPoint: at(prediction.pointMinutes),
      predictedLow: at(prediction.lowMinutes),
      predictedHigh: at(prediction.highMinutes),
      predictedBase: at(prediction.baseMinutes),
      backlogAtPlacement: backlog,
      modelVersion: prediction.modelVersion,
      items: {
        create: items.map((item) => ({
          menuItemId: item.id,
          qty: 1,
          priceHkdSnapshot: item.priceHkd,
          prepPriorSnapshotMin: item.prepPriorMin,
        })),
      },
    },
    select: { id: true },
  });
  await notify(db, 'order_changed', {
    orderId: order.id,
    vendorId,
    studentId,
    status: 'placed',
  });
}

async function generateMinute(
  db: PrismaClient,
  minuteStart: number,
  state: DemoLoadState,
  uniform: Uniform,
): Promise<void> {
  const [vendors, holidays, students] = await Promise.all([
    db.vendor.findMany({
      where: ACTIVE_VENDOR_WHERE,
      select: { id: true, openingHours: true, pickupEnabled: true, paused: true },
    }),
    holidayDates(db, state),
    simStudents(db, state),
  ]);
  const share = DEMO_APP_ORDER_SHARE / (1 - DEMO_APP_ORDER_SHARE);

  for (const vendor of vendors) {
    const ranges = openRangesOn(
      openingHoursSchema.parse(vendor.openingHours),
      hktDate(minuteStart),
      holidays,
    );
    if (!isOpenAt(ranges, minuteStart)) continue;
    const payload = await latestPayload(db, vendor.id, minuteStart);
    const slot = payload === null ? null : forecastSlotAt(payload, minuteStart);
    if (payload === null || slot === null) continue;

    if (isLastMinuteOfSlot(minuteStart)) {
      await db.ticketCount.createMany({
        data: [
          {
            vendorId: vendor.id,
            slotStart: new Date(slotStartOf(minuteStart)),
            count: poisson(slot.expectedWalkIns, uniform),
            source: 'sim',
          },
        ],
        skipDuplicates: true,
      });
    }
    if (!vendor.pickupEnabled || vendor.paused) continue;
    const arrivals = poisson(slot.lambdaPerMinute * share, uniform);
    for (let n = 0; n < arrivals; n += 1) {
      const placedAt = minuteStart + Math.floor(uniform() * MS_PER_MINUTE);
      await placeSimOrder(db, vendor.id, placedAt, payload, students, uniform);
    }
  }
}

interface StatusChange {
  status: 'preparing' | 'ready' | 'picked_up';
  readyAt?: Date;
  pickedUpAt?: Date;
}

async function applyChange(
  db: PrismaClient,
  order: { id: string; vendorId: string; studentId: string },
  change: StatusChange,
): Promise<void> {
  await db.order.update({ where: { id: order.id }, data: change });
  await notify(db, 'order_changed', {
    orderId: order.id,
    vendorId: order.vendorId,
    studentId: order.studentId,
    status: change.status,
  });
}

async function progressSimOrders(db: PrismaClient, nowMs: number): Promise<void> {
  const active = await db.order.findMany({
    where: {
      status: { in: ['accepted', 'preparing', 'ready'] },
      student: { email: { endsWith: `@${SIM_EMAIL_DOMAIN}` } },
    },
    select: {
      id: true,
      vendorId: true,
      studentId: true,
      status: true,
      placedAt: true,
      fireAt: true,
      readyAt: true,
      backlogAtPlacement: true,
      items: { select: { prepPriorSnapshotMin: true } },
    },
  });
  const payloads = new Map<string, StoredSnapshotPayload | null>();
  const now = new Date(nowMs);

  for (const order of active) {
    if (order.status === 'accepted' && order.fireAt === null) {
      await applyChange(db, order, { status: 'preparing' });
    } else if (order.status === 'preparing') {
      if (!payloads.has(order.vendorId)) {
        payloads.set(order.vendorId, await latestPayload(db, order.vendorId, nowMs));
      }
      const payload = payloads.get(order.vendorId);
      if (payload === null || payload === undefined) continue;
      const due = readyDueAt({
        orderId: order.id,
        placedAt: order.placedAt.getTime(),
        backlogAtPlacement: order.backlogAtPlacement,
        prepMinutes: orderPrep(order.items.map((item) => item.prepPriorSnapshotMin)),
        muPerMinute: payload.mu.perMinute,
      });
      if (nowMs >= due) await applyChange(db, order, { status: 'ready', readyAt: now });
    } else if (order.status === 'ready' && order.readyAt !== null) {
      if (nowMs >= pickupDueAt(order.id, order.readyAt.getTime())) {
        await applyChange(db, order, { status: 'picked_up', pickedUpAt: now });
      }
    }
  }
}

export async function demoLoad(
  db: PrismaClient,
  nowMs: number,
  state: DemoLoadState,
  uniform: Uniform,
): Promise<void> {
  const minute = Math.floor(nowMs / MS_PER_MINUTE);
  const last = state.lastMinute;
  const first =
    last === null || minute < last
      ? minute
      : Math.max(last + 1, minute - DEMO_CATCH_UP_MINUTES + 1);
  for (let current = first; current <= minute; current += 1) {
    await generateMinute(db, current * MS_PER_MINUTE, state, uniform);
  }
  state.lastMinute = minute;
  await progressSimOrders(db, nowMs);
}
