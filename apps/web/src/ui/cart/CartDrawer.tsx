'use client';

import { formatHktTime } from '@app/core';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { SlotsView, WalletView } from '@/server/orderService';
import { formatHkd, orderErrorMessage, type ErrorBody } from '../orders/orderViewModel';
import { Button, ErrorNote, ToggleChip } from '../primitives';
import { cartCount, cartTotal, toOrderRequest } from './cartReducer';
import { useCart } from './CartProvider';

type Mode = 'asap' | 'scheduled';

export function CartDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): React.JSX.Element | null {
  const router = useRouter();
  const { state, dispatch } = useCart();
  const [mode, setMode] = useState<Mode>('asap');
  const [slots, setSlots] = useState<SlotsView | null>(null);
  const [slotStart, setSlotStart] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const itemsQuery = state.lines.map((line) => `${line.menuItemId}:${line.qty}`).join(',');

  useEffect(() => {
    if (!open) return;
    void fetch('/api/wallet/me', { cache: 'no-store' })
      .then((response) => (response.ok ? (response.json() as Promise<WalletView>) : null))
      .then((wallet) => setBalance(wallet?.balanceHkd ?? null));
  }, [open]);

  const loadSlots = useCallback(
    async (preferred?: number): Promise<void> => {
      if (state.vendorId === null) return;
      const response = await fetch(`/api/slots/${state.vendorId}?items=${itemsQuery}`, {
        cache: 'no-store',
      });
      if (!response.ok) return;
      const view = (await response.json()) as SlotsView;
      setSlots(view);
      const free = view.slots.filter((slot) => slot.free);
      setSlotStart(
        free.find((slot) => slot.slotStart === preferred)?.slotStart ?? free[0]?.slotStart ?? null,
      );
    },
    [state.vendorId, itemsQuery],
  );

  useEffect(() => {
    if (open && mode === 'scheduled') void loadSlots();
  }, [open, mode, loadSlots]);

  if (!open) return null;

  const request = toOrderRequest(
    state,
    mode === 'asap' || slotStart === null ? { kind: 'asap' } : { kind: 'scheduled', slotStart },
  );
  const total = cartTotal(state);
  const canPay = request !== null && !busy && (mode === 'asap' || slotStart !== null);

  async function pay(): Promise<void> {
    if (request === null) return;
    setBusy(true);
    setError(null);
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
    const body = (await response.json().catch(() => ({}))) as ErrorBody & {
      order?: { id: string };
    };
    setBusy(false);
    if (response.ok && body.order) {
      dispatch({ type: 'clear' });
      onClose();
      router.push(`/orders/${body.order.id}`);
      return;
    }
    setError(orderErrorMessage(response.status, body));
    if (body.error === 'slot_full' || body.error === 'slot_invalid') {
      await loadSlots(body.nextSlotStart ?? body.earliestSlotStart);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close cart"
        onClick={onClose}
        className="absolute inset-0 bg-navy/50"
      />
      <aside
        role="dialog"
        aria-label="Your cart"
        className="relative flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto bg-white p-4 shadow-xl sm:p-6"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Your cart</h2>
            {state.vendorName ? <p className="text-sm text-muted">{state.vendorName}</p> : null}
          </div>
          <Button tone="quiet" type="button" onClick={onClose}>
            Close
          </Button>
        </header>

        {state.lines.length === 0 ? (
          <p className="text-sm text-navy">Your cart is empty. Add something from the list.</p>
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-navy/15">
              {state.lines.map((line) => (
                <li key={line.menuItemId} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    <p className="text-xs text-muted">{formatHkd(line.priceHkd)} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`One less ${line.name}`}
                      onClick={() =>
                        dispatch({ type: 'setQty', menuItemId: line.menuItemId, qty: line.qty - 1 })
                      }
                      className="h-9 w-9 rounded-full border border-navy/60 text-lg"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-sm font-medium" data-qty>
                      {line.qty}
                    </span>
                    <button
                      type="button"
                      aria-label={`One more ${line.name}`}
                      onClick={() =>
                        dispatch({ type: 'setQty', menuItemId: line.menuItemId, qty: line.qty + 1 })
                      }
                      className="h-9 w-9 rounded-full border border-navy/60 text-lg"
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Pickup</h3>
              <div className="flex flex-wrap gap-2">
                <ToggleChip selected={mode === 'asap'} onToggle={() => setMode('asap')}>
                  As soon as ready
                </ToggleChip>
                <ToggleChip selected={mode === 'scheduled'} onToggle={() => setMode('scheduled')}>
                  Pick a slot
                </ToggleChip>
              </div>
              {mode === 'asap' ? (
                <p className="text-sm text-navy">
                  The kitchen starts right away. Your ready time appears on the next screen.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2" data-slots>
                  {slots === null ? (
                    <p className="col-span-3 text-sm text-navy">Loading slots…</p>
                  ) : (
                    slots.slots.map((slot) => (
                      <button
                        key={slot.slotStart}
                        type="button"
                        disabled={!slot.free}
                        aria-pressed={slotStart === slot.slotStart}
                        onClick={() => setSlotStart(slot.slotStart)}
                        className={`rounded-md border px-2 py-2 text-sm disabled:cursor-not-allowed disabled:text-muted disabled:line-through ${
                          slotStart === slot.slotStart
                            ? 'border-navy bg-navy text-cream'
                            : 'border-navy/60 bg-white'
                        }`}
                      >
                        {formatHktTime(slot.slotStart)}
                      </button>
                    ))
                  )}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-1 border-t border-navy/15 pt-3 text-sm">
              <p className="flex justify-between">
                <span>{cartCount(state)} items</span>
                <span className="font-semibold">{formatHkd(total)}</span>
              </p>
              <p className="flex justify-between text-muted">
                <span>Wallet balance (demo money)</span>
                <span data-balance>{balance === null ? '…' : formatHkd(balance)}</span>
              </p>
            </section>

            <ErrorNote message={error} />
            <Button type="button" disabled={!canPay} onClick={() => void pay()}>
              {busy ? 'Paying…' : `Pay ${formatHkd(total)} from demo wallet`}
            </Button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'clear' })}
              className="self-start text-sm text-muted underline"
            >
              Empty cart
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
