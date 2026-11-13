import { EXTRA_ITEM_SERVICE_SHARE } from './config.js';

export function orderServiceMinutes(itemMinutes: readonly number[]): number {
  const longest = Math.max(...itemMinutes);
  const rest = itemMinutes.reduce((sum, minutes) => sum + minutes, 0) - longest;
  return longest + EXTRA_ITEM_SERVICE_SHARE * rest;
}

export interface KitchenJob {
  arrivalMs: number;
  serviceMs: number;
}

export function serveFifo(jobs: readonly KitchenJob[], staff: number): number[] {
  const freeAt = Array.from({ length: staff }, () => 0);
  return jobs.map((job) => {
    let station = 0;
    for (let index = 1; index < freeAt.length; index += 1) {
      if ((freeAt[index] ?? 0) < (freeAt[station] ?? 0)) station = index;
    }
    const start = Math.max(job.arrivalMs, freeAt[station] ?? 0);
    const done = start + job.serviceMs;
    freeAt[station] = done;
    return done;
  });
}
