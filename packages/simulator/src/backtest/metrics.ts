import type { RangePrediction } from './historical.js';
import type { ModelId, OrderPredictions } from './walkForward.js';

const MS_PER_MINUTE = 60_000;

export type Truth = 'trueReady' | 'tap';

export interface MetricSummary {
  n: number;
  maeMinutes: number | null;
  onTimeRate: number | null;
}

export type ModelMetrics = Record<ModelId, MetricSummary>;

export interface ScoredPair {
  actualMinutes: number;
  prediction: RangePrediction;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function actualMinutes(row: OrderPredictions, truth: Truth): number | null {
  const end = truth === 'trueReady' ? row.order.trueReadyAt : row.order.tapAt;
  return end === null ? null : (end - row.order.placedAt) / MS_PER_MINUTE;
}

export function summarize(pairs: readonly ScoredPair[]): MetricSummary {
  if (pairs.length === 0) return { n: 0, maeMinutes: null, onTimeRate: null };
  const absoluteError = pairs.reduce(
    (sum, pair) => sum + Math.abs(pair.prediction.point - pair.actualMinutes),
    0,
  );
  const inside = pairs.filter(
    (pair) =>
      pair.actualMinutes >= pair.prediction.low && pair.actualMinutes <= pair.prediction.high,
  ).length;
  return {
    n: pairs.length,
    maeMinutes: round(absoluteError / pairs.length, 2),
    onTimeRate: round(inside / pairs.length, 3),
  };
}

function scoreModel(
  rows: readonly OrderPredictions[],
  truth: Truth,
  model: ModelId,
): MetricSummary {
  const pairs = rows.flatMap((row) => {
    const actual = actualMinutes(row, truth);
    return actual === null ? [] : [{ actualMinutes: actual, prediction: row.predictions[model] }];
  });
  return summarize(pairs);
}

export function modelMetrics(rows: readonly OrderPredictions[], truth: Truth): ModelMetrics {
  return {
    historical: scoreModel(rows, truth, 'historical'),
    backlog: scoreModel(rows, truth, 'backlog'),
    full: scoreModel(rows, truth, 'full'),
  };
}

export interface TruthMetrics {
  trueReady: ModelMetrics;
  tap: ModelMetrics;
}

export function truthMetrics(rows: readonly OrderPredictions[]): TruthMetrics {
  return { trueReady: modelMetrics(rows, 'trueReady'), tap: modelMetrics(rows, 'tap') };
}
