import { ACTIVE_VENDOR_WHERE } from '@app/db';
import { prisma } from '@/server/db';
import { requireRole } from '@/server/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const guard = await requireRole(request, ['student']);
  if (!guard.ok) return guard.response;

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
    },
  });
  return Response.json({ vendors });
}
