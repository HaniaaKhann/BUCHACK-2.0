import { MODEL_VERSION } from '@app/core';
import { TRAIN_WEEKS, type SimWeekType } from '../history/config.js';
import type { History } from '../history/generate.js';
import { truthMetrics, type ModelMetrics, type TruthMetrics } from './metrics.js';
import { MODEL_IDS, runWalkForward, type ModelId, type OrderPredictions } from './walkForward.js';

export const MODEL_NAMES: Readonly<Record<ModelId, string>> = {
  historical: 'Historical only',
  backlog: 'Historical + backlog walk-in model',
  full: 'Full model with in-app learning',
};

export interface AccuracyReport {
  label: 'Simulated data';
  seed: number;
  modelVersion: string;
  historyStart: string;
  weekLayout: SimWeekType[];
  trainWeeks: number[];
  testWeeks: number[];
  models: { id: ModelId; name: string }[];
  overall: TruthMetrics;
  byWeekType: ({ weekType: SimWeekType } & TruthMetrics)[];
  byDay: { date: string; weekType: SimWeekType; trueReady: ModelMetrics }[];
  byVendor: ({ vendorName: string; isFocus: boolean } & TruthMetrics)[];
}

export interface BacktestResult {
  all: OrderPredictions[];
  test: OrderPredictions[];
  report: AccuracyReport;
}

function uniqueInOrder<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export function isTestRow(row: OrderPredictions): boolean {
  return row.day.weekIndex > TRAIN_WEEKS;
}

export function runBacktest(history: History): BacktestResult {
  const all = history.vendors.flatMap((vendor) => runWalkForward(vendor, history.days));
  const test = all.filter(isTestRow);
  const weekIndexes = history.weekLayout.map((_, index) => index + 1);
  const testDays = history.days.filter((day) => day.weekIndex > TRAIN_WEEKS);

  const report: AccuracyReport = {
    label: 'Simulated data',
    seed: history.seed,
    modelVersion: MODEL_VERSION,
    historyStart: history.startDate,
    weekLayout: [...history.weekLayout],
    trainWeeks: weekIndexes.filter((week) => week <= TRAIN_WEEKS),
    testWeeks: weekIndexes.filter((week) => week > TRAIN_WEEKS),
    models: MODEL_IDS.map((id) => ({ id, name: MODEL_NAMES[id] })),
    overall: truthMetrics(test),
    byWeekType: uniqueInOrder(testDays.map((day) => day.weekType)).map((weekType) => ({
      weekType,
      ...truthMetrics(test.filter((row) => row.day.weekType === weekType)),
    })),
    byDay: testDays
      .map((day) => ({ day, rows: test.filter((row) => row.day.date === day.date) }))
      .filter(({ rows }) => rows.length > 0)
      .map(({ day, rows }) => ({
        date: day.date,
        weekType: day.weekType,
        trueReady: truthMetrics(rows).trueReady,
      })),
    byVendor: history.vendors
      .filter((vendor) => vendor.appEnabled)
      .map((vendor) => ({
        vendorName: vendor.name,
        isFocus: vendor.isFocus,
        ...truthMetrics(test.filter((row) => row.order.vendorName === vendor.name)),
      })),
  };
  return { all, test, report };
}
