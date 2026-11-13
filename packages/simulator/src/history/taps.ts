import type { Rng } from '../rng.js';
import {
  BATCH_JOIN_WINDOW_MINUTES,
  BATCH_START_PROBABILITY,
  BATCH_TAP_GAP_SECONDS,
  PICKUP_LAG_MEDIAN_MINUTES,
  PICKUP_LAG_SIGMA,
  TAP_FORGET_PROBABILITY,
  TAP_LAG_MEAN_MINUTES,
} from './config.js';

const MS_PER_MINUTE = 60_000;

function batchEnd(readyTimes: readonly number[], start: number): number {
  const first = readyTimes[start] ?? 0;
  let end = start;
  while (
    end + 1 < readyTimes.length &&
    (readyTimes[end + 1] ?? 0) - first <= BATCH_JOIN_WINDOW_MINUTES * MS_PER_MINUTE
  ) {
    end += 1;
  }
  return end;
}

export function staffTaps(readyTimesSorted: readonly number[], rng: Rng): (number | null)[] {
  const taps: (number | null)[] = readyTimesSorted.map(() => null);
  let index = 0;
  while (index < readyTimesSorted.length) {
    const end = rng.chance(BATCH_START_PROBABILITY) ? batchEnd(readyTimesSorted, index) : index;
    const tapStart =
      (readyTimesSorted[end] ?? 0) + rng.exponential(TAP_LAG_MEAN_MINUTES) * MS_PER_MINUTE;
    for (let member = index; member <= end; member += 1) {
      if (rng.chance(TAP_FORGET_PROBABILITY)) continue;
      taps[member] = tapStart + (member - index) * BATCH_TAP_GAP_SECONDS * 1000;
    }
    index = end + 1;
  }
  return taps;
}

export function pickupAt(trueReadyAt: number, rng: Rng): number {
  return trueReadyAt + rng.lognormal(PICKUP_LAG_MEDIAN_MINUTES, PICKUP_LAG_SIGMA) * MS_PER_MINUTE;
}
