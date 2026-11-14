import { describe, expect, it } from 'vitest';
import { toOrderView, type OrderRow } from '../src/server/orderViews';

const PLACED = Date.UTC(2026, 10, 17, 4, 15);

function row(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: 'o1',
    status: 'placed',
    totalHkd: 76,
    placedAt: new Date(PLACED),
    acceptedAt: null,
    fireAt: null,
    slotStart: null,
    readyAt: null,
    pickedUpAt: null,
    cancelledAt: null,
    predictedLow: new Date(PLACED + 240_000),
    predictedPoint: new Date(PLACED + 360_000),
    predictedHigh: new Date(PLACED + 540_000),
    vendor: { id: 'v1', name: 'Main Canteen' },
    items: [{ qty: 2, priceHkdSnapshot: 38, menuItem: { name: 'Vegetable Noodles' } }],
    ...overrides,
  };
}

describe('toOrderView', () => {
  it('turns dates into milliseconds and items into names with the price paid', () => {
    const view = toOrderView(row(), PLACED + 10_000);
    expect(view.placedAt).toBe(PLACED);
    expect(view.predicted).toEqual({
      low: PLACED + 240_000,
      point: PLACED + 360_000,
      high: PLACED + 540_000,
    });
    expect(view.items).toEqual([{ name: 'Vegetable Noodles', qty: 2, priceHkd: 38 }]);
    expect(view.acceptedAt).toBeNull();
  });

  it('allows cancelling only while the order is placed, with the grace countdown', () => {
    const placed = toOrderView(row(), PLACED + 25_000);
    expect(placed).toMatchObject({ canCancel: true, canPickUp: false, graceSecondsLeft: 35 });
    const accepted = toOrderView(row({ status: 'accepted' }), PLACED + 25_000);
    expect(accepted).toMatchObject({ canCancel: false, graceSecondsLeft: 0 });
  });

  it('allows pick-up from accepted, preparing and ready only', () => {
    const states = ['placed', 'accepted', 'preparing', 'ready', 'picked_up', 'cancelled'] as const;
    const allowed = states.filter((status) => toOrderView(row({ status }), PLACED).canPickUp);
    expect(allowed).toEqual(['accepted', 'preparing', 'ready']);
  });
});
