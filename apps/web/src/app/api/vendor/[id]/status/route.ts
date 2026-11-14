import { z } from 'zod';
import { requireVendorAccess } from '@/server/rbac';
import { vendorStatus } from '@/server/vendorControls';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return Response.json({ error: 'invalid_request' }, { status: 400 });

  const guard = await requireVendorAccess(request, params.data.id);
  if (!guard.ok) return guard.response;

  const status = await vendorStatus(params.data.id);
  if (status === null) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json({ status });
}
