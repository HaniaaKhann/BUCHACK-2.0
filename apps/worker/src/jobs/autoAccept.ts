import { ORDER_GRACE_SECONDS } from '@app/core';
import type { PrismaClient } from '@app/db';
import { notify } from '../notifier.js';

export async function autoAccept(db: PrismaClient, nowMs: number): Promise<void> {
  const cutoff = new Date(nowMs - ORDER_GRACE_SECONDS * 1000);
  const due = await db.order.findMany({
    where: { status: 'placed', placedAt: { lte: cutoff } },
    select: { id: true, vendorId: true, studentId: true },
  });
  if (due.length === 0) return;
  await db.order.updateMany({
    where: { id: { in: due.map((order) => order.id) }, status: 'placed' },
    data: { status: 'accepted', acceptedAt: new Date(nowMs) },
  });
  for (const order of due) {
    await notify(db, 'order_changed', {
      orderId: order.id,
      vendorId: order.vendorId,
      studentId: order.studentId,
      status: 'accepted',
    });
  }
}
