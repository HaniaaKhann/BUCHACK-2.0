import { describe, expect, it } from 'vitest';
import { historicalPrediction, type HistoricalLabel } from '../src/backtest/historical.js';
import { summarize } from '../src/backtest/metrics.js';
import { runBacktest } from '../src/backtest/report.js';
import { runWalkForward } from '../src/backtest/walkForward.js';
import { hktMidnightMs } from '../src/history/calendar.js';
import { generateHistory, type History } from '../src/history/generate.js';
import { smallInput } from './fixtures.js';

const MINUTE = 60_000;

describe('summarize', () => {
  it('computes mean absolute error and the share inside the range', () => {
    const summary = summarize([
      { actualMinutes: 10, prediction: { point: 8, low: 6, high: 12 } },
      { actualMinutes: 5, prediction: { point: 9, low: 7, high: 11 } },
    ]);
    expect(summary).toEqual({ n: 2, maeMinutes: 3, onTimeRate: 0.5 });
  });

  it('returns nulls with no data', () => {
    expect(summarize([])).toEqual({ n: 0, maeMinutes: null, onTimeRate: null });
  });
});

describe('historicalPrediction', () => {
  const label = (weekday: number, slot: number, actualMinutes: number): HistoricalLabel => ({
    weekday,
    slot,
    weekType: 'teaching',
    actualMinutes,
  });

  it('uses matching weekday and slot when there are enough labels', () => {
    const labels = [
      ...Array.from({ length: 5 }, () => label(1, 50, 10)),
      ...Array.from({ length: 5 }, () => label(2, 50, 30)),
    ];
    const prediction = historicalPrediction(
      labels,
      { weekday: 1, slot: 50, weekType: 'teaching' },
      4,
    );
    expect(prediction).toEqual({ point: 10, low: 10, high: 10 });
  });

  it('falls back to the same slot on any weekday, then to a cold-start range', () => {
    const labels = Array.from({ length: 6 }, (_, index) => label(index % 3, 50, 12));
    expect(
      historicalPrediction(labels, { weekday: 4, slot: 50, weekType: 'teaching' }, 4).point,
    ).toBe(12);
    expect(historicalPrediction([], { weekday: 4, slot: 50, weekType: 'exam' }, 10)).toEqual({
      point: 10,
      low: 7,
      high: 13,
    });
  });
});

function shiftFuture(history: History, cutoff: number): History {
  return {
    ...history,
    vendors: history.vendors.map((vendor) => ({
      ...vendor,
      orders: vendor.orders.map((order) =>
        order.placedAt < cutoff
          ? order
          : {
              ...order,
              trueReadyAt: order.trueReadyAt + 30 * MINUTE,
              tapAt: order.tapAt === null ? null : order.tapAt + 30 * MINUTE,
              pickedUpAt: order.pickedUpAt === null ? null : order.pickedUpAt + 30 * MINUTE,
            },
      ),
      tickets: vendor.tickets.map((row) =>
        Date.parse(row.slotStart) < cutoff ? row : { ...row, count: row.count + 5 },
      ),
    })),
  };
}

describe('walk-forward backtest', () => {
  const history = generateHistory(smallInput());
  const cutoff = hktMidnightMs('2026-11-02');

  it('does not let future outcomes change earlier predictions', () => {
    const vendor = history.vendors[0];
    const changed = shiftFuture(history, cutoff).vendors[0];
    if (vendor === undefined || changed === undefined) throw new Error('missing vendor');
    const before = runWalkForward(vendor, history.days).filter((r) => r.order.placedAt < cutoff);
    const after = runWalkForward(changed, history.days).filter((r) => r.order.placedAt < cutoff);
    expect(before.length).toBeGreaterThan(0);
    expect(after.map((r) => r.predictions)).toEqual(before.map((r) => r.predictions));
  });

  it('predicts every app order once with a valid range', () => {
    const vendor = history.vendors[0];
    if (vendor === undefined) throw new Error('missing vendor');
    const rows = runWalkForward(vendor, history.days);
    expect(rows).toHaveLength(vendor.orders.filter((o) => o.channel === 'app').length);
    for (const row of rows) {
      for (const prediction of Object.values(row.predictions)) {
        expect(prediction.low).toBeLessThanOrEqual(prediction.point);
        expect(prediction.point).toBeLessThanOrEqual(prediction.high);
      }
    }
  });

  it('trains on weeks 1 to 4, scores weeks 5 and 6, and splits by week type', () => {
    const { test, report } = runBacktest(history);
    expect(report.trainWeeks).toEqual([1, 2, 3, 4]);
    expect(report.testWeeks).toEqual([5, 6]);
    expect(test.every((row) => row.day.weekIndex >= 5)).toBe(true);
    expect(report.byWeekType.map((group) => group.weekType)).toEqual(['exam', 'teaching']);
    const splitTotal = report.byWeekType.reduce((sum, group) => sum + group.trueReady.full.n, 0);
    expect(splitTotal).toBe(report.overall.trueReady.full.n);
    expect(report.overall.tap.full.n).toBeLessThan(report.overall.trueReady.full.n);
    expect(report.label).toBe('Simulated data');
  });
});
