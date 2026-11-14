export interface TokenBucketOptions {
  capacity: number;
  refillPerSecond: number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export interface TokenBuckets {
  take(key: string, nowMs: number): boolean;
}

export function createTokenBuckets(options: TokenBucketOptions): TokenBuckets {
  const buckets = new Map<string, Bucket>();
  return {
    take(key, nowMs) {
      const bucket = buckets.get(key) ?? { tokens: options.capacity, updatedAt: nowMs };
      const elapsedSeconds = Math.max(0, (nowMs - bucket.updatedAt) / 1000);
      const tokens = Math.min(
        options.capacity,
        bucket.tokens + elapsedSeconds * options.refillPerSecond,
      );
      if (tokens < 1) {
        buckets.set(key, { tokens, updatedAt: nowMs });
        return false;
      }
      buckets.set(key, { tokens: tokens - 1, updatedAt: nowMs });
      return true;
    },
  };
}
