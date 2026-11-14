import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { MenuItemView } from '../src/server/menuView';
import type { MenuResponse, VendorListResponse } from '../src/server/menuService';
import { CartProvider } from '../src/ui/cart/CartProvider';
import { Dashboard } from '../src/ui/dashboard/Dashboard';
import { ItemList } from '../src/ui/dashboard/ItemList';
import { HALAL_EMPTY_TEXT } from '../src/ui/dashboard/viewModel';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

const NOW = Date.UTC(2026, 10, 17, 4, 15);
const MINUTE = 60_000;

function item(overrides: Partial<MenuItemView> = {}): MenuItemView {
  return {
    id: 'item-1',
    vendorId: 'vendor-1',
    vendorName: 'Main Canteen',
    name: 'Vegetable Noodles',
    priceHkd: 38,
    category: 'Noodles',
    dietTags: ['vegetarian'],
    allergens: [],
    tagsStatus: 'verified',
    notVerified: false,
    fit: { status: 'fits', lateByMinutes: 0 },
    vendorOpenNow: true,
    orderable: true,
    wait: { lowMinutes: 4.2, highMinutes: 8.1, source: 'live' },
    readyLowAt: NOW + 4 * MINUTE,
    readyPointAt: NOW + 6 * MINUTE,
    readyHighAt: NOW + 9 * MINUTE,
    pickupAt: NOW + 9 * MINUTE,
    deadline: NOW + 90 * MINUTE,
    leaveAt: NOW + 3 * MINUTE,
    leaveNow: false,
    cookedFor: null,
    chips: [
      { text: 'Vegetarian ✓', tone: 'verified' },
      { text: 'Ready 12:21 to 12:24', tone: 'neutral' },
    ],
    score: 0.7,
    ...overrides,
  };
}

const unverified = (): MenuItemView =>
  item({
    id: 'item-2',
    name: 'Fish Ball Noodles',
    tagsStatus: 'unverified',
    notVerified: true,
    dietTags: ['vegetarian', 'halal'],
    chips: [
      { text: 'Not verified', tone: 'warn' },
      { text: 'Ready 12:21 to 12:24', tone: 'neutral' },
    ],
  });

function menu(items: MenuItemView[], overrides: Partial<MenuResponse['meta']> = {}): MenuResponse {
  return {
    items,
    meta: {
      now: NOW,
      schedule: { freeNow: true, classEnd: null, nextClassStart: NOW + 90 * MINUTE },
      applied: {
        dietIds: [],
        allergenIds: [],
        goal: null,
        goalFilter: false,
        maxPrice: null,
        maxWait: null,
        fitsOnly: false,
        openNowOnly: false,
        vendorIds: [],
        sort: 'best_match',
        off: [],
      },
      emptyState: null,
      vendorsWithoutWalk: 0,
      staleVendorIds: [],
      needsBuilding: false,
      ...overrides,
    },
  };
}

const vendors: VendorListResponse = {
  now: NOW,
  vendors: [
    {
      id: 'vendor-1',
      name: 'Main Canteen',
      campus: 'BURC',
      floor: 'G/F',
      building: { id: 'b1', name: 'Undergraduate Halls', code: null },
      pickupEnabled: true,
      paused: false,
      busyState: 'rush',
      busyUntil: null,
      openNow: true,
      hoursToday: [{ open: '08:00', close: '17:30' }],
      walk: { minutes: 4, source: 'estimate' },
      wait: { lowMinutes: 5, highMinutes: 9, source: 'live', stale: false },
    },
  ],
};

function cards(html: string): string[] {
  return html.split('<article').slice(1);
}

describe('ranked list HTML', () => {
  it('gives an unverified item the label Not verified and never a tick', () => {
    const html = renderToStaticMarkup(
      <ItemList menu={menu([item(), unverified()])} filtersOn={false} />,
    );
    const unverifiedCards = cards(html).filter((card) =>
      card.includes('data-verified="unverified"'),
    );
    expect(unverifiedCards).toHaveLength(1);
    for (const card of unverifiedCards) {
      expect(card).toContain('Not verified');
      expect(card).not.toContain('✓');
    }
  });

  it('ticks a verified item and says nothing about verification', () => {
    const html = renderToStaticMarkup(<ItemList menu={menu([item()])} filtersOn={false} />);
    const [card] = cards(html);
    expect(card).toContain('Vegetarian ✓');
    expect(card).not.toContain('Not verified');
  });

  it('uses a shrinkable single column on a phone, so a long outlet name cannot widen the page', () => {
    const html = renderToStaticMarkup(<ItemList menu={menu([item()])} filtersOn={false} />);
    expect(html).toContain('grid grid-cols-1 gap-3 md:grid-cols-2');
  });

  it('never ticks halal for an unverified item that carries a halal tag', () => {
    const html = renderToStaticMarkup(<ItemList menu={menu([unverified()])} filtersOn={false} />);
    expect(html).not.toContain('Halal ✓');
    expect(html).not.toContain('✓');
  });

  it('shows the halal empty state as a normal message, not an error', () => {
    const html = renderToStaticMarkup(
      <ItemList menu={menu([], { emptyState: 'halal_unconfirmed' })} filtersOn />,
    );
    expect(html).toContain(HALAL_EMPTY_TEXT);
    expect(html).toContain(
      'No items are confirmed halal yet. Vendors confirm this themselves, and we never guess.',
    );
    expect(html).toContain('data-empty-state="halal_unconfirmed"');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('text-red');
  });

  it('groups items by fit and keeps late ones visible and muted', () => {
    const late = item({
      id: 'late-1',
      fit: { status: 'late', lateByMinutes: 3.2 },
      chips: [{ text: 'May make you late by 4 min', tone: 'late' }],
    });
    const html = renderToStaticMarkup(<ItemList menu={menu([item(), late])} filtersOn={false} />);
    expect(html.indexOf('data-group="fits"')).toBeLessThan(html.indexOf('data-group="late"'));
    expect(html).toContain('May make you late by 4 min');
    expect(html).toContain('opacity-75');
  });

  it('shows the cooked-for-arrival suggestion with the pickup slot', () => {
    const html = renderToStaticMarkup(
      <ItemList
        menu={menu([item({ cookedFor: { slotStart: NOW + 45 * MINUTE } })])}
        filtersOn={false}
      />,
    );
    expect(html).toContain('Order now, it will be cooked for when you arrive');
    expect(html).toContain('13:00');
  });

  it('does not say leave now to a student who is still in class', () => {
    const inClass = menu([item({ leaveNow: true, cookedFor: { slotStart: NOW + 60 * MINUTE } })], {
      schedule: { freeNow: false, classEnd: NOW + 45 * MINUTE, nextClassStart: NOW + 165 * MINUTE },
    });
    const html = renderToStaticMarkup(<ItemList menu={inClass} filtersOn={false} />);
    expect(html).toContain('After class, 13:00');
    expect(html).not.toContain('Leave now');
  });

  it('shows the leave time and a leave-now state', () => {
    const later = renderToStaticMarkup(<ItemList menu={menu([item()])} filtersOn={false} />);
    expect(later).toContain('Leave at 12:18');
    const now = renderToStaticMarkup(
      <ItemList menu={menu([item({ leaveNow: true })])} filtersOn={false} />,
    );
    expect(now).toContain('Leave now');
  });
});

describe('dashboard layout', () => {
  const html = renderToStaticMarkup(
    <CartProvider>
      <Dashboard
        initialMenu={menu([item(), unverified()])}
        initialVendors={vendors}
        profile={{ dietTags: ['vegetarian'], allergens: [], goal: null }}
        buildings={[{ id: 'b1', campus: 'BURC', name: 'Undergraduate Halls' }]}
        currentBuildingId="b1"
      />
    </CartProvider>,
  );

  it('uses the full wide container with a filter column and a list column from laptop width', () => {
    expect(html).toContain('max-w-7xl');
    expect(html).toContain('lg:grid-cols-[19rem_minmax(0,1fr)]');
    expect(html).not.toMatch(/max-w-(sm|md|lg|xl|2xl|3xl|4xl)\b/);
  });

  it('starts mobile first: filters sit behind a button that disappears on laptops', () => {
    expect(html).toContain('Filters and sorting');
    expect(html).toContain('lg:hidden');
    expect(html).toContain('hidden lg:sticky lg:top-4 lg:block');
  });

  it('scrolls the vendor strip sideways on a phone and turns it into a grid on a laptop', () => {
    expect(html).toContain('overflow-x-auto');
    expect(html).toContain('lg:grid-cols-3');
    expect(html).toContain('xl:grid-cols-4');
  });

  it('marks estimated walk times and shows the busy badge and live wait', () => {
    expect(html).toContain('4 min walk (est.)');
    expect(html).toContain('Rush');
    expect(html).toContain('Wait 5 to 9 min');
  });

  it('shows the demo clock and the schedule line', () => {
    expect(html).toContain('Tue 12:15');
    expect(html).toContain('Free now. Next class 13:45');
  });

  it('lets each profile filter be switched off for the visit', () => {
    expect(html).toContain('aria-label="Diet filter"');
    expect(html).toContain('role="switch"');
  });

  it('puts an Add to cart button on every item card and a cart button with the count in the header', () => {
    expect(html).toContain('data-add="item-1"');
    expect(html).toContain('Add to cart');
    expect(html).toContain('Cart (0)');
    expect(html).toContain('href="/orders"');
  });

  it('shows order at the counter instead of an add button for a vendor that takes no app orders', () => {
    const html = renderToStaticMarkup(
      <CartProvider>
        <Dashboard
          initialMenu={menu([item({ orderable: false })])}
          initialVendors={vendors}
          profile={{ dietTags: [], allergens: [], goal: null }}
          buildings={[{ id: 'b1', campus: 'BURC', name: 'Undergraduate Halls' }]}
          currentBuildingId="b1"
        />
      </CartProvider>,
    );
    expect(html).toContain('Order at the counter');
    expect(html).not.toContain('data-add=');
  });
});

describe('dashboard without a from building', () => {
  const unknownItem = item({ leaveAt: null, chips: [{ text: 'Ready 12:21', tone: 'neutral' }] });
  const html = renderToStaticMarkup(
    <CartProvider>
      <Dashboard
        initialMenu={menu([unknownItem], { needsBuilding: true })}
        initialVendors={vendors}
        profile={{ dietTags: [], allergens: [], goal: null }}
        buildings={[{ id: 'b1', campus: 'BURC', name: 'Undergraduate Halls' }]}
        currentBuildingId={null}
      />
    </CartProvider>,
  );

  it('shows the class start and the short hint above the list', () => {
    expect(html).toContain('Next class 13:45');
    expect(html).toContain('data-from-hint-summary');
    expect(html).toContain('Choose where you are to see a leave time');
  });

  it('calls the selector From, with the hint beside it', () => {
    expect(html).toContain('>From</h2>');
    expect(html).toContain('data-from-select');
    expect(html).toContain('data-from-hint="true"');
    expect(html).not.toContain('Where you are');
  });

  it('lists the items under Available now instead of fit groups, and shows the class start on the tile', () => {
    expect(html).toContain('Available now');
    expect(html).not.toContain('Fits before your next class');
    expect(html).toContain('Class at 13:45');
  });

  it('disables the fits filter, because it needs a leave time', () => {
    expect(html).toMatch(
      /<input[^>]*disabled[^>]*type="checkbox"|<input[^>]*type="checkbox"[^>]*disabled/,
    );
  });

  it('shows no hint once a building is chosen', () => {
    const chosen = renderToStaticMarkup(
      <CartProvider>
        <Dashboard
          initialMenu={menu([item()])}
          initialVendors={vendors}
          profile={{ dietTags: [], allergens: [], goal: null }}
          buildings={[{ id: 'b1', campus: 'BURC', name: 'Undergraduate Halls' }]}
          currentBuildingId="b1"
        />
      </CartProvider>,
    );
    expect(chosen).not.toContain('data-from-hint');
  });
});
