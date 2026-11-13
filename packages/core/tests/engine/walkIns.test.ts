import { describe, expect, it } from 'vitest';
import { walkIns } from '../../src/engine/walkIns.js';

describe('walkIns', () => {
  it('uses all tickets when tickets exclude app orders', () => {
    expect(walkIns({ tickets: 10, appOrdersInSlot: 3, ticketsIncludeAppOrders: false })).toBe(10);
  });

  it('subtracts app orders when tickets include them', () => {
    expect(walkIns({ tickets: 10, appOrdersInSlot: 3, ticketsIncludeAppOrders: true })).toBe(7);
  });

  it('never goes below zero', () => {
    expect(walkIns({ tickets: 2, appOrdersInSlot: 5, ticketsIncludeAppOrders: true })).toBe(0);
  });
});
