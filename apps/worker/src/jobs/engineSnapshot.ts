import {
  MODEL_VERSION,
  MS_PER_DAY,
  MS_PER_MINUTE,
  SLOT_MINUTES,
  busyMinuteRates,
  hktDate,
  hktMidnight,
  openRangesOn,
  orderPrep,
  weekTypeLookup,
  type BusyOrder,
  type OpeningHours,
  type TicketSlot,
} from '@app/core';
import { ACTIVE_VENDOR_WHERE, openingHoursSchema, type PrismaClient } from '@app/db';
import { SNAPSHOT_HISTORY_DAYS } from '../config.js';
import { notify } from '../notifier.js';
import {
  buildSnapshotPayload,
  type DayBusyRates,
  type SnapshotOrder,
  type TicketRow,
} from '../snapshotPayload.js';

const SLOT_MS = SLOT_MINUTES * MS_PER_MINUTE;

export interface LoadedOrder {
  placedAt: Date;
  readyAt: Date | null;
  pickedUpAt: Date | null;
  slotStart: Date | null;
  predictedPoint: Date;
  predictedBase: Date;
  backlogAtPlacement: number;
  items: { qty: number; prepPriorSnapshotMin: number; menuItem: { name: string } }[];
}

export function toSnapshotOrder(order: LoadedOrder): SnapshotOrder {
  const [only] = order.items;
  return {
    placedAt: order.placedAt.getTime(),
    readyAt: order.readyAt?.getTime() ?? null,
    pickedUpAt: order.pickedUpAt?.getTime() ?? null,
    slotStart: order.slotStart?.getTime() ?? null,
    predictedPoint: order.predictedPoint.getTime(),
    predictedBase: order.predictedBase.getTime(),
    backlogAtPlacement: order.backlogAtPlacement,
    singleItemName: order.items.length === 1 && only?.qty === 1 ? only.menuItem.name : null,
  };
}

function priorPrepMinutes(order: LoadedOrder): number {
  return orderPrep(order.items.map((item) => item.prepPriorSnapshotMin));
}

function groupByDate<T>(rows: readonly T[], at: (row: T) => number): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const date = hktDate(at(row));
    groups.set(date, [...(groups.get(date) ?? []), row]);
  }
  return groups;
}

export function completedDayBusyRates(
  hours: OpeningHours,
  holidays: ReadonlySet<string>,
  orders: readonly LoadedOrder[],
  tickets: readonly TicketRow[],
  from: number,
  until: number,
): DayBusyRates[] {
  const ordersByDate = groupByDate(orders, (order) => order.placedAt.getTime());
  const ticketsByDate = groupByDate(tickets, (row) => row.slotStart);
  const days: DayBusyRates[] = [];
  for (
    let midnight = hktMidnight(hktDate(from));
    midnight + MS_PER_DAY <= until;
    midnight += MS_PER_DAY
  ) {
    const date = hktDate(midnight);
    const dayOrders = ordersByDate.get(date) ?? [];
    if (dayOrders.length === 0) continue;
    const busyOrders: BusyOrder[] = dayOrders.map((order) => ({
      placedAt: order.placedAt.getTime(),
      priorPrepMinutes: priorPrepMinutes(order),
      tapAt: order.readyAt?.getTime() ?? null,
      pickedUpAt: order.pickedUpAt?.getTime() ?? null,
    }));
    const daySlots: TicketSlot[] = (ticketsByDate.get(date) ?? []).map((row) => ({
      slotStart: row.slotStart,
      count: row.count,
    }));
    days.push({
      dayEnd: midnight + MS_PER_DAY,
      rates: busyMinuteRates({
        ranges: openRangesOn(hours, date, holidays),
        orders: busyOrders,
        tickets: daySlots,
      }),
    });
  }
  return days;
}

function appOrdersBySlot(orders: readonly LoadedOrder[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const order of orders) {
    const slot = Math.floor(order.placedAt.getTime() / SLOT_MS) * SLOT_MS;
    counts.set(slot, (counts.get(slot) ?? 0) + 1);
  }
  return counts;
}

export async function runEngineSnapshots(
  db: PrismaClient,
  boundaries: readonly number[],
): Promise<void> {
  const first = boundaries[0];
  const last = boundaries.at(-1);
  if (first === undefined || last === undefined) return;
  const rangeFrom = new Date(first - SNAPSHOT_HISTORY_DAYS * MS_PER_DAY);
  const rangeTo = new Date(last);

  const [vendors, weeks, holidayRows, existing] = await Promise.all([
    db.vendor.findMany({
      where: ACTIVE_VENDOR_WHERE,
      select: {
        id: true,
        openingHours: true,
        capacityPriorPerMin: true,
        ticketsIncludeAppOrders: true,
      },
    }),
    db.academicWeek.findMany({ select: { weekStart: true, type: true } }),
    db.publicHoliday.findMany({ select: { date: true } }),
    db.engineSnapshot.findMany({
      where: { computedAt: { in: boundaries.map((boundary) => new Date(boundary)) } },
      select: { vendorId: true, computedAt: true },
    }),
  ]);
  const weekTypeOf = weekTypeLookup(weeks);
  const holidays = new Set(holidayRows.map((row) => row.date.toISOString().slice(0, 10)));
  const done = new Set(existing.map((row) => `${row.vendorId}|${row.computedAt.getTime()}`));

  for (const vendor of vendors) {
    const missing = boundaries.filter((boundary) => !done.has(`${vendor.id}|${boundary}`));
    if (missing.length === 0) continue;

    const [ticketRows, orders] = await Promise.all([
      db.ticketCount.findMany({
        where: { vendorId: vendor.id, slotStart: { gte: rangeFrom, lt: rangeTo } },
        select: { slotStart: true, count: true },
      }),
      db.order.findMany({
        where: {
          vendorId: vendor.id,
          status: { not: 'cancelled' },
          placedAt: { gte: rangeFrom, lt: rangeTo },
        },
        select: {
          placedAt: true,
          readyAt: true,
          pickedUpAt: true,
          slotStart: true,
          predictedPoint: true,
          predictedBase: true,
          backlogAtPlacement: true,
          items: {
            select: { qty: true, prepPriorSnapshotMin: true, menuItem: { select: { name: true } } },
          },
        },
      }),
    ]);
    const tickets: TicketRow[] = ticketRows.map((row) => ({
      slotStart: row.slotStart.getTime(),
      count: row.count,
    }));
    const hours = openingHoursSchema.parse(vendor.openingHours);
    const dayBusyRates = completedDayBusyRates(
      hours,
      holidays,
      orders,
      tickets,
      rangeFrom.getTime(),
      last,
    );
    const snapshotOrders = orders.map(toSnapshotOrder);
    const slotCounts = appOrdersBySlot(orders);

    await db.engineSnapshot.createMany({
      data: missing.map((boundary) => ({
        vendorId: vendor.id,
        computedAt: new Date(boundary),
        modelVersion: MODEL_VERSION,
        payload: buildSnapshotPayload({
          boundary,
          ingestedFrom: boundary - SNAPSHOT_HISTORY_DAYS * MS_PER_DAY,
          capacityPriorPerMin: vendor.capacityPriorPerMin,
          ticketsIncludeAppOrders: vendor.ticketsIncludeAppOrders,
          tickets,
          orders: snapshotOrders,
          appOrdersBySlot: slotCounts,
          dayBusyRates,
          openRanges: openRangesOn(hours, hktDate(boundary), holidays),
          weekTypeOf,
        }),
      })),
    });
    for (const boundary of missing) {
      await notify(db, 'snapshot_written', {
        vendorId: vendor.id,
        computedAt: new Date(boundary).toISOString(),
      });
    }
  }
}
