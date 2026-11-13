import { requireRole } from '@/server/rbac';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const guard = await requireRole(request, ['student']);
  if (!guard.ok) return guard.response;
  return Response.json({ userId: guard.value.userId, email: guard.value.email });
}

export async function DELETE(request: Request): Promise<Response> {
  const guard = await requireRole(request, ['student']);
  if (!guard.ok) return guard.response;
  return Response.json({ error: 'use POST /api/auth/delete-user' }, { status: 501 });
}
