import {
  ALLERGEN_KEYWORDS,
  BRAND_BLOCKLIST,
  DIET_KEYWORDS,
  DRINK_WORDS,
  GROUP_KEYWORDS,
  ITEMS_PER_OUTLET,
  LIGHT_WORDS,
  OUTLET_GROUPS,
  PREP_MINUTES,
  PRICE_BOUNDS_HKD,
  USD_TO_HKD,
  type OutletGroup,
} from './config.js';
import { mulberry32 } from '../rng.js';

export type Allergen = keyof typeof ALLERGEN_KEYWORDS;
export type DietTag = 'vegetarian' | 'vegan';

export interface RawMenuRow {
  restaurantId: string;
  restaurantName: string;
  restaurantCategories: string;
  menuCategory: string;
  name: string;
  description: string;
  priceRaw: string;
}

export interface Candidate {
  group: OutletGroup;
  externalId: string;
  name: string;
  category: string;
  priceHkd: number;
  dietTags: DietTag[];
  allergens: Allergen[];
  prepPriorMin: number;
}

export interface OutputItem {
  name: string;
  priceHkd: number;
  category: string;
  dietTags: DietTag[];
  allergens: Allergen[];
  prepPriorMin: number;
  isSpecial: boolean;
  externalId: string;
}

export interface OutputMenuFile {
  isDemoData: true;
  source: 'kaggle';
  description: string;
  outlets: { outletName: string; items: OutputItem[] }[];
}

export function parsePriceUsd(raw: string): number | null {
  const match = /\d+(?:\.\d+)?/.exec(raw.replace(/,/g, ''));
  if (!match) return null;
  const value = Number(match[0]);
  return value > 0 ? value : null;
}

export function usdToHkd(usd: number, rate: number = USD_TO_HKD): number {
  return Math.round(usd * rate);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function stripRestaurantName(text: string, restaurantName: string): string {
  const trimmed = restaurantName.trim();
  const withoutName =
    trimmed.length === 0
      ? text
      : text.replace(new RegExp(`${escapeRegExp(trimmed)}(?:'s)?`, 'gi'), ' ');
  return withoutName
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—:,.']+|[\s\-–—:,]+$/g, '')
    .trim();
}

export function mentionsBrand(text: string): boolean {
  const lower = text.toLowerCase();
  return BRAND_BLOCKLIST.some((brand) => lower.includes(brand));
}

function containsAny(text: string, words: readonly string[]): boolean {
  return words.some((word) => text.includes(word));
}

export function suggestTags(text: string): { dietTags: DietTag[]; allergens: Allergen[] } {
  const lower = text.toLowerCase();
  const hasMeat = containsAny(lower, DIET_KEYWORDS.meat);
  const isVegan = containsAny(lower, DIET_KEYWORDS.vegan) && !hasMeat;
  const isVegetarian = isVegan || (containsAny(lower, DIET_KEYWORDS.vegetarian) && !hasMeat);
  const dietTags: DietTag[] = isVegan
    ? ['vegetarian', 'vegan']
    : isVegetarian
      ? ['vegetarian']
      : [];
  const allergens = (Object.keys(ALLERGEN_KEYWORDS) as Allergen[]).filter((allergen) =>
    containsAny(lower, ALLERGEN_KEYWORDS[allergen]),
  );
  return { dietTags, allergens };
}

export function classifyGroup(
  restaurantCategories: string,
  menuCategory: string,
): OutletGroup | null {
  const text = `${restaurantCategories} ${menuCategory}`.toLowerCase();
  const matches = (Object.keys(GROUP_KEYWORDS) as OutletGroup[]).filter((group) =>
    containsAny(text, GROUP_KEYWORDS[group]),
  );
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

export function estimatePrepMin(group: OutletGroup, text: string): number {
  const lower = text.toLowerCase();
  const prep = PREP_MINUTES[group];
  if (containsAny(lower, DRINK_WORDS)) return prep.drink;
  if (containsAny(lower, LIGHT_WORDS)) return prep.light;
  return prep.main;
}

export function buildCandidate(row: RawMenuRow, rowNumber: number): Candidate | null {
  const group = classifyGroup(row.restaurantCategories, row.menuCategory);
  if (!group) return null;

  const rawName = `${row.name} ${row.description}`;
  if (mentionsBrand(rawName) || mentionsBrand(row.restaurantName)) return null;

  const name = stripRestaurantName(row.name, row.restaurantName);
  if (name.length < 3 || name.length > 60) return null;

  const usd = parsePriceUsd(row.priceRaw);
  if (usd === null) return null;
  const priceHkd = usdToHkd(usd);
  const bounds = PRICE_BOUNDS_HKD[group];
  if (priceHkd < bounds.min || priceHkd > bounds.max) return null;

  const description = stripRestaurantName(row.description, row.restaurantName);
  const { dietTags, allergens } = suggestTags(`${name} ${description}`);
  const category = stripRestaurantName(row.menuCategory, row.restaurantName) || 'Other';

  return {
    group,
    externalId: `kaggle:${row.restaurantId}:${rowNumber}`,
    name,
    category,
    priceHkd,
    dietTags,
    allergens,
    prepPriorMin: estimatePrepMin(group, `${name} ${category}`),
  };
}

export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const random = mulberry32(seed);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = result[i] as T;
    result[i] = result[j] as T;
    result[j] = a;
  }
  return result;
}

export interface Assignment {
  byOutlet: Map<string, Candidate[]>;
  shortfalls: string[];
}

export function assignToOutlets(candidates: readonly Candidate[], seed: number): Assignment {
  const byOutlet = new Map<string, Candidate[]>();
  const shortfalls: string[] = [];

  for (const group of Object.keys(OUTLET_GROUPS) as OutletGroup[]) {
    const outlets = OUTLET_GROUPS[group];
    const seen = new Set<string>();
    const unique = seededShuffle(
      candidates.filter((c) => c.group === group),
      seed,
    ).filter((c) => {
      const key = c.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    for (const outlet of outlets) byOutlet.set(outlet, []);

    unique.forEach((candidate, index) => {
      const items = byOutlet.get(outlets[index % outlets.length] as string) as Candidate[];
      if (items.length < ITEMS_PER_OUTLET.max) items.push(candidate);
    });

    for (const outlet of outlets) {
      const count = byOutlet.get(outlet)?.length ?? 0;
      if (count < ITEMS_PER_OUTLET.min) {
        shortfalls.push(`${outlet}: ${count} items, need at least ${ITEMS_PER_OUTLET.min}`);
      }
    }
  }

  return { byOutlet, shortfalls };
}

export function toMenuFile(
  byOutlet: Map<string, Candidate[]>,
  description: string,
): OutputMenuFile {
  return {
    isDemoData: true,
    source: 'kaggle',
    description,
    outlets: [...byOutlet.entries()]
      .filter(([, items]) => items.length > 0)
      .map(([outletName, items]) => ({
        outletName,
        items: items.map((c) => ({
          name: c.name,
          priceHkd: c.priceHkd,
          category: c.category,
          dietTags: c.dietTags,
          allergens: c.allergens,
          prepPriorMin: c.prepPriorMin,
          isSpecial: false,
          externalId: c.externalId,
        })),
      })),
  };
}
