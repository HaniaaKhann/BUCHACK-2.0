import { describe, expect, it, vi } from 'vitest';
import { createEventHub, studentFilter, vendorFilter } from '../src/server/events/eventHub';
import type { AppEvent } from '../src/server/events/notifications';

const orderFor = (studentId: string, vendorId: string): AppEvent => ({
  kind: 'order',
  orderId: 'order-1',
  vendorId,
  studentId,
  status: 'ready',
  at: 1,
});

const snapshotFor = (vendorId: string): AppEvent => ({
  kind: 'snapshot',
  vendorId,
  computedAt: '2026-11-17T04:15:00.000Z',
});

describe('createEventHub', () => {
  it('delivers an event only to subscribers whose filter accepts it', () => {
    const hub = createEventHub();
    const mine = vi.fn();
    const theirs = vi.fn();
    hub.subscribe(studentFilter('a'), mine);
    hub.subscribe(studentFilter('b'), theirs);
    hub.publish(orderFor('a', 'v'));
    expect(mine).toHaveBeenCalledTimes(1);
    expect(theirs).not.toHaveBeenCalled();
  });

  it('stops delivering after unsubscribe and tracks the subscriber count', () => {
    const hub = createEventHub();
    const handler = vi.fn();
    const unsubscribe = hub.subscribe(() => true, handler);
    expect(hub.subscriberCount()).toBe(1);
    unsubscribe();
    unsubscribe();
    hub.publish(snapshotFor('v'));
    expect(handler).not.toHaveBeenCalled();
    expect(hub.subscriberCount()).toBe(0);
  });

  it('keeps delivering to other subscribers when one handler throws', () => {
    const hub = createEventHub();
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const healthy = vi.fn();
    hub.subscribe(
      () => true,
      () => {
        throw new Error('boom');
      },
    );
    hub.subscribe(() => true, healthy);
    hub.publish(snapshotFor('v'));
    expect(healthy).toHaveBeenCalledTimes(1);
    stderr.mockRestore();
  });

  it('sends resync to every subscriber whatever their filter says', () => {
    const hub = createEventHub();
    const never = vi.fn();
    hub.subscribe(() => false, never);
    hub.publish({ kind: 'resync' });
    expect(never).toHaveBeenCalledWith({ kind: 'resync' });
  });
});

describe('studentFilter', () => {
  it('passes the student own orders and every snapshot, nothing else', () => {
    const filter = studentFilter('a');
    expect(filter(orderFor('a', 'v1'))).toBe(true);
    expect(filter(orderFor('b', 'v1'))).toBe(false);
    expect(filter(snapshotFor('v9'))).toBe(true);
    expect(filter({ kind: 'queue', vendorId: 'v9' })).toBe(true);
  });
});

describe('vendorFilter', () => {
  it('passes only orders and snapshots of that vendor', () => {
    const filter = vendorFilter('v1');
    expect(filter(orderFor('a', 'v1'))).toBe(true);
    expect(filter(orderFor('a', 'v2'))).toBe(false);
    expect(filter(snapshotFor('v1'))).toBe(true);
    expect(filter(snapshotFor('v2'))).toBe(false);
    expect(filter({ kind: 'queue', vendorId: 'v1' })).toBe(true);
    expect(filter({ kind: 'queue', vendorId: 'v2' })).toBe(false);
  });

  it('sends a notification event only to the student it is for, never to a vendor', () => {
    const hub = createEventHub();
    const mine = vi.fn();
    const theirs = vi.fn();
    const vendor = vi.fn();
    hub.subscribe(studentFilter('a'), mine);
    hub.subscribe(studentFilter('b'), theirs);
    hub.subscribe(vendorFilter('v1'), vendor);
    hub.publish({ kind: 'notification', userId: 'a' });
    expect(mine).toHaveBeenCalledWith({ kind: 'notification', userId: 'a' });
    expect(theirs).not.toHaveBeenCalled();
    expect(vendor).not.toHaveBeenCalled();
  });
});
