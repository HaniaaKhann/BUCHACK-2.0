import { z } from 'zod';
import { requireVendorAccess } from '@/server/rbac';
import { setBusyState } from '@/server/vendorControls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({ state: z.enum(['quiet', 'normal', 'rush']) }).strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return Response.json({ error: 'invalid_request' }, { status: 400 });

  const guard = await requireVendorAccess(request, params.data.id);
  if (!guard.ok) return guard.response;

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: 'invalid_request' }, { status: 400 });

  await setBusyState(params.data.id, body.data.state);
  return Response.json({ state: body.data.state });
}
