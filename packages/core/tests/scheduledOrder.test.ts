import { describe, expect, it } from 'vitest';
import { MS_PER_MINUTE } from '../src/config.js';
import { earliestSlotStart, graceSecondsLeft, scheduledPrediction } from '../src/scheduledOrder.js';

const SLOT = Date.UTC(2026, 10, 17, 5, 0);

describe('scheduledPrediction', () => {
  it('centres on the slot start plus the median lateness, with the high end from the 90th percentile', () => {
    expect(scheduledPrediction(SLOT, 1, 4)).toEqual({
      base: SLOT,
      low: SLOT,
      point: SLOT + MS_PER_MINUTE,
      high: SLOT + 4 * MS_PER_MINUTE,
    });
  });

  it('uses the cold-start 0 and 3 minutes without error', () => {
    const cold = scheduledPrediction(SLOT, 0, 3);
    expect(cold.low).toBe(SLOT);
    expect(cold.point).toBe(SLOT);
    expect(cold.high).toBe(SLOT + 3 * MS_PER_MINUTE);
  });

  it('keeps low at or below point and high at or above point even with early or odd values', () => {
    const early = scheduledPrediction(SLOT, -2, -3);
    expect(early.low).toBe(SLOT - 2 * MS_PER_MINUTE);
    expect(early.high).toBeGreaterThanOrEqual(early.point);
    const odd = scheduledPrediction(SLOT, 5, 2);
    expect(odd.high).toBe(odd.point);
  });
});

describe('earliestSlotStart', () => {
  const now = Date.UTC(2026, 10, 17, 4, 20);

  it('rounds up to the next 15-minute boundary so the fire time is not already past', () => {
    const slot = earliestSlotStart(now, 3, 4);
    expect(slot).toBe(Date.UTC(2026, 10, 17, 4, 30));
    expect(slot - (3 + 4) * MS_PER_MINUTE).toBeGreaterThanOrEqual(now);
  });

  it('keeps a slot that is exactly on a boundary', () => {
    expect(earliestSlotStart(now, 5, 5)).toBe(Date.UTC(2026, 10, 17, 4, 30));
    expect(earliestSlotStart(Date.UTC(2026, 10, 17, 4, 15), 0, 0)).toBe(
      Date.UTC(2026, 10, 17, 4, 15),
    );
  });
});

describe('graceSecondsLeft', () => {
  const placed = Date.UTC(2026, 10, 17, 4, 20);

  it('counts down from the 60 second grace window and stops at zero', () => {
    expect(graceSecondsLeft(placed, placed)).toBe(60);
    expect(graceSecondsLeft(placed, placed + 25_500)).toBe(35);
    expect(graceSecondsLeft(placed, placed + 60_000)).toBe(0);
    expect(graceSecondsLeft(placed, placed + 600_000)).toBe(0);
  });

  it('does not exceed the window if the clock reads earlier than the order', () => {
    expect(graceSecondsLeft(placed, placed - 5_000)).toBe(60);
  });
});
