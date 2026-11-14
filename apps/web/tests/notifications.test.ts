import { describe, expect, it } from 'vitest';
import { parseNotification, toWire, type AppEvent } from '../src/server/events/notifications';

const order = {
  orderId: 'order-1',
  vendorId: 'vendor-1',
  studentId: 'student-1',
  status: 'accepted',
};

describe('parseNotification', () => {
  it('parses an order_changed payload and stamps the receive time', () => {
    expect(parseNotification('order_changed', JSON.stringify(order), 1234)).toEqual({
      kind: 'order',
      ...order,
      at: 1234,
    });
  });

  it('parses a snapshot_written payload', () => {
    const payload = { vendorId: 'vendor-1', computedAt: '2026-11-17T04:15:00.000Z' };
    expect(parseNotification('snapshot_written', JSON.stringify(payload), 1)).toEqual({
      kind: 'snapshot',
      ...payload,
    });
  });

  it('drops payloads that are not valid JSON', () => {
    expect(parseNotification('order_changed', '{nope', 1)).toBeNull();
    expect(parseNotification('order_changed', undefined, 1)).toBeNull();
  });

  it('drops payloads with missing fields or an unknown status', () => {
    expect(parseNotification('order_changed', JSON.stringify({ orderId: 'x' }), 1)).toBeNull();
    expect(
      parseNotification('order_changed', JSON.stringify({ ...order, status: 'teleported' }), 1),
    ).toBeNull();
    expect(parseNotification('snapshot_written', JSON.stringify({ vendorId: 'v' }), 1)).toBeNull();
  });

  it('turns a vendor_changed payload into a queue event with only the vendor id', () => {
    expect(parseNotification('vendor_changed', JSON.stringify({ vendorId: 'v1' }), 5)).toEqual({
      kind: 'queue',
      vendorId: 'v1',
    });
    expect(parseNotification('vendor_changed', JSON.stringify({}), 5)).toBeNull();
  });

  it('ignores channels it does not know', () => {
    expect(parseNotification('clock_updated', JSON.stringify(order), 1)).toBeNull();
  });
});

describe('toWire', () => {
  it('leaves the student id out of order events', () => {
    const event: AppEvent = { kind: 'order', ...order, status: 'ready', at: 99 };
    expect(toWire(event)).toEqual({
      name: 'order',
      data: { orderId: 'order-1', vendorId: 'vendor-1', status: 'ready', at: 99 },
    });
  });

  it('sends only the vendor id for a queue event', () => {
    expect(toWire({ kind: 'queue', vendorId: 'v' })).toEqual({
      name: 'queue',
      data: { vendorId: 'v' },
    });
  });

  it('names snapshot and resync events', () => {
    expect(toWire({ kind: 'snapshot', vendorId: 'v', computedAt: 't' }).name).toBe('snapshot');
    expect(toWire({ kind: 'resync' })).toEqual({ name: 'resync', data: {} });
  });
});
