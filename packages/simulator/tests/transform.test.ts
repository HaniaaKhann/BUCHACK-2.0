import { describe, expect, it } from 'vitest';
import { menuFileSchema } from '@app/db/seed-schemas';
import { ITEMS_PER_OUTLET, OUTLET_GROUPS } from '../src/kaggle/config.js';
import {
  parseConfirmedMapping,
  proposeMapping,
  validateMappingAgainstHeaders,
} from '../src/kaggle/mapping.js';
import {
  assignToOutlets,
  buildCandidate,
  classifyGroup,
  mentionsBrand,
  parsePriceUsd,
  seededShuffle,
  stripRestaurantName,
  suggestTags,
  toMenuFile,
  usdToHkd,
  type Candidate,
  type RawMenuRow,
} from '../src/kaggle/transform.js';

const baseRow: RawMenuRow = {
  restaurantId: '7',
  restaurantName: 'Joe Grill House',
  restaurantCategories: 'Burgers, American',
  menuCategory: 'Burgers',
  name: 'Joe Grill House Classic Burger',
  description: 'Beef patty with cheese on a bun',
  priceRaw: '9.50 USD',
};

describe('price helpers', () => {
  it('parses price strings with currency text and thousands separators', () => {
    expect(parsePriceUsd('9.50 USD')).toBe(9.5);
    expect(parsePriceUsd('$1,200.00')).toBe(1200);
    expect(parsePriceUsd('free')).toBeNull();
    expect(parsePriceUsd('0.00')).toBeNull();
  });

  it('converts at the fixed rate and rounds to whole HKD', () => {
    expect(usdToHkd(10)).toBe(78);
    expect(usdToHkd(9.5)).toBe(74);
  });
});

describe('stripRestaurantName', () => {
  it('removes the restaurant name and possessive form, case-insensitively', () => {
    expect(stripRestaurantName("Joe Grill House's Classic Burger", 'Joe Grill House')).toBe(
      'Classic Burger',
    );
    expect(stripRestaurantName('JOE GRILL HOUSE - Fries', 'Joe Grill House')).toBe('Fries');
  });

  it('handles names containing regex characters', () => {
    expect(stripRestaurantName('A+B (Cafe) Latte', 'A+B (Cafe)')).toBe('Latte');
  });
});

describe('mentionsBrand', () => {
  it('flags blocklisted brand terms', () => {
    expect(mentionsBrand('Big Mac Meal')).toBe(true);
    expect(mentionsBrand('Classic Burger')).toBe(false);
  });
});

describe('suggestTags', () => {
  it('marks vegan only when a vegan keyword appears without meat', () => {
    expect(suggestTags('Vegan burger with lettuce').dietTags).toEqual(['vegetarian', 'vegan']);
    expect(suggestTags('Vegan chicken wrap').dietTags).toEqual([]);
  });

  it('marks vegetarian from veggie keywords', () => {
    expect(suggestTags('Veggie pasta').dietTags).toEqual(['vegetarian']);
  });

  it('suggests allergens from keywords', () => {
    expect(suggestTags('Shrimp pasta with cheese').allergens).toEqual(
      expect.arrayContaining(['gluten', 'dairy', 'shellfish']),
    );
  });
});

describe('classifyGroup', () => {
  it('routes burger and steak places to the bistro group', () => {
    expect(classifyGroup('Burgers, American', 'Burgers')).toBe('bistro');
  });

  it('routes coffee and bakery places to the cafe group', () => {
    expect(classifyGroup('Coffee & Tea, Bakery', 'Pastries')).toBe('cafe');
  });

  it('returns null for unrelated or ambiguous categories', () => {
    expect(classifyGroup('Mexican', 'Tacos')).toBeNull();
    expect(classifyGroup('Burgers, Coffee', 'Mixed')).toBeNull();
  });
});

describe('buildCandidate', () => {
  it('strips the restaurant name, converts the price and tags the item', () => {
    const candidate = buildCandidate(baseRow, 12);
    expect(candidate).toMatchObject({
      group: 'bistro',
      name: 'Classic Burger',
      priceHkd: 74,
      externalId: 'kaggle:7:12',
    });
    expect(candidate?.name).not.toContain('Joe');
  });

  it('drops branded, out-of-range and unpriced rows', () => {
    expect(buildCandidate({ ...baseRow, name: 'Big Mac' }, 1)).toBeNull();
    expect(buildCandidate({ ...baseRow, priceRaw: '99.00 USD' }, 1)).toBeNull();
    expect(buildCandidate({ ...baseRow, priceRaw: '0.50 USD' }, 1)).toBeNull();
    expect(buildCandidate({ ...baseRow, priceRaw: '' }, 1)).toBeNull();
  });
});

function fixtureCandidates(group: 'bistro' | 'cafe', count: number): Candidate[] {
  return Array.from({ length: count }, (_, i) => ({
    group,
    externalId: `kaggle:1:${group}${i}`,
    name: `${group} item ${i}`,
    category: 'Mains',
    priceHkd: 60,
    dietTags: [],
    allergens: [],
    prepPriorMin: 5,
  }));
}

describe('assignToOutlets', () => {
  it('is deterministic for a fixed seed', () => {
    const input = fixtureCandidates('cafe', 80);
    const a = assignToOutlets(input, 1);
    const b = assignToOutlets(input, 1);
    expect([...a.byOutlet.entries()]).toEqual([...b.byOutlet.entries()]);
  });

  it('spreads cafe items across the five cafes within the item limits', () => {
    const { byOutlet, shortfalls } = assignToOutlets(
      [...fixtureCandidates('cafe', 300), ...fixtureCandidates('bistro', 100)],
      1,
    );
    expect(shortfalls).toEqual([]);
    for (const outlet of OUTLET_GROUPS.cafe) {
      expect(byOutlet.get(outlet)?.length).toBe(ITEMS_PER_OUTLET.max);
    }
    expect(byOutlet.get('Bistro NTT')?.length).toBe(ITEMS_PER_OUTLET.max);
  });

  it('reports a shortfall instead of padding', () => {
    const { shortfalls } = assignToOutlets(fixtureCandidates('bistro', 10), 1);
    expect(shortfalls.some((s) => s.startsWith('Bistro NTT'))).toBe(true);
  });

  it('drops duplicate names inside a group', () => {
    const dupes = fixtureCandidates('bistro', 30).map((c) => ({ ...c, name: 'Same' }));
    expect(assignToOutlets(dupes, 1).byOutlet.get('Bistro NTT')).toHaveLength(1);
  });
});

describe('seededShuffle', () => {
  it('keeps the same elements', () => {
    expect(seededShuffle([1, 2, 3, 4, 5], 3).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('toMenuFile', () => {
  it('produces a file the seed schema accepts, flagged as demo data', () => {
    const { byOutlet } = assignToOutlets(
      [...fixtureCandidates('cafe', 300), ...fixtureCandidates('bistro', 100)],
      1,
    );
    const parsed = menuFileSchema.parse(toMenuFile(byOutlet, 'fixture'));
    expect(parsed.isDemoData).toBe(true);
    expect(parsed.source).toBe('kaggle');
  });
});

describe('mapping gate', () => {
  const files = [
    { file: 'restaurants.csv', headers: ['id', 'name', 'category', 'score'] },
    {
      file: 'restaurant-menus.csv',
      headers: ['restaurant_id', 'category', 'name', 'description', 'price'],
    },
  ];

  it('refuses to import without a confirmed mapping', () => {
    expect(() => parseConfirmedMapping(null)).toThrow(/mapping.confirmed.json is missing/);
  });

  it('rejects a confirmed mapping with missing fields', () => {
    expect(() => parseConfirmedMapping('{}')).toThrow();
  });

  it('proposes a mapping from headers using the single column table', () => {
    const { mapping, missing } = proposeMapping(files);
    expect(missing).toEqual([]);
    expect(mapping?.menu.price).toBe('price');
    expect(mapping?.restaurants.category).toBe('category');
  });

  it('reports unmatched columns instead of guessing', () => {
    const { mapping, missing } = proposeMapping([
      { file: 'restaurants.csv', headers: ['id', 'name', 'category'] },
      { file: 'restaurant-menus.csv', headers: ['restaurant_id', 'name', 'price'] },
    ]);
    expect(mapping).toBeNull();
    expect(missing).toEqual(expect.arrayContaining(['menu.category', 'menu.description']));
  });

  it('flags confirmed columns that are not in the file headers', () => {
    const { mapping } = proposeMapping(files);
    if (!mapping) throw new Error('fixture mapping expected');
    expect(validateMappingAgainstHeaders(mapping, files)).toEqual([]);
    const broken = { ...mapping, menu: { ...mapping.menu, price: 'cost' } };
    expect(validateMappingAgainstHeaders(broken, files)[0]).toMatch(/"cost"/);
  });
});
