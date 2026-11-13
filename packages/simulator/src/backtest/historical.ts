import { COLD_START_RANGE_RATIO, mean, quantile, type WeekType } from '@app/core';

export const HISTORICAL_MIN_LABELS = 5;

export interface HistoricalLabel {
  weekday: number;
  slot: number;
  weekType: WeekType;
  actualMinutes: number;
}

export interface RangePrediction {
  point: number;
  low: number;
  high: number;
}

export interface HistoricalKey {
  weekday: number;
  slot: number;
  weekType: WeekType;
}

function tiers(labels: readonly HistoricalLabel[], key: HistoricalKey): HistoricalLabel[][] {
  const sameType = labels.filter((l) => l.weekType === key.weekType);
  const sameSlot = sameType.filter((l) => l.slot === key.slot);
  return [sameSlot.filter((l) => l.weekday === key.weekday), sameSlot, sameType, [...labels]];
}

export function historicalPrediction(
  labels: readonly HistoricalLabel[],
  key: HistoricalKey,
  coldStartPoint: number,
): RangePrediction {
  const chosen = tiers(labels, key).find((tier) => tier.length >= HISTORICAL_MIN_LABELS);
  if (chosen === undefined) {
    return {
      point: coldStartPoint,
      low: coldStartPoint * (1 - COLD_START_RANGE_RATIO),
      high: coldStartPoint * (1 + COLD_START_RANGE_RATIO),
    };
  }
  const values = chosen.map((l) => l.actualMinutes);
  return { point: mean(values), low: quantile(values, 0.1), high: quantile(values, 0.9) };
}
