import { readSnapshotPayload } from '@app/db';
import { prisma } from './db';
import type { VendorWaitState } from './waitEstimate';

export async function loadWaitStates(
  vendorIds: readonly string[],
  now: number,
): Promise<Map<string, VendorWaitState>> {
  const busyRows = await prisma.vendor.findMany({
    where: { id: { in: [...vendorIds] } },
    select: { id: true, busyState: true, busyUntil: true },
  });
  const busy = new Map(busyRows.map((row) => [row.id, row]));
  const entries = await Promise.all(
    vendorIds.map(async (vendorId): Promise<[string, VendorWaitState]> => {
      const row = await prisma.engineSnapshot.findFirst({
        where: { vendorId, computedAt: { lte: new Date(now) } },
        orderBy: { computedAt: 'desc' },
        select: { computedAt: true, payload: true },
      });
      const payload = row === null ? null : readSnapshotPayload(row.payload);
      const vendorBusy = busy.get(vendorId);
      const busyFields = {
        busyState: vendorBusy?.busyState ?? 'normal',
        busyUntil: vendorBusy?.busyUntil?.getTime() ?? null,
      } as const;
      if (row === null || payload === null) {
        return [vendorId, { payload: null, arrivals: [], ...busyFields }];
      }
      const orders = await prisma.order.findMany({
        where: {
          vendorId,
          status: { not: 'cancelled' },
          placedAt: { gte: row.computedAt, lt: new Date(now) },
        },
        select: { placedAt: true },
      });
      return [
        vendorId,
        { payload, arrivals: orders.map((order) => order.placedAt.getTime()), ...busyFields },
      ];
    }),
  );
  return new Map(entries);
}
