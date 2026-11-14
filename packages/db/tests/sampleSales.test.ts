import { describe, expect, it } from 'vitest';
import { SAMPLE_DAYS, buildSampleSales, type SampleVendorInput } from '../src/seed/sampleSales.js';

const ANCHOR = Date.parse('2026-11-17T12:15:00+08:00');
const DAY = 86_400_000;
const MIDNIGHT = Date.parse('2026-11-17T00:00:00+08:00');

const vendors: SampleVendorInput[] = [
  {
    id: 'vendor-a',
    items: [
      { name: 'Noodles', priceHkd: 40 },
      { name: 'Tea', priceHkd: 12 },
      { name: 'Rice', priceHkd: 45 },
    ],
  },
  { id: 'vendor-b', items: [{ name: 'Bun', priceHkd: 10 }] },
  { id: 'vendor-empty', items: [] },
];

describe('sample sales for the demo', () => {
  const orders = buildSampleSales(vendors, ANCHOR);

  it('is the same every time it is built, so a reset gives the same page', () => {
    expect(buildSampleSales(vendors, ANCHOR)).toEqual(orders);
  });

  it('covers the last 7 days up to the anchor and never the future', () => {
    expect(SAMPLE_DAYS).toBe(7);
    const earliest = Math.min(...orders.map((order) => order.placedAt.getTime()));
    const latest = Math.max(...orders.map((order) => order.placedAt.getTime()));
    expect(earliest).toBeGreaterThanOrEqual(MIDNIGHT - 6 * DAY);
    expect(latest).toBeLessThanOrEqual(ANCHOR);
    const days = new Set(
      orders.map((order) => Math.floor((order.placedAt.getTime() - MIDNIGHT + 7 * DAY) / DAY)),
    );
    expect(days.size).toBe(7);
  });

  it('makes orders only for vendors that have dishes, from their own dishes', () => {
    expect(orders.some((order) => order.vendorId === 'vendor-empty')).toBe(false);
    for (const order of orders) {
      const vendor = vendors.find((entry) => entry.id === order.vendorId);
      for (const item of order.items) {
        expect(vendor?.items.map((dish) => dish.name)).toContain(item.name);
      }
    }
  });

  it('adds up each total from its lines and mostly completes the orders', () => {
    for (const order of orders) {
      expect(order.totalHkd).toBe(
        order.items.reduce((sum, item) => sum + item.priceHkd * item.qty, 0),
      );
      expect(order.items.length).toBeGreaterThan(0);
      expect(['completed', 'cancelled']).toContain(order.status);
    }
    const cancelled = orders.filter((order) => order.status === 'cancelled').length;
    expect(cancelled).toBeGreaterThan(0);
    expect(cancelled / orders.length).toBeLessThan(0.15);
  });

  it('peaks at lunch time', () => {
    const byHour = new Map<number, number>();
    for (const order of orders) {
      const hour = new Date(order.placedAt.getTime() + 8 * 3_600_000).getUTCHours();
      byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
    }
    const busiest = [...byHour].sort((a, b) => b[1] - a[1])[0]?.[0];
    expect([11, 12, 13]).toContain(busiest);
    expect(byHour.has(3)).toBe(false);
  });
});
