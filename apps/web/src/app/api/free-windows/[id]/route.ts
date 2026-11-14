import { z } from 'zod';
import { prisma } from '@/server/db';
import { requireRole } from '@/server/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireRole(request, ['student']);
  if (!guard.ok) return guard.response;

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return Response.json({ error: 'invalid window id' }, { status: 400 });

  const removed = await prisma.freeWindow.deleteMany({
    where: { id: params.data.id, userId: guard.value.userId },
  });
  if (removed.count === 0) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ deleted: params.data.id });
}
