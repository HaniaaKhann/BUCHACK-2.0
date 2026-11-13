import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KAGGLE_OUTLETS, mergeMenus } from '../src/seed/menus.js';
import { menuFileSchema, outletsFileSchema, type MenuFile } from '../src/seed/schemas.js';

function loadSeed(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../seed-data/${name}`, import.meta.url), 'utf8'));
}

const generic = menuFileSchema.parse(loadSeed('menus_generic.json'));
const outlets = outletsFileSchema.parse(loadSeed('outlets.json')).outlets;

const FOCUS_OUTLETS = [
  'Main Canteen',
  'Harmony Cafeteria',
  'Harmony Lounge',
  'iCafe',
  'Bistro NTT',
  'Deli',
];

function countFor(file: MenuFile, outletName: string): number {
  return file.outlets.find((o) => o.outletName === outletName)?.items.length ?? 0;
}

describe('menus_generic.json', () => {
  it('is flagged as demo data from the generic source', () => {
    expect(generic.isDemoData).toBe(true);
    expect(generic.source).toBe('generic');
  });

  it('has at least 20 items for every focus outlet', () => {
    for (const name of FOCUS_OUTLETS) {
      expect(countFor(generic, name), name).toBeGreaterThanOrEqual(20);
    }
  });

  it('has at least 10 items for every other open outlet', () => {
    const others = outlets.filter((o) => o.status === 'open' && !FOCUS_OUTLETS.includes(o.name));
    for (const outlet of others) {
      expect(countFor(generic, outlet.name), outlet.name).toBeGreaterThanOrEqual(10);
    }
  });

  it('names only outlets that exist in outlets.json and skips closed ones', () => {
    const known = new Set(outlets.map((o) => o.name));
    const closed = new Set(outlets.filter((o) => o.status !== 'open').map((o) => o.name));
    for (const outlet of generic.outlets) {
      expect(known.has(outlet.outletName), outlet.outletName).toBe(true);
      expect(closed.has(outlet.outletName), outlet.outletName).toBe(false);
    }
  });

  it('has unique item names inside each outlet', () => {
    for (const outlet of generic.outlets) {
      const names = outlet.items.map((i) => i.name);
      expect(new Set(names).size, outlet.outletName).toBe(names.length);
    }
  });
});

describe('mergeMenus', () => {
  const kaggle: MenuFile = {
    isDemoData: true,
    source: 'kaggle',
    description: 'fixture',
    outlets: [
      {
        outletName: 'Bistro NTT',
        items: [
          {
            name: 'Cheeseburger',
            priceHkd: 90,
            category: 'Burgers',
            dietTags: [],
            allergens: [],
            prepPriorMin: 10,
            isSpecial: false,
          },
          {
            name: 'Imported Wrap',
            priceHkd: 50,
            category: 'Wraps',
            dietTags: [],
            allergens: [],
            prepPriorMin: 6,
            isSpecial: false,
          },
        ],
      },
    ],
  };

  it('returns only generic items when there is no Kaggle menu', () => {
    const merged = mergeMenus(generic, null);
    const expected = generic.outlets.reduce((sum, o) => sum + o.items.length, 0);
    expect(merged).toHaveLength(expected);
    expect(merged.every((i) => i.source === 'generic' && i.isDemo)).toBe(true);
  });

  it('lets Kaggle items override and extend generic ones for the same outlet', () => {
    const merged = mergeMenus(generic, kaggle).filter((i) => i.outletName === 'Bistro NTT');
    const cheeseburger = merged.find((i) => i.name === 'Cheeseburger');
    expect(cheeseburger).toMatchObject({ priceHkd: 90, source: 'kaggle' });
    expect(merged.find((i) => i.name === 'Imported Wrap')?.source).toBe('kaggle');
    expect(merged.find((i) => i.name === 'Classic Beef Burger')?.source).toBe('generic');
    expect(merged).toHaveLength(countFor(generic, 'Bistro NTT') + 1);
  });

  it('keeps every Kaggle item flagged as demo data', () => {
    expect(mergeMenus(generic, kaggle).every((i) => i.isDemo)).toBe(true);
  });

  it('rejects Kaggle items aimed at a Hong Kong style outlet', () => {
    const wrong: MenuFile = {
      ...kaggle,
      outlets: [{ outletName: 'Main Canteen', items: kaggle.outlets[0]?.items ?? [] }],
    };
    expect(() => mergeMenus(generic, wrong)).toThrow(/not a Kaggle outlet/);
  });

  it('lists only café outlets and Bistro NTT as Kaggle targets', () => {
    expect(KAGGLE_OUTLETS).not.toContain('Main Canteen');
    expect(KAGGLE_OUTLETS).toContain('Bistro NTT');
  });
});
