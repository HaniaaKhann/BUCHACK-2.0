import { loadMenu } from '@/server/menuService';
import { requireRole } from '@/server/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const guard = await requireRole(request, ['student']);
  if (!guard.ok) return guard.response;

  const result = await loadMenu(guard.value.userId, new URL(request.url).searchParams);
  return Response.json(result.body, { status: result.status });
}
