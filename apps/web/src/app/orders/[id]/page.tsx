import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { getOrder } from '@/server/orderService';
import { getPageActor } from '@/server/session';
import { OrderTracker } from '@/ui/orders/OrderTracker';

export const dynamic = 'force-dynamic';

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const actor = await getPageActor();
  if (!actor) redirect('/sign-in');
  if (actor.role !== 'student') redirect('/');

  const id = z
    .string()
    .uuid()
    .safeParse((await params).id);
  if (!id.success) notFound();
  const order = await getOrder(actor.userId, id.data);
  if (order === null) notFound();
  return <OrderTracker initial={order} />;
}
