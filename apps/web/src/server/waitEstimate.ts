import {
  LATENESS_COLD_START_Q50_MINUTES,
  LATENESS_COLD_START_Q90_MINUTES,
  MU_FLOOR_PER_MINUTE,
  computeLiveWait,
  predictWait,
  type BusyState,
} from '@app/core';
import { toWaitSnapshot, type StoredSnapshotPayload } from '@app/db';

export type WaitSource = 'live' | 'stale' | 'cold';

export interface VendorWaitState {
  payload: StoredSnapshotPayload | null;
  arrivals: readonly number[];
  busyState?: BusyState;
  busyUntil?: number | null;
}

export function effectiveBusyState(state: VendorWaitState | undefined, now: number): BusyState {
  if (state?.busyState === undefined) return 'normal';
  const expired =
    state.busyState === 'rush' &&
    state.busyUntil !== undefined &&
    state.busyUntil !== null &&
    state.busyUntil <= now;
  return expired ? 'normal' : state.busyState;
}

export interface WaitEstimate {
  baseMinutes: number;
  queueDelayMinutes: number;
  lowMinutes: number;
  pointMinutes: number;
  highMinutes: number;
  source: WaitSource;
  backlog: number;
}

export function estimateWait(
  state: VendorWaitState | undefined,
  now: number,
  prepMinutes: number,
): WaitEstimate {
  if (state === undefined || state.payload === null) {
    const prediction = predictWait({
      backlog: 0,
      muPerMinute: MU_FLOOR_PER_MINUTE,
      prep: prepMinutes,
      bias: 0,
      biasSamples: 0,
      residuals: [],
    });
    return {
      baseMinutes: prediction.baseMinutes,
      queueDelayMinutes: prediction.queueDelayMinutes,
      lowMinutes: prediction.lowMinutes,
      pointMinutes: prediction.pointMinutes,
      highMinutes: prediction.highMinutes,
      source: 'cold',
      backlog: 0,
    };
  }
  const result = computeLiveWait({
    snapshot: toWaitSnapshot(state.payload),
    now,
    appArrivalTimes: state.arrivals,
    prepMinutes,
    busyState: effectiveBusyState(state, now),
  });
  return {
    baseMinutes: result.prediction.baseMinutes,
    queueDelayMinutes: result.prediction.queueDelayMinutes,
    lowMinutes: result.prediction.lowMinutes,
    pointMinutes: result.prediction.pointMinutes,
    highMinutes: result.prediction.highMinutes,
    source: result.stale ? 'stale' : 'live',
    backlog: result.backlog,
  };
}

export function latenessFor(state: VendorWaitState | undefined): { q50: number; q90: number } {
  const lateness = state?.payload?.lateness;
  return lateness
    ? { q50: lateness.q50, q90: lateness.q90 }
    : { q50: LATENESS_COLD_START_Q50_MINUTES, q90: LATENESS_COLD_START_Q90_MINUTES };
}
