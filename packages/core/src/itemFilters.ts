import type { Goal } from './dietary.js';
import type { FitResult } from './fit.js';

export interface ItemFilterSettings {
  maxPriceHkd: number | null;
  maxWaitMinutes: number | null;
  fitsOnly: boolean;
  openNowOnly: boolean;
  vendorIds: readonly string[];
  goal: Goal | null;
}

export interface FilterableItem {
  vendorId: string;
  category: string;
  priceHkd: number;
  waitHighMinutes: number;
  vendorOpenNow: boolean;
  fit: FitResult;
}

const GOAL_CATEGORIES: Record<Exclude<Goal, 'none'>, readonly string[]> = {
  more_protein: ['Steak', 'Burgers', 'Dim sum', 'Set meals', 'Sandwiches', 'Soups'],
  more_carbs: ['Rice', 'Noodles', 'Pasta', 'Congee', 'Bakery', 'Pastries'],
  balanced: ['Salads', 'Set meals', 'Soups', 'Congee'],
};

const GOAL_MATCH = 1;
const GOAL_NEUTRAL = 0.5;
const GOAL_MISS = 0.3;

export function goalMatch(goal: Goal | null, category: string): number {
  if (goal === null || goal === 'none') return GOAL_NEUTRAL;
  return GOAL_CATEGORIES[goal].includes(category) ? GOAL_MATCH : GOAL_MISS;
}

export function passesItemFilters(item: FilterableItem, settings: ItemFilterSettings): boolean {
  if (settings.maxPriceHkd !== null && item.priceHkd > settings.maxPriceHkd) return false;
  if (settings.maxWaitMinutes !== null && item.waitHighMinutes > settings.maxWaitMinutes) {
    return false;
  }
  if (settings.fitsOnly && item.fit.status !== 'fits') return false;
  if (settings.openNowOnly && !item.vendorOpenNow) return false;
  if (settings.vendorIds.length > 0 && !settings.vendorIds.includes(item.vendorId)) return false;
  if (settings.goal !== null && settings.goal !== 'none') {
    return goalMatch(settings.goal, item.category) === GOAL_MATCH;
  }
  return true;
}
