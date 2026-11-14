import { describe, expect, it } from 'vitest';
import type { MenuResponse } from '../src/server/menuService';
import {
  DEFAULT_FILTERS,
  HALAL_EMPTY_TEXT,
  activeFilterCount,
  emptyMessage,
  formatDemoClock,
  formatWaitRange,
  groupByFit,
  groupHeading,
  leaveText,
  scheduleSummary,
  toQueryString,
  toggleValue,
  waitNote,
  whenToGoText,
} from '../src/ui/dashboard/viewModel';

const NOON_TUESDAY = Date.UTC(2026, 10, 17, 4, 15);

const meta = (overrides: Partial<MenuResponse['meta']> = {}): MenuResponse['meta'] => ({
  now: NOON_TUESDAY,
  schedule: { freeNow: true, classEnd: null, nextClassStart: null },
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
});

describe('toQueryString', () => {
  it('is empty for the default filters', () => {
    expect(toQueryString(DEFAULT_FILTERS)).toBe('');
  });

  it('writes only what the student changed', () => {
    const query = toQueryString({
      ...DEFAULT_FILTERS,
      off: ['diet', 'goal'],
      maxPrice: 40,
      maxWait: 10,
      fits: true,
      openNow: true,
      goalFilter: true,
      vendor: ['a', 'b'],
      sort: 'lowest_price',
    });
    const params = new URLSearchParams(query);
    expect(params.get('off')).toBe('diet,goal');
    expect(params.get('maxPrice')).toBe('40');
    expect(params.get('maxWait')).toBe('10');
    expect(params.get('fits')).toBe('1');
    expect(params.get('openNow')).toBe('1');
    expect(params.get('goalFilter')).toBe('1');
    expect(params.get('vendor')).toBe('a,b');
    expect(params.get('sort')).toBe('lowest_price');
  });
});

describe('filter helpers', () => {
  it('toggles a value in and out of a list', () => {
    expect(toggleValue(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleValue(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('counts the filters that are not at their default', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(
      activeFilterCount({
        ...DEFAULT_FILTERS,
        off: ['diet'],
        maxPrice: 30,
        vendor: ['a'],
        fits: true,
      }),
    ).toBe(4);
  });
});

describe('formatting', () => {
  it('rounds a wait range outwards and collapses equal ends', () => {
    expect(formatWaitRange(5.2, 8.1)).toBe('5 to 9 min');
    expect(formatWaitRange(6, 6)).toBe('6 min');
    expect(formatWaitRange(5.9, 6.0)).toBe('5 to 6 min');
  });

  it('says leave now or a clock time', () => {
    expect(leaveText(true, NOON_TUESDAY)).toBe('Leave now');
    expect(leaveText(false, NOON_TUESDAY + 26 * 60_000)).toBe('Leave at 12:41');
  });

  it('shows the demo clock with the Hong Kong weekday', () => {
    expect(formatDemoClock(NOON_TUESDAY)).toBe('Tue 12:15');
  });

  it('summarises free time and class time', () => {
    expect(scheduleSummary({ freeNow: true, classEnd: null, nextClassStart: null })).toBe(
      'Free now. No class later today',
    );
    expect(
      scheduleSummary({
        freeNow: false,
        classEnd: NOON_TUESDAY + 45 * 60_000,
        nextClassStart: NOON_TUESDAY + 165 * 60_000,
      }),
    ).toBe('In class until 13:00. Next class 15:00');
  });

  it('only notes estimates that are not live', () => {
    expect(waitNote('live')).toBeNull();
    expect(waitNote('stale')).toBe('Estimate updating');
    expect(waitNote('cold')).toBe('Prep time only');
  });
});

describe('grouping', () => {
  const items = [
    { id: 1, fit: { status: 'late' as const } },
    { id: 2, fit: { status: 'fits' as const } },
    { id: 3, fit: { status: 'fits' as const } },
  ];

  it('orders groups fits, tight, late and leaves out empty ones', () => {
    expect(groupByFit(items).map((group) => [group.status, group.items.length])).toEqual([
      ['fits', 2],
      ['late', 1],
    ]);
  });

  it('uses one neutral heading when there is no next class', () => {
    expect(groupHeading('fits', false)).toBe('Available now');
    expect(groupHeading('fits', true)).toBe('Fits before your next class');
    expect(groupHeading('late', true)).toBe('May make you late');
  });
});

describe('emptyMessage', () => {
  it('shows the exact halal sentence as a plain message', () => {
    const message = emptyMessage(meta({ emptyState: 'halal_unconfirmed' }), true);
    expect(message.body).toBe(
      'No items are confirmed halal yet. Vendors confirm this themselves, and we never guess.',
    );
    expect(message.body).toBe(HALAL_EMPTY_TEXT);
  });

  it('no longer asks for a building, because the list shows without one', () => {
    expect(emptyMessage(meta({ needsBuilding: true }), false).title).toBe(
      'Nothing matches right now',
    );
  });

  it('suggests turning a filter off only when one is on', () => {
    expect(emptyMessage(meta(), true).body).toContain('turning a filter off');
    expect(emptyMessage(meta(), false).body).not.toContain('turning a filter off');
  });
});

describe('whenToGoText', () => {
  const free = { freeNow: true, classEnd: null };
  const base = { vendorOpenNow: true, leaveNow: false, leaveAt: NOON_TUESDAY + 26 * 60_000 };

  it('says leave now or a time for a student who is free', () => {
    expect(whenToGoText({ ...base, leaveNow: true }, free)).toBe('Leave now');
    expect(whenToGoText(base, free)).toBe('Leave at 12:41');
  });

  it('points a student in class to the end of class instead of leaving now', () => {
    expect(
      whenToGoText(
        { ...base, leaveNow: true },
        { freeNow: false, classEnd: NOON_TUESDAY + 45 * 60_000 },
      ),
    ).toBe('After class, 13:00');
  });

  it('says closed for a vendor that is shut', () => {
    expect(whenToGoText({ ...base, vendorOpenNow: false }, free)).toBe('Closed now');
  });

  it('shows the class start instead of a leave time when the building is unknown', () => {
    const unknown = { vendorOpenNow: true, leaveNow: false, leaveAt: null };
    expect(whenToGoText(unknown, { ...free, nextClassStart: NOON_TUESDAY + 90 * 60_000 })).toBe(
      'Class at 13:45',
    );
    expect(whenToGoText(unknown, free)).toBe('No class later today');
  });
});
