import { z } from 'zod';

export const ORDER_CHANGED_CHANNEL = 'order_changed';
export const SNAPSHOT_WRITTEN_CHANNEL = 'snapshot_written';
export const VENDOR_CHANGED_CHANNEL = 'vendor_changed';
export const CLOCK_UPDATED_CHANNEL = 'clock_updated';
export const LISTEN_CHANNELS = [
  ORDER_CHANGED_CHANNEL,
  SNAPSHOT_WRITTEN_CHANNEL,
  VENDOR_CHANGED_CHANNEL,
  CLOCK_UPDATED_CHANNEL,
] as const;

const orderStatus = z.enum(['placed', 'accepted', 'preparing', 'ready', 'picked_up', 'cancelled']);

const orderChangedSchema = z.object({
  orderId: z.string().min(1),
  vendorId: z.string().min(1),
  studentId: z.string().min(1),
  status: orderStatus,
});

const snapshotWrittenSchema = z.object({
  vendorId: z.string().min(1),
  computedAt: z.string().min(1),
});

const vendorChangedSchema = z.object({ vendorId: z.string().min(1) });

export type AppEvent =
  | {
      kind: 'order';
      orderId: string;
      vendorId: string;
      studentId: string;
      status: z.infer<typeof orderStatus>;
      at: number;
    }
  | { kind: 'snapshot'; vendorId: string; computedAt: string }
  | { kind: 'queue'; vendorId: string }
  | { kind: 'resync' };

function parseJson(payload: string | undefined): unknown {
  if (payload === undefined) return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export function parseNotification(
  channel: string,
  payload: string | undefined,
  now: number,
): AppEvent | null {
  const json = parseJson(payload);
  if (channel === ORDER_CHANGED_CHANNEL) {
    const parsed = orderChangedSchema.safeParse(json);
    return parsed.success ? { kind: 'order', ...parsed.data, at: now } : null;
  }
  if (channel === SNAPSHOT_WRITTEN_CHANNEL) {
    const parsed = snapshotWrittenSchema.safeParse(json);
    return parsed.success ? { kind: 'snapshot', ...parsed.data } : null;
  }
  if (channel === VENDOR_CHANGED_CHANNEL) {
    const parsed = vendorChangedSchema.safeParse(json);
    return parsed.success ? { kind: 'queue', vendorId: parsed.data.vendorId } : null;
  }
  if (channel === CLOCK_UPDATED_CHANNEL) return { kind: 'resync' };
  return null;
}

export function toWire(event: AppEvent): { name: string; data: Record<string, unknown> } {
  switch (event.kind) {
    case 'order':
      return {
        name: 'order',
        data: {
          orderId: event.orderId,
          vendorId: event.vendorId,
          status: event.status,
          at: event.at,
        },
      };
    case 'snapshot':
      return {
        name: 'snapshot',
        data: { vendorId: event.vendorId, computedAt: event.computedAt },
      };
    case 'queue':
      return { name: 'queue', data: { vendorId: event.vendorId } };
    case 'resync':
      return { name: 'resync', data: {} };
  }
}
