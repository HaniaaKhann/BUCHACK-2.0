import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export interface NewNotification {
  userId: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  at: number;
}

export async function createNotification(db: Db, input: NewNotification): Promise<void> {
  await db.notification.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      link: input.link,
      createdAt: new Date(input.at),
    },
  });
  const payload = JSON.stringify({ userId: input.userId });
  await db.$executeRaw`SELECT pg_notify('notification_created', ${payload})`;
}
