import { describe, expect, it } from 'vitest';
import { itemPrep, learnedPrep, orderPrep, type PrepSample } from '../../src/engine/prep.js';

function sample(placedToReadyMinutes: number, backlogAtPlacement: number): PrepSample {
  return { placedToReadyMinutes, backlogAtPlacement };
}

describe('learnedPrep', () => {
  it('takes the median of orders placed with backlog at most 1', () => {
    const samples = [
      sample(4, 0),
      sample(5, 1),
      sample(6, 0),
      sample(7, 1),
      sample(8, 0),
      sample(30, 3),
    ];
    expect(learnedPrep(samples)).toBe(6);
  });

  it('returns null below 5 qualifying samples', () => {
    const samples = [sample(4, 0), sample(5, 0), sample(6, 0), sample(7, 0), sample(30, 3)];
    expect(learnedPrep(samples)).toBeNull();
  });
});

describe('itemPrep', () => {
  it('prefers learned, then vendor prior, then category prior', () => {
    expect(itemPrep({ learned: 6, vendorPrior: 5, categoryPrior: 7 })).toBe(6);
    expect(itemPrep({ learned: null, vendorPrior: 5, categoryPrior: 7 })).toBe(5);
    expect(itemPrep({ learned: null, vendorPrior: null, categoryPrior: 7 })).toBe(7);
  });
});

describe('orderPrep', () => {
  it('adds 0.5 minutes per extra item to the slowest item', () => {
    expect(orderPrep([5])).toBe(5);
    expect(orderPrep([4, 6, 5])).toBe(7);
  });
});
