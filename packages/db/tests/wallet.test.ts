import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { STARTING_WALLET_HKD, grantStartingCredit } from '../src/seed/wallet.js';

function fakeDb(existing: number): { db: PrismaClient; created: unknown[] } {
  const created: unknown[] = [];
  const db = {
    walletLedger: {
      count: async () => existing,
      create: async (args: unknown) => {
        created.push(args);
      },
    },
  } as unknown as PrismaClient;
  return { db, created };
}

describe('grantStartingCredit', () => {
  it('writes one seed row of the starting amount for a user with no ledger yet', async () => {
    const { db, created } = fakeDb(0);
    await grantStartingCredit(db, 'u1');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      data: { userId: 'u1', deltaHkd: STARTING_WALLET_HKD, reason: 'seed' },
    });
    expect(STARTING_WALLET_HKD).toBe(300);
  });

  it('does nothing when the user already has ledger rows, so a reseed never tops up', async () => {
    const { db, created } = fakeDb(3);
    await grantStartingCredit(db, 'u1');
    expect(created).toHaveLength(0);
  });
});
