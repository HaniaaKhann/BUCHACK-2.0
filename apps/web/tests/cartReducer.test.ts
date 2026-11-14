import { describe, expect, it } from 'vitest';
import {
  EMPTY_CART,
  cartCount,
  cartReducer,
  cartTotal,
  conflictsWithCart,
  toOrderRequest,
  type CartState,
} from '../src/ui/cart/cartReducer';

const canteen = { id: 'v1', name: 'Main Canteen' };
const bistro = { id: 'v2', name: 'Bistro NTT' };
const noodles = { menuItemId: 'i1', name: 'Noodles', priceHkd: 38 };
const tea = { menuItemId: 'i2', name: 'Milk Tea', priceHkd: 14 };

const add = (state: CartState, line = noodles, vendor = canteen): CartState =>
  cartReducer(state, { type: 'add', vendor, line });

describe('cartReducer', () => {
  it('adds an item and counts repeated adds on the same line', () => {
    let state = add(EMPTY_CART);
    state = add(state);
    expect(state.lines).toEqual([{ ...noodles, qty: 2 }]);
    expect(state.vendorName).toBe('Main Canteen');
  });

  it('caps a line at five and the cart at eight lines', () => {
    let state = EMPTY_CART;
    for (let i = 0; i < 8; i += 1) state = add(state);
    expect(state.lines[0]?.qty).toBe(5);
    let many = EMPTY_CART;
    for (let i = 0; i < 10; i += 1) {
      many = add(many, { menuItemId: `i${i}`, name: `Item ${i}`, priceHkd: 10 });
    }
    expect(many.lines).toHaveLength(8);
  });

  it('keeps one vendor: adding from another vendor changes nothing until the cart is replaced', () => {
    const state = add(EMPTY_CART);
    expect(conflictsWithCart(state, 'v2')).toBe(true);
    expect(conflictsWithCart(state, 'v1')).toBe(false);
    expect(conflictsWithCart(EMPTY_CART, 'v2')).toBe(false);
    expect(add(state, tea, bistro)).toBe(state);
    const replaced = cartReducer(state, { type: 'replace', vendor: bistro, line: tea });
    expect(replaced).toEqual({
      vendorId: 'v2',
      vendorName: 'Bistro NTT',
      lines: [{ ...tea, qty: 1 }],
    });
  });

  it('sets a quantity within bounds and removes a line at zero or by request', () => {
    let state = add(add(EMPTY_CART), tea);
    state = cartReducer(state, { type: 'setQty', menuItemId: 'i1', qty: 9 });
    expect(state.lines[0]?.qty).toBe(5);
    state = cartReducer(state, { type: 'setQty', menuItemId: 'i1', qty: 0 });
    expect(state.lines.map((line) => line.menuItemId)).toEqual(['i2']);
    state = cartReducer(state, { type: 'remove', menuItemId: 'i2' });
    expect(state).toEqual(EMPTY_CART);
  });

  it('totals the price and counts the items', () => {
    let state = add(EMPTY_CART);
    state = add(state);
    state = add(state, tea);
    expect(cartTotal(state)).toBe(38 * 2 + 14);
    expect(cartCount(state)).toBe(3);
    expect(cartReducer(state, { type: 'clear' })).toEqual(EMPTY_CART);
  });
});

describe('toOrderRequest', () => {
  it('sends only ids and quantities, never prices', () => {
    const state = add(add(EMPTY_CART), tea);
    const request = toOrderRequest(state, { kind: 'asap' });
    expect(request).toEqual({
      vendorId: 'v1',
      items: [
        { menuItemId: 'i1', qty: 1 },
        { menuItemId: 'i2', qty: 1 },
      ],
      pickup: { kind: 'asap' },
    });
    expect(JSON.stringify(request)).not.toContain('priceHkd');
  });

  it('returns nothing for an empty cart', () => {
    expect(toOrderRequest(EMPTY_CART, { kind: 'asap' })).toBeNull();
  });
});
