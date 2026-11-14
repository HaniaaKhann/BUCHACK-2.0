import { prisma } from './db';

export interface OrderChange {
  id: string;
  vendorId: string;
  studentId: string;
  status: string;
}

export async function notifyOrderChanged(order: OrderChange): Promise<void> {
  const payload = JSON.stringify({
    orderId: order.id,
    vendorId: order.vendorId,
    studentId: order.studentId,
    status: order.status,
  });
  await prisma.$executeRaw`SELECT pg_notify('order_changed', ${payload})`;
}

export async function notifyVendorChanged(vendorId: string): Promise<void> {
  const payload = JSON.stringify({ vendorId });
  await prisma.$executeRaw`SELECT pg_notify('vendor_changed', ${payload})`;
}

export async function notifyClockUpdated(): Promise<void> {
  await prisma.$executeRaw`SELECT pg_notify('clock_updated', '{}')`;
}
