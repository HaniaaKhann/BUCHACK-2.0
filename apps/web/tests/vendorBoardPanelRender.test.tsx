import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { VendorStatusView } from '../src/server/vendorControls';
import { VendorBoard } from '../src/ui/vendor/VendorBoard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

const NOW = Date.UTC(2026, 10, 17, 4, 15);

function board(paused: boolean): string {
  const status: VendorStatusView = {
    name: 'Bistro NTT',
    paused,
    busyState: 'normal',
    busyUntil: null,
    now: NOW,
  };
  return renderToStaticMarkup(
    <VendorBoard
      vendorId="v1"
      initialOrders={[]}
      initialDone={[]}
      initialStatus={status}
      isOwner
    />,
  );
}

describe('VendorBoard status panel', () => {
  it('labels the switch Pause orders and shows no badge while taking orders', () => {
    const html = board(false);
    expect(html).toContain('aria-label="Pause orders"');
    expect(html).toContain('aria-checked="false"');
    expect(html).not.toContain('data-paused-badge');
    expect(html).not.toContain('Pause new orders');
  });

  it('shows a Paused badge and a checked switch while paused', () => {
    const html = board(true);
    expect(html).toContain('data-paused-badge');
    expect(html).toContain('>Paused<');
    expect(html).toContain('aria-label="Pause orders"');
  });
});
