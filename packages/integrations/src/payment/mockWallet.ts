import type { PaymentIntent, PaymentProvider } from './provider.js';

export type LedgerReason = 'seed' | 'pay' | 'refund';

export interface LedgerRow {
  userId: string;
  deltaHkd: number;
  reason: LedgerReason;
}

export interface LedgerStore {
  balanceHkd(userId: string): Promise<number>;
  rowsFor(reference: string): Promise<LedgerRow[]>;
  append(row: LedgerRow, reference: string): Promise<void>;
}

export class MockWalletProvider implements PaymentProvider {
  constructor(private readonly store: LedgerStore) {}

  async charge(userId: string, amountHkd: number, reference: string): Promise<PaymentIntent> {
    if (amountHkd <= 0 || (await this.store.balanceHkd(userId)) < amountHkd) {
      return { id: reference, userId, amountHkd, status: 'failed' };
    }
    await this.store.append({ userId, deltaHkd: -amountHkd, reason: 'pay' }, reference);
    return { id: reference, userId, amountHkd, status: 'captured' };
  }

  async refund(reference: string): Promise<PaymentIntent> {
    const rows = await this.store.rowsFor(reference);
    const paid = rows.find((row) => row.reason === 'pay');
    if (paid === undefined) return { id: reference, userId: '', amountHkd: 0, status: 'failed' };
    const amountHkd = -paid.deltaHkd;
    const intent = { id: reference, userId: paid.userId, amountHkd };
    if (rows.some((row) => row.reason === 'refund')) return { ...intent, status: 'refunded' };
    await this.store.append(
      { userId: paid.userId, deltaHkd: amountHkd, reason: 'refund' },
      reference,
    );
    return { ...intent, status: 'refunded' };
  }
}
