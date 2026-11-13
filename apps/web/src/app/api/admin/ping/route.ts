import { requireRole } from '@/server/rbac';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const guard = await requireRole(request, ['admin']);
  if (!guard.ok) return guard.response;
  return Response.json({ ok: true });
}
