import { describe, expect, it } from 'vitest';
import { newOrderIds } from '../src/ui/vendor/boardModel';
import {
  VENDOR_ACTIONS,
  VENDOR_TRANSITIONS,
  actionFor,
  checkTransition,
} from '../src/server/vendorTransitions';

describe('vendor transitions', () => {
  it('walks placed to ready in three steps, and ready is the last one', () => {
    expect(VENDOR_ACTIONS.map((action) => VENDOR_TRANSITIONS[action].to)).toEqual([
      'accepted',
      'preparing',
      'ready',
    ]);
    expect(VENDOR_TRANSITIONS.ready.from).toBe('preparing');
    expect(actionFor('ready')).toBeNull();
    expect(Object.keys(VENDOR_TRANSITIONS)).not.toContain('picked-up');
  });

  it('refuses ready from every state except preparing, and treats a repeat as done', () => {
    for (const status of ['placed', 'accepted', 'cancelled', 'completed']) {
      expect(checkTransition('ready', status)).toBe('wrong_state');
    }
    expect(checkTransition('ready', 'preparing')).toBe('apply');
    expect(checkTransition('ready', 'ready')).toBe('already_done');
  });
});

describe('newOrderIds', () => {
  const order = (id: string, status: 'placed' | 'preparing') => ({
    id,
    status,
    totalHkd: 1,
    placedAt: 0,
    fireAt: null,
    slotStart: null,
    items: [],
  });

  it('reports only unseen orders that are still new', () => {
    const seen = new Set(['a']);
    expect(
      newOrderIds(seen, [order('a', 'placed'), order('b', 'placed'), order('c', 'preparing')]),
    ).toEqual(['b']);
  });
});
