import type { PrismaClient } from '@app/db';
import { notify } from '../notifier.js';

export async function slotFire(db: PrismaClient, nowMs: number): Promise<void> {
  const due = await db.order.findMany({
    where: { status: 'accepted', fireAt: { lte: new Date(nowMs) } },
    select: { id: true, vendorId: true, studentId: true },
  });
  if (due.length === 0) return;
  await db.order.updateMany({
    where: { id: { in: due.map((order) => order.id) }, status: 'accepted' },
    data: { status: 'preparing' },
  });
  for (const order of due) {
    await notify(db, 'order_changed', {
      orderId: order.id,
      vendorId: order.vendorId,
      studentId: order.studentId,
      status: 'preparing',
    });
  }
}
