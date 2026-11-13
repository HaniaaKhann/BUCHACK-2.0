import { z } from 'zod';
import { vendorFilter } from '@/server/events/eventHub';
import { ensureEventListener, getConnectionRegistry, getEventHub } from '@/server/events/runtime';
import { openEventStream } from '@/server/events/sseStream';
import { requireVendorAccess } from '@/server/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return Response.json({ error: 'invalid vendor id' }, { status: 400 });

  const guard = await requireVendorAccess(request, params.data.id);
  if (!guard.ok) return guard.response;

  ensureEventListener();
  return openEventStream({
    request,
    userId: guard.value.userId,
    filter: vendorFilter(params.data.id),
    hub: getEventHub(),
    registry: getConnectionRegistry(),
  });
}
