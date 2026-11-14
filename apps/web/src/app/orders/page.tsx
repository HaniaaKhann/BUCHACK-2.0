import { formatHktTime } from '@app/core';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listOrders, walletView } from '@/server/orderService';
import { getPageActor } from '@/server/session';
import { STATUS_LABELS, formatHkd } from '@/ui/orders/orderViewModel';

export const dynamic = 'force-dynamic';

export default async function OrdersPage(): Promise<React.JSX.Element> {
  const actor = await getPageActor();
  if (!actor) redirect('/sign-in');
  if (actor.role !== 'student') redirect('/');

  const [orders, wallet] = await Promise.all([listOrders(actor.userId), walletView(actor.userId)]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="text-sm font-medium underline">
            Back to food
          </Link>
          <p className="text-sm">
            Wallet (demo money){' '}
            <span className="font-semibold" data-wallet-balance>
              {formatHkd(wallet.balanceHkd)}
            </span>
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:py-6">
        <h1 className="text-xl font-semibold">My orders</h1>
        {orders.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-700">
            You have not ordered yet.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex flex-col gap-1 rounded-xl border border-neutral-200 bg-white p-4 hover:border-neutral-400"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{order.vendor.name}</span>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium">
                      {STATUS_LABELS[order.status]}
                    </span>
                  </span>
                  <span className="text-sm text-neutral-700">
                    {order.items.map((item) => `${item.qty} × ${item.name}`).join(', ')}
                  </span>
                  <span className="flex justify-between text-sm text-neutral-600">
                    <span>Placed {formatHktTime(order.placedAt)}</span>
                    <span className="font-medium text-neutral-900">
                      {formatHkd(order.totalHkd)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
