import { ORDER_MAX_LINES, ORDER_MAX_QTY_PER_LINE } from '@app/core';

export interface CartLine {
  menuItemId: string;
  name: string;
  priceHkd: number;
  qty: number;
}

export interface CartState {
  vendorId: string | null;
  vendorName: string | null;
  lines: CartLine[];
}

export const EMPTY_CART: CartState = { vendorId: null, vendorName: null, lines: [] };

export type CartAction =
  | { type: 'add'; vendor: { id: string; name: string }; line: Omit<CartLine, 'qty'> }
  | { type: 'replace'; vendor: { id: string; name: string }; line: Omit<CartLine, 'qty'> }
  | { type: 'setQty'; menuItemId: string; qty: number }
  | { type: 'remove'; menuItemId: string }
  | { type: 'clear' };

export function conflictsWithCart(state: CartState, vendorId: string): boolean {
  return state.lines.length > 0 && state.vendorId !== vendorId;
}

function withLine(
  state: CartState,
  vendor: { id: string; name: string },
  line: Omit<CartLine, 'qty'>,
): CartState {
  const existing = state.lines.find((entry) => entry.menuItemId === line.menuItemId);
  if (existing) {
    return {
      ...state,
      lines: state.lines.map((entry) =>
        entry.menuItemId === line.menuItemId
          ? { ...entry, qty: Math.min(ORDER_MAX_QTY_PER_LINE, entry.qty + 1) }
          : entry,
      ),
    };
  }
  if (state.lines.length >= ORDER_MAX_LINES) return state;
  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    lines: [...state.lines, { ...line, qty: 1 }],
  };
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add':
      return conflictsWithCart(state, action.vendor.id)
        ? state
        : withLine(state, action.vendor, action.line);
    case 'replace':
      return withLine(EMPTY_CART, action.vendor, action.line);
    case 'setQty':
      if (action.qty <= 0) {
        return cartReducer(state, { type: 'remove', menuItemId: action.menuItemId });
      }
      return {
        ...state,
        lines: state.lines.map((line) =>
          line.menuItemId === action.menuItemId
            ? { ...line, qty: Math.min(ORDER_MAX_QTY_PER_LINE, action.qty) }
            : line,
        ),
      };
    case 'remove': {
      const lines = state.lines.filter((line) => line.menuItemId !== action.menuItemId);
      return lines.length === 0 ? EMPTY_CART : { ...state, lines };
    }
    case 'clear':
      return EMPTY_CART;
  }
}

export function cartTotal(state: CartState): number {
  return state.lines.reduce((sum, line) => sum + line.priceHkd * line.qty, 0);
}

export function cartCount(state: CartState): number {
  return state.lines.reduce((sum, line) => sum + line.qty, 0);
}

export type PickupChoice = { kind: 'asap' } | { kind: 'scheduled'; slotStart: number };

export function toOrderRequest(
  state: CartState,
  pickup: PickupChoice,
): { vendorId: string; items: { menuItemId: string; qty: number }[]; pickup: PickupChoice } | null {
  if (state.vendorId === null || state.lines.length === 0) return null;
  return {
    vendorId: state.vendorId,
    items: state.lines.map((line) => ({ menuItemId: line.menuItemId, qty: line.qty })),
    pickup,
  };
}
