import { describe, expect, it } from 'vitest';
import { placeOrderSchema } from '../src/server/orderInput';

const VENDOR = '00000000-0000-4000-8000-000000000001';
const ITEM_A = '00000000-0000-4000-8000-0000000000a1';
const ITEM_B = '00000000-0000-4000-8000-0000000000b2';

const valid = {
  vendorId: VENDOR,
  items: [{ menuItemId: ITEM_A, qty: 2 }],
  pickup: { kind: 'asap' },
};

describe('placeOrderSchema', () => {
  it('accepts an ASAP order and a scheduled order', () => {
    expect(placeOrderSchema.safeParse(valid).success).toBe(true);
    expect(
      placeOrderSchema.safeParse({
        ...valid,
        pickup: { kind: 'scheduled', slotStart: 1_700_000_000_000 },
      }).success,
    ).toBe(true);
  });

  it('rejects any client-supplied price or total', () => {
    expect(placeOrderSchema.safeParse({ ...valid, totalHkd: 1 }).success).toBe(false);
    expect(
      placeOrderSchema.safeParse({ ...valid, items: [{ menuItemId: ITEM_A, qty: 1, priceHkd: 1 }] })
        .success,
    ).toBe(false);
  });

  it('limits quantities and the number of lines', () => {
    expect(
      placeOrderSchema.safeParse({ ...valid, items: [{ menuItemId: ITEM_A, qty: 6 }] }).success,
    ).toBe(false);
    expect(
      placeOrderSchema.safeParse({ ...valid, items: [{ menuItemId: ITEM_A, qty: 0 }] }).success,
    ).toBe(false);
    expect(placeOrderSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
    const nine = Array.from({ length: 9 }, (_, index) => ({
      menuItemId: `00000000-0000-4000-8000-00000000000${index}`,
      qty: 1,
    }));
    expect(placeOrderSchema.safeParse({ ...valid, items: nine }).success).toBe(false);
  });

  it('rejects the same item twice and non-integer quantities', () => {
    expect(
      placeOrderSchema.safeParse({
        ...valid,
        items: [
          { menuItemId: ITEM_A, qty: 1 },
          { menuItemId: ITEM_A, qty: 1 },
        ],
      }).success,
    ).toBe(false);
    expect(
      placeOrderSchema.safeParse({ ...valid, items: [{ menuItemId: ITEM_B, qty: 1.5 }] }).success,
    ).toBe(false);
  });

  it('rejects malformed ids, unknown pickup kinds and a scheduled order without a slot', () => {
    expect(placeOrderSchema.safeParse({ ...valid, vendorId: 'nope' }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...valid, pickup: { kind: 'teleport' } }).success).toBe(
      false,
    );
    expect(placeOrderSchema.safeParse({ ...valid, pickup: { kind: 'scheduled' } }).success).toBe(
      false,
    );
    expect(
      placeOrderSchema.safeParse({ ...valid, pickup: { kind: 'asap', slotStart: 1 } }).success,
    ).toBe(false);
  });
});
