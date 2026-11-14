import { ORDER_GRACE_SECONDS, orderLink, orderStatusNotification } from '@app/core';
import { SIM_EMAIL_DOMAIN, createNotification, type PrismaClient } from '@app/db';
import { notify } from '../notifier.js';

export async function autoAccept(db: PrismaClient, nowMs: number): Promise<void> {
  const cutoff = new Date(nowMs - ORDER_GRACE_SECONDS * 1000);
  const due = await db.order.findMany({
    where: { status: 'placed', placedAt: { lte: cutoff } },
    select: {
      id: true,
      vendorId: true,
      studentId: true,
      vendor: { select: { name: true } },
      student: { select: { email: true } },
    },
  });
  for (const order of due) {
    const changed = await db.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { id: order.id, status: 'placed' },
        data: { status: 'accepted', acceptedAt: new Date(nowMs) },
      });
      if (result.count === 0) return false;
      if (!order.student.email.endsWith(`@${SIM_EMAIL_DOMAIN}`)) {
        await createNotification(tx, {
          userId: order.studentId,
          ...orderStatusNotification('accepted', order.vendor.name),
          link: orderLink(order.id),
          at: nowMs,
        });
      }
      return true;
    });
    if (!changed) continue;
    await notify(db, 'order_changed', {
      orderId: order.id,
      vendorId: order.vendorId,
      studentId: order.studentId,
      status: 'accepted',
    });
  }
}
