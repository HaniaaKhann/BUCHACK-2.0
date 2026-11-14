import { formatHktTime } from '@app/core';
import type { VendorOrderView } from '../../server/vendorService';
import type { VendorAction } from '../../server/vendorTransitions';
import { Button } from '../primitives';
import { boardColumns } from './boardModel';

interface BoardColumnsProps {
  orders: readonly VendorOrderView[];
  pendingId: string | null;
  onAction: (orderId: string, action: VendorAction) => void;
}

export function BoardColumns({
  orders,
  pendingId,
  onAction,
}: BoardColumnsProps): React.JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {boardColumns(orders).map((column) => (
        <section key={column.status} aria-label={column.title} className="space-y-3">
          <h2 className="text-sm font-semibold">
            {column.title} ({column.orders.length})
          </h2>
          {column.orders.map((order) => (
            <article key={order.id} className="rounded-md border border-neutral-200 bg-white p-3">
              <p className="text-sm font-medium">
                {order.items.map((item) => `${item.qty} × ${item.name}`).join(', ')}
              </p>
              <p className="mt-1 text-xs text-neutral-600" data-order-timing>
                {order.slotStart === null
                  ? `ASAP, placed ${formatHktTime(order.placedAt)}`
                  : `Scheduled for ${formatHktTime(order.slotStart)}${
                      order.fireAt === null ? '' : `, start by ${formatHktTime(order.fireAt)}`
                    }`}
              </p>
              <Button
                type="button"
                className="mt-3 w-full"
                data-action={column.action}
                disabled={pendingId === order.id}
                onClick={() => onAction(order.id, column.action)}
              >
                {column.actionLabel}
              </Button>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
