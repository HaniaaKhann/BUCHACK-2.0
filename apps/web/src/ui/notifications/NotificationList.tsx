import { formatHktTime } from '@app/core';
import type { NotificationView } from '@/server/notificationService';

export interface NotificationListProps {
  notifications: readonly NotificationView[];
  unread: number;
  onMarkAll: () => void;
  onClose: () => void;
}

export function NotificationList(props: NotificationListProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2" data-bell-panel>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Notifications</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-bell-mark-all
            disabled={props.unread === 0}
            onClick={props.onMarkAll}
            className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium disabled:opacity-50"
          >
            Mark all read
          </button>
          <button
            type="button"
            data-bell-close
            aria-label="Close notifications"
            onClick={props.onClose}
            className="rounded-md px-2 py-1 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            ×
          </button>
        </div>
      </div>
      {props.notifications.length === 0 ? (
        <p className="py-3 text-sm text-neutral-700" data-bell-empty>
          Nothing yet. You will see order updates and leave-now reminders here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {props.notifications.map((item) => (
            <li
              key={item.id}
              data-notification={item.kind}
              data-read={item.read}
              className={`rounded-lg border p-3 text-sm ${
                item.read ? 'border-neutral-200 bg-white' : 'border-neutral-900 bg-neutral-50'
              }`}
            >
              <p className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{item.title}</span>
                <span className="shrink-0 text-xs text-neutral-600">
                  {formatHktTime(item.createdAt)}
                </span>
              </p>
              <p className="mt-0.5 text-neutral-700">{item.body}</p>
              {item.link === null ? null : (
                <a href={item.link} className="mt-1 inline-block text-xs font-medium underline">
                  View order
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
