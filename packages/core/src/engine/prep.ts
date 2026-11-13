import { MULTI_ITEM_EXTRA_MINUTES, PREP_MAX_BACKLOG, PREP_MIN_SAMPLES } from '../config.js';
import { median } from './stats.js';

export interface PrepSample {
  placedToReadyMinutes: number;
  backlogAtPlacement: number;
}

export function learnedPrep(samples: readonly PrepSample[]): number | null {
  const quiet = samples.filter((sample) => sample.backlogAtPlacement <= PREP_MAX_BACKLOG);
  if (quiet.length < PREP_MIN_SAMPLES) return null;
  return median(quiet.map((sample) => sample.placedToReadyMinutes));
}

export interface ItemPrepInput {
  learned: number | null;
  vendorPrior: number | null;
  categoryPrior: number;
}

export function itemPrep(input: ItemPrepInput): number {
  return input.learned ?? input.vendorPrior ?? input.categoryPrior;
}

export function orderPrep(itemPreps: readonly number[]): number {
  return Math.max(...itemPreps) + MULTI_ITEM_EXTRA_MINUTES * (itemPreps.length - 1);
}
