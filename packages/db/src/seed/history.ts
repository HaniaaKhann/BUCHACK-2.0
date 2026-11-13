import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { SIM_EMAIL_DOMAIN } from './simUsers.js';

const MS_PER_MINUTE = 60_000;
const TICKET_BATCH = 4000;
const ORDER_BATCH = 1000;

export const ticketFileSchema = z.array(
  z.object({
    vendorName: z.string().min(1),
    slotStart: z.string().datetime(),
    count: z.number().int().nonnegative(),
    source: z.literal('sim'),
  }),
);

export const studentFileSchema = z.array(z.object({ key: z.string().min(1) }));

export const orderFileSchema = z.array(
  z.object({
    id: z.string().min(1),
    vendorName: z.string().min(1),
    studentKey: z.string().min(1),
    status: z.literal('picked_up'),
    placedAt: z.string().datetime(),
    readyAt: z.string().datetime().nullable(),
    pickedUpAt: z.string().datetime(),
    items: z.array(
      z.object({
        name: z.string().min(1),
        qty: z.number().int().positive(),
        prepPriorMin: z.number().positive(),
      }),
    ),
  }),
);

export const predictionFileSchema = z.array(
  z.object({
    orderId: z.string().min(1),
    pointMinutes: z.number(),
    lowMinutes: z.number(),
    highMinutes: z.number(),
    baseMinutes: z.number(),
    backlogAtPlacement: z.number(),
    modelVersion: z.string().min(1),
  }),
);

export type TicketFile = z.infer<typeof ticketFileSchema>;
export type OrderFile = z.infer<typeof orderFileSchema>;
export type PredictionFile = z.infer<typeof predictionFileSchema>;
export type StudentFile = z.infer<typeof studentFileSchema>;

export interface MenuRef {
  id: string;
  priceHkd: number;
}

export interface HistoryLookups {
  vendorIdByName: ReadonlyMap<string, string>;
  menuByVendorAndName: ReadonlyMap<string, MenuRef>;
}

export function menuKey(vendorId: string, itemName: string): string {
  return `${vendorId}\u0000${itemName}`;
}

export function simUserRows(students: StudentFile) {
  return students.map((student, index) => ({
    id: student.key,
    name: `Simulated student ${String(index + 1).padStart(3, '0')}`,
    email: `${student.key}@${SIM_EMAIL_DOMAIN}`,
    emailVerified: false,
    role: 'student' as const,
  }));
}

export function ticketRows(tickets: TicketFile, lookups: HistoryLookups) {
  return tickets.map((row) => ({
    vendorId: requireVendor(lookups, row.vendorName),
    slotStart: new Date(row.slotStart),
    count: row.count,
    source: row.source,
  }));
}

function requireVendor(lookups: HistoryLookups, name: string): string {
  const id = lookups.vendorIdByName.get(name);
  if (id === undefined) throw new Error(`History references unknown outlet "${name}"`);
  return id;
}

export function orderRows(orders: OrderFile, predictions: PredictionFile, lookups: HistoryLookups) {
  const predictionByOrder = new Map(predictions.map((row) => [row.orderId, row]));
  return orders.map((order) => {
    const prediction = predictionByOrder.get(order.id);
    if (prediction === undefined) throw new Error(`No prediction for history order ${order.id}`);
    const vendorId = requireVendor(lookups, order.vendorName);
    const placedAt = Date.parse(order.placedAt);
    const items = order.items.map((item, index) => {
      const menu = lookups.menuByVendorAndName.get(menuKey(vendorId, item.name));
      if (menu === undefined) {
        throw new Error(`History order ${order.id} uses unknown item "${item.name}"`);
      }
      return {
        id: `${order.id}-${index}`,
        orderId: order.id,
        menuItemId: menu.id,
        qty: item.qty,
        priceHkdSnapshot: menu.priceHkd,
        prepPriorSnapshotMin: item.prepPriorMin,
      };
    });
    return {
      order: {
        id: order.id,
        studentId: order.studentKey,
        vendorId,
        status: order.status,
        totalHkd: items.reduce((sum, item) => sum + item.priceHkdSnapshot * item.qty, 0),
        placedAt: new Date(placedAt),
        readyAt: order.readyAt === null ? null : new Date(order.readyAt),
        pickedUpAt: new Date(order.pickedUpAt),
        predictedPoint: new Date(placedAt + prediction.pointMinutes * MS_PER_MINUTE),
        predictedLow: new Date(placedAt + prediction.lowMinutes * MS_PER_MINUTE),
        predictedHigh: new Date(placedAt + prediction.highMinutes * MS_PER_MINUTE),
        predictedBase: new Date(placedAt + prediction.baseMinutes * MS_PER_MINUTE),
        backlogAtPlacement: prediction.backlogAtPlacement,
        modelVersion: prediction.modelVersion,
      },
      items,
    };
  });
}

function chunk<T>(rows: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < rows.length; start += size)
    chunks.push(rows.slice(start, start + size));
  return chunks;
}

async function readGenerated<T>(
  directory: string,
  name: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): Promise<T | null> {
  try {
    return schema.parse(JSON.parse(await readFile(`${directory}/${name}`, 'utf8')));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

export const GENERATED_DIR = fileURLToPath(new URL('../../../../data/generated', import.meta.url));

export async function seedHistory(db: PrismaClient, directory: string): Promise<void> {
  const [tickets, orders, predictions, students] = await Promise.all([
    readGenerated(directory, 'tickets.json', ticketFileSchema),
    readGenerated(directory, 'orders.json', orderFileSchema),
    readGenerated(directory, 'predictions.json', predictionFileSchema),
    readGenerated(directory, 'students.json', studentFileSchema),
  ]);
  if (tickets === null || orders === null || predictions === null || students === null) return;

  const vendors = await db.vendor.findMany({ select: { id: true, name: true } });
  const menuItems = await db.menuItem.findMany({
    select: { id: true, vendorId: true, name: true, priceHkd: true },
  });
  const lookups: HistoryLookups = {
    vendorIdByName: new Map(vendors.map((vendor) => [vendor.name, vendor.id])),
    menuByVendorAndName: new Map(
      menuItems.map((item) => [
        menuKey(item.vendorId, item.name),
        { id: item.id, priceHkd: item.priceHkd },
      ]),
    ),
  };

  await db.user.createMany({ data: simUserRows(students), skipDuplicates: true });
  for (const batch of chunk(ticketRows(tickets, lookups), TICKET_BATCH)) {
    await db.ticketCount.createMany({ data: batch, skipDuplicates: true });
  }
  for (const batch of chunk(orderRows(orders, predictions, lookups), ORDER_BATCH)) {
    await db.order.createMany({ data: batch.map((row) => row.order), skipDuplicates: true });
    await db.orderItem.createMany({
      data: batch.flatMap((row) => row.items),
      skipDuplicates: true,
    });
  }
}
