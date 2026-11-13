import { describe, expect, it } from 'vitest';
import {
  buildSnapshotPayload,
  type SnapshotInput,
  type SnapshotOrder,
} from '../src/snapshotPayload.js';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const BOUNDARY = Date.UTC(2026, 10, 17, 4, 15);

function baseInput(overrides: Partial<SnapshotInput> = {}): SnapshotInput {
  return {
    boundary: BOUNDARY,
    ingestedFrom: BOUNDARY - 56 * DAY,
    capacityPriorPerMin: null,
    ticketsIncludeAppOrders: false,
    tickets: [],
    orders: [],
    appOrdersBySlot: new Map(),
    dayBusyRates: [],
    weekTypeOf: () => 'teaching',
    ...overrides,
  };
}

function order(placedMinutesBefore: number, overrides: Partial<SnapshotOrder> = {}): SnapshotOrder {
  const placedAt = BOUNDARY - placedMinutesBefore * MINUTE;
  return {
    placedAt,
    readyAt: placedAt + 10 * MINUTE,
    pickedUpAt: placedAt + 12 * MINUTE,
    slotStart: null,
    predictedPoint: placedAt + 8 * MINUTE,
    predictedBase: placedAt + 7 * MINUTE,
    backlogAtPlacement: 0,
    singleItemName: null,
    ...overrides,
  };
}

describe('buildSnapshotPayload cold start', () => {
  it('writes eight empty forecast slots and cold-start statistics', () => {
    const payload = buildSnapshotPayload(baseInput());
    expect(payload.forecast).toHaveLength(8);
    expect(payload.forecast[0]?.slotStart).toBe(new Date(BOUNDARY).toISOString());
    expect(payload.forecast[1]?.slotStart).toBe(new Date(BOUNDARY + 15 * MINUTE).toISOString());
    expect(payload.forecast.every((slot) => slot.lambdaPerMinute === 0)).toBe(true);
    expect(payload.mu.perMinute).toBe(0.05);
    expect(payload.bias).toEqual({ value: null, samples: 0 });
    expect(payload.residuals).toEqual([]);
    expect(payload.prep).toEqual({});
    expect(payload.lateness).toEqual({ q50: 0, q90: 3, samples: 0 });
  });
});

describe('buildSnapshotPayload forecast', () => {
  const lastTuesday = Date.UTC(2026, 10, 10, 4, 15);
  const twoTuesdaysAgo = Date.UTC(2026, 10, 3, 4, 15);
  const pastTickets = [
    { slotStart: lastTuesday, count: 30 },
    { slotStart: twoTuesdaysAgo, count: 15 },
  ];

  it('weights matching past weeks by recency', () => {
    const payload = buildSnapshotPayload(baseInput({ tickets: pastTickets }));
    const expected = (0.4 * 30 + 0.3 * 15) / 0.7;
    expect(payload.forecast[0]?.lambdaSource).toBe('matching_weeks');
    expect(payload.forecast[0]?.lambdaPerMinute).toBeCloseTo(expected / 15, 10);
    expect(payload.forecast[0]?.expectedWalkIns).toBeCloseTo(expected, 10);
  });

  it('ignores tickets at or after the boundary', () => {
    const withFuture = buildSnapshotPayload(
      baseInput({ tickets: [...pastTickets, { slotStart: BOUNDARY, count: 999 }] }),
    );
    const without = buildSnapshotPayload(baseInput({ tickets: pastTickets }));
    expect(withFuture).toEqual(without);
  });

  it('ignores tickets older than the ingest window', () => {
    const payload = buildSnapshotPayload(
      baseInput({
        ingestedFrom: lastTuesday + MINUTE,
        tickets: [{ slotStart: lastTuesday, count: 30 }],
      }),
    );
    expect(payload.forecast[0]?.lambdaPerMinute).toBe(0);
  });

  it('subtracts app orders when tickets include them', () => {
    const payload = buildSnapshotPayload(
      baseInput({
        ticketsIncludeAppOrders: true,
        tickets: [
          { slotStart: lastTuesday, count: 30 },
          { slotStart: twoTuesdaysAgo, count: 30 },
        ],
        appOrdersBySlot: new Map([
          [lastTuesday, 15],
          [twoTuesdaysAgo, 15],
        ]),
      }),
    );
    expect(payload.forecast[0]?.expectedWalkIns).toBeCloseTo(15, 10);
  });
});

describe('buildSnapshotPayload learning', () => {
  it('seeds bias from the first labelled order and records its residual', () => {
    const payload = buildSnapshotPayload(baseInput({ orders: [order(60)] }));
    expect(payload.bias).toEqual({ value: 3, samples: 1 });
    expect(payload.residuals).toEqual([2]);
  });

  it('skips orders whose label is not yet known at the boundary', () => {
    const payload = buildSnapshotPayload(
      baseInput({ orders: [order(5, { readyAt: BOUNDARY + MINUTE, pickedUpAt: null })] }),
    );
    expect(payload.bias.samples).toBe(0);
  });

  it('drops labels that break the cleaning rules', () => {
    const payload = buildSnapshotPayload(
      baseInput({ orders: [order(120, { readyAt: BOUNDARY - 70 * MINUTE })] }),
    );
    expect(payload.bias.samples).toBe(0);
  });

  it('learns item prep from quiet single-item orders once there are enough', () => {
    const quiet = (minutesBefore: number): SnapshotOrder => {
      const readyAt = BOUNDARY - (minutesBefore - 6) * MINUTE;
      return order(minutesBefore, {
        readyAt,
        predictedPoint: readyAt,
        predictedBase: readyAt,
        singleItemName: 'Wonton noodles',
      });
    };
    const payload = buildSnapshotPayload(baseInput({ orders: [60, 50, 40, 30, 20].map(quiet) }));
    expect(payload.prep['Wonton noodles']).toEqual({ minutes: 6, samples: 5 });
  });

  it('does not learn item prep from busy orders', () => {
    const busy = (minutesBefore: number): SnapshotOrder =>
      order(minutesBefore, { singleItemName: 'Wonton noodles', backlogAtPlacement: 4 });
    const payload = buildSnapshotPayload(baseInput({ orders: [60, 50, 40, 30, 20].map(busy) }));
    expect(payload.prep).toEqual({});
  });

  it('takes scheduled lateness quantiles once there are enough scheduled orders', () => {
    const scheduled = (minutesBefore: number): SnapshotOrder => {
      const placedAt = BOUNDARY - minutesBefore * MINUTE;
      return order(minutesBefore, {
        slotStart: placedAt + 8 * MINUTE,
        readyAt: placedAt + 10 * MINUTE,
      });
    };
    const orders = Array.from({ length: 10 }, (_, index) => scheduled(100 - index * 5));
    const payload = buildSnapshotPayload(baseInput({ orders }));
    expect(payload.lateness).toEqual({ q50: 2, q90: 2, samples: 10 });
  });
});

describe('buildSnapshotPayload capacity', () => {
  const thirtyRates = Array.from({ length: 30 }, () => 2);

  it('blends the prior with learned busy-minute rates', () => {
    const payload = buildSnapshotPayload(
      baseInput({
        capacityPriorPerMin: 1,
        dayBusyRates: [{ dayEnd: BOUNDARY - DAY, rates: thirtyRates }],
      }),
    );
    expect(payload.mu.prior).toBe(1);
    expect(payload.mu.busyMinutes).toBe(30);
    expect(payload.mu.perMinute).toBeCloseTo(1.5, 10);
  });

  it('leaves out days that finish after the boundary', () => {
    const payload = buildSnapshotPayload(
      baseInput({
        capacityPriorPerMin: 1,
        dayBusyRates: [{ dayEnd: BOUNDARY + DAY, rates: thirtyRates }],
      }),
    );
    expect(payload.mu.busyMinutes).toBe(0);
    expect(payload.mu.perMinute).toBe(1);
  });
});
