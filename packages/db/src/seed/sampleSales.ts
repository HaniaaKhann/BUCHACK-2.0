import type { PrismaClient } from '@prisma/client';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const HKT_OFFSET_MS = 8 * HOUR_MS;
export const SAMPLE_DAYS = 7;

const HOUR_WEIGHTS: readonly number[] = [
  0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 4, 8, 14, 10, 5, 4, 4, 3, 2, 1, 1, 0, 0, 0,
];

export interface SampleVendorInput {
  id: string;
  items: readonly { name: string; priceHkd: number }[];
}

export interface SampleOrderInput {
  vendorId: string;
  placedAt: Date;
  status: 'completed' | 'cancelled';
  totalHkd: number;
  items: { name: string; qty: number; priceHkd: number }[];
}

function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  }
  return value >>> 0;
}

function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hktDayStart(ms: number): number {
  return Math.floor((ms + HKT_OFFSET_MS) / DAY_MS) * DAY_MS - HKT_OFFSET_MS;
}

function pickHour(random: () => number): number {
  const total = HOUR_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
  let target = random() * total;
  for (let hour = 0; hour < HOUR_WEIGHTS.length; hour += 1) {
    target -= HOUR_WEIGHTS[hour] ?? 0;
    if (target < 0) return hour;
  }
  return 12;
}

export function buildSampleSales(
  vendors: readonly SampleVendorInput[],
  anchorMs: number,
): SampleOrderInput[] {
  const today = hktDayStart(anchorMs);
  const orders: SampleOrderInput[] = [];
  for (const vendor of vendors) {
    if (vendor.items.length === 0) continue;
    for (let back = 0; back < SAMPLE_DAYS; back += 1) {
      const dayStart = today - back * DAY_MS;
      const random = generator(hash(`${vendor.id}:${dayStart}`));
      const weekday = new Date(dayStart + HKT_OFFSET_MS).getUTCDay();
      const busy = weekday === 0 || weekday === 6 ? 0.4 : 1;
      const count = Math.round((14 + (hash(vendor.id) % 22)) * busy);
      for (let index = 0; index < count; index += 1) {
        const placedAt =
          dayStart +
          pickHour(random) * HOUR_MS +
          Math.floor(random() * 60) * 60_000 +
          Math.floor(random() * 60) * 1000;
        if (placedAt > anchorMs) continue;
        const lines = 1 + Math.floor(random() * 3);
        const chosen = new Map<number, number>();
        for (let line = 0; line < lines; line += 1) {
          const itemIndex = Math.floor(random() * vendor.items.length);
          chosen.set(itemIndex, random() < 0.15 ? 2 : 1);
        }
        const items = [...chosen].flatMap(([itemIndex, qty]) => {
          const item = vendor.items[itemIndex];
          return item === undefined ? [] : [{ name: item.name, qty, priceHkd: item.priceHkd }];
        });
        orders.push({
          vendorId: vendor.id,
          placedAt: new Date(placedAt),
          status: random() < 0.04 ? 'cancelled' : 'completed',
          totalHkd: items.reduce((sum, item) => sum + item.priceHkd * item.qty, 0),
          items,
        });
      }
    }
  }
  return orders;
}

export async function writeSampleSales(db: PrismaClient, anchorMs: number): Promise<number> {
  const vendors = await db.vendor.findMany({
    where: { status: 'open' },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      menuItems: {
        where: { isDemo: true, deletedAt: null },
        orderBy: { name: 'asc' },
        select: { name: true, priceHkd: true },
      },
    },
  });
  const orders = buildSampleSales(
    vendors.map((vendor) => ({ id: vendor.id, items: vendor.menuItems })),
    anchorMs,
  );
  await db.sampleVendorOrder.deleteMany({});
  const chunk = 1000;
  for (let start = 0; start < orders.length; start += chunk) {
    await db.sampleVendorOrder.createMany({ data: orders.slice(start, start + chunk) });
  }
  return orders.length;
}
