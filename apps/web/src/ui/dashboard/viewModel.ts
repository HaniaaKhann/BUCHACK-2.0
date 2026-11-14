import { formatHktTime, hktWeekday, type FitStatus, type SortKey } from '@app/core';
import type { MenuResponse } from '@/server/menuService';

export type ProfileFilterId = 'diet' | 'allergens' | 'goal';

export interface FilterState {
  off: ProfileFilterId[];
  maxPrice: number | null;
  maxWait: number | null;
  fits: boolean;
  openNow: boolean;
  goalFilter: boolean;
  vendor: string[];
  sort: SortKey;
}

export const DEFAULT_FILTERS: FilterState = {
  off: [],
  maxPrice: null,
  maxWait: null,
  fits: false,
  openNow: false,
  goalFilter: false,
  vendor: [],
  sort: 'best_match',
};

export const HALAL_EMPTY_TEXT =
  'No items are confirmed halal yet. Vendors confirm this themselves, and we never guess.';

export const PRICE_CHOICES = [20, 30, 40, 60, 80] as const;
export const WAIT_CHOICES = [5, 10, 15, 20, 30] as const;

export function toQueryString(state: FilterState): string {
  const params = new URLSearchParams();
  if (state.off.length > 0) params.set('off', state.off.join(','));
  if (state.maxPrice !== null) params.set('maxPrice', String(state.maxPrice));
  if (state.maxWait !== null) params.set('maxWait', String(state.maxWait));
  if (state.fits) params.set('fits', '1');
  if (state.openNow) params.set('openNow', '1');
  if (state.goalFilter) params.set('goalFilter', '1');
  if (state.vendor.length > 0) params.set('vendor', state.vendor.join(','));
  if (state.sort !== 'best_match') params.set('sort', state.sort);
  return params.toString();
}

export function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

export function activeFilterCount(state: FilterState): number {
  return (
    state.off.length +
    (state.maxPrice === null ? 0 : 1) +
    (state.maxWait === null ? 0 : 1) +
    (state.fits ? 1 : 0) +
    (state.openNow ? 1 : 0) +
    (state.goalFilter ? 1 : 0) +
    (state.vendor.length > 0 ? 1 : 0) +
    (state.sort === 'best_match' ? 0 : 1)
  );
}

export function formatWaitRange(lowMinutes: number, highMinutes: number): string {
  const low = Math.max(0, Math.floor(lowMinutes));
  const high = Math.max(low, Math.ceil(highMinutes));
  return low === high ? `${high} min` : `${low} to ${high} min`;
}

export function leaveText(leaveNow: boolean, leaveAt: number): string {
  return leaveNow ? 'Leave now' : `Leave at ${formatHktTime(leaveAt)}`;
}

export interface WhenToGoInput {
  vendorOpenNow: boolean;
  leaveNow: boolean;
  leaveAt: number;
}

export function whenToGoText(
  item: WhenToGoInput,
  schedule: { freeNow: boolean; classEnd: number | null },
): string {
  if (!item.vendorOpenNow) return 'Closed now';
  if (!schedule.freeNow && schedule.classEnd !== null) {
    return `After class, ${formatHktTime(schedule.classEnd)}`;
  }
  return leaveText(item.leaveNow, item.leaveAt);
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function formatDemoClock(now: number): string {
  return `${WEEKDAY_NAMES[hktWeekday(now)] ?? ''} ${formatHktTime(now)}`;
}

export function scheduleSummary(schedule: MenuResponse['meta']['schedule']): string {
  const nextClass =
    schedule.nextClassStart === null
      ? 'No class later today'
      : `Next class ${formatHktTime(schedule.nextClassStart)}`;
  if (schedule.freeNow) return `Free now. ${nextClass}`;
  return `In class until ${formatHktTime(schedule.classEnd ?? 0)}. ${nextClass}`;
}

export const BUSY_LABELS = { quiet: 'Quiet', normal: 'Normal', rush: 'Rush' } as const;

export const SORT_LABELS: Record<SortKey, string> = {
  best_match: 'Best match',
  lowest_wait: 'Lowest wait',
  lowest_price: 'Lowest price',
};

export function groupHeading(status: FitStatus, hasNextClass: boolean): string {
  if (!hasNextClass) return 'Available now';
  if (status === 'fits') return 'Fits before your next class';
  if (status === 'tight') return 'Tight for your next class';
  return 'May make you late';
}

export function groupByFit<T extends { fit: { status: FitStatus } }>(
  items: readonly T[],
): { status: FitStatus; items: T[] }[] {
  const order: FitStatus[] = ['fits', 'tight', 'late'];
  return order
    .map((status) => ({ status, items: items.filter((item) => item.fit.status === status) }))
    .filter((group) => group.items.length > 0);
}

export interface EmptyMessage {
  title: string;
  body: string;
}

export function emptyMessage(meta: MenuResponse['meta'], filtersOn: boolean): EmptyMessage {
  if (meta.needsBuilding) {
    return {
      title: 'Where are you?',
      body: 'Choose the building you are in to see walk times and what fits before class.',
    };
  }
  if (meta.emptyState === 'halal_unconfirmed') {
    return { title: 'Halal', body: HALAL_EMPTY_TEXT };
  }
  return {
    title: 'Nothing matches right now',
    body: filtersOn
      ? 'Try turning a filter off, or choose another vendor.'
      : 'No open vendor has items available at the moment.',
  };
}

export function waitNote(source: 'live' | 'stale' | 'cold'): string | null {
  if (source === 'stale') return 'Estimate updating';
  if (source === 'cold') return 'Prep time only';
  return null;
}
