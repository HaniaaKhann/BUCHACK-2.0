import { describe, expect, it } from 'vitest';
import { biasWeight, updateBias } from '../../src/engine/bias.js';

describe('updateBias', () => {
  it('seeds with the first error', () => {
    expect(updateBias({ previous: null, error: 5, weight: 1 })).toBe(5);
  });

  it('applies EWMA with alpha 0.2', () => {
    expect(updateBias({ previous: 5, error: 0, weight: 1 })).toBeCloseTo(4, 10);
  });

  it('scales alpha by the label weight', () => {
    expect(updateBias({ previous: 5, error: 0, weight: 0.5 })).toBeCloseTo(4.5, 10);
  });

  it('converges to a constant error', () => {
    let bias = 0;
    for (let i = 0; i < 40; i += 1) bias = updateBias({ previous: bias, error: 10, weight: 1 });
    expect(bias).toBeCloseTo(10, 1);
  });
});

describe('biasWeight', () => {
  it('is n / (n + 30)', () => {
    expect(biasWeight(0)).toBe(0);
    expect(biasWeight(30)).toBe(0.5);
    expect(biasWeight(70)).toBeCloseTo(0.7, 10);
  });
});
