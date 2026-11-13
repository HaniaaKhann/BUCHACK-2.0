import { describe, expect, it } from 'vitest';
import { latenessMinutes, latenessQuantiles } from '../../src/engine/lateness.js';

describe('latenessMinutes', () => {
  it('measures ready minus slot start in minutes', () => {
    expect(latenessMinutes(0, 4 * 60_000)).toBe(4);
    expect(latenessMinutes(5 * 60_000, 3 * 60_000)).toBe(-2);
  });
});

describe('latenessQuantiles', () => {
  it('uses q50 = 0 and q90 = 3 on cold start', () => {
    expect(latenessQuantiles([])).toEqual({ q50: 0, q90: 3 });
    expect(latenessQuantiles([5, 6, 7])).toEqual({ q50: 0, q90: 3 });
  });

  it('learns quantiles once enough scheduled orders exist', () => {
    const samples = Array.from({ length: 11 }, (_, index) => index);
    expect(latenessQuantiles(samples)).toEqual({ q50: 5, q90: 9 });
  });
});
