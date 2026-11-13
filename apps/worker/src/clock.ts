import { MS_PER_MINUTE, SLOT_MINUTES, clockNowMs } from '@app/core';
import type { PrismaClient } from '@app/db';

export interface ClockReading {
  nowMs: number;
  demoPlaying: boolean;
}

export async function readClock(db: PrismaClient, realNowMs: number): Promise<ClockReading> {
  const row = await db.systemClock.findUniqueOrThrow({ where: { id: 1 } });
  return { nowMs: clockNowMs(row, realNowMs), demoPlaying: row.mode === 'demo' && row.speed > 0 };
}

export const SNAPSHOT_STEP_MS = SLOT_MINUTES * MS_PER_MINUTE;

export function boundaryAtOrBefore(ms: number, stepMs: number): number {
  return Math.floor(ms / stepMs) * stepMs;
}

export function dueBoundaries(
  previous: number | null,
  nowMs: number,
  stepMs: number,
  maxReplayed: number,
): number[] {
  const current = boundaryAtOrBefore(nowMs, stepMs);
  if (previous === null || current < previous) return [current];
  const count = Math.min((current - previous) / stepMs, maxReplayed);
  return Array.from({ length: count }, (_, index) => current - (count - 1 - index) * stepMs);
}
