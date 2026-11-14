import { z } from 'zod';
import { listNotifications, markNotificationsRead } from '@/server/notificationService';
import { requireRole } from '@/server/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.union([
  z.object({ all: z.literal(true) }).strict(),
  z.object({ ids: z.array(z.string().uuid()).min(1).max(50) }).strict(),
]);

export async function GET(request: Request): Promise<Response> {
  const guard = await requireRole(request, ['student']);
  if (!guard.ok) return guard.response;
  return Response.json(await listNotifications(guard.value.userId));
}

export async function PATCH(request: Request): Promise<Response> {
  const guard = await requireRole(request, ['student']);
  if (!guard.ok) return guard.response;

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: 'invalid_request' }, { status: 400 });

  const marked = await markNotificationsRead(guard.value.userId, body.data);
  return Response.json({ marked, ...(await listNotifications(guard.value.userId)) });
}
