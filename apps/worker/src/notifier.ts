import type { PrismaClient } from '@app/db';

export type NotifyChannel = 'order_changed' | 'snapshot_written';

export async function notify(
  db: PrismaClient,
  channel: NotifyChannel,
  payload: Record<string, string>,
): Promise<void> {
  await db.$executeRaw`SELECT pg_notify(${channel}, ${JSON.stringify(payload)})`;
}
