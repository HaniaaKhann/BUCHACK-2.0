import { prisma } from './db';
import type { PageActor } from './session';

export interface VendorContext {
  vendorId: string;
  memberRole: 'owner' | 'staff';
}

export async function getVendorContext(actor: PageActor): Promise<VendorContext | null> {
  if (actor.role !== 'vendor_owner' && actor.role !== 'vendor_staff') return null;
  const member = await prisma.vendorMember.findFirst({
    where: { userId: actor.userId },
    orderBy: { vendorId: 'asc' },
    select: { vendorId: true, role: true },
  });
  return member === null ? null : { vendorId: member.vendorId, memberRole: member.role };
}
