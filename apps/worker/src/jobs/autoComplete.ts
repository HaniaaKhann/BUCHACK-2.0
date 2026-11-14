import {
  AUTO_COMPLETE_AFTER_MINUTES,
  MS_PER_MINUTE,
  orderCompletedNotification,
  orderLink,
} from '@app/core';
import { SIM_EMAIL_DOMAIN, createNotification, type PrismaClient } from '@app/db';
import { notify } from '../notifier.js';

export async function autoComplete(db: PrismaClient, nowMs: number): Promise<void> {
  const cutoff = new Date(nowMs - AUTO_COMPLETE_AFTER_MINUTES * MS_PER_MINUTE);
  const due = await db.order.findMany({
    where: {
      status: 'ready',
      readyAt: { lte: cutoff },
      student: { NOT: { email: { endsWith: `@${SIM_EMAIL_DOMAIN}` } } },
    },
    select: {
      id: true,
      vendorId: true,
      studentId: true,
      vendor: { select: { name: true } },
    },
  });
  for (const order of due) {
    const changed = await db.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { id: order.id, status: 'ready' },
        data: { status: 'completed' },
      });
      if (result.count === 0) return false;
      await createNotification(tx, {
        userId: order.studentId,
        ...orderCompletedNotification(order.vendor.name),
        link: orderLink(order.id),
        at: nowMs,
      });
      return true;
    });
    if (!changed) continue;
    await notify(db, 'order_changed', {
      orderId: order.id,
      vendorId: order.vendorId,
      studentId: order.studentId,
      status: 'completed',
    });
  }
}
