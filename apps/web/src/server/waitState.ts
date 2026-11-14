import { readSnapshotPayload } from '@app/db';
import { prisma } from './db';
import type { VendorWaitState } from './waitEstimate';

export async function loadWaitStates(
  vendorIds: readonly string[],
  now: number,
): Promise<Map<string, VendorWaitState>> {
  const entries = await Promise.all(
    vendorIds.map(async (vendorId): Promise<[string, VendorWaitState]> => {
      const row = await prisma.engineSnapshot.findFirst({
        where: { vendorId, computedAt: { lte: new Date(now) } },
        orderBy: { computedAt: 'desc' },
        select: { computedAt: true, payload: true },
      });
      const payload = row === null ? null : readSnapshotPayload(row.payload);
      if (row === null || payload === null) return [vendorId, { payload: null, arrivals: [] }];
      const orders = await prisma.order.findMany({
        where: {
          vendorId,
          status: { not: 'cancelled' },
          placedAt: { gte: row.computedAt, lt: new Date(now) },
        },
        select: { placedAt: true },
      });
      return [vendorId, { payload, arrivals: orders.map((order) => order.placedAt.getTime()) }];
    }),
  );
  return new Map(entries);
}
