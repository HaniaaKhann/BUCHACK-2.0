import { describe, expect, it } from 'vitest';
import { MS_PER_MINUTE, SLOT_MINUTES } from '../../src/config.js';
import { busyMinuteRates, labelAvailableAt, type BusyOrder } from '../../src/engine/busyMinutes.js';

const SLOT_START = Date.UTC(2026, 10, 16, 4, 0);
const SLOT_END = SLOT_START + SLOT_MINUTES * MS_PER_MINUTE;

function minutes(offset: number): number {
  return SLOT_START + offset * MS_PER_MINUTE;
}

function order(placed: number, prep: number, tap: number | null): BusyOrder {
  return {
    placedAt: minutes(placed),
    priorPrepMinutes: prep,
    tapAt: tap === null ? null : minutes(tap),
    pickedUpAt: null,
  };
}

describe('labelAvailableAt', () => {
  it('prefers the tap, then the pickup, then never', () => {
    expect(labelAvailableAt({ ...order(0, 1, 5), pickedUpAt: minutes(9) })).toBe(minutes(5));
    expect(labelAvailableAt({ ...order(0, 1, null), pickedUpAt: minutes(9) })).toBe(minutes(9));
    expect(labelAvailableAt(order(0, 1, null))).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('busyMinuteRates', () => {
  const ranges = [{ openAt: SLOT_START, closeAt: SLOT_END }];

  it('counts taps in busy minutes and scales by the app share of the slot', () => {
    const rates = busyMinuteRates({
      ranges,
      orders: [order(0, 2, 5.1667), order(1, 2, 7)],
      tickets: [{ slotStart: SLOT_START, count: 2 }],
    });
    expect(rates).toHaveLength(5);
    for (const rate of rates) expect(rate).toBeCloseTo(0.4, 10);
  });

  it('ignores minutes where every order is still inside its prior prep time', () => {
    const rates = busyMinuteRates({
      ranges,
      orders: [order(0, 10, 14)],
      tickets: [{ slotStart: SLOT_START, count: 0 }],
    });
    expect(rates).toEqual([0, 0, 0, 0]);
  });

  it('returns nothing for a slot with no app orders', () => {
    expect(busyMinuteRates({ ranges, orders: [], tickets: [] })).toEqual([]);
  });

  it('treats a slot with no ticket row as zero tickets', () => {
    const rates = busyMinuteRates({ ranges, orders: [order(0, 2, 5.1667)], tickets: [] });
    expect(rates).toHaveLength(4);
    for (const rate of rates) expect(rate).toBeCloseTo(0.25, 10);
  });

  it('starts at the slot that contains the opening time', () => {
    const rates = busyMinuteRates({
      ranges: [{ openAt: minutes(7), closeAt: SLOT_END }],
      orders: [order(0, 2, 5.1667)],
      tickets: [],
    });
    expect(rates).toHaveLength(4);
  });
});
