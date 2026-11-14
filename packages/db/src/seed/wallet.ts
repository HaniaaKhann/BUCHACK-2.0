import type { PrismaClient } from '@prisma/client';

export const STARTING_WALLET_HKD = 300;

export async function grantStartingCredit(db: PrismaClient, userId: string): Promise<void> {
  const existing = await db.walletLedger.count({ where: { userId } });
  if (existing > 0) return;
  await db.walletLedger.create({
    data: { userId, deltaHkd: STARTING_WALLET_HKD, reason: 'seed', createdAt: new Date() },
  });
}
