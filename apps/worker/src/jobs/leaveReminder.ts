import { leaveNowAt, leaveNowNotification, orderLink } from '@app/core';
import { SIM_EMAIL_DOMAIN, createNotification, type PrismaClient } from '@app/db';

export async function leaveReminder(db: PrismaClient, nowMs: number): Promise<void> {
  const orders = await db.order.findMany({
    where: {
      status: { in: ['accepted', 'preparing'] },
      student: {
        NOT: { email: { endsWith: `@${SIM_EMAIL_DOMAIN}` } },
        profile: { currentBuildingId: { not: null } },
      },
    },
    select: {
      id: true,
      studentId: true,
      vendorId: true,
      predictedPoint: true,
      vendor: { select: { name: true } },
      student: { select: { profile: { select: { currentBuildingId: true } } } },
    },
  });
  for (const order of orders) {
    const buildingId = order.student.profile?.currentBuildingId;
    if (buildingId === null || buildingId === undefined) continue;
    const walk = await db.walkTime.findFirst({
      where: { fromBuildingId: buildingId, toVendorId: order.vendorId },
      select: { minutes: true },
    });
    if (walk === null) continue;
    const readyAt = order.predictedPoint.getTime();
    if (nowMs < leaveNowAt(readyAt, walk.minutes)) continue;
    const link = orderLink(order.id);
    const already = await db.notification.findFirst({
      where: { userId: order.studentId, kind: 'leave_now', link },
      select: { id: true },
    });
    if (already !== null) continue;
    await createNotification(db, {
      userId: order.studentId,
      ...leaveNowNotification(order.vendor.name, readyAt),
      link,
      at: nowMs,
    });
  }
}
