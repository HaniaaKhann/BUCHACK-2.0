import { describe, expect, it } from 'vitest';
import { MockWalletProvider, type LedgerRow, type LedgerStore } from '../src/payment/mockWallet.js';

class MemoryStore implements LedgerStore {
  readonly rows: { row: LedgerRow; reference: string }[] = [];

  constructor(startingHkd: number) {
    this.rows.push({ row: { userId: 'u1', deltaHkd: startingHkd, reason: 'seed' }, reference: '' });
  }

  async balanceHkd(userId: string): Promise<number> {
    return this.rows
      .filter((entry) => entry.row.userId === userId)
      .reduce((sum, entry) => sum + entry.row.deltaHkd, 0);
  }

  async rowsFor(reference: string): Promise<LedgerRow[]> {
    return this.rows.filter((entry) => entry.reference === reference).map((entry) => entry.row);
  }

  async append(row: LedgerRow, reference: string): Promise<void> {
    this.rows.push({ row, reference });
  }
}

describe('MockWalletProvider', () => {
  it('charges the wallet by adding a negative ledger row', async () => {
    const store = new MemoryStore(300);
    const intent = await new MockWalletProvider(store).charge('u1', 45, 'order-1');
    expect(intent).toEqual({ id: 'order-1', userId: 'u1', amountHkd: 45, status: 'captured' });
    expect(await store.balanceHkd('u1')).toBe(255);
    expect(await store.rowsFor('order-1')).toEqual([
      { userId: 'u1', deltaHkd: -45, reason: 'pay' },
    ]);
  });

  it('refuses a charge above the balance and writes nothing', async () => {
    const store = new MemoryStore(40);
    const intent = await new MockWalletProvider(store).charge('u1', 45, 'order-1');
    expect(intent.status).toBe('failed');
    expect(store.rows).toHaveLength(1);
  });

  it('allows spending exactly the whole balance and refuses a non-positive amount', async () => {
    const store = new MemoryStore(40);
    const wallet = new MockWalletProvider(store);
    expect((await wallet.charge('u1', 0, 'zero')).status).toBe('failed');
    expect((await wallet.charge('u1', 40, 'all')).status).toBe('captured');
    expect(await store.balanceHkd('u1')).toBe(0);
  });

  it('refunds in full and puts the balance back', async () => {
    const store = new MemoryStore(300);
    const wallet = new MockWalletProvider(store);
    await wallet.charge('u1', 45, 'order-1');
    const refund = await wallet.refund('order-1');
    expect(refund).toEqual({ id: 'order-1', userId: 'u1', amountHkd: 45, status: 'refunded' });
    expect(await store.balanceHkd('u1')).toBe(300);
  });

  it('refunds only once however many times it is asked', async () => {
    const store = new MemoryStore(300);
    const wallet = new MockWalletProvider(store);
    await wallet.charge('u1', 45, 'order-1');
    await wallet.refund('order-1');
    await wallet.refund('order-1');
    expect(await store.balanceHkd('u1')).toBe(300);
    expect((await store.rowsFor('order-1')).filter((row) => row.reason === 'refund')).toHaveLength(
      1,
    );
  });

  it('cannot refund something that was never paid', async () => {
    const store = new MemoryStore(300);
    const intent = await new MockWalletProvider(store).refund('never-paid');
    expect(intent.status).toBe('failed');
    expect(await store.balanceHkd('u1')).toBe(300);
  });
});
