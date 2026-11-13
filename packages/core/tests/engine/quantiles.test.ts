import { describe, expect, it } from 'vitest';
import { residualRange } from '../../src/engine/quantiles.js';

const residuals = Array.from({ length: 21 }, (_, index) => index - 10);

describe('residualRange', () => {
  it('adds the q10 and q90 residuals to the prediction', () => {
    expect(residualRange({ pred: 10, prep: 1, residuals })).toEqual({ low: 2, high: 18 });
  });

  it('keeps both ends at least prep', () => {
    expect(residualRange({ pred: 5, prep: 4, residuals })).toEqual({ low: 4, high: 13 });
  });

  it('uses plus or minus 30 percent below 20 residuals', () => {
    const range = residualRange({ pred: 10, prep: 4, residuals: residuals.slice(0, 19) });
    expect(range.low).toBeCloseTo(7, 10);
    expect(range.high).toBeCloseTo(13, 10);
  });

  it('floors the cold start range at prep', () => {
    const range = residualRange({ pred: 10, prep: 8, residuals: [] });
    expect(range.low).toBe(8);
    expect(range.high).toBeCloseTo(13, 10);
  });

  it('uses only the last 200 residuals', () => {
    const many = [
      ...Array.from({ length: 50 }, () => 1000),
      ...Array.from({ length: 200 }, () => 0),
    ];
    expect(residualRange({ pred: 10, prep: 1, residuals: many })).toEqual({ low: 10, high: 10 });
  });
});
