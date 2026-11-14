import { MS_PER_MINUTE, ORDER_GRACE_SECONDS, SLOT_MINUTES } from './config.js';

const SLOT_MS = SLOT_MINUTES * MS_PER_MINUTE;

export interface ScheduledPrediction {
  base: number;
  low: number;
  point: number;
  high: number;
}

export function scheduledPrediction(
  slotStart: number,
  latenessQ50Minutes: number,
  latenessQ90Minutes: number,
): ScheduledPrediction {
  const point = slotStart + latenessQ50Minutes * MS_PER_MINUTE;
  return {
    base: slotStart,
    low: Math.min(slotStart, point),
    point,
    high: Math.max(point, slotStart + latenessQ90Minutes * MS_PER_MINUTE),
  };
}

export function earliestSlotStart(
  now: number,
  queueDelayMinutes: number,
  prepMinutes: number,
): number {
  const earliest = now + (queueDelayMinutes + prepMinutes) * MS_PER_MINUTE;
  return Math.ceil(earliest / SLOT_MS) * SLOT_MS;
}

export function graceSecondsLeft(placedAt: number, now: number): number {
  const left = ORDER_GRACE_SECONDS - Math.floor((now - placedAt) / 1000);
  return Math.min(ORDER_GRACE_SECONDS, Math.max(0, left));
}
