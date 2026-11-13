import { describe, expect, it } from 'vitest';
import { residualRange } from '../../src/engine/quantiles.js';

const residuals = Array.from({ length: 21 }, (_, index) => index - 10);

describe('residualRange', () => {
  it('adds the q10 and q90 residuals to the prediction', () => {
    expect(residualRange({ pred: 10, prep: 1, residuals })).toEqual({ low: 2, high: 18 });
  });

  it('floors the low end at half of prep', () => {
    expect(residualRange({ pred: 5, prep: 4, residuals })).toEqual({ low: 2, high: 13 });
  });

  it('lets the low end fall below prep down to half of prep', () => {
    expect(residualRange({ pred: 5, prep: 4, residuals: residuals.map(() => -2) })).toEqual({
      low: 3,
      high: 4,
    });
  });

  it('keeps the high end at least prep', () => {
    const allNegative = residuals.map(() => -5);
    expect(residualRange({ pred: 10, prep: 8, residuals: allNegative })).toEqual({
      low: 5,
      high: 8,
    });
  });

  it('uses plus or minus 30 percent below 20 residuals', () => {
    const range = residualRange({ pred: 10, prep: 4, residuals: residuals.slice(0, 19) });
    expect(range.low).toBeCloseTo(7, 10);
    expect(range.high).toBeCloseTo(13, 10);
  });

  it('floors the cold start range at half of prep below and prep above', () => {
    const range = residualRange({ pred: 10, prep: 8, residuals: [] });
    expect(range.low).toBeCloseTo(7, 10);
    expect(range.high).toBeCloseTo(13, 10);
    const short = residualRange({ pred: 2, prep: 4, residuals: [] });
    expect(short).toEqual({ low: 2, high: 4 });
  });

  it('uses only the last 200 residuals', () => {
    const many = [
      ...Array.from({ length: 50 }, () => 1000),
      ...Array.from({ length: 200 }, () => 0),
    ];
    expect(residualRange({ pred: 10, prep: 1, residuals: many })).toEqual({ low: 10, high: 10 });
  });
});
