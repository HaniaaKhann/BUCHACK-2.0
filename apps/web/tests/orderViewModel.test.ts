import { describe, expect, it } from 'vitest';
import type { OrderView } from '../src/server/orderViews';
import {
  formatHkd,
  orderErrorMessage,
  readyRange,
  statusMessage,
  stepIndex,
} from '../src/ui/orders/orderViewModel';

const NOW = Date.UTC(2026, 10, 17, 4, 15);
const MINUTE = 60_000;

function order(overrides: Partial<OrderView> = {}): OrderView {
  return {
    id: 'o1',
    status: 'placed',
    vendor: { id: 'v1', name: 'Main Canteen' },
    totalHkd: 76,
    items: [{ name: 'Noodles', qty: 2, priceHkd: 38 }],
    placedAt: NOW,
    acceptedAt: null,
    fireAt: null,
    slotStart: null,
    readyAt: null,
    pickedUpAt: null,
    cancelledAt: null,
    predicted: { low: NOW + 4 * MINUTE, point: NOW + 6 * MINUTE, high: NOW + 9 * MINUTE },
    now: NOW,
    graceSecondsLeft: 40,
    canCancel: true,
    canPickUp: false,
    ...overrides,
  };
}

describe('order status text', () => {
  it('counts the grace seconds while the order is placed', () => {
    expect(statusMessage(order())).toContain('40 more seconds');
    expect(statusMessage(order({ graceSecondsLeft: 0 }))).toBe('Waiting for the vendor to accept.');
  });

  it('says where a scheduled order is booked', () => {
    const text = statusMessage(order({ status: 'accepted', slotStart: NOW + 45 * MINUTE }));
    expect(text).toContain('13:00');
  });

  it('tells the student to tap pick up when ready and mentions the refund when cancelled', () => {
    expect(statusMessage(order({ status: 'ready' }))).toContain('I picked it up');
    expect(statusMessage(order({ status: 'ready' }))).toContain('30 minutes after it was ready');
    expect(statusMessage(order({ status: 'completed' }))).toBe('Enjoy your meal.');
    expect(statusMessage(order({ status: 'cancelled' }))).toContain('HK$76 was refunded');
  });

  it('formats the ready range and money', () => {
    expect(readyRange(order())).toBe('12:19 to 12:24');
    expect(readyRange(order({ predicted: { low: NOW, point: NOW, high: NOW } }))).toBe('12:15');
    expect(formatHkd(12)).toBe('HK$12');
  });

  it('orders the steps and leaves cancelled outside them', () => {
    expect(stepIndex('placed')).toBe(0);
    expect(stepIndex('completed')).toBe(4);
    expect(stepIndex('picked_up')).toBe(4);
    expect(stepIndex('cancelled')).toBe(-1);
  });
});

describe('orderErrorMessage', () => {
  it('explains a short wallet with both amounts', () => {
    expect(
      orderErrorMessage(402, { error: 'insufficient_balance', balanceHkd: 10, totalHkd: 38 }),
    ).toBe('Not enough in your wallet. You have HK$10 and this order is HK$38.');
  });

  it('offers the next slot when a slot is full and the earliest one when too soon', () => {
    expect(
      orderErrorMessage(409, { error: 'slot_full', nextSlotStart: NOW + 15 * MINUTE }),
    ).toContain('12:30');
    expect(
      orderErrorMessage(409, { error: 'slot_invalid', earliestSlotStart: NOW + 15 * MINUTE }),
    ).toContain('12:30');
    expect(orderErrorMessage(409, { error: 'slot_full' })).toContain('choose another');
  });

  it('has a clear message for each refusal and a safe fallback', () => {
    for (const code of [
      'item_unavailable',
      'vendor_paused',
      'vendor_closed',
      'vendor_unavailable',
      'total_too_high',
      'rate_limited',
    ]) {
      expect(orderErrorMessage(409, { error: code }).length).toBeGreaterThan(10);
    }
    expect(orderErrorMessage(500, {})).toBe('Something went wrong. Please try again.');
    expect(orderErrorMessage(400, {})).toBe('Could not place the order.');
  });
});
