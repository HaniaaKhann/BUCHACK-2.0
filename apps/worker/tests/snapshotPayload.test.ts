import { hktMidnight } from '@app/core';
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
    openRanges: [],
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

  it('does not learn bias, residuals or item prep from scheduled orders', () => {
    const scheduled = (minutesBefore: number): SnapshotOrder => {
      const placedAt = BOUNDARY - minutesBefore * MINUTE;
      return order(minutesBefore, {
        slotStart: placedAt + 90 * MINUTE,
        readyAt: placedAt + 92 * MINUTE,
        singleItemName: 'Wonton noodles',
      });
    };
    const payload = buildSnapshotPayload(
      baseInput({ orders: [200, 190, 180, 170, 160, 150].map(scheduled) }),
    );
    expect(payload.bias).toEqual({ value: null, samples: 0 });
    expect(payload.residuals).toEqual([]);
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

describe('buildSnapshotPayload backlog', () => {
  const TUESDAY = '2026-11-17';
  const openAt = hktMidnight(TUESDAY) + 8 * 60 * MINUTE;
  const at = (hours: number, minutes = 0): number =>
    hktMidnight(TUESDAY) + (hours * 60 + minutes) * MINUTE;
  const wholeDay = [{ openAt, closeAt: at(17, 30) }];

  const pastTuesdays = ['2026-11-10', '2026-11-03'];
  const busyTickets = pastTuesdays.flatMap((date) =>
    Array.from({ length: 18 }, (_, index) => ({
      slotStart: hktMidnight(date) + (32 + index) * 15 * MINUTE,
      count: 30,
    })),
  );

  const busy = (boundary: number, overrides: Partial<SnapshotInput> = {}) =>
    buildSnapshotPayload(
      baseInput({
        boundary,
        capacityPriorPerMin: 1,
        tickets: busyTickets,
        openRanges: wholeDay,
        ...overrides,
      }),
    );

  it('builds a busy outlet backlog from opening time when the clock jumps from 09:00 to 12:15', () => {
    const morning = busy(at(9));
    const lunch = busy(at(12, 15));
    expect(morning.backlog).toBeCloseTo(60 * (2 - 1), 10);
    expect(lunch.backlog).toBeGreaterThan(0);
    expect(lunch.backlog).toBeCloseTo(255 * (2 - 1), 10);
    expect(lunch.backlog - morning.backlog).toBeCloseTo(195, 10);
  });

  it('is zero at opening and for a closed outlet', () => {
    expect(busy(openAt).backlog).toBe(0);
    expect(busy(at(7)).backlog).toBe(0);
    expect(busy(at(18)).backlog).toBe(0);
    expect(busy(at(12, 15), { openRanges: [] }).backlog).toBe(0);
  });

  it('restarts from the second opening when an outlet closes in the middle of the day', () => {
    const split = [
      { openAt, closeAt: at(12) },
      { openAt: at(13), closeAt: at(17, 30) },
    ];
    expect(busy(at(13, 30), { openRanges: split }).backlog).toBeCloseTo(30 * (2 - 1), 10);
    expect(busy(at(12, 30), { openRanges: split }).backlog).toBe(0);
  });

  it('adds the app orders actually placed since opening', () => {
    const quiet = buildSnapshotPayload(
      baseInput({
        capacityPriorPerMin: 0.05,
        openRanges: [{ openAt: at(11), closeAt: at(17, 30) }],
        orders: [at(12, 0) + 10_000, at(12, 0) + 20_000, at(12, 10)].map((placedAt) =>
          order(0, { placedAt, readyAt: null, pickedUpAt: null }),
        ),
      }),
    );
    expect(quiet.backlog).toBeCloseTo(2.25, 10);
  });

  it('uses the forecast rate for earlier slots of the same day, not the day own tickets', () => {
    const today = Array.from({ length: 18 }, (_, index) => ({
      slotStart: openAt + index * 15 * MINUTE,
      count: 300,
    }));
    const withToday = busy(at(12, 15), { tickets: [...busyTickets, ...today] });
    expect(withToday.backlog).toBeCloseTo(255, 10);
  });
});
