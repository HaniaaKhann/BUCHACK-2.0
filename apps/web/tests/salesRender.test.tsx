import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { buildSalesView, type SalesRow } from '../src/server/salesService';
import { SalesBody } from '../src/ui/vendor/SalesDashboard';
import { formatDayTime, formatHourLabel, formatMoney } from '../src/ui/vendor/salesFormat';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

const NOW = Date.UTC(2026, 10, 17, 4, 15);
const MIDNIGHT = Date.UTC(2026, 10, 16, 16, 0);

const row = (id: string, hour: number, total: number, name: string): SalesRow => ({
  id,
  placedAt: MIDNIGHT + hour * 3_600_000,
  status: 'completed',
  totalHkd: total,
  items: [{ name, qty: 2 }],
});

describe('sales formatting', () => {
  it('writes Hong Kong day and time, hours and money', () => {
    expect(formatDayTime(Date.UTC(2026, 10, 17, 4, 3))).toBe('Tue 17 Nov 12:03');
    expect(formatHourLabel(9)).toBe('09:00');
    expect(formatMoney(31)).toBe('HK$31');
    expect(formatMoney(31.7)).toBe('HK$31.7');
  });
});

describe('sales page body', () => {
  const view = buildSalesView(
    'today',
    NOW,
    [row('app-1', 11, 40, 'Real Noodles')],
    [row('sample-1', 10, 20, 'Sample Tea'), row('sample-2', 12, 30, 'Sample Rice')],
  );
  const html = renderToStaticMarkup(<SalesBody view={view} />);

  it('shows the three numbers for today', () => {
    expect(html).toContain('data-stat="revenue"');
    expect(html).toContain('Revenue today');
    expect(html).toContain('HK$90');
    expect(html).toContain('Orders today');
    expect(html).toContain('Average order value today');
    expect(html).toContain('HK$30');
  });

  it('lists the top dishes and the hour bars with a text table', () => {
    expect(html).toContain('data-top-dishes');
    expect(html).toContain('1. Real Noodles');
    expect(html).toContain('data-hour-bars');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-hour-table');
    expect(html).toContain('Orders per hour as a table');
    expect(html).toContain('<th scope="col"');
  });

  it('puts the app orders first, then the labelled sample data, never mixed', () => {
    expect(html.indexOf('data-app-orders')).toBeLessThan(html.indexOf('data-sample-orders'));
    expect(html).toContain('Orders from the app (1)');
    expect(html).toContain('Sample data for the demo (2)');
    expect(html).toContain('data-sales-row="app"');
    expect(html.match(/data-sales-row="sample"/g)).toHaveLength(2);
    expect(html.match(/>Sample</g)).toHaveLength(2);
    const app = html.slice(html.indexOf('data-app-orders'), html.indexOf('data-sample-orders'));
    expect(app).toContain('Real Noodles');
    expect(app).not.toContain('Sample Tea');
  });

  it('says plainly that the sample data is made up, kept apart and never used by the engine', () => {
    expect(html).toContain('made up');
    expect(html).toContain('stored apart from real orders');
    expect(html).toContain('never used by the wait-time engine');
  });

  it('explains an empty app list instead of leaving a blank', () => {
    const empty = renderToStaticMarkup(
      <SalesBody view={buildSalesView('today', NOW, [], [row('s', 10, 20, 'Tea')])} />,
    );
    expect(empty).toContain('No orders have been placed through the app in this period yet');
    expect(empty).toContain('Orders from the app (0)');
  });
});
