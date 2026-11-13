import type { PrismaClient } from '@app/db';

export async function busyExpiry(db: PrismaClient, nowMs: number): Promise<void> {
  const now = new Date(nowMs);
  const expired = await db.vendor.findMany({
    where: { busyState: 'rush', busyUntil: { lte: now } },
    select: { id: true },
  });
  for (const vendor of expired) {
    await db.$transaction([
      db.vendor.update({
        where: { id: vendor.id },
        data: { busyState: 'normal', busyUntil: null },
      }),
      db.busyEvent.create({ data: { vendorId: vendor.id, state: 'normal', setAt: now } }),
    ]);
  }
}
