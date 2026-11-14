import { z } from 'zod';
import { menuItemEditSchema } from '@/server/menuInput';
import { orderErrorResponse } from '@/server/orderHttp';
import { requireVendorAccess } from '@/server/rbac';
import { updateMenuItem } from '@/server/vendorControls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: z.string().uuid(), itemId: z.string().uuid() });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; itemId: string }> },
): Promise<Response> {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return Response.json({ error: 'invalid_request' }, { status: 400 });

  const guard = await requireVendorAccess(request, params.data.id, { ownerOnly: true });
  if (!guard.ok) return guard.response;

  const body = menuItemEditSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: 'invalid_request' }, { status: 400 });

  try {
    return Response.json({
      item: await updateMenuItem(params.data.id, params.data.itemId, body.data),
    });
  } catch (error) {
    return orderErrorResponse(error);
  }
}
