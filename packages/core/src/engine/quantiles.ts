import {
  COLD_START_RANGE_RATIO,
  RANGE_HIGH_QUANTILE,
  RANGE_LOW_QUANTILE,
  RESIDUAL_MIN_SAMPLES,
  RESIDUAL_WINDOW,
} from '../config.js';
import { quantile } from './stats.js';

export interface ResidualRangeInput {
  pred: number;
  prep: number;
  residuals: readonly number[];
}

export interface ReadyRange {
  low: number;
  high: number;
}

export function residualRange(input: ResidualRangeInput): ReadyRange {
  const recent = input.residuals.slice(-RESIDUAL_WINDOW);
  if (recent.length < RESIDUAL_MIN_SAMPLES) {
    return {
      low: Math.max(input.prep, input.pred * (1 - COLD_START_RANGE_RATIO)),
      high: Math.max(input.prep, input.pred * (1 + COLD_START_RANGE_RATIO)),
    };
  }
  return {
    low: Math.max(input.prep, input.pred + quantile(recent, RANGE_LOW_QUANTILE)),
    high: Math.max(input.prep, input.pred + quantile(recent, RANGE_HIGH_QUANTILE)),
  };
}
