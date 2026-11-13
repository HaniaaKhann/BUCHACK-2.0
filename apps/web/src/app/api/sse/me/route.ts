import { studentFilter } from '@/server/events/eventHub';
import { ensureEventListener, getConnectionRegistry, getEventHub } from '@/server/events/runtime';
import { openEventStream } from '@/server/events/sseStream';
import { requireRole } from '@/server/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const guard = await requireRole(request, ['student']);
  if (!guard.ok) return guard.response;

  ensureEventListener();
  return openEventStream({
    request,
    userId: guard.value.userId,
    filter: studentFilter(guard.value.userId),
    hub: getEventHub(),
    registry: getConnectionRegistry(),
  });
}
