import { z } from 'zod';
import { orderErrorResponse } from '@/server/orderHttp';
import { cancelOrder } from '@/server/orderService';
import { requireRole } from '@/server/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireRole(request, ['student']);
  if (!guard.ok) return guard.response;

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return Response.json({ error: 'invalid order id' }, { status: 400 });

  try {
    return Response.json({ order: await cancelOrder(guard.value.userId, params.data.id) });
  } catch (error) {
    return orderErrorResponse(error);
  }
}
