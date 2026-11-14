import { randomUUID } from 'node:crypto';
import {
  MODEL_VERSION,
  MS_PER_DAY,
  MS_PER_MINUTE,
  MU_FLOOR_PER_MINUTE,
  ORDER_MAX_TOTAL_HKD,
  SLOT_CHOICES_SHOWN,
  SLOT_MINUTES,
  defaultSlotCap,
  earliestSlotStart,
  fireAt,
  hktDate,
  isOpenAt,
  itemPrep,
  median,
  openRangesOn,
  orderPrep,
  scheduledPrediction,
  slotGrid,
  type OpenRange,
} from '@app/core';
import { ACTIVE_VENDOR_WHERE, openingHoursSchema, type Prisma } from '@app/db';
import { MockWalletProvider } from '@app/integrations';
import { getClockNowMs } from './clock';
import { prisma } from './db';
import { notifyOrderChanged } from './notify';
import { OrderError } from './orderErrors';
import type { PlaceOrderInput } from './orderInput';
import { orderSelect, toOrderView, type OrderView } from './orderViews';
import { estimateWait, latenessFor, type VendorWaitState } from './waitEstimate';
import { loadWaitStates } from './waitState';
import { ledgerStore } from './walletStore';

const SLOT_MS = SLOT_MINUTES * MS_PER_MINUTE;
const SLOT_HORIZON = 48;
const MAX_LEAD_MS = 12 * 60 * MS_PER_MINUTE;

type Tx = Prisma.TransactionClient;

async function lockUser(tx: Tx, userId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
}

async function vendorRanges(
  db: Tx | typeof prisma,
  hoursJson: unknown,
  now: number,
): Promise<OpenRange[]> {
  const holidayRows = await db.publicHoliday.findMany({ select: { date: true } });
  const holidays = new Set(holidayRows.map((row) => row.date.toISOString().slice(0, 10)));
  const hours = openingHoursSchema.parse(hoursJson);
  return [
    ...openRangesOn(hours, hktDate(now), holidays),
    ...openRangesOn(hours, hktDate(now + MS_PER_DAY), holidays),
  ];
}

interface Priced {
  rows: { id: string; name: string; priceHkd: number; prepPriorMin: number; qty: number }[];
  totalHkd: number;
  prepMinutes: number;
}

function priceAndPrep(
  rows: { id: string; name: string; priceHkd: number; prepPriorMin: number }[],
  quantities: ReadonlyMap<string, number>,
  state: VendorWaitState | undefined,
): Priced {
  const lines = rows.map((row) => ({ ...row, qty: quantities.get(row.id) ?? 1 }));
  const units = lines.flatMap((line) =>
    Array.from({ length: line.qty }, () =>
      itemPrep({
        learned: state?.payload?.prep[line.name]?.minutes ?? null,
        vendorPrior: line.prepPriorMin,
        categoryPrior: line.prepPriorMin,
      }),
    ),
  );
  return {
    rows: lines,
    totalHkd: lines.reduce((sum, line) => sum + line.priceHkd * line.qty, 0),
    prepMinutes: orderPrep(units),
  };
}

async function nextFreeSlotStart(
  tx: Tx,
  vendorId: string,
  ranges: readonly OpenRange[],
  after: number,
  defaultCap: number,
): Promise<number | null> {
  const grid = slotGrid({
    ranges,
    from: after + SLOT_MS,
    horizonSlots: SLOT_HORIZON,
    cap: defaultCap,
    bookedBySlotStart: new Map(),
  });
  const rows = await tx.pickupSlot.findMany({
    where: { vendorId, slotStart: { in: grid.map((slot) => new Date(slot.slotStart)) } },
  });
  const full = new Set(
    rows.filter((row) => row.bookedCount >= row.cap).map((row) => row.slotStart.getTime()),
  );
  return grid.find((slot) => !full.has(slot.slotStart))?.slotStart ?? null;
}

export async function placeOrder(userId: string, input: PlaceOrderInput): Promise<OrderView> {
  const now = await getClockNowMs();
  const orderId = randomUUID();

  await prisma.$transaction(
    async (tx) => {
      await lockUser(tx, userId);

      const vendor = await tx.vendor.findFirst({
        where: { id: input.vendorId, ...ACTIVE_VENDOR_WHERE },
        select: { id: true, pickupEnabled: true, paused: true, openingHours: true },
      });
      if (vendor === null || !vendor.pickupEnabled) throw new OrderError(409, 'vendor_unavailable');
      if (vendor.paused) throw new OrderError(409, 'vendor_paused');
      const ranges = await vendorRanges(tx, vendor.openingHours, now);
      if (input.pickup.kind === 'asap' && !isOpenAt(ranges, now)) {
        throw new OrderError(409, 'vendor_closed');
      }

      const wanted = input.items.map((item) => item.menuItemId);
      const rows = await tx.menuItem.findMany({
        where: {
          id: { in: wanted },
          vendorId: vendor.id,
          deletedAt: null,
          stockStatus: 'in_stock',
        },
        select: { id: true, name: true, priceHkd: true, prepPriorMin: true },
      });
      if (rows.length !== wanted.length) {
        const found = new Set(rows.map((row) => row.id));
        throw new OrderError(409, 'item_unavailable', {
          menuItemIds: wanted.filter((id) => !found.has(id)),
        });
      }

      const state = (await loadWaitStates([vendor.id], now)).get(vendor.id);
      const priced = priceAndPrep(
        rows,
        new Map(input.items.map((item) => [item.menuItemId, item.qty])),
        state,
      );
      if (priced.totalHkd > ORDER_MAX_TOTAL_HKD) throw new OrderError(400, 'total_too_high');
      const estimate = estimateWait(state, now, priced.prepMinutes);

      let slotStart: number | null = null;
      let fireAtMs: number | null = null;
      let prediction = {
        base: now + estimate.baseMinutes * MS_PER_MINUTE,
        low: now + estimate.lowMinutes * MS_PER_MINUTE,
        point: now + estimate.pointMinutes * MS_PER_MINUTE,
        high: now + estimate.highMinutes * MS_PER_MINUTE,
      };

      if (input.pickup.kind === 'scheduled') {
        slotStart = input.pickup.slotStart;
        const earliest = earliestSlotStart(now, estimate.queueDelayMinutes, priced.prepMinutes);
        const inGrid = slotGrid({
          ranges,
          from: slotStart,
          horizonSlots: 1,
          cap: 1,
          bookedBySlotStart: new Map(),
        });
        if (slotStart % SLOT_MS !== 0 || slotStart > now + MAX_LEAD_MS || inGrid.length === 0) {
          throw new OrderError(409, 'slot_invalid');
        }
        if (slotStart < earliest) {
          throw new OrderError(409, 'slot_invalid', { earliestSlotStart: earliest });
        }

        const defaultCap = defaultSlotCap(state?.payload?.mu.perMinute ?? MU_FLOOR_PER_MINUTE);
        const slot = await tx.pickupSlot.upsert({
          where: { vendorId_slotStart: { vendorId: vendor.id, slotStart: new Date(slotStart) } },
          create: { vendorId: vendor.id, slotStart: new Date(slotStart), cap: defaultCap },
          update: {},
        });
        const claimed = await tx.pickupSlot.updateMany({
          where: {
            vendorId: vendor.id,
            slotStart: new Date(slotStart),
            bookedCount: { lt: slot.cap },
          },
          data: { bookedCount: { increment: 1 } },
        });
        if (claimed.count === 0) {
          const next = await nextFreeSlotStart(tx, vendor.id, ranges, slotStart, defaultCap);
          throw new OrderError(409, 'slot_full', next === null ? {} : { nextSlotStart: next });
        }

        const lateness = latenessFor(state);
        prediction = scheduledPrediction(slotStart, lateness.q50, lateness.q90);
        fireAtMs = fireAt({
          slotStart,
          forecastQueueDelayMinutes: estimate.queueDelayMinutes,
          prepMinutes: priced.prepMinutes,
        });
      }

      await tx.order.create({
        data: {
          id: orderId,
          studentId: userId,
          vendorId: vendor.id,
          status: 'placed',
          totalHkd: priced.totalHkd,
          placedAt: new Date(now),
          fireAt: fireAtMs === null ? null : new Date(fireAtMs),
          slotStart: slotStart === null ? null : new Date(slotStart),
          predictedPoint: new Date(prediction.point),
          predictedLow: new Date(prediction.low),
          predictedHigh: new Date(prediction.high),
          predictedBase: new Date(prediction.base),
          backlogAtPlacement: estimate.backlog,
          modelVersion: MODEL_VERSION,
          items: {
            create: priced.rows.map((row) => ({
              menuItemId: row.id,
              qty: row.qty,
              priceHkdSnapshot: row.priceHkd,
              prepPriorSnapshotMin: row.prepPriorMin,
            })),
          },
        },
      });

      const store = ledgerStore(tx, now);
      const intent = await new MockWalletProvider(store).charge(userId, priced.totalHkd, orderId);
      if (intent.status !== 'captured') {
        throw new OrderError(402, 'insufficient_balance', {
          balanceHkd: await store.balanceHkd(userId),
          totalHkd: priced.totalHkd,
        });
      }
    },
    { timeout: 15_000 },
  );

  const view = await getOrder(userId, orderId);
  if (view === null) throw new OrderError(404, 'not_found');
  await notifyOrderChanged({
    id: view.id,
    vendorId: view.vendor.id,
    studentId: userId,
    status: view.status,
  });
  return view;
}

export async function getOrder(userId: string, orderId: string): Promise<OrderView | null> {
  const [row, now] = await Promise.all([
    prisma.order.findFirst({ where: { id: orderId, studentId: userId }, select: orderSelect }),
    getClockNowMs(),
  ]);
  return row === null ? null : toOrderView(row, now);
}

export async function listOrders(userId: string): Promise<OrderView[]> {
  const [rows, now] = await Promise.all([
    prisma.order.findMany({
      where: { studentId: userId },
      orderBy: { placedAt: 'desc' },
      take: 30,
      select: orderSelect,
    }),
    getClockNowMs(),
  ]);
  return rows.map((row) => toOrderView(row, now));
}

export async function cancelOrder(userId: string, orderId: string): Promise<OrderView> {
  const now = await getClockNowMs();
  const changed = await prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const order = await tx.order.findFirst({
      where: { id: orderId, studentId: userId },
      select: { id: true, status: true, vendorId: true, slotStart: true },
    });
    if (order === null) throw new OrderError(404, 'not_found');
    if (order.status === 'cancelled') return null;

    const result = await tx.order.updateMany({
      where: { id: orderId, studentId: userId, status: 'placed' },
      data: { status: 'cancelled', cancelledAt: new Date(now) },
    });
    if (result.count === 0) throw new OrderError(409, 'not_cancellable');

    await new MockWalletProvider(ledgerStore(tx, now)).refund(orderId);
    if (order.slotStart !== null) {
      await tx.pickupSlot.updateMany({
        where: { vendorId: order.vendorId, slotStart: order.slotStart, bookedCount: { gt: 0 } },
        data: { bookedCount: { decrement: 1 } },
      });
    }
    return order.vendorId;
  });

  const view = await getOrder(userId, orderId);
  if (view === null) throw new OrderError(404, 'not_found');
  if (changed !== null) {
    await notifyOrderChanged({
      id: orderId,
      vendorId: changed,
      studentId: userId,
      status: 'cancelled',
    });
  }
  return view;
}

export async function pickUpOrder(userId: string, orderId: string): Promise<OrderView> {
  const now = await getClockNowMs();
  const result = await prisma.order.updateMany({
    where: { id: orderId, studentId: userId, status: { in: ['accepted', 'preparing', 'ready'] } },
    data: { status: 'picked_up', pickedUpAt: new Date(now) },
  });

  const view = await getOrder(userId, orderId);
  if (view === null) throw new OrderError(404, 'not_found');
  if (result.count === 0 && view.status !== 'picked_up') throw new OrderError(409, 'not_ready');
  if (result.count === 1) {
    await notifyOrderChanged({
      id: orderId,
      vendorId: view.vendor.id,
      studentId: userId,
      status: 'picked_up',
    });
  }
  return view;
}

export interface WalletView {
  balanceHkd: number;
  entries: { id: string; deltaHkd: number; reason: string; orderId: string | null; at: number }[];
}

export async function walletView(userId: string): Promise<WalletView> {
  const [total, rows] = await Promise.all([
    prisma.walletLedger.aggregate({ where: { userId }, _sum: { deltaHkd: true } }),
    prisma.walletLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, deltaHkd: true, reason: true, refOrderId: true, createdAt: true },
    }),
  ]);
  return {
    balanceHkd: total._sum.deltaHkd ?? 0,
    entries: rows.map((row) => ({
      id: row.id,
      deltaHkd: row.deltaHkd,
      reason: row.reason,
      orderId: row.refOrderId,
      at: row.createdAt.getTime(),
    })),
  };
}

export interface SlotsView {
  now: number;
  earliestSlotStart: number;
  slots: { slotStart: number; cap: number; booked: number; free: boolean }[];
}

export async function slotsView(
  vendorId: string,
  quantities: ReadonlyMap<string, number>,
): Promise<SlotsView | null> {
  const now = await getClockNowMs();
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, ...ACTIVE_VENDOR_WHERE },
    select: { id: true, openingHours: true },
  });
  if (vendor === null) return null;

  const [state, items, ranges] = await Promise.all([
    loadWaitStates([vendor.id], now).then((states) => states.get(vendor.id)),
    prisma.menuItem.findMany({
      where: { vendorId: vendor.id, deletedAt: null, stockStatus: 'in_stock' },
      select: { id: true, name: true, priceHkd: true, prepPriorMin: true },
    }),
    vendorRanges(prisma, vendor.openingHours, now),
  ]);
  const chosen = items.filter((item) => quantities.has(item.id));
  const prepMinutes =
    chosen.length > 0
      ? priceAndPrep(chosen, quantities, state).prepMinutes
      : median(items.map((item) => item.prepPriorMin));
  const estimate = estimateWait(state, now, prepMinutes);
  const earliest = earliestSlotStart(now, estimate.queueDelayMinutes, prepMinutes);

  const defaultCap = defaultSlotCap(state?.payload?.mu.perMinute ?? MU_FLOOR_PER_MINUTE);
  const grid = slotGrid({
    ranges,
    from: earliest,
    horizonSlots: SLOT_HORIZON,
    cap: defaultCap,
    bookedBySlotStart: new Map(),
  }).slice(0, SLOT_CHOICES_SHOWN);
  const rows = await prisma.pickupSlot.findMany({
    where: { vendorId: vendor.id, slotStart: { in: grid.map((slot) => new Date(slot.slotStart)) } },
  });
  const byStart = new Map(rows.map((row) => [row.slotStart.getTime(), row]));
  return {
    now,
    earliestSlotStart: earliest,
    slots: grid.map((slot) => {
      const row = byStart.get(slot.slotStart);
      const cap = row?.cap ?? slot.cap;
      const booked = row?.bookedCount ?? 0;
      return { slotStart: slot.slotStart, cap, booked, free: booked < cap };
    }),
  };
}
