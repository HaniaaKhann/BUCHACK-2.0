import { badRequest, readJson } from '@/server/http';
import { orderErrorResponse } from '@/server/orderHttp';
import { placeOrderSchema } from '@/server/orderInput';
import { listOrders, placeOrder } from '@/server/orderService';
import { requireRole } from '@/server/rbac';
import { createTokenBuckets, type TokenBuckets } from '@/server/tokenBucket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORDERS_PER_MINUTE = 5;

const globalForBuckets = globalThis as unknown as { orderBuckets?: TokenBuckets };
globalForBuckets.orderBuckets ??= createTokenBuckets({
  capacity: ORDERS_PER_MINUTE,
  refillPerSecond: ORDERS_PER_MINUTE / 60,
});

export async function POST(request: Request): Promise<Response> {
  const guard = await requireRole(request, ['student']);
  if (!guard.ok) return guard.response;

  if (!globalForBuckets.orderBuckets?.take(guard.value.userId, Date.now())) {
    return Response.json({ error: 'rate_limited' }, { status: 429 });
  }

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = placeOrderSchema.safeParse(body.value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return badRequest(`${issue?.path.join('.')}: ${issue?.message}`);
  }

  try {
    const order = await placeOrder(guard.value.userId, parsed.data);
    return Response.json({ order }, { status: 201 });
  } catch (error) {
    return orderErrorResponse(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  const guard = await requireRole(request, ['student']);
  if (!guard.ok) return guard.response;
  return Response.json({ orders: await listOrders(guard.value.userId) });
}
