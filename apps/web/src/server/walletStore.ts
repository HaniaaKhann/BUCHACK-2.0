import type { Prisma } from '@app/db';
import type { LedgerRow, LedgerStore } from '@app/integrations';

export function ledgerStore(tx: Prisma.TransactionClient, nowMs: number): LedgerStore {
  return {
    async balanceHkd(userId) {
      const total = await tx.walletLedger.aggregate({
        where: { userId },
        _sum: { deltaHkd: true },
      });
      return total._sum.deltaHkd ?? 0;
    },
    async rowsFor(reference) {
      const rows = await tx.walletLedger.findMany({
        where: { refOrderId: reference },
        select: { userId: true, deltaHkd: true, reason: true },
      });
      return rows satisfies LedgerRow[];
    },
    async append(row, reference) {
      await tx.walletLedger.create({
        data: {
          userId: row.userId,
          deltaHkd: row.deltaHkd,
          reason: row.reason,
          refOrderId: reference,
          createdAt: new Date(nowMs),
        },
      });
    },
  };
}
