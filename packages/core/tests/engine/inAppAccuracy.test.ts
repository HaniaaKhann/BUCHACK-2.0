import { describe, expect, it } from 'vitest';
import { summarizeInApp } from '../../src/engine/inAppAccuracy.js';

const PLACED = Date.UTC(2026, 10, 17, 4, 15);
const MIN = 60_000;

const order = (readyMinutes: number, low = 4, point = 6, high = 9) => ({
  placedAt: PLACED,
  readyAt: PLACED + readyMinutes * MIN,
  predictedLow: PLACED + low * MIN,
  predictedPoint: PLACED + point * MIN,
  predictedHigh: PLACED + high * MIN,
});

describe('summarizeInApp', () => {
  it('has no numbers when there are no completed orders', () => {
    expect(summarizeInApp([])).toEqual({ n: 0, maeMinutes: null, onTimeRate: null });
  });

  it('uses the same definition as the backtest: mean absolute error of the point and the share inside the range', () => {
    expect(summarizeInApp([order(6), order(10), order(5)])).toEqual({
      n: 3,
      maeMinutes: 1.67,
      onTimeRate: 0.667,
    });
  });
});
