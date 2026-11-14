import { MS_PER_MINUTE } from '../config.js';

export interface InAppOrder {
  placedAt: number;
  readyAt: number;
  predictedLow: number;
  predictedPoint: number;
  predictedHigh: number;
}

export interface InAppAccuracy {
  n: number;
  maeMinutes: number | null;
  onTimeRate: number | null;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function summarizeInApp(orders: readonly InAppOrder[]): InAppAccuracy {
  if (orders.length === 0) return { n: 0, maeMinutes: null, onTimeRate: null };
  let absoluteError = 0;
  let inside = 0;
  for (const order of orders) {
    const actual = (order.readyAt - order.placedAt) / MS_PER_MINUTE;
    const point = (order.predictedPoint - order.placedAt) / MS_PER_MINUTE;
    const low = (order.predictedLow - order.placedAt) / MS_PER_MINUTE;
    const high = (order.predictedHigh - order.placedAt) / MS_PER_MINUTE;
    absoluteError += Math.abs(point - actual);
    if (actual >= low && actual <= high) inside += 1;
  }
  return {
    n: orders.length,
    maeMinutes: round(absoluteError / orders.length, 2),
    onTimeRate: round(inside / orders.length, 3),
  };
}
