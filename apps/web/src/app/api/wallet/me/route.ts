import { requireRole } from '@/server/rbac';
import { walletView } from '@/server/orderService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const guard = await requireRole(request, ['student']);
  if (!guard.ok) return guard.response;
  return Response.json(await walletView(guard.value.userId));
}
