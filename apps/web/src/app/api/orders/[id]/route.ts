import { z } from 'zod';
import { getOrder } from '@/server/orderService';
import { requireRole } from '@/server/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireRole(request, ['student']);
  if (!guard.ok) return guard.response;

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return Response.json({ error: 'invalid order id' }, { status: 400 });

  const order = await getOrder(guard.value.userId, params.data.id);
  if (order === null) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json({ order });
}
