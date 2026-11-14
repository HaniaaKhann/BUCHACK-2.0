import { describe, expect, it } from 'vitest';
import { MS_PER_MINUTE } from '../src/config.js';
import {
  leaveNowAt,
  leaveNowNotification,
  orderLink,
  orderStatusNotification,
} from '../src/notifications.js';

describe('order status notifications', () => {
  it('says what happened at which outlet for every status', () => {
    expect(orderStatusNotification('accepted', 'Bistro NTT')).toEqual({
      kind: 'order_accepted',
      title: 'Order accepted',
      body: 'Bistro NTT accepted your order.',
    });
    expect(orderStatusNotification('preparing', 'Deli')).toMatchObject({
      kind: 'order_preparing',
      body: 'Deli started preparing your order.',
    });
    expect(orderStatusNotification('ready', 'Main Canteen')).toEqual({
      kind: 'order_ready',
      title: 'Order ready',
      body: 'Your order at Main Canteen is ready for pickup.',
    });
    expect(orderStatusNotification('picked_up', 'Deli')).toMatchObject({
      kind: 'order_picked_up',
      title: 'Order picked up',
    });
  });
});

describe('leave now', () => {
  const READY = Date.UTC(2026, 10, 17, 4, 30);

  it('leaves the walking time before the predicted ready time', () => {
    expect(leaveNowAt(READY, 5)).toBe(READY - 5 * MS_PER_MINUTE);
    expect(leaveNowAt(READY, 0)).toBe(READY);
  });

  it('names the outlet and the ready time in Hong Kong time', () => {
    expect(leaveNowNotification('Bistro NTT', READY)).toEqual({
      kind: 'leave_now',
      title: 'Time to leave',
      body: 'Leave now to collect your order at Bistro NTT. It should be ready around 12:30.',
    });
  });

  it('links to the order', () => {
    expect(orderLink('abc')).toBe('/orders/abc');
  });
});
