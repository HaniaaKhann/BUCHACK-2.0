import { describe, expect, it } from 'vitest';
import {
  HALAL_EMPTY_STATE,
  buildMenuView,
  type MenuItemRow,
  type MenuViewInput,
  type VendorForMenu,
} from '../src/server/menuView';
import { resolveMenuQuery } from '../src/server/menuQuery';

const NOW = Date.UTC(2026, 10, 17, 4, 15);

const vendor = (overrides: Partial<VendorForMenu> = {}): VendorForMenu => ({
  id: 'v1',
  name: 'Open Place',
  openNow: true,
  orderable: true,
  walkFromOriginMinutes: 3,
  walkToNextClassMinutes: null,
  wait: undefined,
  slots: [],
  ...overrides,
});

const item = (overrides: Partial<MenuItemRow> = {}): MenuItemRow => ({
  id: 'i1',
  vendorId: 'v1',
  name: 'Noodles',
  priceHkd: 40,
  category: 'Noodles',
  dietTags: ['vegetarian'],
  allergens: [],
  tagsStatus: 'verified',
  prepPriorMin: 5,
  ...overrides,
});

function input(overrides: Partial<MenuViewInput> = {}): MenuViewInput {
  return {
    now: NOW,
    schedule: { freeNow: true, classEnd: null, classBuildingId: null, nextClass: null },
    originKnown: true,
    eatMinutes: 15,
    vendors: [vendor()],
    items: [item()],
    pastOrderCounts: new Map(),
    query: resolveMenuQuery(
      {
        diet: null,
        allergens: null,
        goalFilter: false,
        maxPrice: null,
        maxWait: null,
        fits: false,
        openNow: false,
        vendor: [],
        sort: 'best_match',
        off: [],
      },
      { dietTags: [], allergens: [], goal: null },
    ),
    ...overrides,
  };
}

const withDiet = (...dietIds: string[]): MenuViewInput['query'] => ({
  ...input().query,
  dietIds,
});

describe('buildMenuView without a from building', () => {
  const nextClassAt = NOW + 90 * 60_000;
  const unknown = (): MenuViewInput =>
    input({
      originKnown: false,
      schedule: {
        freeNow: true,
        classEnd: null,
        classBuildingId: null,
        nextClass: { start: nextClassAt, buildingId: 'b-class' },
      },
      vendors: [vendor({ walkFromOriginMinutes: null, walkToNextClassMinutes: null })],
    });

  it('still lists the items, with waits and ready times, instead of an empty menu', () => {
    const { items, meta } = buildMenuView(unknown());
    expect(items).toHaveLength(1);
    expect(items[0]?.wait.highMinutes).toBeGreaterThan(0);
    expect(items[0]?.chips.map((chip) => chip.text).join(' ')).toContain('Ready');
    expect(meta.vendorsWithoutWalk).toBe(0);
    expect(meta.schedule.nextClassStart).toBe(nextClassAt);
  });

  it('gives no leave time, no fit message and no cooked-for suggestion', () => {
    const { items } = buildMenuView(unknown());
    expect(items[0]?.leaveAt).toBeNull();
    expect(items[0]?.leaveNow).toBe(false);
    expect(items[0]?.cookedFor).toBeNull();
    expect(items[0]?.chips.map((chip) => chip.text).join(' ')).not.toContain('class');
  });

  it('still gives a leave time once the building is known', () => {
    const { items } = buildMenuView(
      input({
        schedule: {
          freeNow: true,
          classEnd: null,
          classBuildingId: null,
          nextClass: { start: nextClassAt, buildingId: 'b-class' },
        },
        vendors: [vendor({ walkFromOriginMinutes: 4, walkToNextClassMinutes: 3 })],
      }),
    );
    expect(items[0]?.leaveAt).not.toBeNull();
  });
});

describe('buildMenuView', () => {
  it('lists an item with a ready range and no fit chip when there is no next class', () => {
    const { items } = buildMenuView(input());
    expect(items).toHaveLength(1);
    expect(items[0]?.fit.status).toBe('fits');
    expect(items[0]?.chips.map((chip) => chip.text)).toEqual(['Ready 12:20 to 12:21']);
  });

  it('keeps items of a closed vendor but puts them last as closed', () => {
    const { items } = buildMenuView(
      input({
        vendors: [vendor(), vendor({ id: 'v2', name: 'Shut', openNow: false })],
        items: [item(), item({ id: 'i2', vendorId: 'v2' })],
      }),
    );
    expect(items.map((entry) => entry.id)).toEqual(['i1', 'i2']);
    expect(items[1]?.fit.status).toBe('late');
    expect(items[1]?.chips.map((chip) => chip.text)).toContain('Closed now');
  });

  it('leaves out vendors without a walk time and counts them', () => {
    const { items, meta } = buildMenuView(
      input({
        vendors: [vendor(), vendor({ id: 'v2', walkFromOriginMinutes: null })],
        items: [item(), item({ id: 'i2', vendorId: 'v2' })],
      }),
    );
    expect(items.map((entry) => entry.id)).toEqual(['i1']);
    expect(meta.vendorsWithoutWalk).toBe(1);
  });

  it('needs the walk to the next class too when there is a next class', () => {
    const { items, meta } = buildMenuView(
      input({
        schedule: {
          freeNow: true,
          classEnd: null,
          classBuildingId: null,
          nextClass: { start: NOW + 3_600_000, buildingId: 'b' },
        },
      }),
    );
    expect(items).toEqual([]);
    expect(meta.vendorsWithoutWalk).toBe(1);
  });

  it('removes unverified items when a diet filter is on and shows them labelled when it is off', () => {
    const rows = [item(), item({ id: 'i2', tagsStatus: 'unverified' })];
    const on = buildMenuView(input({ items: rows, query: withDiet('vegetarian') }));
    expect(on.items.map((entry) => entry.id)).toEqual(['i1']);
    expect(on.items[0]?.chips.map((chip) => chip.text)).toContain('Vegetarian ✓');

    const off = buildMenuView(input({ items: rows }));
    const unverified = off.items.find((entry) => entry.id === 'i2');
    expect(unverified?.notVerified).toBe(true);
    expect(unverified?.chips.map((chip) => chip.text)).not.toContain('Not verified');
    expect(unverified?.chips.some((chip) => chip.text.includes('✓'))).toBe(false);
  });

  it('puts no verification text on any tile when no diet or allergen filter is active', () => {
    const rows = [item(), item({ id: 'i2', tagsStatus: 'unverified' })];
    const { items } = buildMenuView(input({ items: rows }));
    for (const entry of items) {
      const text = entry.chips.map((chip) => chip.text).join(' ');
      expect(text).not.toContain('Not verified');
      expect(text).not.toContain('✓');
    }
  });

  it('ticks a verified item only while a diet filter that it satisfies is active', () => {
    const withFilter = buildMenuView(input({ query: withDiet('vegetarian') }));
    expect(withFilter.items[0]?.chips.map((chip) => chip.text)).toContain('Vegetarian ✓');
    const without = buildMenuView(input());
    expect(without.items[0]?.chips.map((chip) => chip.text).join(' ')).not.toContain('✓');
  });

  it('reports the halal empty state when halal is on and nothing is confirmed', () => {
    const result = buildMenuView(
      input({
        items: [item(), item({ id: 'i2', dietTags: ['halal'], tagsStatus: 'unverified' })],
        query: withDiet('halal'),
      }),
    );
    expect(result.items).toEqual([]);
    expect(result.meta.emptyState).toBe(HALAL_EMPTY_STATE);
  });

  it('does not report the halal empty state for other empty results', () => {
    const result = buildMenuView(input({ items: [], query: withDiet('vegan') }));
    expect(result.meta.emptyState).toBeNull();
  });

  it('shows halal only for a verified item that carries the halal tag', () => {
    const result = buildMenuView(
      input({
        items: [item({ id: 'h1', dietTags: ['halal'], tagsStatus: 'verified' })],
        query: withDiet('halal'),
      }),
    );
    expect(result.items.map((entry) => entry.id)).toEqual(['h1']);
    expect(result.items[0]?.chips.map((chip) => chip.text)).toContain('Halal ✓');
    expect(result.meta.emptyState).toBeNull();
  });

  it('suggests a cooked-for slot after class when food would be ready before the class ends', () => {
    const classEnd = NOW + 45 * 60_000;
    const slot = { slotStart: classEnd + 15 * 60_000, cap: 2, booked: 0 };
    const { items } = buildMenuView(
      input({
        schedule: { freeNow: false, classEnd, classBuildingId: 'a', nextClass: null },
        vendors: [vendor({ slots: [slot] })],
      }),
    );
    expect(items[0]?.cookedFor).toEqual({ slotStart: slot.slotStart });
  });

  it('lists vendors whose snapshot is stale', () => {
    const { meta } = buildMenuView(
      input({
        vendors: [
          vendor({
            wait: {
              arrivals: [],
              payload: {
                computedAt: new Date(NOW).toISOString(),
                ingestedFrom: new Date(NOW).toISOString(),
                modelVersion: 'v2',
                forecast: [],
                mu: { prior: 1, perMinute: 1, busyMinutes: 0 },
                bias: { value: null, samples: 0 },
                residuals: [],
                prep: {},
                lateness: { q50: 0, q90: 3, samples: 0 },
              },
            },
          }),
        ],
      }),
    );
    expect(meta.staleVendorIds).toEqual(['v1']);
  });
});
