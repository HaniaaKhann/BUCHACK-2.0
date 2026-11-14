import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { NotificationView } from '../src/server/notificationService';
import { NotificationBell } from '../src/ui/notifications/NotificationBell';
import { NotificationList } from '../src/ui/notifications/NotificationList';

const NOW = Date.UTC(2026, 10, 17, 4, 15);
const noop = (): void => undefined;

const item = (id: string, overrides: Partial<NotificationView> = {}): NotificationView => ({
  id,
  kind: 'order_ready',
  title: 'Order ready',
  body: 'Your order at H.F.C. (Hot Food Counter) @ Scholars Court is ready for pickup.',
  link: `/orders/${id}`,
  createdAt: NOW,
  read: false,
  ...overrides,
});

const list = (notifications: NotificationView[], unread: number): string =>
  renderToStaticMarkup(
    <NotificationList
      notifications={notifications}
      unread={unread}
      onMarkAll={noop}
      onClose={noop}
    />,
  );

describe('NotificationList', () => {
  it('shows the title, the body, the Hong Kong time and a link for each notification', () => {
    const html = list([item('a')], 1);
    expect(html).toContain('data-notification="order_ready"');
    expect(html).toContain('Order ready');
    expect(html).toContain('H.F.C. (Hot Food Counter) @ Scholars Court');
    expect(html).toContain('12:15');
    expect(html).toContain('href="/orders/a"');
  });

  it('marks unread and read notifications differently and enables Mark all read only when needed', () => {
    const html = list([item('a'), item('b', { read: true })], 1);
    expect(html).toContain('data-read="false"');
    expect(html).toContain('data-read="true"');
    expect(html).not.toMatch(/data-bell-mark-all="true"[^>]*disabled=""/);
    expect(list([item('b', { read: true })], 0)).toMatch(
      /data-bell-mark-all="true"[^>]*disabled=""|disabled=""[^>]*data-bell-mark-all="true"/,
    );
  });

  it('says plainly when there is nothing yet', () => {
    const html = list([], 0);
    expect(html).toContain('data-bell-empty');
    expect(html).toContain('Nothing yet.');
  });
});

describe('NotificationBell', () => {
  it('starts closed with no count and an accessible name that says how many are unread', () => {
    const html = renderToStaticMarkup(<NotificationBell />);
    expect(html).toContain('data-bell="true"');
    expect(html).toContain('aria-label="Notifications, 0 unread"');
    expect(html).not.toContain('data-bell-count');
    expect(html).not.toContain('data-bell-panel');
  });
});
