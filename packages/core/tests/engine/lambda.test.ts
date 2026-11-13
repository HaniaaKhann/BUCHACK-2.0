import { describe, expect, it } from 'vitest';
import {
  lambdaHist,
  lambdaLive,
  type SlotKey,
  type SlotObservation,
} from '../../src/engine/lambda.js';

const key: SlotKey = { weekday: 2, slot: 49, weekType: 'teaching' };

function obs(
  weekIndex: number,
  walkIns: number,
  overrides: Partial<SlotObservation> = {},
): SlotObservation {
  return { weekIndex, weekday: 2, slot: 49, weekType: 'teaching', walkIns, ...overrides };
}

describe('lambdaHist', () => {
  it('applies 0.4, 0.3, 0.2, 0.1 recency weights over four matching weeks', () => {
    const result = lambdaHist([obs(1, 15), obs(2, 30), obs(3, 45), obs(4, 60)], key);
    expect(result.source).toBe('matching_weeks');
    expect(result.perMinute).toBeCloseTo(3, 10);
  });

  it('uses only the four most recent matching weeks', () => {
    const result = lambdaHist([obs(0, 900), obs(1, 15), obs(2, 30), obs(3, 45), obs(4, 60)], key);
    expect(result.perMinute).toBeCloseTo(3, 10);
  });

  it('renormalises the weights with two matching weeks', () => {
    const result = lambdaHist([obs(3, 15), obs(4, 30)], key);
    expect(result.source).toBe('matching_weeks');
    expect(result.perMinute).toBeCloseTo(16.5 / 0.7 / 15, 10);
  });

  it('falls back to all weekdays for the same slot and week type with fewer than 2 matching weeks', () => {
    const result = lambdaHist(
      [
        obs(4, 60),
        obs(4, 30, { weekday: 3 }),
        obs(3, 30, { weekday: 4 }),
        obs(4, 900, { weekType: 'exam' }),
      ],
      key,
    );
    expect(result.source).toBe('all_weekdays');
    expect(result.perMinute).toBeCloseTo(40 / 15, 10);
  });

  it('falls back to the vendor average when no observation shares the slot and week type', () => {
    const result = lambdaHist([obs(4, 15, { slot: 10 }), obs(4, 45, { slot: 11 })], key);
    expect(result.source).toBe('vendor_average');
    expect(result.perMinute).toBeCloseTo(2, 10);
  });

  it('returns zero with no history at all', () => {
    expect(lambdaHist([], key)).toEqual({ perMinute: 0, source: 'vendor_average' });
  });
});

describe('lambdaLive', () => {
  it('uses the last 10 minutes of walk-ins when a live feed exists', () => {
    expect(lambdaLive({ lambdaHistPerMinute: 2, busyState: 'rush', walkInsLast10Min: 20 })).toBe(2);
  });

  it('multiplies lambdaHist by the busy multiplier without a live feed', () => {
    const base = { lambdaHistPerMinute: 2, walkInsLast10Min: null } as const;
    expect(lambdaLive({ ...base, busyState: 'quiet' })).toBeCloseTo(1.2, 10);
    expect(lambdaLive({ ...base, busyState: 'normal' })).toBeCloseTo(2, 10);
    expect(lambdaLive({ ...base, busyState: 'rush' })).toBeCloseTo(3.2, 10);
  });
});
