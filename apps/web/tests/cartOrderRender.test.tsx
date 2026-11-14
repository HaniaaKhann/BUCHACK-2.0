import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { OrderView } from '../src/server/orderViews';
import { CartDrawer } from '../src/ui/cart/CartDrawer';
import { CartProvider } from '../src/ui/cart/CartProvider';
import type { CartState } from '../src/ui/cart/cartReducer';
import { OrderTracker } from '../src/ui/orders/OrderTracker';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

const NOW = Date.UTC(2026, 10, 17, 4, 15);
const MINUTE = 60_000;

const cart: CartState = {
  vendorId: 'v1',
  vendorName: 'Main Canteen',
  lines: [
    { menuItemId: 'i1', name: 'Vegetable Noodles', priceHkd: 38, qty: 2 },
    { menuItemId: 'i2', name: 'Milk Tea', priceHkd: 14, qty: 1 },
  ],
};

function drawer(initial?: CartState, open = true): string {
  return renderToStaticMarkup(
    <CartProvider {...(initial ? { initial } : {})}>
      <CartDrawer open={open} onClose={() => undefined} />
    </CartProvider>,
  );
}

function order(overrides: Partial<OrderView> = {}): OrderView {
  return {
    id: 'o1',
    status: 'placed',
    vendor: { id: 'v1', name: 'Main Canteen' },
    totalHkd: 90,
    items: [
      { name: 'Vegetable Noodles', qty: 2, priceHkd: 38 },
      { name: 'Milk Tea', qty: 1, priceHkd: 14 },
    ],
    placedAt: NOW,
    acceptedAt: null,
    fireAt: null,
    slotStart: null,
    readyAt: null,
    pickedUpAt: null,
    cancelledAt: null,
    predicted: { low: NOW + 4 * MINUTE, point: NOW + 6 * MINUTE, high: NOW + 9 * MINUTE },
    now: NOW,
    graceSecondsLeft: 45,
    canCancel: true,
    canPickUp: false,
    ...overrides,
  };
}

const tracker = (value: OrderView): string =>
  renderToStaticMarkup(<OrderTracker initial={value} />);

describe('cart drawer HTML', () => {
  it('renders nothing while closed', () => {
    expect(drawer(cart, false)).toBe('');
  });

  it('says the cart is empty when it is', () => {
    expect(drawer()).toContain('Your cart is empty');
  });

  it('lists the lines with quantity controls and the total on the pay button', () => {
    const html = drawer(cart);
    expect(html).toContain('Main Canteen');
    expect(html).toContain('Vegetable Noodles');
    expect(html).toContain('aria-label="One more Milk Tea"');
    expect(html).toContain('aria-label="One less Vegetable Noodles"');
    expect(html).toContain('3 items');
    expect(html).toContain('Pay HK$90 from demo wallet');
    expect(html).toContain('Wallet (demo credit):');
    expect(html).toContain('After this order:');
  });

  it('offers as soon as ready and a slot choice, defaulting to as soon as ready', () => {
    const html = drawer(cart);
    expect(html).toContain('As soon as ready');
    expect(html).toContain('Pick a slot');
    expect(html).toContain('Your ready time appears on the next screen');
    expect(html).not.toContain('data-slots');
  });

  it('is a full-width panel on a phone and a side panel on larger screens', () => {
    const html = drawer(cart);
    expect(html).toContain('w-full max-w-md');
    expect(html).toContain('role="dialog"');
  });
});

describe('order page HTML', () => {
  it('shows a placed order with the grace countdown on the cancel button and no pick-up button', () => {
    const html = tracker(order());
    expect(html).toContain('data-order-status="placed"');
    expect(html).toContain('Cancel order (45s)');
    expect(html).not.toContain('I picked it up');
    expect(html).toContain('12:19 to 12:24');
    expect(html).toContain('As soon as ready');
    expect(html).toContain('HK$90');
  });

  it('shows the progress steps and marks the finished ones', () => {
    const html = tracker(order({ status: 'preparing', canCancel: false, graceSecondsLeft: 0 }));
    expect(html).toContain('data-step="placed" data-done="true"');
    expect(html).toContain('data-step="preparing" data-done="true"');
    expect(html).toContain('data-step="ready" data-done="false"');
    expect(html).not.toContain('Cancel order');
  });

  it('shows the pick-up button once the order can be picked up', () => {
    const html = tracker(order({ status: 'ready', canCancel: false, canPickUp: true }));
    expect(html).toContain('I picked it up');
    expect(html).toContain('Your order is ready');
  });

  it('shows a cancelled order with the refund and without progress steps', () => {
    const html = tracker(order({ status: 'cancelled', canCancel: false }));
    expect(html).toContain('HK$90 was refunded');
    expect(html).not.toContain('data-step=');
  });

  it('shows the pickup slot and when the kitchen starts for a scheduled order', () => {
    const html = tracker(
      order({
        status: 'accepted',
        canCancel: false,
        slotStart: NOW + 45 * MINUTE,
        fireAt: NOW + 38 * MINUTE,
      }),
    );
    expect(html).toContain('Slot 13:00');
    expect(html).toContain('Kitchen starts');
    expect(html).toContain('12:53');
  });

  it('is one column on a phone and two columns inside the wide container on a laptop', () => {
    const html = tracker(order());
    expect(html).toContain('max-w-7xl');
    expect(html).toContain('lg:grid-cols-2');
    expect(html).not.toMatch(/max-w-(sm|md|lg|xl|2xl|3xl|4xl)\b/);
  });
});
