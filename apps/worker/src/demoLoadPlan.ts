import { MS_PER_MINUTE, SLOT_MINUTES } from '@app/core';
import {
  DEMO_COOK_SIGMA,
  DEMO_ITEM_COUNT_WEIGHTS,
  DEMO_PICKUP_MEDIAN_MINUTES,
  DEMO_PICKUP_SIGMA,
} from './config.js';
import type { SnapshotPayload } from './snapshotPayload.js';

const SLOT_MS = SLOT_MINUTES * MS_PER_MINUTE;

export type Uniform = () => number;

export function poisson(mean: number, uniform: Uniform): number {
  if (mean <= 0) return 0;
  const limit = Math.exp(-mean);
  let count = 0;
  let product = uniform();
  while (product > limit) {
    count += 1;
    product *= uniform();
  }
  return count;
}

export function drawItemCount(uniform: Uniform, available: number): number {
  const draw = uniform();
  let cumulative = 0;
  for (const [index, weight] of DEMO_ITEM_COUNT_WEIGHTS.entries()) {
    cumulative += weight;
    if (draw < cumulative) return Math.min(index + 1, available);
  }
  return Math.min(DEMO_ITEM_COUNT_WEIGHTS.length, available);
}

function hashUniform(key: string, salt: string): number {
  let hash = 2166136261;
  for (const char of `${salt}:${key}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return ((hash >>> 0) + 1) / 4294967297;
}

function hashNormal(key: string): number {
  const radius = Math.sqrt(-2 * Math.log(hashUniform(key, 'radius')));
  return radius * Math.cos(2 * Math.PI * hashUniform(key, 'angle'));
}

export function cookMinutes(orderId: string, prepMinutes: number): number {
  return prepMinutes * Math.exp(DEMO_COOK_SIGMA * hashNormal(`cook:${orderId}`));
}

export function pickupLagMinutes(orderId: string): number {
  return DEMO_PICKUP_MEDIAN_MINUTES * Math.exp(DEMO_PICKUP_SIGMA * hashNormal(`pickup:${orderId}`));
}

export interface ReadyDueInput {
  orderId: string;
  placedAt: number;
  backlogAtPlacement: number;
  prepMinutes: number;
  muPerMinute: number;
}

export function readyDueAt(input: ReadyDueInput): number {
  const queueMinutes = input.backlogAtPlacement / input.muPerMinute;
  const total = queueMinutes + cookMinutes(input.orderId, input.prepMinutes);
  return input.placedAt + total * MS_PER_MINUTE;
}

export function pickupDueAt(orderId: string, readyAt: number): number {
  return readyAt + pickupLagMinutes(orderId) * MS_PER_MINUTE;
}

export function forecastSlotAt(
  payload: SnapshotPayload,
  ms: number,
): SnapshotPayload['forecast'][number] | null {
  return (
    payload.forecast.find((slot) => {
      const start = Date.parse(slot.slotStart);
      return ms >= start && ms < start + SLOT_MS;
    }) ?? null
  );
}

export function isLastMinuteOfSlot(minuteStart: number): boolean {
  return (minuteStart + MS_PER_MINUTE) % SLOT_MS === 0;
}

export function slotStartOf(minuteStart: number): number {
  return Math.floor(minuteStart / SLOT_MS) * SLOT_MS;
}
