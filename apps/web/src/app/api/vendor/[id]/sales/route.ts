import { z } from 'zod';
import { requireVendorAccess } from '@/server/rbac';
import { loadSalesView } from '@/server/salesService';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: z.string().uuid() });
const querySchema = z.object({ range: z.enum(['today', '7d']).default('today') });

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return Response.json({ error: 'invalid vendor id' }, { status: 400 });

  const guard = await requireVendorAccess(request, params.data.id, { ownerOnly: true });
  if (!guard.ok) return guard.response;

  const query = querySchema.safeParse({
    range: new URL(request.url).searchParams.get('range') ?? undefined,
  });
  if (!query.success) return Response.json({ error: 'invalid range' }, { status: 400 });

  return Response.json(await loadSalesView(params.data.id, query.data.range));
}
