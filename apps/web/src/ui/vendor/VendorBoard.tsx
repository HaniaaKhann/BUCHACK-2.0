'use client';

import { formatHktTime } from '@app/core';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { VendorStatusView } from '@/server/vendorControls';
import type { DoneOrderView, VendorOrderView } from '@/server/vendorService';
import type { VendorAction } from '@/server/vendorTransitions';
import { useLiveRefresh } from '../dashboard/useLiveRefresh';
import { AppHeader, Button, Card, ErrorNote, Switch } from '../primitives';
import { SignOutButton } from '../SignOutButton';
import { BoardColumns } from './BoardColumns';
import { DoneToday } from './DoneToday';
import { newOrderIds } from './boardModel';

function beep(): void {
  const context = new AudioContext();
  const tone = context.createOscillator();
  tone.frequency.value = 880;
  tone.connect(context.destination);
  tone.start();
  tone.stop(context.currentTime + 0.2);
  tone.onended = () => void context.close();
}

const BUSY_CHOICES = [
  { state: 'quiet', label: 'Quiet' },
  { state: 'normal', label: 'Normal' },
  { state: 'rush', label: 'Rush' },
] as const;

interface VendorBoardProps {
  vendorId: string;
  initialOrders: VendorOrderView[];
  initialDone: DoneOrderView[];
  initialStatus: VendorStatusView;
  isOwner: boolean;
}

export function VendorBoard({
  vendorId,
  initialOrders,
  initialDone,
  initialStatus,
  isOwner,
}: VendorBoardProps): React.JSX.Element {
  const [orders, setOrders] = useState(initialOrders);
  const [done, setDone] = useState(initialDone);
  const [status, setStatus] = useState(initialStatus);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const seen = useRef(new Set(initialOrders.map((order) => order.id)));

  useEffect(() => {
    const fresh = newOrderIds(seen.current, orders);
    for (const order of orders) seen.current.add(order.id);
    if (soundOn && fresh.length > 0) beep();
  }, [orders, soundOn]);

  const refresh = useCallback(async (): Promise<void> => {
    const [ordersResponse, statusResponse] = await Promise.all([
      fetch(`/api/vendor/${vendorId}/orders`, { cache: 'no-store' }),
      fetch(`/api/vendor/${vendorId}/status`, { cache: 'no-store' }),
    ]);
    if (ordersResponse.ok) {
      const body = (await ordersResponse.json()) as {
        orders: VendorOrderView[];
        done: DoneOrderView[];
      };
      setOrders(body.orders);
      setDone(body.done);
    }
    if (statusResponse.ok) {
      setStatus(((await statusResponse.json()) as { status: VendorStatusView }).status);
    }
  }, [vendorId]);

  useLiveRefresh(refresh, `/api/sse/vendor/${vendorId}`);

  async function send(path: string, body?: unknown): Promise<boolean> {
    setError(null);
    const response = await fetch(`/api/vendor/${vendorId}/${path}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) setError('That did not work. The board has been refreshed.');
    await refresh();
    return response.ok;
  }

  async function onAction(orderId: string, action: VendorAction): Promise<void> {
    setPendingId(orderId);
    await send(`orders/${orderId}/${action}`);
    setPendingId(null);
  }

  const rushUntil =
    status.busyState === 'rush' && status.busyUntil !== null
      ? ` until ${formatHktTime(status.busyUntil)}`
      : '';

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader
        left={<h1 className="text-lg font-semibold">{status.name}</h1>}
        right={
          <>
            <span className="text-sm" data-clock>
              Demo time {formatHktTime(status.now)}
            </span>
            <Link href="/vendor/menu" className="text-sm font-medium underline">
              Menu and stock
            </Link>
            {isOwner ? (
              <Link href="/vendor/sales" className="text-sm font-medium underline">
                Sales
              </Link>
            ) : null}
            <SignOutButton />
          </>
        }
      />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:py-6">
        <Card title="Kitchen status">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Busy level">
              {BUSY_CHOICES.map((choice) => (
                <Button
                  key={choice.state}
                  type="button"
                  tone={status.busyState === choice.state ? 'primary' : 'quiet'}
                  aria-pressed={status.busyState === choice.state}
                  data-busy={choice.state}
                  onClick={() => void send('busy', { state: choice.state })}
                >
                  {choice.label}
                </Button>
              ))}
              <span className="text-sm text-navy" data-busy-note>
                {status.busyState}
                {rushUntil}
              </span>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={soundOn} label="Sound for new orders" onChange={setSoundOn} />
              Sound for new orders
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={status.paused}
                label="Pause orders"
                onChange={(next) => void send('pause', { paused: next })}
              />
              Pause orders
              {status.paused ? (
                <span
                  data-paused-badge
                  className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-berry"
                >
                  Paused
                </span>
              ) : null}
            </label>
          </div>
          {isOwner ? null : <p className="mt-2 text-xs text-muted">Signed in as staff.</p>}
        </Card>
        <ErrorNote message={error} />
        <BoardColumns orders={orders} pendingId={pendingId} onAction={onAction} />
        <DoneToday orders={done} />
      </main>
    </div>
  );
}
