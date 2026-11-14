import { prisma } from '@/server/db';
import { requireRole } from '@/server/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const guard = await requireRole(request, ['student']);
  if (!guard.ok) return guard.response;

  const buildings = await prisma.building.findMany({
    orderBy: [{ campus: 'asc' }, { name: 'asc' }],
    select: { id: true, campus: true, name: true, code: true },
  });
  return Response.json({ buildings });
}
