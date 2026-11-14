import { describe, expect, it } from 'vitest';
import { createTokenBuckets } from '../src/server/tokenBucket';

describe('createTokenBuckets', () => {
  const options = { capacity: 3, refillPerSecond: 1 };

  it('lets a user spend the whole capacity and then refuses', () => {
    const buckets = createTokenBuckets(options);
    expect([1, 2, 3, 4].map(() => buckets.take('u1', 0))).toEqual([true, true, true, false]);
  });

  it('refills over time and never above the capacity', () => {
    const buckets = createTokenBuckets(options);
    for (let i = 0; i < 3; i += 1) buckets.take('u1', 0);
    expect(buckets.take('u1', 500)).toBe(false);
    expect(buckets.take('u1', 1_000)).toBe(true);
    expect(buckets.take('u1', 1_000)).toBe(false);
    expect([1, 2, 3, 4].map(() => buckets.take('u1', 600_000))).toEqual([true, true, true, false]);
  });

  it('keeps each user on their own bucket', () => {
    const buckets = createTokenBuckets(options);
    for (let i = 0; i < 3; i += 1) buckets.take('u1', 0);
    expect(buckets.take('u1', 0)).toBe(false);
    expect(buckets.take('u2', 0)).toBe(true);
  });

  it('does not refill when the clock reads earlier than before', () => {
    const buckets = createTokenBuckets(options);
    for (let i = 0; i < 3; i += 1) buckets.take('u1', 10_000);
    expect(buckets.take('u1', 0)).toBe(false);
  });
});
