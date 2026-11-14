'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { SalesRange, SalesRow, SalesView as SalesViewData } from '@/server/salesService';
import { AppHeader, Card, ToggleChip } from '../primitives';
import { SignOutButton } from '../SignOutButton';
import { SALES_STATUS_LABELS, formatDayTime, formatHourLabel, formatMoney } from './salesFormat';

const RANGE_LABELS: Record<SalesRange, string> = { today: 'Today', '7d': 'Last 7 days' };

function Stat({
  label,
  value,
  name,
}: {
  label: string;
  value: string;
  name: string;
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-navy/15 bg-white p-4" data-stat={name}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function HourBars({ hourly }: { hourly: SalesViewData['hourly'] }): React.JSX.Element {
  const max = Math.max(1, ...hourly.map((entry) => entry.orders));
  const withOrders = hourly.filter((entry) => entry.orders > 0);
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-1.5" data-hour-bars aria-hidden="true">
        {hourly.map((entry) => (
          <li key={entry.hour} className="flex items-center gap-2 text-xs">
            <span className="w-11 shrink-0">{formatHourLabel(entry.hour)}</span>
            <span className="h-4 min-w-0 flex-1 rounded bg-cream">
              <span
                className="block h-4 rounded bg-navy"
                style={{ width: `${(entry.orders / max) * 100}%` }}
              />
            </span>
            <span className="w-8 shrink-0 text-right font-semibold">{entry.orders}</span>
          </li>
        ))}
      </ul>
      <table className="w-full text-left text-xs" data-hour-table>
        <caption className="mb-1 text-left font-semibold">Orders per hour as a table</caption>
        <thead>
          <tr>
            <th scope="col" className="py-1 pr-2 font-semibold">
              Hour
            </th>
            <th scope="col" className="py-1 font-semibold">
              Orders
            </th>
          </tr>
        </thead>
        <tbody>
          {withOrders.length === 0 ? (
            <tr>
              <td colSpan={2} className="py-1">
                No orders in this period.
              </td>
            </tr>
          ) : (
            withOrders.map((entry) => (
              <tr key={entry.hour} className="border-t border-navy/15">
                <td className="py-1 pr-2">{formatHourLabel(entry.hour)}</td>
                <td className="py-1">{entry.orders}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function OrderRows({
  rows,
  sample,
}: {
  rows: readonly SalesRow[];
  sample: boolean;
}): React.JSX.Element {
  return (
    <ul className="grid gap-2 md:grid-cols-2" data-order-list={sample ? 'sample' : 'app'}>
      {rows.map((row) => (
        <li
          key={row.id}
          data-sales-row={sample ? 'sample' : 'app'}
          className="rounded-md border border-navy/15 bg-white p-3 text-sm"
        >
          <p className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold">{formatDayTime(row.placedAt)}</span>
            <span>
              {sample ? (
                <span className="mr-2 rounded bg-cocoa px-1.5 py-0.5 text-cream">Sample</span>
              ) : null}
              {SALES_STATUS_LABELS[row.status]}
            </span>
          </p>
          <p className="mt-1 font-medium">
            {row.items.map((item) => `${item.qty} × ${item.name}`).join(', ')}
          </p>
          <p className="mt-1 text-xs text-muted">{formatMoney(row.totalHkd)}</p>
        </li>
      ))}
    </ul>
  );
}

export function SalesBody({ view }: { view: SalesViewData }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4" data-sales-view={view.range}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat name="revenue" label="Revenue today" value={formatMoney(view.today.revenueHkd)} />
        <Stat name="orders" label="Orders today" value={String(view.today.orders)} />
        <Stat
          name="average"
          label="Average order value today"
          value={view.today.averageHkd === null ? 'None yet' : formatMoney(view.today.averageHkd)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Top 5 dishes (${RANGE_LABELS[view.range].toLowerCase()})`}>
          {view.top.length === 0 ? (
            <p className="text-sm">No orders in this period.</p>
          ) : (
            <ol className="flex flex-col gap-1.5 text-sm" data-top-dishes>
              {view.top.map((dish, index) => (
                <li key={dish.name} className="flex justify-between gap-3">
                  <span className="min-w-0">
                    {index + 1}. {dish.name}
                  </span>
                  <span className="shrink-0 font-semibold">{dish.qty}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card title={`Orders per hour (${RANGE_LABELS[view.range].toLowerCase()})`}>
          <HourBars hourly={view.hourly} />
        </Card>
      </div>

      <section aria-label="Orders from the app" className="flex flex-col gap-2" data-app-orders>
        <h2 className="text-base font-semibold">Orders from the app ({view.counts.app})</h2>
        {view.appOrders.length === 0 ? (
          <p className="text-sm">
            No orders have been placed through the app in this period yet. They appear here, above
            the sample data, as soon as a student orders.
          </p>
        ) : (
          <OrderRows rows={view.appOrders} sample={false} />
        )}
      </section>

      <section
        aria-label="Sample data for the demo"
        className="flex flex-col gap-2"
        data-sample-orders
      >
        <h2 className="text-base font-semibold">Sample data for the demo ({view.counts.sample})</h2>
        <p className="rounded-md bg-white p-2 text-xs text-cocoa">
          These orders are made up so the page is not empty in the demo. They are stored apart from
          real orders, are never used by the wait-time engine, and are included in the totals above.
        </p>
        {view.sampleOrders.length === 0 ? (
          <p className="text-sm">There is no sample data in this period.</p>
        ) : (
          <OrderRows rows={view.sampleOrders} sample />
        )}
      </section>
    </div>
  );
}

export function SalesDashboard({
  vendorId,
  vendorName,
  initial,
}: {
  vendorId: string;
  vendorName: string;
  initial: SalesViewData;
}): React.JSX.Element {
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(range: SalesRange): Promise<void> {
    if (range === view.range || busy) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/vendor/${vendorId}/sales?range=${range}`, {
      cache: 'no-store',
    });
    setBusy(false);
    if (!response.ok) {
      setError('Could not load that period. Showing the last one.');
      return;
    }
    setView((await response.json()) as SalesViewData);
  }

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader
        left={
          <Link href="/vendor" className="text-sm font-medium underline">
            Back to orders
          </Link>
        }
        right={
          <>
            <h1 className="text-lg font-semibold">{vendorName}: sales</h1>
            <SignOutButton />
          </>
        }
      />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:py-6">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Period">
          {(Object.keys(RANGE_LABELS) as SalesRange[]).map((range) => (
            <ToggleChip
              key={range}
              selected={view.range === range}
              onToggle={() => void choose(range)}
            >
              {RANGE_LABELS[range]}
            </ToggleChip>
          ))}
        </div>
        {error ? (
          <p role="alert" className="text-sm text-berry">
            {error}
          </p>
        ) : null}
        <SalesBody view={view} />
      </main>
    </div>
  );
}
