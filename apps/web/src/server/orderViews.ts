import { graceSecondsLeft } from '@app/core';

export const orderSelect = {
  id: true,
  status: true,
  totalHkd: true,
  placedAt: true,
  acceptedAt: true,
  fireAt: true,
  slotStart: true,
  readyAt: true,
  pickedUpAt: true,
  cancelledAt: true,
  predictedLow: true,
  predictedPoint: true,
  predictedHigh: true,
  vendor: { select: { id: true, name: true } },
  items: { select: { qty: true, priceHkdSnapshot: true, menuItem: { select: { name: true } } } },
} as const;

export interface OrderRow {
  id: string;
  status: 'placed' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'picked_up' | 'cancelled';
  totalHkd: number;
  placedAt: Date;
  acceptedAt: Date | null;
  fireAt: Date | null;
  slotStart: Date | null;
  readyAt: Date | null;
  pickedUpAt: Date | null;
  cancelledAt: Date | null;
  predictedLow: Date;
  predictedPoint: Date;
  predictedHigh: Date;
  vendor: { id: string; name: string };
  items: { qty: number; priceHkdSnapshot: number; menuItem: { name: string } }[];
}

export interface OrderView {
  id: string;
  status: OrderRow['status'];
  vendor: { id: string; name: string };
  totalHkd: number;
  items: { name: string; qty: number; priceHkd: number }[];
  placedAt: number;
  acceptedAt: number | null;
  fireAt: number | null;
  slotStart: number | null;
  readyAt: number | null;
  pickedUpAt: number | null;
  cancelledAt: number | null;
  predicted: { low: number; point: number; high: number };
  now: number;
  graceSecondsLeft: number;
  canCancel: boolean;
  canPickUp: boolean;
}

const time = (value: Date | null): number | null => value?.getTime() ?? null;

export function toOrderView(row: OrderRow, now: number): OrderView {
  return {
    id: row.id,
    status: row.status,
    vendor: row.vendor,
    totalHkd: row.totalHkd,
    items: row.items.map((item) => ({
      name: item.menuItem.name,
      qty: item.qty,
      priceHkd: item.priceHkdSnapshot,
    })),
    placedAt: row.placedAt.getTime(),
    acceptedAt: time(row.acceptedAt),
    fireAt: time(row.fireAt),
    slotStart: time(row.slotStart),
    readyAt: time(row.readyAt),
    pickedUpAt: time(row.pickedUpAt),
    cancelledAt: time(row.cancelledAt),
    predicted: {
      low: row.predictedLow.getTime(),
      point: row.predictedPoint.getTime(),
      high: row.predictedHigh.getTime(),
    },
    now,
    graceSecondsLeft: row.status === 'placed' ? graceSecondsLeft(row.placedAt.getTime(), now) : 0,
    canCancel: row.status === 'placed',
    canPickUp: row.status === 'ready',
  };
}
