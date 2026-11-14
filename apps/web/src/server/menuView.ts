import {
  MS_PER_MINUTE,
  buildWhyChips,
  evaluateFit,
  goalMatch,
  itemPrep,
  leaveAt,
  orderPrep,
  passesItemFilters,
  rankItems,
  resolveHardFilters,
  suggestCookedForArrival,
  type FitResult,
  type FitStatus,
  type PickupSlot,
  type ScheduleContext,
  type TagsStatus,
  type WhyChip,
} from '@app/core';
import type { ResolvedMenuQuery } from './menuQuery';
import { estimateWait, type VendorWaitState, type WaitEstimate } from './waitEstimate';

export const HALAL_EMPTY_STATE = 'halal_unconfirmed';

export interface VendorForMenu {
  id: string;
  name: string;
  openNow: boolean;
  orderable: boolean;
  walkFromOriginMinutes: number | null;
  walkToNextClassMinutes: number | null;
  wait: VendorWaitState | undefined;
  slots: readonly PickupSlot[];
}

export interface MenuItemRow {
  id: string;
  vendorId: string;
  name: string;
  priceHkd: number;
  category: string;
  dietTags: readonly string[];
  allergens: readonly string[];
  tagsStatus: TagsStatus;
  prepPriorMin: number;
}

export interface MenuViewInput {
  now: number;
  schedule: ScheduleContext;
  originKnown: boolean;
  eatMinutes: number;
  vendors: readonly VendorForMenu[];
  items: readonly MenuItemRow[];
  pastOrderCounts: ReadonlyMap<string, number>;
  query: ResolvedMenuQuery;
}

export interface MenuItemView {
  id: string;
  vendorId: string;
  vendorName: string;
  name: string;
  priceHkd: number;
  category: string;
  dietTags: readonly string[];
  allergens: readonly string[];
  tagsStatus: TagsStatus;
  notVerified: boolean;
  fit: { status: FitStatus; lateByMinutes: number };
  vendorOpenNow: boolean;
  orderable: boolean;
  wait: WaitEstimate;
  readyLowAt: number;
  readyPointAt: number;
  readyHighAt: number;
  pickupAt: number;
  deadline: number | null;
  leaveAt: number | null;
  leaveNow: boolean;
  cookedFor: { slotStart: number } | null;
  chips: WhyChip[];
  score: number;
}

export interface MenuViewMeta {
  now: number;
  schedule: { freeNow: boolean; classEnd: number | null; nextClassStart: number | null };
  applied: ResolvedMenuQuery;
  emptyState: typeof HALAL_EMPTY_STATE | null;
  vendorsWithoutWalk: number;
  staleVendorIds: string[];
}

interface ReadyVendor extends VendorForMenu {
  walkFromOriginMinutes: number;
  walkToNextClassMinutes: number | null;
}

interface Candidate {
  id: string;
  row: MenuItemRow;
  vendor: ReadyVendor;
  dietTags: readonly string[];
  allergens: readonly string[];
  tagsStatus: TagsStatus;
  category: string;
  vendorId: string;
  priceHkd: number;
  goalMatch: number;
  pastOrderCount: number;
  waitHighMinutes: number;
  vendorOpenNow: boolean;
  fit: FitResult;
  wait: WaitEstimate;
  leaveAt: number | null;
  cookedFor: { slotStart: number } | null;
}

function readyVendors(
  vendors: readonly VendorForMenu[],
  schedule: ScheduleContext,
  originKnown: boolean,
): ReadyVendor[] {
  if (!originKnown) {
    return vendors.map((vendor) => ({
      ...vendor,
      walkFromOriginMinutes: 0,
      walkToNextClassMinutes: null,
    }));
  }
  return vendors.flatMap((vendor) => {
    if (vendor.walkFromOriginMinutes === null) return [];
    if (schedule.nextClass !== null && vendor.walkToNextClassMinutes === null) return [];
    return [{ ...vendor, walkFromOriginMinutes: vendor.walkFromOriginMinutes }];
  });
}

function candidateFor(input: MenuViewInput, vendor: ReadyVendor, row: MenuItemRow): Candidate {
  const { now, query } = input;
  const schedule = input.originKnown
    ? input.schedule
    : { ...input.schedule, classEnd: null, nextClass: null };
  const prep = orderPrep([
    itemPrep({
      learned: vendor.wait?.payload?.prep[row.name]?.minutes ?? null,
      vendorPrior: row.prepPriorMin,
      categoryPrior: row.prepPriorMin,
    }),
  ]);
  const wait = estimateWait(vendor.wait, now, prep);
  const raw = evaluateFit({
    now,
    choice: { kind: 'asap', predMinutes: wait.pointMinutes, readyHighMinutes: wait.highMinutes },
    classEnd: schedule.classEnd,
    walkToVendorMinutes: vendor.walkFromOriginMinutes,
    nextClass:
      schedule.nextClass === null
        ? null
        : {
            start: schedule.nextClass.start,
            walkFromVendorMinutes: vendor.walkToNextClassMinutes ?? 0,
          },
    eatMinutes: input.eatMinutes,
  });
  const fit: FitResult = vendor.openNow ? raw : { ...raw, status: 'late' };
  const leave = input.originKnown
    ? leaveAt({
        now,
        readyPointAt: fit.readyPointAt,
        walkToVendorMinutes: vendor.walkFromOriginMinutes,
      })
    : null;
  const slot =
    leave === null
      ? null
      : suggestCookedForArrival({
          leaveAt: leave,
          currentClassEnd: schedule.classEnd,
          walkClassToVendorMinutes: vendor.walkFromOriginMinutes,
          slots: vendor.slots,
        });
  return {
    id: row.id,
    row,
    vendor,
    dietTags: row.dietTags,
    allergens: row.allergens,
    tagsStatus: row.tagsStatus,
    category: row.category,
    vendorId: row.vendorId,
    priceHkd: row.priceHkd,
    goalMatch: goalMatch(query.goal, row.category),
    pastOrderCount: input.pastOrderCounts.get(row.id) ?? 0,
    waitHighMinutes: wait.highMinutes,
    vendorOpenNow: vendor.openNow,
    fit,
    wait,
    leaveAt: leave,
    cookedFor: slot === null ? null : { slotStart: slot.slotStart },
  };
}

export function buildMenuView(input: MenuViewInput): { items: MenuItemView[]; meta: MenuViewMeta } {
  const { query, schedule, now } = input;
  const vendors = readyVendors(input.vendors, schedule, input.originKnown);
  const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));

  const candidates = input.items.flatMap((row) => {
    const vendor = vendorById.get(row.vendorId);
    return vendor === undefined ? [] : [candidateFor(input, vendor, row)];
  });

  const filtered = candidates.filter((candidate) =>
    passesItemFilters(candidate, {
      maxPriceHkd: query.maxPrice,
      maxWaitMinutes: query.maxWait,
      fitsOnly: query.fitsOnly,
      openNowOnly: query.openNowOnly,
      vendorIds: query.vendorIds,
      goal: query.goalFilter ? query.goal : null,
    }),
  );
  const ranked = rankItems(filtered, {
    filters: resolveHardFilters(query.dietIds, query.allergenIds),
    sort: query.sort,
  });

  const items = ranked.map(({ item, score, notVerified }): MenuItemView => {
    const { fit, wait } = item;
    return {
      id: item.id,
      vendorId: item.vendorId,
      vendorName: item.vendor.name,
      name: item.row.name,
      priceHkd: item.priceHkd,
      category: item.category,
      dietTags: item.dietTags,
      allergens: item.allergens,
      tagsStatus: item.tagsStatus,
      notVerified,
      fit: { status: fit.status, lateByMinutes: fit.lateByMinutes },
      vendorOpenNow: item.vendorOpenNow,
      orderable: item.vendor.orderable,
      wait,
      readyLowAt: now + wait.lowMinutes * MS_PER_MINUTE,
      readyPointAt: fit.readyPointAt,
      readyHighAt: fit.readyHighAt,
      pickupAt: fit.pickupAt,
      deadline: fit.deadline,
      leaveAt: item.leaveAt,
      leaveNow: item.leaveAt !== null && item.leaveAt <= now,
      cookedFor: item.cookedFor,
      chips: buildWhyChips({
        selectedDietIds: query.dietIds,
        selectedAllergenIds: query.allergenIds,
        item: { dietTags: item.dietTags, allergens: item.allergens, tagsStatus: item.tagsStatus },
        fit,
        nextClassStart: input.originKnown ? (schedule.nextClass?.start ?? null) : null,
        vendorOpenNow: item.vendorOpenNow,
      }),
      score,
    };
  });

  const staleVendorIds = vendors
    .filter((vendor) => estimateWait(vendor.wait, now, 1).source === 'stale')
    .map((vendor) => vendor.id);

  return {
    items,
    meta: {
      now,
      schedule: {
        freeNow: schedule.freeNow,
        classEnd: schedule.classEnd,
        nextClassStart: schedule.nextClass?.start ?? null,
      },
      applied: query,
      emptyState: items.length === 0 && query.dietIds.includes('halal') ? HALAL_EMPTY_STATE : null,
      vendorsWithoutWalk: input.vendors.length - vendors.length,
      staleVendorIds,
    },
  };
}
