import type { History } from './generate.js';

export interface OrderRow {
  id: string;
  vendorName: string;
  studentKey: string;
  status: 'picked_up';
  placedAt: string;
  readyAt: string | null;
  pickedUpAt: string;
  items: { name: string; qty: number; prepPriorMin: number }[];
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

export function appOrderRows(history: History): OrderRow[] {
  return history.vendors.flatMap((vendor) =>
    vendor.orders.flatMap((order) =>
      order.channel === 'app' && order.studentKey !== null && order.pickedUpAt !== null
        ? [
            {
              id: order.id,
              vendorName: order.vendorName,
              studentKey: order.studentKey,
              status: 'picked_up' as const,
              placedAt: iso(order.placedAt),
              readyAt: order.tapAt === null ? null : iso(order.tapAt),
              pickedUpAt: iso(order.pickedUpAt),
              items: order.items.map((item) => ({
                name: item.name,
                qty: 1,
                prepPriorMin: item.prepPriorMin,
              })),
            },
          ]
        : [],
    ),
  );
}
