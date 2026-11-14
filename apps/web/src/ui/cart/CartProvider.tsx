'use client';

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import { EMPTY_CART, cartReducer, type CartAction, type CartState } from './cartReducer';

interface CartContextValue {
  state: CartState;
  dispatch: Dispatch<CartAction>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  children,
  initial = EMPTY_CART,
}: {
  children: ReactNode;
  initial?: CartState;
}): React.JSX.Element {
  const [state, dispatch] = useReducer(cartReducer, initial);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (value === null) throw new Error('useCart needs a CartProvider');
  return value;
}
