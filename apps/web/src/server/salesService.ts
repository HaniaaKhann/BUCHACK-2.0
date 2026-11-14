import { hktDate, hktMidnight } from '@app/core';
import { SIM_EMAIL_DOMAIN } from '@app/db';
import { getClockNowMs } from './clock';
import { prisma } from './db';

export type SalesRange = 'today' | '7d';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const HKT_OFFSET_MS = 8 * HOUR_MS;
const ROW_LIMIT = 100;
const TOP_DISHES = 5;
const FIRST_HOUR = 8;
const LAST_HOUR = 19;

export type SalesStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'picked_up'
  | 'cancelled';

export interface SalesRow {
  id: string;
  placedAt: number;
  status: SalesStatus;
  totalHkd: number;
  items: { name: string; qty: number }[];
}

export interface TodayTotals {
  revenueHkd: number;
  orders: number;
  averageHkd: number | null;
}

export interface HourBar {
  hour: number;
  orders: number;
}

export interface TopDish {
  name: string;
  qty: number;
}

export interface SalesView {
  range: SalesRange;
  now: number;
  today: TodayTotals;
  top: TopDish[];
  hourly: HourBar[];
  appOrders: SalesRow[];
  sampleOrders: SalesRow[];
  counts: { app: number; sample: number };
}

const counted = (row: SalesRow): boolean => row.status !== 'cancelled';

export function todayStart(now: number): number {
  return hktMidnight(hktDate(now));
}

export function rangeStart(range: SalesRange, now: number): number {
  const start = todayStart(now);
  return range === 'today' ? start : start - 6 * DAY_MS;
}

export function hourOf(placedAt: number): number {
  return Math.floor(((placedAt + HKT_OFFSET_MS) % DAY_MS) / HOUR_MS);
}

export function totalsFor(rows: readonly SalesRow[]): TodayTotals {
  const sales = rows.filter(counted);
  const revenueHkd = sales.reduce((sum, row) => sum + row.totalHkd, 0);
  return {
    revenueHkd,
    orders: sales.length,
    averageHkd: sales.length === 0 ? null : Math.round((revenueHkd / sales.length) * 10) / 10,
  };
}

export function topDishes(rows: readonly SalesRow[]): TopDish[] {
  const totals = new Map<string, number>();
  for (const row of rows.filter(counted)) {
    for (const item of row.items) totals.set(item.name, (totals.get(item.name) ?? 0) + item.qty);
  }
  return [...totals]
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name))
    .slice(0, TOP_DISHES);
}

export function ordersPerHour(rows: readonly SalesRow[]): HourBar[] {
  const byHour = new Map<number, number>();
  for (const row of rows.filter(counted)) {
    const hour = hourOf(row.placedAt);
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
  }
  const hours = new Set<number>(byHour.keys());
  for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour += 1) hours.add(hour);
  return [...hours].sort((a, b) => a - b).map((hour) => ({ hour, orders: byHour.get(hour) ?? 0 }));
}

export function buildSalesView(
  range: SalesRange,
  now: number,
  appRows: readonly SalesRow[],
  sampleRows: readonly SalesRow[],
): SalesView {
  const newestFirst = (a: SalesRow, b: SalesRow): number => b.placedAt - a.placedAt;
  const all = [...appRows, ...sampleRows];
  const start = todayStart(now);
  return {
    range,
    now,
    today: totalsFor(all.filter((row) => row.placedAt >= start)),
    top: topDishes(all),
    hourly: ordersPerHour(all),
    appOrders: [...appRows].sort(newestFirst).slice(0, ROW_LIMIT),
    sampleOrders: [...sampleRows].sort(newestFirst).slice(0, ROW_LIMIT),
    counts: { app: appRows.length, sample: sampleRows.length },
  };
}

interface StoredItem {
  name: string;
  qty: number;
}

function storedItems(value: unknown): StoredItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const { name, qty } = entry as { name?: unknown; qty?: unknown };
    return typeof name === 'string' && typeof qty === 'number' ? [{ name, qty }] : [];
  });
}

export async function loadSalesView(vendorId: string, range: SalesRange): Promise<SalesView> {
  const now = await getClockNowMs();
  const from = new Date(rangeStart(range, now));
  const [real, sample] = await Promise.all([
    prisma.order.findMany({
      where: {
        vendorId,
        placedAt: { gte: from },
        student: { NOT: { email: { endsWith: `@${SIM_EMAIL_DOMAIN}` } } },
      },
      select: {
        id: true,
        status: true,
        totalHkd: true,
        placedAt: true,
        items: { select: { qty: true, menuItem: { select: { name: true } } } },
      },
    }),
    prisma.sampleVendorOrder.findMany({
      where: { vendorId, placedAt: { gte: from } },
      select: { id: true, status: true, totalHkd: true, placedAt: true, items: true },
    }),
  ]);
  const appRows: SalesRow[] = real.map((row) => ({
    id: row.id,
    placedAt: row.placedAt.getTime(),
    status: row.status,
    totalHkd: row.totalHkd,
    items: row.items.map((item) => ({ name: item.menuItem.name, qty: item.qty })),
  }));
  const sampleRows: SalesRow[] = sample.map((row) => ({
    id: row.id,
    placedAt: row.placedAt.getTime(),
    status: row.status === 'cancelled' ? 'cancelled' : 'completed',
    totalHkd: row.totalHkd,
    items: storedItems(row.items),
  }));
  return buildSalesView(range, now, appRows, sampleRows);
}
