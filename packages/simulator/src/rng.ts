export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  uniform(): number;
  int(minInclusive: number, maxInclusive: number): number;
  chance(probability: number): boolean;
  normal(): number;
  lognormal(median: number, sigma: number): number;
  exponential(mean: number): number;
  poisson(mean: number): number;
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);

  const uniform = (): number => next();
  const normal = (): number => {
    const u = Math.max(next(), Number.EPSILON);
    const v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  return {
    uniform,
    int: (minInclusive, maxInclusive) =>
      minInclusive + Math.floor(next() * (maxInclusive - minInclusive + 1)),
    chance: (probability) => next() < probability,
    normal,
    lognormal: (median, sigma) => median * Math.exp(sigma * normal()),
    exponential: (mean) => -mean * Math.log(Math.max(next(), Number.EPSILON)),
    poisson: (mean) => {
      const limit = Math.exp(-mean);
      let count = 0;
      let product = next();
      while (product > limit) {
        count += 1;
        product *= next();
      }
      return count;
    },
    pick: (items) => items[Math.floor(next() * items.length)] as (typeof items)[number],
  };
}
