import { describe, expect, it } from 'vitest';
import { detectBatchTaps, labelOrder, type LabelInput } from '../../src/engine/label.js';

const MINUTE = 60_000;

function input(overrides: Partial<LabelInput> = {}): LabelInput {
  return {
    times: { placedAt: 0, readyAt: 8 * MINUTE, pickedUpAt: null },
    predictedMinutes: 7,
    medianPickupLagMinutes: 2,
    inBatch: false,
    ...overrides,
  };
}

describe('labelOrder', () => {
  it('labels ready minus placed with full weight', () => {
    expect(labelOrder(input())).toEqual({ actualMinutes: 8, weight: 1 });
  });

  it('halves the weight for batch-tapped orders', () => {
    expect(labelOrder(input({ inBatch: true }))).toEqual({ actualMinutes: 8, weight: 0.5 });
  });

  it('falls back to pickup minus lag with weight 0.5 when ready is missing', () => {
    const result = labelOrder(
      input({ times: { placedAt: 0, readyAt: null, pickedUpAt: 12 * MINUTE } }),
    );
    expect(result).toEqual({ actualMinutes: 10, weight: 0.5 });
  });

  it('returns null with neither ready nor pickup time', () => {
    const times = { placedAt: 0, readyAt: null, pickedUpAt: null };
    expect(labelOrder(input({ times }))).toBeNull();
  });

  it('drops labels above 60 minutes', () => {
    const times = { placedAt: 0, readyAt: 70 * MINUTE, pickedUpAt: null };
    expect(labelOrder(input({ times, predictedMinutes: 40 }))).toBeNull();
  });

  it('drops labels above 3 times the prediction and keeps exactly 3 times', () => {
    const over = { placedAt: 0, readyAt: 25 * MINUTE, pickedUpAt: null };
    const exact = { placedAt: 0, readyAt: 21 * MINUTE, pickedUpAt: null };
    expect(labelOrder(input({ times: over }))).toBeNull();
    expect(labelOrder(input({ times: exact }))).toEqual({ actualMinutes: 21, weight: 1 });
  });
});

describe('detectBatchTaps', () => {
  it('flags three orders ready within 10 seconds', () => {
    const times = [0, 4000, 9000, 30000, 100000, 104000];
    expect(detectBatchTaps(times)).toEqual([true, true, true, false, false, false]);
  });

  it('includes a span of exactly 10 seconds and excludes 11', () => {
    expect(detectBatchTaps([0, 5000, 10000])).toEqual([true, true, true]);
    expect(detectBatchTaps([0, 5000, 11000])).toEqual([false, false, false]);
  });

  it('flags by original index for unsorted input', () => {
    expect(detectBatchTaps([9000, 0, 30000, 4000])).toEqual([true, true, false, true]);
  });

  it('does not flag two orders', () => {
    expect(detectBatchTaps([0, 1000])).toEqual([false, false]);
  });
});
