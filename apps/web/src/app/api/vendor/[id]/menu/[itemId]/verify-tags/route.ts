import { DATA_ALLERGENS, DATA_DIET_TAGS } from '@app/core';
import { z } from 'zod';
import { orderErrorResponse } from '@/server/orderHttp';
import { requireVendorAccess } from '@/server/rbac';
import { verifyTags } from '@/server/vendorControls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: z.string().uuid(), itemId: z.string().uuid() });

const dietIds = DATA_DIET_TAGS.map((tag) => tag.id) as [string, ...string[]];
const allergenIds = DATA_ALLERGENS.map((allergen) => allergen.id) as [string, ...string[]];

const bodySchema = z
  .object({
    dietTags: z.array(z.enum(dietIds)).max(dietIds.length),
    allergens: z.array(z.enum(allergenIds)).max(allergenIds.length),
  })
  .strict()
  .optional();

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; itemId: string }> },
): Promise<Response> {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return Response.json({ error: 'invalid_request' }, { status: 400 });

  const guard = await requireVendorAccess(request, params.data.id, { ownerOnly: true });
  if (!guard.ok) return guard.response;

  const text = await request.text();
  const body = bodySchema.safeParse(text === '' ? undefined : parseJson(text));
  if (!body.success) return Response.json({ error: 'invalid_request' }, { status: 400 });

  try {
    await verifyTags(params.data.id, params.data.itemId, guard.value.userId, body.data);
    return Response.json({ tagsVerified: true });
  } catch (error) {
    return orderErrorResponse(error);
  }
}
