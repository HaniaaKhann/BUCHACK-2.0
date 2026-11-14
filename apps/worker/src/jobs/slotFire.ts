import { orderLink, orderStatusNotification } from '@app/core';
import { SIM_EMAIL_DOMAIN, createNotification, type PrismaClient } from '@app/db';
import { notify } from '../notifier.js';

export async function slotFire(db: PrismaClient, nowMs: number): Promise<void> {
  const due = await db.order.findMany({
    where: { status: 'accepted', fireAt: { lte: new Date(nowMs) } },
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
        where: { id: order.id, status: 'accepted' },
        data: { status: 'preparing' },
      });
      if (result.count === 0) return false;
      if (!order.student.email.endsWith(`@${SIM_EMAIL_DOMAIN}`)) {
        await createNotification(tx, {
          userId: order.studentId,
          ...orderStatusNotification('preparing', order.vendor.name),
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
      status: 'preparing',
    });
  }
}
