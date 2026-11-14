import { clockNowMs, nextClockAnchor, type ClockCommand, type ClockRow } from '@app/core';
import { prisma } from './db';
import { isDemoMode } from './demoMode';
import { notifyClockUpdated } from './notify';

export interface ClockView {
  mode: 'real' | 'demo';
  speed: number;
  nowMs: number;
  demoMode: boolean;
}

function toView(row: ClockRow, realNowMs: number): ClockView {
  return {
    mode: row.mode,
    speed: row.speed,
    nowMs: clockNowMs(row, realNowMs),
    demoMode: isDemoMode(),
  };
}

export async function getClockView(): Promise<ClockView> {
  const row = await prisma.systemClock.findUniqueOrThrow({ where: { id: 1 } });
  return toView(row, Date.now());
}

export async function applyClockCommand(command: ClockCommand): Promise<ClockView> {
  const view = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM system_clock WHERE id = 1 FOR UPDATE`;
    const realNowMs = Date.now();
    const row = await tx.systemClock.findUniqueOrThrow({ where: { id: 1 } });
    const next = nextClockAnchor(row, realNowMs, command);
    const updated = await tx.systemClock.update({
      where: { id: 1 },
      data: {
        mode: 'demo',
        currentTime: new Date(next.currentTimeMs),
        speed: next.speed,
        updatedAt: new Date(realNowMs),
      },
    });
    return toView(updated, realNowMs);
  });
  await notifyClockUpdated();
  return view;
}
