import { describe, expect, it } from 'vitest';
import {
  buildSalesView,
  hourOf,
  ordersPerHour,
  rangeStart,
  todayStart,
  topDishes,
  totalsFor,
  type SalesRow,
} from '../src/server/salesService';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 10, 17, 4, 15);
const MIDNIGHT = Date.UTC(2026, 10, 16, 16, 0);

function row(
  id: string,
  atHkt: { hour: number; minute?: number; daysBack?: number },
  totalHkd: number,
  items: [string, number][],
  status: SalesRow['status'] = 'completed',
): SalesRow {
  return {
    id,
    placedAt:
      MIDNIGHT - (atHkt.daysBack ?? 0) * DAY + atHkt.hour * HOUR + (atHkt.minute ?? 0) * 60_000,
    status,
    totalHkd,
    items: items.map(([name, qty]) => ({ name, qty })),
  };
}

describe('day and range boundaries', () => {
  it('starts today at midnight Hong Kong time on the demo clock', () => {
    expect(todayStart(NOW)).toBe(MIDNIGHT);
    expect(rangeStart('today', NOW)).toBe(MIDNIGHT);
    expect(rangeStart('7d', NOW)).toBe(MIDNIGHT - 6 * DAY);
  });

  it('reads the Hong Kong hour of an order', () => {
    expect(hourOf(MIDNIGHT + 12 * HOUR + 59 * 60_000)).toBe(12);
    expect(hourOf(MIDNIGHT + 23 * HOUR + 59 * 60_000)).toBe(23);
    expect(hourOf(MIDNIGHT)).toBe(0);
  });
});

describe('totals', () => {
  it('adds up revenue and orders, leaves cancelled orders out, and averages', () => {
    const rows = [
      row('a', { hour: 12 }, 40, [['Noodles', 1]]),
      row('b', { hour: 12 }, 25, [['Tea', 2]]),
      row('c', { hour: 13 }, 99, [['Noodles', 3]], 'cancelled'),
      row('d', { hour: 13 }, 30, [['Rice', 1]], 'placed'),
    ];
    expect(totalsFor(rows)).toEqual({ revenueHkd: 95, orders: 3, averageHkd: 31.7 });
  });

  it('has no average when there are no orders', () => {
    expect(totalsFor([])).toEqual({ revenueHkd: 0, orders: 0, averageHkd: null });
    expect(totalsFor([row('a', { hour: 9 }, 10, [], 'cancelled')]).averageHkd).toBeNull();
  });
});

describe('top dishes', () => {
  it('ranks by quantity, then name, keeps five, and ignores cancelled orders', () => {
    const rows = [
      row('1', { hour: 12 }, 1, [
        ['Noodles', 3],
        ['Tea', 1],
      ]),
      row('2', { hour: 12 }, 1, [
        ['Rice', 3],
        ['Soup', 1],
        ['Bun', 1],
      ]),
      row('3', { hour: 12 }, 1, [
        ['Pie', 1],
        ['Cake', 1],
      ]),
      row('4', { hour: 12 }, 1, [['Ghost', 99]], 'cancelled'),
    ];
    const top = topDishes(rows);
    expect(top).toHaveLength(5);
    expect(top.slice(0, 2)).toEqual([
      { name: 'Noodles', qty: 3 },
      { name: 'Rice', qty: 3 },
    ]);
    expect(top.map((dish) => dish.name)).not.toContain('Ghost');
  });
});

describe('orders per hour', () => {
  it('always shows 08:00 to 19:00, and adds an hour outside them that has orders', () => {
    const rows = [
      row('a', { hour: 12, minute: 5 }, 1, []),
      row('b', { hour: 12, minute: 50 }, 1, []),
      row('c', { hour: 7 }, 1, []),
      row('d', { hour: 12 }, 1, [], 'cancelled'),
    ];
    const bars = ordersPerHour(rows);
    expect(bars.map((bar) => bar.hour)).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(bars.find((bar) => bar.hour === 12)?.orders).toBe(2);
    expect(bars.find((bar) => bar.hour === 7)?.orders).toBe(1);
  });
});

describe('buildSalesView', () => {
  const app = [row('app', { hour: 12 }, 30, [['Noodles', 1]])];
  const sample = [
    row('s-today', { hour: 10 }, 20, [['Tea', 1]]),
    row('s-old', { hour: 11, daysBack: 3 }, 50, [['Rice', 2]]),
  ];

  it('keeps real orders and sample orders in separate lists, with separate counts', () => {
    const view = buildSalesView('7d', NOW, app, sample);
    expect(view.appOrders.map((entry) => entry.id)).toEqual(['app']);
    expect(view.sampleOrders.map((entry) => entry.id)).toEqual(['s-today', 's-old']);
    expect(view.counts).toEqual({ app: 1, sample: 2 });
  });

  it("totals today's numbers from both kinds, and the top dishes and hours from the whole range", () => {
    const view = buildSalesView('7d', NOW, app, sample);
    expect(view.today).toEqual({ revenueHkd: 50, orders: 2, averageHkd: 25 });
    expect(view.top.map((dish) => dish.name)).toContain('Rice');
    expect(view.hourly.find((bar) => bar.hour === 11)?.orders).toBe(1);
  });

  it('lists the newest first and keeps at most 100 of each', () => {
    const many = Array.from({ length: 130 }, (_, index) =>
      row(`m${index}`, { hour: 9, minute: index % 60, daysBack: Math.floor(index / 60) }, 1, []),
    );
    const view = buildSalesView('7d', NOW, [], many);
    expect(view.sampleOrders).toHaveLength(100);
    const times = view.sampleOrders.map((entry) => entry.placedAt);
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(view.counts.sample).toBe(130);
  });

  it('shows an app order first by position, never mixed into the sample list', () => {
    const view = buildSalesView('today', NOW, app, sample);
    expect(view.appOrders.every((entry) => entry.id === 'app')).toBe(true);
    expect(view.sampleOrders.some((entry) => entry.id === 'app')).toBe(false);
  });
});
