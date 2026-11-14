import { z } from 'zod';
import { orderErrorResponse } from '@/server/orderHttp';
import { requireVendorAccess } from '@/server/rbac';
import { setStock } from '@/server/vendorControls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: z.string().uuid(), itemId: z.string().uuid() });
const bodySchema = z.object({ inStock: z.boolean() }).strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; itemId: string }> },
): Promise<Response> {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return Response.json({ error: 'invalid_request' }, { status: 400 });

  const guard = await requireVendorAccess(request, params.data.id);
  if (!guard.ok) return guard.response;

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: 'invalid_request' }, { status: 400 });

  try {
    await setStock(params.data.id, params.data.itemId, body.data.inStock);
    return Response.json({ inStock: body.data.inStock });
  } catch (error) {
    return orderErrorResponse(error);
  }
}
