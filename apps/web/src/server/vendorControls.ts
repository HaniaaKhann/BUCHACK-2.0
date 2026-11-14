import { MS_PER_MINUTE, median, type BusyState } from '@app/core';
import { getClockNowMs } from './clock';
import { prisma } from './db';
import { notifyVendorChanged } from './notify';
import type { MenuItemEdit, NewMenuItem } from './menuInput';
import { OrderError } from './orderErrors';

export const RUSH_MINUTES = 30;

export interface VendorStatusView {
  name: string;
  paused: boolean;
  busyState: BusyState;
  busyUntil: number | null;
  now: number;
}

export async function vendorStatus(vendorId: string): Promise<VendorStatusView | null> {
  const [vendor, now] = await Promise.all([
    prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { name: true, paused: true, busyState: true, busyUntil: true },
    }),
    getClockNowMs(),
  ]);
  if (vendor === null) return null;
  return {
    name: vendor.name,
    paused: vendor.paused,
    busyState: vendor.busyState,
    busyUntil: vendor.busyUntil?.getTime() ?? null,
    now,
  };
}

export async function setBusyState(vendorId: string, state: BusyState): Promise<void> {
  const now = await getClockNowMs();
  const expiresAt = state === 'rush' ? new Date(now + RUSH_MINUTES * MS_PER_MINUTE) : null;
  await prisma.$transaction([
    prisma.vendor.update({
      where: { id: vendorId },
      data: { busyState: state, busyUntil: expiresAt },
    }),
    prisma.busyEvent.create({ data: { vendorId, state, setAt: new Date(now), expiresAt } }),
  ]);
  await notifyVendorChanged(vendorId);
}

export async function setPaused(vendorId: string, paused: boolean): Promise<void> {
  await prisma.vendor.update({ where: { id: vendorId }, data: { paused } });
  await notifyVendorChanged(vendorId);
}

export interface VendorMenuItemView {
  id: string;
  name: string;
  priceHkd: number;
  category: string;
  inStock: boolean;
  dietTags: string[];
  allergens: string[];
  tagsVerified: boolean;
}

const menuSelect = {
  id: true,
  name: true,
  priceHkd: true,
  category: true,
  stockStatus: true,
  dietTags: true,
  allergens: true,
  tagsStatus: true,
} as const;

interface MenuRow {
  id: string;
  name: string;
  priceHkd: number;
  category: string;
  stockStatus: 'in_stock' | 'out_of_stock';
  dietTags: string[];
  allergens: string[];
  tagsStatus: 'verified' | 'unverified';
}

function toMenuView(row: MenuRow): VendorMenuItemView {
  return {
    id: row.id,
    name: row.name,
    priceHkd: row.priceHkd,
    category: row.category,
    inStock: row.stockStatus === 'in_stock',
    dietTags: row.dietTags,
    allergens: row.allergens,
    tagsVerified: row.tagsStatus === 'verified',
  };
}

export async function listVendorMenu(vendorId: string): Promise<VendorMenuItemView[]> {
  const rows = await prisma.menuItem.findMany({
    where: { vendorId, deletedAt: null },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    select: menuSelect,
  });
  return rows.map(toMenuView);
}

const DEFAULT_PREP_MINUTES = 5;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export async function createMenuItem(
  vendorId: string,
  input: NewMenuItem,
): Promise<VendorMenuItemView> {
  const existing = await prisma.menuItem.findMany({
    where: { vendorId, deletedAt: null },
    select: { prepPriorMin: true },
  });
  const prepPriorMin =
    existing.length > 0 ? median(existing.map((item) => item.prepPriorMin)) : DEFAULT_PREP_MINUTES;
  try {
    const row = await prisma.menuItem.create({
      data: {
        vendorId,
        name: input.name,
        priceHkd: input.priceHkd,
        category: input.category,
        dietTags: [],
        allergens: [],
        tagsStatus: 'unverified',
        prepPriorMin,
        stockStatus: 'in_stock',
        isDemo: false,
      },
      select: menuSelect,
    });
    await notifyVendorChanged(vendorId);
    return toMenuView(row);
  } catch (error) {
    if (isUniqueViolation(error)) throw new OrderError(409, 'name_taken');
    throw error;
  }
}

export async function updateMenuItem(
  vendorId: string,
  itemId: string,
  edit: MenuItemEdit,
): Promise<VendorMenuItemView> {
  const current = await prisma.menuItem.findFirst({
    where: { id: itemId, vendorId, deletedAt: null },
    select: { name: true },
  });
  if (current === null) throw new OrderError(404, 'not_found');
  const renamed = edit.name !== undefined && edit.name !== current.name;
  try {
    const row = await prisma.menuItem.update({
      where: { id: itemId },
      data: {
        ...(edit.name === undefined ? {} : { name: edit.name }),
        ...(edit.priceHkd === undefined ? {} : { priceHkd: edit.priceHkd }),
        ...(edit.category === undefined ? {} : { category: edit.category }),
        ...(renamed
          ? { tagsStatus: 'unverified', tagsVerifiedBy: null, tagsVerifiedAt: null }
          : {}),
      },
      select: menuSelect,
    });
    await notifyVendorChanged(vendorId);
    return toMenuView(row);
  } catch (error) {
    if (isUniqueViolation(error)) throw new OrderError(409, 'name_taken');
    throw error;
  }
}

export async function setStock(vendorId: string, itemId: string, inStock: boolean): Promise<void> {
  const result = await prisma.menuItem.updateMany({
    where: { id: itemId, vendorId, deletedAt: null },
    data: { stockStatus: inStock ? 'in_stock' : 'out_of_stock' },
  });
  if (result.count === 0) throw new OrderError(404, 'not_found');
  await notifyVendorChanged(vendorId);
}

export interface TagEdit {
  dietTags: string[];
  allergens: string[];
}

export async function verifyTags(
  vendorId: string,
  itemId: string,
  ownerId: string,
  edit: TagEdit | undefined,
): Promise<void> {
  const now = new Date(await getClockNowMs());
  const result = await prisma.menuItem.updateMany({
    where: { id: itemId, vendorId, deletedAt: null },
    data: {
      ...(edit ? { dietTags: edit.dietTags, allergens: edit.allergens } : {}),
      tagsStatus: 'verified',
      tagsVerifiedBy: ownerId,
      tagsVerifiedAt: now,
    },
  });
  if (result.count === 0) throw new OrderError(404, 'not_found');
  await notifyVendorChanged(vendorId);
}
