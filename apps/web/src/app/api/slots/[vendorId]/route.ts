import { ORDER_MAX_LINES, ORDER_MAX_QTY_PER_LINE } from '@app/core';
import { z } from 'zod';
import { slotsView } from '@/server/orderService';
import { requireRole } from '@/server/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ vendorId: z.string().uuid() });
const entrySchema = z.tuple([
  z.string().uuid(),
  z.coerce.number().int().min(1).max(ORDER_MAX_QTY_PER_LINE),
]);

function parseItems(value: string | null): Map<string, number> | null {
  if (value === null || value === '') return new Map();
  const parts = value.split(',');
  if (parts.length > ORDER_MAX_LINES) return null;
  const entries: [string, number][] = [];
  for (const part of parts) {
    const parsed = entrySchema.safeParse(part.split(':'));
    if (!parsed.success) return null;
    entries.push(parsed.data);
  }
  return new Map(entries);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ vendorId: string }> },
): Promise<Response> {
  const guard = await requireRole(request, ['student']);
  if (!guard.ok) return guard.response;

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return Response.json({ error: 'invalid vendor id' }, { status: 400 });
  const quantities = parseItems(new URL(request.url).searchParams.get('items'));
  if (quantities === null) return Response.json({ error: 'invalid items' }, { status: 400 });

  const view = await slotsView(params.data.vendorId, quantities);
  if (view === null) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(view);
}
