import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { VendorOrderView } from '../src/server/vendorService';
import { BoardColumns } from '../src/ui/vendor/BoardColumns';

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
      orders={[order('a', 'placed'), order('b', 'ready')]}
      pendingId={null}
      onAction={() => undefined}
    />,
  );

  it('puts the Picked up button in the Ready column only', () => {
    const ready = html.slice(html.indexOf('aria-label="Ready"'));
    expect(ready).toContain('data-action="picked-up"');
    expect(ready).toContain('Picked up');
    const before = html.slice(0, html.indexOf('aria-label="Ready"'));
    expect(before).not.toContain('Picked up');
    expect(html.match(/Picked up/g)).toHaveLength(1);
  });

  it('offers Accept on a new order', () => {
    expect(html).toContain('data-action="accept"');
  });
});
