import { describe, expect, it } from 'vitest';
import {
  cookMinutes,
  drawItemCount,
  forecastSlotAt,
  isLastMinuteOfSlot,
  pickupDueAt,
  pickupLagMinutes,
  poisson,
  readyDueAt,
  slotStartOf,
} from '../src/demoLoadPlan.js';
import type { StoredSnapshotPayload } from '@app/db';

const MINUTE = 60_000;
const SLOT_START = Date.UTC(2026, 10, 17, 4, 15);

function sequence(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
}

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

describe('poisson', () => {
  it('returns zero for a non-positive mean', () => {
    expect(poisson(0, sequence([0.5]))).toBe(0);
    expect(poisson(-1, sequence([0.5]))).toBe(0);
  });

  it('counts uniform draws until their product falls below exp(-mean)', () => {
    expect(poisson(1, sequence([0.9]))).toBe(9);
    expect(poisson(1, sequence([0.2]))).toBe(0);
  });

  it('averages close to the mean', () => {
    const uniform = seeded(7);
    const draws = Array.from({ length: 4000 }, () => poisson(3, uniform));
    const average = draws.reduce((sum, value) => sum + value, 0) / draws.length;
    expect(average).toBeGreaterThan(2.85);
    expect(average).toBeLessThan(3.15);
  });
});

describe('drawItemCount', () => {
  it('follows the weights and never exceeds the menu size', () => {
    expect(drawItemCount(sequence([0.1]), 5)).toBe(1);
    expect(drawItemCount(sequence([0.8]), 5)).toBe(2);
    expect(drawItemCount(sequence([0.99]), 5)).toBe(3);
    expect(drawItemCount(sequence([0.99]), 2)).toBe(2);
  });
});

describe('simulated kitchen timing', () => {
  it('gives the same cook time for the same order every time', () => {
    expect(cookMinutes('order-1', 6)).toBe(cookMinutes('order-1', 6));
    expect(cookMinutes('order-1', 6)).not.toBe(cookMinutes('order-2', 6));
    expect(cookMinutes('order-1', 6)).toBeGreaterThan(0);
  });

  it('scales cook time with prep time', () => {
    expect(cookMinutes('order-1', 12)).toBeCloseTo(2 * cookMinutes('order-1', 6), 10);
  });

  it('adds the queue wait to the cook time', () => {
    const quiet = readyDueAt({
      orderId: 'order-1',
      placedAt: SLOT_START,
      backlogAtPlacement: 0,
      prepMinutes: 6,
      muPerMinute: 1,
    });
    const busy = readyDueAt({
      orderId: 'order-1',
      placedAt: SLOT_START,
      backlogAtPlacement: 4,
      prepMinutes: 6,
      muPerMinute: 1,
    });
    expect(quiet).toBe(SLOT_START + cookMinutes('order-1', 6) * MINUTE);
    expect(busy - quiet).toBeCloseTo(4 * MINUTE, 3);
  });

  it('picks up after a positive lag', () => {
    expect(pickupLagMinutes('order-1')).toBeGreaterThan(0);
    expect(pickupDueAt('order-1', SLOT_START)).toBe(
      SLOT_START + pickupLagMinutes('order-1') * MINUTE,
    );
  });
});

describe('slot helpers', () => {
  const payload = {
    forecast: [
      {
        slotStart: new Date(SLOT_START).toISOString(),
        lambdaPerMinute: 1,
        lambdaSource: 'matching_weeks',
        expectedWalkIns: 15,
      },
    ],
  } as StoredSnapshotPayload;

  it('finds the forecast slot that contains a minute', () => {
    expect(forecastSlotAt(payload, SLOT_START + 14 * MINUTE)?.expectedWalkIns).toBe(15);
    expect(forecastSlotAt(payload, SLOT_START + 15 * MINUTE)).toBeNull();
    expect(forecastSlotAt(payload, SLOT_START - MINUTE)).toBeNull();
  });

  it('knows the last minute of a slot and the slot start', () => {
    expect(isLastMinuteOfSlot(SLOT_START + 14 * MINUTE)).toBe(true);
    expect(isLastMinuteOfSlot(SLOT_START + 13 * MINUTE)).toBe(false);
    expect(slotStartOf(SLOT_START + 14 * MINUTE)).toBe(SLOT_START);
  });
});
