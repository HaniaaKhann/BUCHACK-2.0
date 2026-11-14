import { AUTO_COMPLETE_AFTER_MINUTES, formatHktTime } from '@app/core';
import type { OrderView } from '@/server/orderViews';

export type OrderStatus = OrderView['status'];

export const STATUS_STEPS = ['placed', 'accepted', 'preparing', 'ready', 'completed'] as const;

export const STATUS_LABELS: Record<OrderStatus, string> = {
  placed: 'Placed',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  picked_up: 'Completed',
  cancelled: 'Cancelled',
};

export function stepIndex(status: OrderStatus): number {
  const step = status === 'picked_up' ? 'completed' : status;
  return STATUS_STEPS.findIndex((entry) => entry === step);
}

export function formatHkd(amount: number): string {
  return `HK$${amount}`;
}

export function statusMessage(order: OrderView): string {
  switch (order.status) {
    case 'placed':
      return order.graceSecondsLeft > 0
        ? `You can cancel for a full refund for ${order.graceSecondsLeft} more seconds.`
        : 'Waiting for the vendor to accept.';
    case 'accepted':
      return order.slotStart === null
        ? 'The vendor has your order.'
        : `Booked for ${formatHktTime(order.slotStart)}. The kitchen starts in time for that slot.`;
    case 'preparing':
      return 'Your food is being cooked.';
    case 'ready':
      return `Your order is ready. Tap "I picked it up" when you have it. It completes by itself ${AUTO_COMPLETE_AFTER_MINUTES} minutes after it was ready.`;
    case 'completed':
    case 'picked_up':
      return 'Enjoy your meal.';
    case 'cancelled':
      return `Cancelled. ${formatHkd(order.totalHkd)} was refunded to your wallet.`;
  }
}

export function readyRange(order: OrderView): string {
  const low = formatHktTime(order.predicted.low);
  const high = formatHktTime(order.predicted.high);
  return low === high ? low : `${low} to ${high}`;
}

export interface ErrorBody {
  error?: string;
  balanceHkd?: number;
  totalHkd?: number;
  nextSlotStart?: number;
  earliestSlotStart?: number;
}

export function orderErrorMessage(status: number, body: ErrorBody): string {
  switch (body.error) {
    case 'insufficient_balance':
      return `Not enough in your wallet. You have ${formatHkd(body.balanceHkd ?? 0)} and this order is ${formatHkd(body.totalHkd ?? 0)}.`;
    case 'slot_full':
      return body.nextSlotStart === undefined
        ? 'That pickup slot is full. Please choose another.'
        : `That pickup slot is full. The next free slot is ${formatHktTime(body.nextSlotStart)}.`;
    case 'slot_invalid':
      return body.earliestSlotStart === undefined
        ? 'That pickup slot is not available. Please choose another.'
        : `That slot is too soon. The earliest is ${formatHktTime(body.earliestSlotStart)}.`;
    case 'item_unavailable':
      return 'An item in your cart is no longer available. Remove it and try again.';
    case 'vendor_paused':
      return 'This vendor has paused online orders for now.';
    case 'vendor_closed':
      return 'This vendor is closed right now. You can still pick a later pickup slot.';
    case 'vendor_unavailable':
      return 'This vendor is not taking app orders.';
    case 'total_too_high':
      return 'That order is over the HK$500 limit. Remove something and try again.';
    case 'rate_limited':
      return 'Too many orders in a short time. Please wait a minute.';
    default:
      return status >= 500
        ? 'Something went wrong. Please try again.'
        : 'Could not place the order.';
  }
}
