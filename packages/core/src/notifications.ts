import { MS_PER_MINUTE } from './config.js';
import { formatHktTime } from './time.js';

export const NOTIFICATION_KINDS = [
  'order_accepted',
  'order_preparing',
  'order_ready',
  'order_picked_up',
  'leave_now',
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface NotificationContent {
  kind: NotificationKind;
  title: string;
  body: string;
}

export type NotifiableStatus = 'accepted' | 'preparing' | 'ready' | 'picked_up';

export function orderStatusNotification(
  status: NotifiableStatus,
  vendorName: string,
): NotificationContent {
  switch (status) {
    case 'accepted':
      return {
        kind: 'order_accepted',
        title: 'Order accepted',
        body: `${vendorName} accepted your order.`,
      };
    case 'preparing':
      return {
        kind: 'order_preparing',
        title: 'Order is being prepared',
        body: `${vendorName} started preparing your order.`,
      };
    case 'ready':
      return {
        kind: 'order_ready',
        title: 'Order ready',
        body: `Your order at ${vendorName} is ready for pickup.`,
      };
    case 'picked_up':
      return {
        kind: 'order_picked_up',
        title: 'Order picked up',
        body: `Your order at ${vendorName} was marked as picked up.`,
      };
  }
}

export function leaveNowNotification(vendorName: string, readyAtMs: number): NotificationContent {
  return {
    kind: 'leave_now',
    title: 'Time to leave',
    body: `Leave now to collect your order at ${vendorName}. It should be ready around ${formatHktTime(readyAtMs)}.`,
  };
}

export function leaveNowAt(predictedReadyMs: number, walkMinutes: number): number {
  return predictedReadyMs - walkMinutes * MS_PER_MINUTE;
}

export function orderLink(orderId: string): string {
  return `/orders/${orderId}`;
}
