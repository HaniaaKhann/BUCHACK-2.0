import {
  RANKING_PAST_ORDERS_CAP,
  RANKING_PRICE_REFERENCE_HKD,
  RANKING_WAIT_REFERENCE_MINUTES,
  RANKING_WEIGHT_GOAL,
  RANKING_WEIGHT_PAST_ORDERS,
  RANKING_WEIGHT_PRICE,
  RANKING_WEIGHT_WAIT,
} from './config.js';
import type { FitResult, FitStatus } from './fit.js';
import type { TagsStatus } from './types.js';

export type SortKey = 'best_match' | 'lowest_wait' | 'lowest_price';

export interface RankableItem {
  id: string;
  dietTags: readonly string[];
  allergens: readonly string[];
  tagsStatus: TagsStatus;
  priceHkd: number;
  goalMatch: number;
  pastOrderCount: number;
  waitHighMinutes: number;
  fit: FitResult;
}

export interface HardFilters {
  requiredDietTags: readonly string[];
  excludedAllergens: readonly string[];
}

export interface RankingQuery {
  filters: HardFilters;
  sort: SortKey;
}

export interface RankedItem<T extends RankableItem> {
  item: T;
  score: number;
  notVerified: boolean;
}

const FIT_ORDER: Record<FitStatus, number> = { fits: 0, tight: 1, late: 2 };

export function passesHardFilters(item: RankableItem, filters: HardFilters): boolean {
  const dietFilterOn = filters.requiredDietTags.length > 0;
  const allergenFilterOn = filters.excludedAllergens.length > 0;

  if ((dietFilterOn || allergenFilterOn) && item.tagsStatus === 'unverified') return false;
  if (!filters.requiredDietTags.every((tag) => item.dietTags.includes(tag))) return false;
  return !filters.excludedAllergens.some((allergen) => item.allergens.includes(allergen));
}

export function bestMatchScore(item: RankableItem): number {
  const waitScore = Math.max(0, 1 - item.waitHighMinutes / RANKING_WAIT_REFERENCE_MINUTES);
  const priceScore = Math.max(0, 1 - item.priceHkd / RANKING_PRICE_REFERENCE_HKD);
  const pastScore = Math.min(1, item.pastOrderCount / RANKING_PAST_ORDERS_CAP);
  return (
    RANKING_WEIGHT_GOAL * item.goalMatch +
    RANKING_WEIGHT_WAIT * waitScore +
    RANKING_WEIGHT_PRICE * priceScore +
    RANKING_WEIGHT_PAST_ORDERS * pastScore
  );
}

function compareWithinGroup<T extends RankableItem>(
  sort: SortKey,
  a: RankedItem<T>,
  b: RankedItem<T>,
): number {
  if (sort === 'lowest_wait') return a.item.waitHighMinutes - b.item.waitHighMinutes;
  if (sort === 'lowest_price') return a.item.priceHkd - b.item.priceHkd;
  return b.score - a.score;
}

export function rankItems<T extends RankableItem>(
  items: readonly T[],
  query: RankingQuery,
): RankedItem<T>[] {
  return items
    .filter((item) => passesHardFilters(item, query.filters))
    .map((item) => ({
      item,
      score: bestMatchScore(item),
      notVerified: item.tagsStatus === 'unverified',
    }))
    .sort(
      (a, b) =>
        FIT_ORDER[a.item.fit.status] - FIT_ORDER[b.item.fit.status] ||
        compareWithinGroup(query.sort, a, b) ||
        a.item.id.localeCompare(b.item.id),
    );
}
