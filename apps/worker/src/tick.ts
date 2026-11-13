import type { PrismaClient } from '@app/db';
import { SNAPSHOT_STEP_MS, boundaryAtOrBefore, dueBoundaries, type ClockReading } from './clock.js';
import { MAX_REPLAYED_BOUNDARIES } from './config.js';
import type { Uniform } from './demoLoadPlan.js';
import { autoAccept } from './jobs/autoAccept.js';
import { busyExpiry } from './jobs/busyExpiry.js';
import { demoLoad, newDemoLoadState, type DemoLoadState } from './jobs/demoLoad.js';
import { runEngineSnapshots } from './jobs/engineSnapshot.js';
import { slotFire } from './jobs/slotFire.js';

export interface TickState {
  lastSnapshotBoundary: number | null;
  demoLoad: DemoLoadState;
}

export function newTickState(): TickState {
  return { lastSnapshotBoundary: null, demoLoad: newDemoLoadState() };
}

export interface TickOptions {
  demoMode: boolean;
  uniform: Uniform;
}

export async function runTick(
  db: PrismaClient,
  clock: ClockReading,
  state: TickState,
  options: TickOptions,
): Promise<void> {
  const { nowMs } = clock;
  if (options.demoMode && clock.demoPlaying) {
    await demoLoad(db, nowMs, state.demoLoad, options.uniform);
  }
  const boundaries = dueBoundaries(
    state.lastSnapshotBoundary,
    nowMs,
    SNAPSHOT_STEP_MS,
    MAX_REPLAYED_BOUNDARIES,
  );
  if (boundaries.length > 0) {
    await runEngineSnapshots(db, boundaries);
    state.lastSnapshotBoundary = boundaryAtOrBefore(nowMs, SNAPSHOT_STEP_MS);
  }
  await autoAccept(db, nowMs);
  await slotFire(db, nowMs);
  await busyExpiry(db, nowMs);
}
