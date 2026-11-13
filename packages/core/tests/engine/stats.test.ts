import { describe, expect, it } from 'vitest';
import { mean, median, quantile } from '../../src/engine/stats.js';

describe('stats', () => {
  it('interpolates quantiles linearly', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([10], 0.9)).toBe(10);
    expect(quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 0.9)).toBe(10);
  });

  it('computes the median of unsorted values', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('computes the mean and returns 0 for no values', () => {
    expect(mean([1, 2, 6])).toBe(3);
    expect(mean([])).toBe(0);
  });
});
