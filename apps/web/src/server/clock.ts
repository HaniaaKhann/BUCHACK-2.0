import { clockNowMs } from '@app/core';
import { prisma } from './db';

export async function getClockNowMs(realNowMs: number = Date.now()): Promise<number> {
  const row = await prisma.systemClock.findUniqueOrThrow({ where: { id: 1 } });
  return clockNowMs(row, realNowMs);
}
