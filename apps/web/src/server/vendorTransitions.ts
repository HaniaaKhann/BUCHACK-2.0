export type VendorOrderStatus = 'placed' | 'accepted' | 'preparing' | 'ready' | 'picked_up';

export type VendorAction = 'accept' | 'preparing' | 'ready' | 'picked-up';

export const VENDOR_ACTIONS: readonly VendorAction[] = [
  'accept',
  'preparing',
  'ready',
  'picked-up',
];

interface Transition {
  from: VendorOrderStatus;
  to: VendorOrderStatus;
  label: string;
}

export const VENDOR_TRANSITIONS: Record<VendorAction, Transition> = {
  accept: { from: 'placed', to: 'accepted', label: 'Accept' },
  preparing: { from: 'accepted', to: 'preparing', label: 'Start preparing' },
  ready: { from: 'preparing', to: 'ready', label: 'Mark ready' },
  'picked-up': { from: 'ready', to: 'picked_up', label: 'Picked up' },
};

export function actionFor(status: VendorOrderStatus): VendorAction | null {
  return VENDOR_ACTIONS.find((action) => VENDOR_TRANSITIONS[action].from === status) ?? null;
}

export type TransitionCheck = 'apply' | 'already_done' | 'wrong_state';

export function checkTransition(action: VendorAction, status: string): TransitionCheck {
  const transition = VENDOR_TRANSITIONS[action];
  if (status === transition.from) return 'apply';
  if (status === transition.to) return 'already_done';
  return 'wrong_state';
}
