import {
  COLD_START_RANGE_RATIO,
  RANGE_HIGH_QUANTILE,
  RANGE_LOW_PREP_FLOOR_RATIO,
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

function floorRange(low: number, high: number, prep: number): ReadyRange {
  return {
    low: Math.max(RANGE_LOW_PREP_FLOOR_RATIO * prep, low),
    high: Math.max(prep, high),
  };
}

export function residualRange(input: ResidualRangeInput): ReadyRange {
  const recent = input.residuals.slice(-RESIDUAL_WINDOW);
  if (recent.length < RESIDUAL_MIN_SAMPLES) {
    return floorRange(
      input.pred * (1 - COLD_START_RANGE_RATIO),
      input.pred * (1 + COLD_START_RANGE_RATIO),
      input.prep,
    );
  }
  return floorRange(
    input.pred + quantile(recent, RANGE_LOW_QUANTILE),
    input.pred + quantile(recent, RANGE_HIGH_QUANTILE),
    input.prep,
  );
}
