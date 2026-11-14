import { getClockNowMs } from './clock';
import { prisma } from './db';

export interface NotificationView {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  createdAt: number;
  read: boolean;
}

export interface NotificationsResponse {
  notifications: NotificationView[];
  unread: number;
}

const LIST_SIZE = 20;

export async function listNotifications(userId: string): Promise<NotificationsResponse> {
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: LIST_SIZE,
      select: {
        id: true,
        kind: true,
        title: true,
        body: true,
        link: true,
        createdAt: true,
        readAt: true,
      },
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return {
    notifications: rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      link: row.link,
      createdAt: row.createdAt.getTime(),
      read: row.readAt !== null,
    })),
    unread,
  };
}

export async function markNotificationsRead(
  userId: string,
  which: { all: true } | { ids: readonly string[] },
): Promise<number> {
  const readAt = new Date(await getClockNowMs());
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null, ...('all' in which ? {} : { id: { in: [...which.ids] } }) },
    data: { readAt },
  });
  return result.count;
}
