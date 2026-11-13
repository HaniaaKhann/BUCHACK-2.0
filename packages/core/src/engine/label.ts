import {
  BATCH_TAP_MIN_ORDERS,
  BATCH_TAP_WEIGHT,
  BATCH_TAP_WINDOW_SECONDS,
  LABEL_MAX_ACTUAL_MINUTES,
  LABEL_MAX_PREDICTED_RATIO,
  LABEL_PICKUP_FALLBACK_WEIGHT,
  MS_PER_MINUTE,
} from '../config.js';

export interface OrderTimes {
  placedAt: number;
  readyAt: number | null;
  pickedUpAt: number | null;
}

export interface LabelInput {
  times: OrderTimes;
  predictedMinutes: number;
  medianPickupLagMinutes: number;
  inBatch: boolean;
}

export interface Label {
  actualMinutes: number;
  weight: number;
}

function rawLabel(input: LabelInput): Label | null {
  const { times } = input;
  if (times.readyAt !== null) {
    return {
      actualMinutes: (times.readyAt - times.placedAt) / MS_PER_MINUTE,
      weight: input.inBatch ? BATCH_TAP_WEIGHT : 1,
    };
  }
  if (times.pickedUpAt !== null) {
    return {
      actualMinutes:
        (times.pickedUpAt - times.placedAt) / MS_PER_MINUTE - input.medianPickupLagMinutes,
      weight: LABEL_PICKUP_FALLBACK_WEIGHT,
    };
  }
  return null;
}

export function labelOrder(input: LabelInput): Label | null {
  const label = rawLabel(input);
  if (label === null) return null;
  if (label.actualMinutes > LABEL_MAX_ACTUAL_MINUTES) return null;
  if (label.actualMinutes > LABEL_MAX_PREDICTED_RATIO * input.predictedMinutes) return null;
  return label;
}

export function detectBatchTaps(readyAts: readonly number[]): boolean[] {
  const flags = readyAts.map(() => false);
  const sorted = readyAts
    .map((readyAt, index) => ({ readyAt, index }))
    .sort((a, b) => a.readyAt - b.readyAt);
  const windowMs = BATCH_TAP_WINDOW_SECONDS * 1000;

  for (let start = 0; start + BATCH_TAP_MIN_ORDERS - 1 < sorted.length; start += 1) {
    const first = sorted[start];
    const last = sorted[start + BATCH_TAP_MIN_ORDERS - 1];
    if (first === undefined || last === undefined) continue;
    if (last.readyAt - first.readyAt > windowMs) continue;
    for (let offset = start; offset < start + BATCH_TAP_MIN_ORDERS; offset += 1) {
      const member = sorted[offset];
      if (member !== undefined) flags[member.index] = true;
    }
  }
  return flags;
}
