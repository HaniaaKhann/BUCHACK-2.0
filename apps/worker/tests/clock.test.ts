import { describe, expect, it } from 'vitest';
import { boundaryAtOrBefore, dueBoundaries } from '../src/clock.js';

const STEP = 15 * 60_000;
const T0 = Date.UTC(2026, 10, 17, 4, 15);

describe('boundaryAtOrBefore', () => {
  it('rounds down to the step', () => {
    expect(boundaryAtOrBefore(T0 + 14 * 60_000, STEP)).toBe(T0);
  });
});

describe('dueBoundaries', () => {
  it('returns only the current boundary on the first tick', () => {
    expect(dueBoundaries(null, T0 + 1000, STEP, 8)).toEqual([T0]);
  });

  it('returns nothing inside the same boundary', () => {
    expect(dueBoundaries(T0, T0 + 14 * 60_000, STEP, 8)).toEqual([]);
  });

  it('returns each boundary passed, oldest first', () => {
    expect(dueBoundaries(T0, T0 + 3 * STEP, STEP, 8)).toEqual([
      T0 + STEP,
      T0 + 2 * STEP,
      T0 + 3 * STEP,
    ]);
  });

  it('keeps only the newest boundaries after a long jump', () => {
    const due = dueBoundaries(T0, T0 + 20 * STEP, STEP, 8);
    expect(due).toHaveLength(8);
    expect(due[0]).toBe(T0 + 13 * STEP);
    expect(due.at(-1)).toBe(T0 + 20 * STEP);
  });

  it('restarts from the current boundary when the clock jumps back', () => {
    expect(dueBoundaries(T0 + 5 * STEP, T0, STEP, 8)).toEqual([T0]);
  });
});
