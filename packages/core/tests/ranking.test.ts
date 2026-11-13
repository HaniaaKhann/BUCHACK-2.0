import { describe, expect, it } from 'vitest';
import {
  RANKING_WEIGHT_GOAL,
  RANKING_WEIGHT_PAST_ORDERS,
  RANKING_WEIGHT_PRICE,
  RANKING_WEIGHT_WAIT,
} from '../src/config.js';
import type { FitResult, FitStatus } from '../src/fit.js';
import {
  bestMatchScore,
  passesHardFilters,
  rankItems,
  type HardFilters,
  type RankableItem,
} from '../src/ranking.js';

const noFilters: HardFilters = { requiredDietTags: [], excludedAllergens: [] };

function fit(status: FitStatus, lateByMinutes = 0): FitResult {
  return {
    status,
    arriveAt: 0,
    readyPointAt: 0,
    readyHighAt: 0,
    pickupAt: 0,
    deadline: null,
    lateByMinutes,
  };
}

function item(id: string, overrides: Partial<RankableItem> = {}): RankableItem {
  return {
    id,
    dietTags: [],
    allergens: [],
    tagsStatus: 'verified',
    priceHkd: 50,
    goalMatch: 0,
    pastOrderCount: 0,
    waitHighMinutes: 10,
    fit: fit('fits'),
    ...overrides,
  };
}

function ids(ranked: { item: RankableItem }[]): string[] {
  return ranked.map((entry) => entry.item.id);
}

describe('passesHardFilters', () => {
  it('keeps unverified items when no diet or allergen filter is on, flagged not verified', () => {
    const unverified = item('a', { tagsStatus: 'unverified' });
    expect(passesHardFilters(unverified, noFilters)).toBe(true);
    expect(
      rankItems([unverified], { filters: noFilters, sort: 'best_match' })[0]?.notVerified,
    ).toBe(true);
  });

  it('removes unverified items when an allergen filter is on', () => {
    const filters = { requiredDietTags: [], excludedAllergens: ['nuts'] };
    expect(passesHardFilters(item('a', { tagsStatus: 'unverified' }), filters)).toBe(false);
  });

  it('removes items that contain an excluded allergen', () => {
    const filters = { requiredDietTags: [], excludedAllergens: ['nuts'] };
    expect(passesHardFilters(item('a', { allergens: ['nuts', 'soy'] }), filters)).toBe(false);
    expect(passesHardFilters(item('b', { allergens: ['soy'] }), filters)).toBe(true);
  });

  it('requires every selected diet tag to be verified on the item', () => {
    const filters = { requiredDietTags: ['halal', 'no pork'], excludedAllergens: [] };
    expect(passesHardFilters(item('a', { dietTags: ['halal', 'no pork'] }), filters)).toBe(true);
    expect(passesHardFilters(item('b', { dietTags: ['halal'] }), filters)).toBe(false);
    const unverified = item('c', { dietTags: ['halal', 'no pork'], tagsStatus: 'unverified' });
    expect(passesHardFilters(unverified, filters)).toBe(false);
  });
});

describe('bestMatchScore', () => {
  it('mixes goal, wait, price and past orders with the configured weights', () => {
    const score = bestMatchScore(
      item('a', { goalMatch: 1, waitHighMinutes: 15, priceHkd: 50, pastOrderCount: 5 }),
    );
    const expected =
      RANKING_WEIGHT_GOAL * 1 +
      RANKING_WEIGHT_WAIT * 0.5 +
      RANKING_WEIGHT_PRICE * 0.5 +
      RANKING_WEIGHT_PAST_ORDERS * 1;
    expect(score).toBeCloseTo(expected, 10);
  });

  it('clamps wait and price scores at zero and past orders at one', () => {
    const score = bestMatchScore(
      item('a', { goalMatch: 0, waitHighMinutes: 300, priceHkd: 900, pastOrderCount: 50 }),
    );
    expect(score).toBeCloseTo(RANKING_WEIGHT_PAST_ORDERS, 10);
  });

  it('uses weights that sum to 1', () => {
    const sum =
      RANKING_WEIGHT_GOAL + RANKING_WEIGHT_WAIT + RANKING_WEIGHT_PRICE + RANKING_WEIGHT_PAST_ORDERS;
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe('rankItems', () => {
  it('groups fits, then tight, then late regardless of sort score', () => {
    const items = [
      item('late', { fit: fit('late', 6), goalMatch: 1, pastOrderCount: 5, waitHighMinutes: 1 }),
      item('tight', { fit: fit('tight'), goalMatch: 0.5 }),
      item('fits', { fit: fit('fits'), goalMatch: 0 }),
    ];
    const ranked = rankItems(items, { filters: noFilters, sort: 'best_match' });
    expect(ids(ranked)).toEqual(['fits', 'tight', 'late']);
  });

  it('keeps late items visible with their late-by minutes', () => {
    const ranked = rankItems([item('late', { fit: fit('late', 6) })], {
      filters: noFilters,
      sort: 'best_match',
    });
    expect(ranked[0]?.item.fit.lateByMinutes).toBe(6);
  });

  it('sorts best match descending inside a group', () => {
    const items = [
      item('weak', { goalMatch: 0, pastOrderCount: 0, waitHighMinutes: 25, priceHkd: 90 }),
      item('strong', { goalMatch: 1, pastOrderCount: 5, waitHighMinutes: 5, priceHkd: 20 }),
    ];
    expect(ids(rankItems(items, { filters: noFilters, sort: 'best_match' }))).toEqual([
      'strong',
      'weak',
    ]);
  });

  it('sorts lowest wait inside a group', () => {
    const items = [
      item('slow', { waitHighMinutes: 20 }),
      item('fast', { waitHighMinutes: 5 }),
      item('late-fast', { waitHighMinutes: 1, fit: fit('late', 2) }),
    ];
    expect(ids(rankItems(items, { filters: noFilters, sort: 'lowest_wait' }))).toEqual([
      'fast',
      'slow',
      'late-fast',
    ]);
  });

  it('sorts lowest price inside a group', () => {
    const items = [item('dear', { priceHkd: 80 }), item('cheap', { priceHkd: 30 })];
    expect(ids(rankItems(items, { filters: noFilters, sort: 'lowest_price' }))).toEqual([
      'cheap',
      'dear',
    ]);
  });

  it('breaks ties by id for a stable order', () => {
    const items = [item('b'), item('a'), item('c')];
    expect(ids(rankItems(items, { filters: noFilters, sort: 'lowest_price' }))).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('applies hard filters before grouping', () => {
    const items = [
      item('ok', { dietTags: ['halal'] }),
      item('wrong-diet', { dietTags: [] }),
      item('allergen', { dietTags: ['halal'], allergens: ['nuts'] }),
      item('unverified', { dietTags: ['halal'], tagsStatus: 'unverified' }),
    ];
    const filters = { requiredDietTags: ['halal'], excludedAllergens: ['nuts'] };
    expect(ids(rankItems(items, { filters, sort: 'best_match' }))).toEqual(['ok']);
  });
});
