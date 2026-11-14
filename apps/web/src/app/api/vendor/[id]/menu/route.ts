import { z } from 'zod';
import { newMenuItemSchema } from '@/server/menuInput';
import { orderErrorResponse } from '@/server/orderHttp';
import { requireVendorAccess } from '@/server/rbac';
import { createMenuItem, listVendorMenu } from '@/server/vendorControls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return Response.json({ error: 'invalid_request' }, { status: 400 });

  const guard = await requireVendorAccess(request, params.data.id);
  if (!guard.ok) return guard.response;
  return Response.json({ items: await listVendorMenu(params.data.id) });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return Response.json({ error: 'invalid_request' }, { status: 400 });

  const guard = await requireVendorAccess(request, params.data.id, { ownerOnly: true });
  if (!guard.ok) return guard.response;

  const body = newMenuItemSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: 'invalid_request' }, { status: 400 });

  try {
    return Response.json(
      { item: await createMenuItem(params.data.id, body.data) },
      { status: 201 },
    );
  } catch (error) {
    return orderErrorResponse(error);
  }
}
