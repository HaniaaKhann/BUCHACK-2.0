import {
  LATENESS_COLD_START_Q50_MINUTES,
  LATENESS_COLD_START_Q90_MINUTES,
  LATENESS_MIN_SAMPLES,
  MS_PER_MINUTE,
} from '../config.js';
import { quantile } from './stats.js';

export interface LatenessQuantiles {
  q50: number;
  q90: number;
}

export function latenessMinutes(slotStart: number, readyAt: number): number {
  return (readyAt - slotStart) / MS_PER_MINUTE;
}

export function latenessQuantiles(samples: readonly number[]): LatenessQuantiles {
  if (samples.length < LATENESS_MIN_SAMPLES) {
    return {
      q50: LATENESS_COLD_START_Q50_MINUTES,
      q90: LATENESS_COLD_START_Q90_MINUTES,
    };
  }
  return { q50: quantile(samples, 0.5), q90: quantile(samples, 0.9) };
}
