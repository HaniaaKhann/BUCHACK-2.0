import { describe, expect, it } from 'vitest';
import {
  menuKey,
  orderRows,
  simUserRows,
  ticketRows,
  type HistoryLookups,
  type OrderFile,
  type PredictionFile,
} from '../src/seed/history.js';
import { SIM_EMAIL_DOMAIN } from '../src/seed/simUsers.js';

const lookups: HistoryLookups = {
  vendorIdByName: new Map([['Main Canteen', 'vendor-1']]),
  menuByVendorAndName: new Map([
    [menuKey('vendor-1', 'Wonton noodles'), { id: 'item-1', priceHkd: 40 }],
  ]),
};

const order: OrderFile[number] = {
  id: 'sim-order-1',
  vendorName: 'Main Canteen',
  studentKey: 'sim-student-001',
  status: 'picked_up',
  placedAt: '2026-10-05T04:00:00.000Z',
  readyAt: null,
  pickedUpAt: '2026-10-05T04:12:00.000Z',
  items: [
    { name: 'Wonton noodles', qty: 1, prepPriorMin: 6 },
    { name: 'Wonton noodles', qty: 2, prepPriorMin: 6 },
  ],
};

const prediction: PredictionFile[number] = {
  orderId: 'sim-order-1',
  pointMinutes: 8,
  lowMinutes: 5,
  highMinutes: 11,
  baseMinutes: 7,
  backlogAtPlacement: 1.5,
  modelVersion: 'v2',
};

describe('simUserRows', () => {
  it('uses the reserved simulated email domain and the student key as id', () => {
    const [row] = simUserRows([{ key: 'sim-student-001' }]);
    expect(row).toMatchObject({
      id: 'sim-student-001',
      email: `sim-student-001@${SIM_EMAIL_DOMAIN}`,
      role: 'student',
    });
  });
});

describe('ticketRows', () => {
  it('maps the outlet name to its id', () => {
    const [row] = ticketRows(
      [
        {
          vendorName: 'Main Canteen',
          slotStart: '2026-10-05T04:00:00.000Z',
          count: 3,
          source: 'sim',
        },
      ],
      lookups,
    );
    expect(row).toMatchObject({ vendorId: 'vendor-1', count: 3, source: 'sim' });
  });

  it('rejects an unknown outlet', () => {
    expect(() =>
      ticketRows(
        [{ vendorName: 'Nowhere', slotStart: '2026-10-05T04:00:00.000Z', count: 3, source: 'sim' }],
        lookups,
      ),
    ).toThrow('unknown outlet');
  });
});

describe('orderRows', () => {
  it('turns predicted minutes into timestamps and prices the items from the menu', () => {
    const [row] = orderRows([order], [prediction], lookups);
    expect(row?.order.predictedPoint.toISOString()).toBe('2026-10-05T04:08:00.000Z');
    expect(row?.order.predictedLow.toISOString()).toBe('2026-10-05T04:05:00.000Z');
    expect(row?.order.predictedHigh.toISOString()).toBe('2026-10-05T04:11:00.000Z');
    expect(row?.order.predictedBase.toISOString()).toBe('2026-10-05T04:07:00.000Z');
    expect(row?.order.totalHkd).toBe(120);
    expect(row?.order.backlogAtPlacement).toBe(1.5);
    expect(row?.items.map((item) => item.id)).toEqual(['sim-order-1-0', 'sim-order-1-1']);
  });

  it('fails when an order has no prediction', () => {
    expect(() => orderRows([order], [], lookups)).toThrow('No prediction');
  });

  it('fails when an item is not on the menu', () => {
    const missing = { ...order, items: [{ name: 'Mystery', qty: 1, prepPriorMin: 5 }] };
    expect(() => orderRows([missing], [prediction], lookups)).toThrow('unknown item');
  });
});
