import { describe, expect, it } from 'vitest';
import type { FitResult } from '../src/fit.js';
import {
  goalMatch,
  passesItemFilters,
  type FilterableItem,
  type ItemFilterSettings,
} from '../src/itemFilters.js';

const fit = (status: FitResult['status']): FitResult => ({
  status,
  arriveAt: 0,
  readyPointAt: 0,
  readyHighAt: 0,
  pickupAt: 0,
  deadline: null,
  lateByMinutes: 0,
});

const item = (overrides: Partial<FilterableItem> = {}): FilterableItem => ({
  vendorId: 'v1',
  category: 'Rice',
  priceHkd: 40,
  waitHighMinutes: 10,
  vendorOpenNow: true,
  fit: fit('fits'),
  ...overrides,
});

const off: ItemFilterSettings = {
  maxPriceHkd: null,
  maxWaitMinutes: null,
  fitsOnly: false,
  openNowOnly: false,
  vendorIds: [],
  goal: null,
};

describe('passesItemFilters', () => {
  it('passes everything when no filter is on', () => {
    expect(passesItemFilters(item({ fit: fit('late'), vendorOpenNow: false }), off)).toBe(true);
  });

  it('applies max price and max wait as inclusive limits', () => {
    expect(passesItemFilters(item({ priceHkd: 40 }), { ...off, maxPriceHkd: 40 })).toBe(true);
    expect(passesItemFilters(item({ priceHkd: 41 }), { ...off, maxPriceHkd: 40 })).toBe(false);
    expect(passesItemFilters(item({ waitHighMinutes: 10 }), { ...off, maxWaitMinutes: 10 })).toBe(
      true,
    );
    expect(passesItemFilters(item({ waitHighMinutes: 11 }), { ...off, maxWaitMinutes: 10 })).toBe(
      false,
    );
  });

  it('keeps only items that fit when asked, dropping tight and late', () => {
    const settings = { ...off, fitsOnly: true };
    expect(passesItemFilters(item({ fit: fit('fits') }), settings)).toBe(true);
    expect(passesItemFilters(item({ fit: fit('tight') }), settings)).toBe(false);
    expect(passesItemFilters(item({ fit: fit('late') }), settings)).toBe(false);
  });

  it('drops closed vendors when open now is on', () => {
    expect(passesItemFilters(item({ vendorOpenNow: false }), { ...off, openNowOnly: true })).toBe(
      false,
    );
  });

  it('limits to the chosen vendors', () => {
    const settings = { ...off, vendorIds: ['v2', 'v3'] };
    expect(passesItemFilters(item({ vendorId: 'v1' }), settings)).toBe(false);
    expect(passesItemFilters(item({ vendorId: 'v3' }), settings)).toBe(true);
  });

  it('keeps only categories that suit the health goal, and ignores goal none', () => {
    expect(passesItemFilters(item({ category: 'Rice' }), { ...off, goal: 'more_carbs' })).toBe(
      true,
    );
    expect(passesItemFilters(item({ category: 'Salads' }), { ...off, goal: 'more_carbs' })).toBe(
      false,
    );
    expect(passesItemFilters(item({ category: 'Salads' }), { ...off, goal: 'none' })).toBe(true);
  });
});

describe('goalMatch', () => {
  it('scores a match highest, a miss lowest and no goal in the middle', () => {
    expect(goalMatch('more_protein', 'Steak')).toBe(1);
    expect(goalMatch('more_protein', 'Cakes')).toBe(0.3);
    expect(goalMatch('none', 'Cakes')).toBe(0.5);
    expect(goalMatch(null, 'Steak')).toBe(0.5);
  });
});
