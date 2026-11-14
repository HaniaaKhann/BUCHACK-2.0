import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { VendorOrderView } from '../src/server/vendorService';
import { BoardColumns } from '../src/ui/vendor/BoardColumns';
import { DoneToday } from '../src/ui/vendor/DoneToday';

const NOW = Date.UTC(2026, 10, 17, 4, 15);

function order(id: string, status: VendorOrderView['status']): VendorOrderView {
  return {
    id,
    status,
    totalHkd: 38,
    placedAt: NOW,
    fireAt: null,
    slotStart: null,
    items: [{ name: 'Vegetable Noodles', qty: 1 }],
  };
}

describe('BoardColumns', () => {
  const html = renderToStaticMarkup(
    <BoardColumns
      orders={[order('a', 'placed'), order('b', 'preparing')]}
      pendingId={null}
      onAction={() => undefined}
    />,
  );

  it('has no Picked up button and no Ready column, because Ready is the last step', () => {
    expect(html).not.toContain('Picked up');
    expect(html).not.toContain('data-action="picked-up"');
    expect(html).not.toContain('aria-label="Ready"');
    expect(html).toContain('aria-label="Preparing"');
  });

  it('puts Mark ready on a preparing order', () => {
    expect(html).toContain('data-action="ready"');
    expect(html).toContain('Mark ready');
  });

  it('offers Accept on a new order', () => {
    expect(html).toContain('data-action="accept"');
  });
});

describe('DoneToday', () => {
  const done = (id: string, status: 'ready' | 'completed') => ({
    id,
    status,
    totalHkd: 38,
    readyAt: NOW,
    items: [{ name: 'Vegetable Noodles', qty: 2 }],
  });

  it('lists ready orders as waiting for pickup and finished ones as completed', () => {
    const html = renderToStaticMarkup(
      <DoneToday orders={[done('a', 'ready'), done('b', 'completed')]} />,
    );
    expect(html).toContain('Done today (2)');
    expect(html).toContain('data-done-status="ready"');
    expect(html).toContain('Waiting for pickup');
    expect(html).toContain('Completed');
    expect(html).toContain('2 × Vegetable Noodles');
    expect(html).toContain('HK$38');
    expect(html).not.toContain('<button');
  });

  it('says what to expect when there is nothing yet', () => {
    const html = renderToStaticMarkup(<DoneToday orders={[]} />);
    expect(html).toContain('Done today (0)');
    expect(html).toContain('Orders you mark ready appear here.');
  });
});
