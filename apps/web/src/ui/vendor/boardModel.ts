import type { VendorOrderView } from '../../server/vendorService';
import {
  VENDOR_TRANSITIONS,
  actionFor,
  type VendorAction,
  type VendorOrderStatus,
} from '../../server/vendorTransitions';

export interface BoardColumn {
  status: VendorOrderStatus;
  title: string;
  action: VendorAction;
  actionLabel: string;
  orders: VendorOrderView[];
}

const COLUMNS: { status: VendorOrderStatus; title: string }[] = [
  { status: 'placed', title: 'New' },
  { status: 'accepted', title: 'Accepted' },
  { status: 'preparing', title: 'Preparing' },
  { status: 'ready', title: 'Ready' },
];

export function boardColumns(orders: readonly VendorOrderView[]): BoardColumn[] {
  return COLUMNS.map(({ status, title }) => {
    const action = actionFor(status);
    if (action === null) throw new Error(`no action for ${status}`);
    return {
      status,
      title,
      action,
      actionLabel: VENDOR_TRANSITIONS[action].label,
      orders: orders.filter((order) => order.status === status),
    };
  });
}

export function newOrderIds(
  seen: ReadonlySet<string>,
  orders: readonly VendorOrderView[],
): string[] {
  return orders
    .filter((order) => order.status === 'placed' && !seen.has(order.id))
    .map((order) => order.id);
}
