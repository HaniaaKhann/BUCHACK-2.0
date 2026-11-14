import { z } from 'zod';
import { orderErrorResponse } from '@/server/orderHttp';
import { requireVendorAccess } from '@/server/rbac';
import { transitionVendorOrder } from '@/server/vendorService';
import { VENDOR_ACTIONS } from '@/server/vendorTransitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  action: z.enum(VENDOR_ACTIONS as [string, ...string[]]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; orderId: string; action: string }> },
): Promise<Response> {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return Response.json({ error: 'invalid_request' }, { status: 400 });

  const guard = await requireVendorAccess(request, params.data.id);
  if (!guard.ok) return guard.response;

  try {
    const result = await transitionVendorOrder(
      params.data.id,
      params.data.orderId,
      params.data.action as (typeof VENDOR_ACTIONS)[number],
    );
    return Response.json(result);
  } catch (error) {
    return orderErrorResponse(error);
  }
}
