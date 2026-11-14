'use client';

import { useCallback, useEffect, useState } from 'react';
import type { NotificationsResponse } from '@/server/notificationService';
import { useLiveRefresh } from '../dashboard/useLiveRefresh';
import { NotificationList } from './NotificationList';

const EMPTY: NotificationsResponse = { notifications: [], unread: 0 };

export function NotificationBell(): React.JSX.Element {
  const [data, setData] = useState<NotificationsResponse>(EMPTY);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    const response = await fetch('/api/notifications', { cache: 'no-store' });
    if (response.ok) setData((await response.json()) as NotificationsResponse);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useLiveRefresh(refresh);

  async function markAll(): Promise<void> {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    await refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        data-bell
        aria-label={`Notifications, ${data.unread} unread`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="relative rounded-md border border-navy/60 bg-white p-2 text-navy hover:bg-navy/10"
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {data.unread > 0 ? (
          <span
            data-bell-count
            className="absolute -right-1.5 -top-1.5 min-w-[1.25rem] rounded-full bg-berry px-1 text-center text-xs font-semibold leading-5 text-white"
          >
            {data.unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="fixed inset-x-3 top-20 z-40 max-h-[70vh] overflow-y-auto rounded-xl border border-navy/15 bg-white p-3 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
          <NotificationList
            notifications={data.notifications}
            unread={data.unread}
            onMarkAll={() => void markAll()}
            onClose={() => setOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
