import { isAllergenId, isDietId, type Goal, type SortKey } from '@app/core';
import { z } from 'zod';

export const PROFILE_FILTERS = ['diet', 'allergens', 'goal'] as const;
export type ProfileFilter = (typeof PROFILE_FILTERS)[number];

const csv = (value: string | null): string[] | null =>
  value === null
    ? null
    : value
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part !== '');

const flag = (value: string | null): boolean => value === '1' || value === 'true';

const querySchema = z.object({
  diet: z.array(z.string().refine(isDietId, 'unknown diet')).max(10).nullable(),
  allergens: z.array(z.string().refine(isAllergenId, 'unknown allergen')).max(12).nullable(),
  goalFilter: z.boolean(),
  maxPrice: z.number().int().positive().max(1000).nullable(),
  maxWait: z.number().int().positive().max(240).nullable(),
  fits: z.boolean(),
  openNow: z.boolean(),
  vendor: z.array(z.string().uuid()).max(20),
  sort: z.enum(['best_match', 'lowest_wait', 'lowest_price']),
  off: z.array(z.enum(PROFILE_FILTERS)).max(3),
});

export interface MenuQuery {
  diet: string[] | null;
  allergens: string[] | null;
  goalFilter: boolean;
  maxPrice: number | null;
  maxWait: number | null;
  fits: boolean;
  openNow: boolean;
  vendor: string[];
  sort: SortKey;
  off: ProfileFilter[];
}

function numberOrNull(value: string | null): number | null {
  return value === null ? null : Number(value);
}

export function parseMenuQuery(
  params: URLSearchParams,
): { ok: true; value: MenuQuery } | { ok: false; error: string } {
  const parsed = querySchema.safeParse({
    diet: csv(params.get('diet')),
    allergens: csv(params.get('allergens')),
    goalFilter: flag(params.get('goalFilter')),
    maxPrice: numberOrNull(params.get('maxPrice')),
    maxWait: numberOrNull(params.get('maxWait')),
    fits: flag(params.get('fits')),
    openNow: flag(params.get('openNow')),
    vendor: csv(params.get('vendor')) ?? [],
    sort: params.get('sort') ?? 'best_match',
    off: csv(params.get('off')) ?? [],
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: `${issue?.path.join('.') ?? 'query'}: ${issue?.message ?? 'invalid'}`,
    };
  }
  return { ok: true, value: parsed.data };
}

export interface ProfileDefaults {
  dietTags: readonly string[];
  allergens: readonly string[];
  goal: Goal | null;
}

export interface ResolvedMenuQuery {
  dietIds: string[];
  allergenIds: string[];
  goal: Goal | null;
  goalFilter: boolean;
  maxPrice: number | null;
  maxWait: number | null;
  fitsOnly: boolean;
  openNowOnly: boolean;
  vendorIds: string[];
  sort: SortKey;
  off: ProfileFilter[];
}

export function resolveMenuQuery(query: MenuQuery, profile: ProfileDefaults): ResolvedMenuQuery {
  const isOff = (filter: ProfileFilter): boolean => query.off.includes(filter);
  const goal = isOff('goal') || profile.goal === 'none' ? null : profile.goal;
  return {
    dietIds: isOff('diet') ? [] : (query.diet ?? [...profile.dietTags]),
    allergenIds: isOff('allergens') ? [] : (query.allergens ?? [...profile.allergens]),
    goal,
    goalFilter: query.goalFilter && goal !== null,
    maxPrice: query.maxPrice,
    maxWait: query.maxWait,
    fitsOnly: query.fits,
    openNowOnly: query.openNow,
    vendorIds: query.vendor,
    sort: query.sort,
    off: query.off,
  };
}
