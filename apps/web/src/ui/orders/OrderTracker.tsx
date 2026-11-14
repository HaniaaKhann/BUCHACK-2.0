'use client';

import { formatHktTime } from '@app/core';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { OrderView } from '@/server/orderViews';
import { useLiveRefresh } from '../dashboard/useLiveRefresh';
import { NotificationBell } from '../notifications/NotificationBell';
import { AppHeader, Button, Card, ErrorNote } from '../primitives';
import {
  STATUS_LABELS,
  STATUS_STEPS,
  formatHkd,
  readyRange,
  statusMessage,
  stepIndex,
} from './orderViewModel';

export function OrderTracker({ initial }: { initial: OrderView }): React.JSX.Element {
  const [order, setOrder] = useState(initial);
  const [seconds, setSeconds] = useState(initial.graceSecondsLeft);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const idRef = useRef(initial.id);

  const apply = useCallback((next: OrderView): void => {
    setOrder(next);
    setSeconds(next.graceSecondsLeft);
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    const response = await fetch(`/api/orders/${idRef.current}`, { cache: 'no-store' });
    if (response.ok) apply(((await response.json()) as { order: OrderView }).order);
  }, [apply]);

  useLiveRefresh(refresh);

  useEffect(() => {
    if (order.status !== 'placed') return;
    const timer = setInterval(() => setSeconds((left) => Math.max(0, left - 1)), 1000);
    return () => clearInterval(timer);
  }, [order.status]);

  async function act(action: 'cancel' | 'pick-up'): Promise<void> {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/orders/${order.id}/${action}`, { method: 'PATCH' });
    const body = (await response.json().catch(() => ({}))) as { order?: OrderView; error?: string };
    setBusy(false);
    if (response.ok && body.order) {
      apply(body.order);
      return;
    }
    setError(
      action === 'cancel'
        ? 'This order can no longer be cancelled because the vendor has accepted it.'
        : 'This order cannot be marked as picked up yet.',
    );
    await refresh();
  }

  const current = stepIndex(order.status);
  const live = { ...order, graceSecondsLeft: seconds };
  const cancelled = order.status === 'cancelled';

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader
        left={
          <Link href="/" className="text-sm font-medium underline">
            Back to food
          </Link>
        }
        right={
          <>
            <Link href="/orders" className="text-sm font-medium underline">
              My orders
            </Link>
            <NotificationBell />
          </>
        }
      />

      <main className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-2 lg:gap-6 lg:py-6">
        <section className="flex flex-col gap-4" data-order-status={order.status}>
          <Card title={`Order at ${order.vendor.name}`}>
            <p className="text-2xl font-semibold" data-status-label>
              {STATUS_LABELS[order.status]}
            </p>
            <p className="text-sm text-navy" data-status-message>
              {statusMessage(live)}
            </p>

            {cancelled ? null : (
              <ol className="flex flex-col gap-2" aria-label="Order progress">
                {STATUS_STEPS.map((step, index) => (
                  <li
                    key={step}
                    data-step={step}
                    data-done={index <= current}
                    className={`flex items-center gap-3 text-sm ${
                      index <= current ? 'font-medium text-navy' : 'text-muted'
                    }`}
                  >
                    <span
                      className={`h-3 w-3 rounded-full ${
                        index < current
                          ? 'bg-navy'
                          : index === current
                            ? 'bg-berry ring-2 ring-berry/30'
                            : 'border border-navy/60 bg-white'
                      }`}
                    />
                    {STATUS_LABELS[step]}
                  </li>
                ))}
              </ol>
            )}

            <ErrorNote message={error} />
            <div className="flex flex-wrap gap-3">
              {order.canCancel ? (
                <Button
                  tone="quiet"
                  type="button"
                  disabled={busy}
                  onClick={() => void act('cancel')}
                >
                  {seconds > 0 ? `Cancel order (${seconds}s)` : 'Cancel order'}
                </Button>
              ) : null}
              {order.canPickUp ? (
                <Button type="button" disabled={busy} onClick={() => void act('pick-up')}>
                  I picked it up
                </Button>
              ) : null}
            </div>
          </Card>
        </section>

        <section className="flex flex-col gap-4">
          <Card title="Details">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Expected ready</dt>
                <dd className="font-medium" data-ready-range>
                  {readyRange(order)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Pickup</dt>
                <dd className="font-medium">
                  {order.slotStart === null
                    ? 'As soon as ready'
                    : `Slot ${formatHktTime(order.slotStart)}`}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Placed</dt>
                <dd className="font-medium">{formatHktTime(order.placedAt)}</dd>
              </div>
              {order.fireAt === null ? null : (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">Kitchen starts</dt>
                  <dd className="font-medium">{formatHktTime(order.fireAt)}</dd>
                </div>
              )}
            </dl>
            <ul className="flex flex-col divide-y divide-navy/15 text-sm">
              {order.items.map((item) => (
                <li key={item.name} className="flex justify-between py-2">
                  <span>
                    {item.qty} × {item.name}
                  </span>
                  <span>{formatHkd(item.priceHkd * item.qty)}</span>
                </li>
              ))}
            </ul>
            <p className="flex justify-between border-t border-navy/15 pt-3 text-base font-semibold">
              <span>Total (demo wallet)</span>
              <span>{formatHkd(order.totalHkd)}</span>
            </p>
          </Card>
        </section>
      </main>
    </div>
  );
}
