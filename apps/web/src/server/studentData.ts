import {
  GOAL_OPTIONS,
  MS_PER_DAY,
  MU_FLOOR_PER_MINUTE,
  SLOT_MINUTES,
  defaultSlotCap,
  formatHktTime,
  hktDate,
  hktMidnight,
  isOpenAt,
  median,
  openRangesOn,
  scheduleContext,
  slotGrid,
  type FreeWindowInput,
  type Goal,
  type PickupSlot,
  type ScheduleContext,
} from '@app/core';
import { ACTIVE_VENDOR_WHERE, openingHoursSchema } from '@app/db';
import { prisma } from './db';
import type { MenuItemRow, VendorForMenu } from './menuView';
import { estimateWait, type VendorWaitState, type WaitEstimate } from './waitEstimate';
import { loadWaitStates } from './waitState';

const SLOT_HORIZON = 48;

export interface StudentState {
  userId: string;
  profile: {
    dietTags: string[];
    allergens: string[];
    goal: Goal | null;
    eatMinutes: number;
    chatLanguage: 'en' | 'zh_HK' | 'zh_CN';
    currentBuildingId: string | null;
  };
  windows: FreeWindowInput[];
  schedule: ScheduleContext;
  originBuildingId: string | null;
}

function asGoal(value: string | null): Goal | null {
  return GOAL_OPTIONS.find((goal) => goal === value) ?? null;
}

export async function loadStudentState(userId: string, now: number): Promise<StudentState | null> {
  const profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (profile === null) return null;
  const rows = await prisma.freeWindow.findMany({ where: { userId } });
  const windows = rows.map((row) => ({
    weekday: row.weekday,
    startMinute: row.startMinute,
    endMinute: row.endMinute,
    prevBuildingId: row.prevBuildingId,
    nextBuildingId: row.nextBuildingId,
  }));
  const schedule = scheduleContext(windows, now);
  return {
    userId,
    profile: {
      dietTags: profile.dietTags,
      allergens: profile.allergens,
      goal: asGoal(profile.goal),
      eatMinutes: profile.eatMinutes,
      chatLanguage: profile.chatLanguage,
      currentBuildingId: profile.currentBuildingId,
    },
    windows,
    schedule,
    originBuildingId: schedule.freeNow ? profile.currentBuildingId : schedule.classBuildingId,
  };
}

export interface VendorRecord {
  id: string;
  name: string;
  campus: string;
  floor: string;
  pickupEnabled: boolean;
  paused: boolean;
  busyState: 'quiet' | 'normal' | 'rush';
  busyUntil: Date | null;
  building: { id: string; name: string; code: string | null };
  openNow: boolean;
  hoursToday: { open: string; close: string }[];
  walk: { minutes: number; source: 'estimate' | 'measured' } | null;
  wait: WaitEstimate;
  forMenu: VendorForMenu;
}

export async function loadVendorRecords(
  state: StudentState | null,
  now: number,
): Promise<{ vendors: VendorRecord[]; items: MenuItemRow[] }> {
  const vendors = await prisma.vendor.findMany({
    where: ACTIVE_VENDOR_WHERE,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      campus: true,
      floor: true,
      pickupEnabled: true,
      paused: true,
      busyState: true,
      busyUntil: true,
      openingHours: true,
      building: { select: { id: true, name: true, code: true } },
    },
  });
  const vendorIds = vendors.map((vendor) => vendor.id);
  const nextBuildingId = state?.schedule.nextClass?.buildingId ?? null;
  const fromBuildings = [state?.originBuildingId ?? null, nextBuildingId].filter(
    (id): id is string => id !== null,
  );

  const [holidayRows, walkRows, waits, items, booked] = await Promise.all([
    prisma.publicHoliday.findMany({ select: { date: true } }),
    prisma.walkTime.findMany({
      where: { type: 'b2v', toVendorId: { in: vendorIds }, fromBuildingId: { in: fromBuildings } },
      select: { fromBuildingId: true, toVendorId: true, minutes: true, source: true },
    }),
    loadWaitStates(vendorIds, now),
    prisma.menuItem.findMany({
      where: { vendorId: { in: vendorIds }, deletedAt: null, stockStatus: 'in_stock' },
      select: {
        id: true,
        vendorId: true,
        name: true,
        priceHkd: true,
        category: true,
        dietTags: true,
        allergens: true,
        tagsStatus: true,
        prepPriorMin: true,
      },
    }),
    prisma.order.groupBy({
      by: ['vendorId', 'slotStart'],
      where: {
        vendorId: { in: vendorIds },
        slotStart: { gte: new Date(now) },
        status: { not: 'cancelled' },
      },
      _count: { _all: true },
    }),
  ]);

  const holidays = new Set(holidayRows.map((row) => row.date.toISOString().slice(0, 10)));
  const walk = new Map(
    walkRows.map((row) => [`${row.fromBuildingId}|${row.toVendorId}`, row] as const),
  );
  const bookedByVendor = new Map<string, Map<number, number>>();
  for (const row of booked) {
    if (row.slotStart === null) continue;
    const counts = bookedByVendor.get(row.vendorId) ?? new Map<number, number>();
    counts.set(row.slotStart.getTime(), row._count._all);
    bookedByVendor.set(row.vendorId, counts);
  }
  const prepByVendor = new Map<string, number[]>();
  for (const item of items) {
    prepByVendor.set(item.vendorId, [
      ...(prepByVendor.get(item.vendorId) ?? []),
      item.prepPriorMin,
    ]);
  }

  const today = hktDate(now);
  const tomorrow = hktDate(hktMidnight(today) + MS_PER_DAY);

  const records = vendors.map((vendor): VendorRecord => {
    const hours = openingHoursSchema.parse(vendor.openingHours);
    const ranges = openRangesOn(hours, today, holidays);
    const openNow = isOpenAt(ranges, now);
    const waitState: VendorWaitState | undefined = waits.get(vendor.id);
    const origin = state?.originBuildingId ?? null;
    const originWalk = origin === null ? undefined : walk.get(`${origin}|${vendor.id}`);
    const nextWalk =
      nextBuildingId === null ? undefined : walk.get(`${nextBuildingId}|${vendor.id}`);
    const referencePrep = median(prepByVendor.get(vendor.id) ?? [SLOT_MINUTES / 3]);
    const wait = estimateWait(waitState, now, referencePrep);

    let slots: PickupSlot[] = [];
    if (state !== null && !state.schedule.freeNow) {
      const cap = defaultSlotCap(waitState?.payload?.mu.perMinute ?? MU_FLOOR_PER_MINUTE);
      slots = slotGrid({
        ranges: [...ranges, ...openRangesOn(hours, tomorrow, holidays)],
        from: now,
        horizonSlots: SLOT_HORIZON,
        cap,
        bookedBySlotStart: bookedByVendor.get(vendor.id) ?? new Map<number, number>(),
      });
    }

    return {
      id: vendor.id,
      name: vendor.name,
      campus: vendor.campus,
      floor: vendor.floor,
      pickupEnabled: vendor.pickupEnabled,
      paused: vendor.paused,
      busyState: vendor.busyState,
      busyUntil: vendor.busyUntil,
      building: vendor.building,
      openNow,
      hoursToday: ranges.map((range) => ({
        open: formatHktTime(range.openAt),
        close: formatHktTime(range.closeAt),
      })),
      walk: originWalk ? { minutes: originWalk.minutes, source: originWalk.source } : null,
      wait,
      forMenu: {
        id: vendor.id,
        name: vendor.name,
        openNow,
        orderable: vendor.pickupEnabled && !vendor.paused,
        walkFromOriginMinutes: originWalk?.minutes ?? null,
        walkToNextClassMinutes: nextWalk?.minutes ?? null,
        wait: waitState,
        slots,
      },
    };
  });
  return { vendors: records, items };
}
