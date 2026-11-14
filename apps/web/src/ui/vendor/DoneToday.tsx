import { formatHktTime } from '@app/core';
import type { DoneOrderView } from '../../server/vendorService';

const STATUS_TEXT = { ready: 'Waiting for pickup', completed: 'Completed' } as const;

export function DoneToday({ orders }: { orders: readonly DoneOrderView[] }): React.JSX.Element {
  return (
    <section aria-label="Done today" data-done-today className="space-y-3">
      <h2 className="text-sm font-semibold">Done today ({orders.length})</h2>
      {orders.length === 0 ? (
        <p className="text-sm text-muted">Orders you mark ready appear here.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => (
            <li
              key={order.id}
              data-done-order={order.id}
              data-done-status={order.status}
              className="rounded-md border border-navy/15 bg-white p-3"
            >
              <p className="text-sm font-medium">
                {order.items.map((item) => `${item.qty} × ${item.name}`).join(', ')}
              </p>
              <p className="mt-1 text-xs text-muted">
                Ready {formatHktTime(order.readyAt)} · HK${order.totalHkd}
              </p>
              <p className="mt-2 text-xs font-semibold">{STATUS_TEXT[order.status]}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
