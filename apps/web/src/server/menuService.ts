import { prisma } from './db';
import { getClockNowMs } from './clock';
import { buildMenuView, type MenuItemView, type MenuViewMeta } from './menuView';
import { parseMenuQuery, resolveMenuQuery } from './menuQuery';
import { loadStudentState, loadVendorRecords } from './studentData';

export interface MenuResponse {
  items: MenuItemView[];
  meta: MenuViewMeta & { needsBuilding: boolean };
}

export type MenuResult =
  | { status: 200; body: MenuResponse }
  | { status: 400 | 409; body: { error: string } };

export async function loadMenu(userId: string, params: URLSearchParams): Promise<MenuResult> {
  const query = parseMenuQuery(params);
  if (!query.ok) return { status: 400, body: { error: query.error } };

  const now = await getClockNowMs();
  const state = await loadStudentState(userId, now);
  if (state === null) return { status: 409, body: { error: 'onboarding_required' } };

  const [{ vendors, items }, pastRows] = await Promise.all([
    loadVendorRecords(state, now),
    prisma.orderItem.groupBy({
      by: ['menuItemId'],
      where: { order: { studentId: userId, status: { not: 'cancelled' } } },
      _count: { _all: true },
    }),
  ]);

  const view = buildMenuView({
    now,
    schedule: state.schedule,
    originKnown: state.originBuildingId !== null,
    eatMinutes: state.profile.eatMinutes,
    vendors: vendors.map((vendor) => vendor.forMenu),
    items,
    pastOrderCounts: new Map(pastRows.map((row) => [row.menuItemId, row._count._all])),
    query: resolveMenuQuery(query.value, state.profile),
  });
  return {
    status: 200,
    body: {
      items: view.items,
      meta: { ...view.meta, needsBuilding: state.originBuildingId === null },
    },
  };
}

export interface VendorListItem {
  id: string;
  name: string;
  campus: string;
  floor: string;
  building: { id: string; name: string; code: string | null };
  pickupEnabled: boolean;
  paused: boolean;
  busyState: 'quiet' | 'normal' | 'rush';
  busyUntil: number | null;
  openNow: boolean;
  hoursToday: { open: string; close: string }[];
  walk: { minutes: number; source: 'estimate' | 'measured' } | null;
  wait: {
    lowMinutes: number;
    highMinutes: number;
    source: 'live' | 'stale' | 'cold';
    stale: boolean;
  };
}

export interface VendorListResponse {
  now: number;
  vendors: VendorListItem[];
}

export async function loadVendorList(userId: string): Promise<VendorListResponse> {
  const now = await getClockNowMs();
  const state = await loadStudentState(userId, now);
  const { vendors } = await loadVendorRecords(state, now);
  return {
    now,
    vendors: vendors.map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      campus: vendor.campus,
      floor: vendor.floor,
      building: vendor.building,
      pickupEnabled: vendor.pickupEnabled,
      paused: vendor.paused,
      busyState: vendor.busyState,
      busyUntil: vendor.busyUntil?.getTime() ?? null,
      openNow: vendor.openNow,
      hoursToday: vendor.hoursToday,
      walk: vendor.walk,
      wait: {
        lowMinutes: vendor.wait.lowMinutes,
        highMinutes: vendor.wait.highMinutes,
        source: vendor.wait.source,
        stale: vendor.wait.source === 'stale',
      },
    })),
  };
}
