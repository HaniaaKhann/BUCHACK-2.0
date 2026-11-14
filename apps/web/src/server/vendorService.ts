import { hktDate, hktMidnight, orderLink, orderStatusNotification } from '@app/core';
import { SIM_EMAIL_DOMAIN, createNotification } from '@app/db';
import { getClockNowMs } from './clock';
import { prisma } from './db';
import { notifyOrderChanged } from './notify';
import { OrderError } from './orderErrors';
import {
  VENDOR_TRANSITIONS,
  checkTransition,
  type VendorAction,
  type VendorOrderStatus,
} from './vendorTransitions';

export interface VendorOrderView {
  id: string;
  status: VendorOrderStatus;
  totalHkd: number;
  placedAt: number;
  fireAt: number | null;
  slotStart: number | null;
  items: { name: string; qty: number }[];
}

const vendorOrderSelect = {
  id: true,
  status: true,
  totalHkd: true,
  placedAt: true,
  fireAt: true,
  slotStart: true,
  studentId: true,
  items: { select: { qty: true, menuItem: { select: { name: true } } } },
} as const;

const ACTIVE_STATUSES: VendorOrderStatus[] = ['placed', 'accepted', 'preparing'];

export async function listVendorOrders(vendorId: string): Promise<VendorOrderView[]> {
  const rows = await prisma.order.findMany({
    where: { vendorId, status: { in: ACTIVE_STATUSES } },
    orderBy: { placedAt: 'asc' },
    take: 100,
    select: vendorOrderSelect,
  });
  return rows.map((row) => ({
    id: row.id,
    status: row.status as VendorOrderStatus,
    totalHkd: row.totalHkd,
    placedAt: row.placedAt.getTime(),
    fireAt: row.fireAt?.getTime() ?? null,
    slotStart: row.slotStart?.getTime() ?? null,
    items: row.items.map((item) => ({ name: item.menuItem.name, qty: item.qty })),
  }));
}

export interface DoneOrderView {
  id: string;
  status: 'ready' | 'completed';
  totalHkd: number;
  readyAt: number;
  items: { name: string; qty: number }[];
}

export async function listDoneToday(vendorId: string): Promise<DoneOrderView[]> {
  const now = await getClockNowMs();
  const dayStart = new Date(hktMidnight(hktDate(now)));
  const rows = await prisma.order.findMany({
    where: {
      vendorId,
      status: { in: ['ready', 'completed', 'picked_up'] },
      readyAt: { gte: dayStart },
    },
    orderBy: { readyAt: 'desc' },
    take: 100,
    select: {
      id: true,
      status: true,
      totalHkd: true,
      readyAt: true,
      items: { select: { qty: true, menuItem: { select: { name: true } } } },
    },
  });
  return rows.flatMap((row) =>
    row.readyAt === null
      ? []
      : [
          {
            id: row.id,
            status: row.status === 'ready' ? ('ready' as const) : ('completed' as const),
            totalHkd: row.totalHkd,
            readyAt: row.readyAt.getTime(),
            items: row.items.map((item) => ({ name: item.menuItem.name, qty: item.qty })),
          },
        ],
  );
}

export async function transitionVendorOrder(
  vendorId: string,
  orderId: string,
  action: VendorAction,
): Promise<{ status: VendorOrderStatus }> {
  const transition = VENDOR_TRANSITIONS[action];
  const now = new Date(await getClockNowMs());
  const stamp =
    transition.to === 'accepted'
      ? { acceptedAt: now }
      : transition.to === 'ready'
        ? { readyAt: now }
        : {};

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: orderId, vendorId, status: transition.from },
      data: { status: transition.to, ...stamp },
    });
    if (updated.count === 1 && transition.to !== 'placed') {
      const target = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        select: {
          studentId: true,
          vendor: { select: { name: true } },
          student: { select: { email: true } },
        },
      });
      if (!target.student.email.endsWith(`@${SIM_EMAIL_DOMAIN}`)) {
        await createNotification(tx, {
          userId: target.studentId,
          ...orderStatusNotification(transition.to, target.vendor.name),
          link: orderLink(orderId),
          at: now.getTime(),
        });
      }
    }
    return updated;
  });

  const order = await prisma.order.findFirst({
    where: { id: orderId, vendorId },
    select: { id: true, status: true, studentId: true },
  });
  if (order === null) throw new OrderError(404, 'not_found');

  if (result.count === 1) {
    await notifyOrderChanged({
      id: order.id,
      vendorId,
      studentId: order.studentId,
      status: transition.to,
    });
    return { status: transition.to };
  }

  const check = checkTransition(action, order.status);
  if (check === 'already_done') return { status: transition.to };
  throw new OrderError(409, 'wrong_state', { status: order.status });
}
