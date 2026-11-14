import { describe, expect, it } from 'vitest';
import { newOrderIds } from '../src/ui/vendor/boardModel';
import {
  VENDOR_ACTIONS,
  VENDOR_TRANSITIONS,
  actionFor,
  checkTransition,
} from '../src/server/vendorTransitions';

describe('vendor transitions', () => {
  it('walks placed to picked up in four steps, and picked up only comes from ready', () => {
    expect(VENDOR_ACTIONS.map((action) => VENDOR_TRANSITIONS[action].to)).toEqual([
      'accepted',
      'preparing',
      'ready',
      'picked_up',
    ]);
    expect(VENDOR_TRANSITIONS['picked-up'].from).toBe('ready');
    expect(actionFor('ready')).toBe('picked-up');
  });

  it('refuses picked up from every state except ready, and treats a repeat as done', () => {
    for (const status of ['placed', 'accepted', 'preparing', 'cancelled']) {
      expect(checkTransition('picked-up', status)).toBe('wrong_state');
    }
    expect(checkTransition('picked-up', 'ready')).toBe('apply');
    expect(checkTransition('picked-up', 'picked_up')).toBe('already_done');
  });
});

describe('newOrderIds', () => {
  const order = (id: string, status: 'placed' | 'ready') => ({
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
      newOrderIds(seen, [order('a', 'placed'), order('b', 'placed'), order('c', 'ready')]),
    ).toEqual(['b']);
  });
});
