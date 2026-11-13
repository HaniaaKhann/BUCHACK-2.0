import {
  BUSY_MULTIPLIER,
  LAMBDA_LIVE_WINDOW_MINUTES,
  LAMBDA_MIN_MATCHING_WEEKS,
  LAMBDA_RECENCY_WEIGHTS,
  SLOT_MINUTES,
} from '../config.js';
import type { BusyState, WeekType } from '../types.js';
import { mean } from './stats.js';

export interface SlotObservation {
  weekIndex: number;
  weekday: number;
  slot: number;
  weekType: WeekType;
  walkIns: number;
}

export interface SlotKey {
  weekday: number;
  slot: number;
  weekType: WeekType;
}

export type LambdaSource = 'matching_weeks' | 'all_weekdays' | 'vendor_average';

export interface LambdaEstimate {
  perMinute: number;
  source: LambdaSource;
}

function weightedRatePerMinute(newestFirst: readonly SlotObservation[]): number {
  const weights = LAMBDA_RECENCY_WEIGHTS.slice(0, newestFirst.length);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const weighted = newestFirst.reduce(
    (sum, observation, index) => sum + (weights[index] ?? 0) * observation.walkIns,
    0,
  );
  return weighted / weightSum / SLOT_MINUTES;
}

function meanRatePerMinute(observations: readonly SlotObservation[]): number {
  return mean(observations.map((observation) => observation.walkIns)) / SLOT_MINUTES;
}

export function lambdaHist(observations: readonly SlotObservation[], key: SlotKey): LambdaEstimate {
  const matching = observations
    .filter((o) => o.weekday === key.weekday && o.slot === key.slot && o.weekType === key.weekType)
    .sort((a, b) => b.weekIndex - a.weekIndex)
    .slice(0, LAMBDA_RECENCY_WEIGHTS.length);

  if (matching.length >= LAMBDA_MIN_MATCHING_WEEKS) {
    return { perMinute: weightedRatePerMinute(matching), source: 'matching_weeks' };
  }

  const sameSlotAnyWeekday = observations.filter(
    (o) => o.slot === key.slot && o.weekType === key.weekType,
  );
  if (sameSlotAnyWeekday.length > 0) {
    return { perMinute: meanRatePerMinute(sameSlotAnyWeekday), source: 'all_weekdays' };
  }

  return { perMinute: meanRatePerMinute(observations), source: 'vendor_average' };
}

export interface LambdaLiveInput {
  lambdaHistPerMinute: number;
  busyState: BusyState;
  walkInsLast10Min: number | null;
}

export function lambdaLive(input: LambdaLiveInput): number {
  if (input.walkInsLast10Min !== null) {
    return input.walkInsLast10Min / LAMBDA_LIVE_WINDOW_MINUTES;
  }
  return input.lambdaHistPerMinute * BUSY_MULTIPLIER[input.busyState];
}
