import type { PrismaClient } from '@prisma/client';
import { DEMO_ACCOUNTS } from './accounts.js';

export const DEMO_VERIFIED_VENDOR_NAMES: readonly string[] = [
  'Bistro NTT',
  'Main Canteen',
  'Harmony Cafeteria',
];

export async function verifyDemoMenus(db: PrismaClient): Promise<void> {
  const owner = DEMO_ACCOUNTS.find((account) => account.role === 'vendor_owner');
  if (owner === undefined) return;
  const vendors = await db.vendor.findMany({
    where: { name: { in: [...DEMO_VERIFIED_VENDOR_NAMES] } },
    select: { id: true },
  });
  await db.menuItem.updateMany({
    where: { vendorId: { in: vendors.map((vendor) => vendor.id) }, tagsStatus: 'unverified' },
    data: { tagsStatus: 'verified', tagsVerifiedBy: owner.id, tagsVerifiedAt: new Date() },
  });
}
