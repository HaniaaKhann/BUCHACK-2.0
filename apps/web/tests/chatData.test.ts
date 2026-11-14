import { halalFallbackSuggestion, matchIntent, requestsFor, type ChatRequest } from '@app/core';
import { describe, expect, it } from 'vitest';
import type { MenuResponse, VendorListResponse } from '../src/server/menuService';
import {
  loadChatData,
  toChatFoods,
  toChatOrders,
  toChatVendors,
  type Fetcher,
} from '../src/ui/chat/chatData';

const NOW = Date.UTC(2026, 10, 17, 4, 15);

const vendors = {
  now: NOW,
  vendors: [
    {
      id: 'v1',
      name: 'Main Canteen',
      campus: 'Shaw',
      floor: 'G/F',
      building: { id: 'b', name: 'Shaw Campus', code: null },
      pickupEnabled: true,
      paused: false,
      busyState: 'normal',
      busyUntil: null,
      openNow: true,
      hoursToday: [],
      walk: null,
      wait: { lowMinutes: 4.7, highMinutes: 8.8, source: 'live', stale: false },
    },
  ],
} as unknown as VendorListResponse;

const menu = {
  items: [
    {
      id: 'i1',
      name: 'Noodles',
      vendorName: 'Main Canteen',
      priceHkd: 32,
      tagsStatus: 'unverified',
      wait: { lowMinutes: 5, highMinutes: 9, pointMinutes: 7 },
      leaveAt: NOW + 240_000,
      leaveNow: false,
      score: 0.7,
    },
  ],
  meta: { now: NOW, emptyState: 'halal_unconfirmed' },
} as unknown as MenuResponse;

const orders = {
  orders: [
    {
      id: 'o1',
      status: 'ready',
      vendor: { id: 'v1', name: 'Main Canteen' },
      placedAt: NOW,
      predicted: { low: NOW, point: NOW, high: NOW },
    },
  ],
};

function fakeFetch(calls: { path: string; init: RequestInit }[], ok = true): Fetcher {
  return async (path, init) => {
    calls.push({ path, init });
    const body = path.startsWith('/api/vendors')
      ? vendors
      : path.startsWith('/api/menu-items')
        ? menu
        : path.startsWith('/api/orders')
          ? orders
          : { balanceHkd: 300, entries: [] };
    return { ok, json: async () => body } as Response;
  };
}

describe('mapping the existing student APIs', () => {
  it('keeps only the fields the bot needs', () => {
    expect(toChatVendors(vendors)[0]).toEqual({
      id: 'v1',
      name: 'Main Canteen',
      openNow: true,
      paused: false,
      pickupEnabled: true,
      busyState: 'normal',
      wait: { lowMinutes: 4.7, highMinutes: 8.8 },
    });
    expect(toChatFoods(menu)).toEqual({
      items: [
        {
          id: 'i1',
          name: 'Noodles',
          vendorName: 'Main Canteen',
          priceHkd: 32,
          tagsStatus: 'unverified',
          wait: { lowMinutes: 5, highMinutes: 9 },
          leaveAt: NOW + 240_000,
          leaveNow: false,
        },
      ],
      emptyState: 'halal_unconfirmed',
    });
    expect(toChatOrders(orders.orders as never)[0]?.vendorName).toBe('Main Canteen');
  });
});

describe('loadChatData', () => {
  it('makes only GET requests to the paths the matcher asked for, and sends no body', async () => {
    const calls: { path: string; init: RequestInit }[] = [];
    const match = matchIntent('I have 20 min, under 40 HKD, something spicy and halal');
    const first = await loadChatData(requestsFor(match), fakeFetch(calls), 0);
    expect(calls.map((call) => call.path)).toEqual([
      '/api/menu-items?maxWait=20&maxPrice=40&diet=halal',
    ]);
    expect(first.foods?.emptyState).toBe('halal_unconfirmed');
    expect(first.foodsWithoutDiet).toBeUndefined();

    calls.length = 0;
    const button = halalFallbackSuggestion('en', match.slots);
    const second = await loadChatData(requestsFor(matchIntent(button.query)), fakeFetch(calls), 0);
    expect(calls.map((call) => call.path)).toEqual([
      '/api/menu-items?maxWait=20&maxPrice=40&diet=halal',
      '/api/menu-items?maxWait=20&maxPrice=40',
    ]);
    for (const call of calls) {
      expect(call.init.method).toBe('GET');
      expect(call.init.body).toBeUndefined();
    }
    expect(second.foodsWithoutDiet?.items).toHaveLength(1);
  });

  it('reads every kind of data and takes the time from the app, not the browser', async () => {
    const calls: { path: string; init: RequestInit }[] = [];
    const requests: ChatRequest[] = [
      { key: 'vendors', path: '/api/vendors' },
      { key: 'orders', path: '/api/orders' },
      { key: 'wallet', path: '/api/wallet/me' },
    ];
    const data = await loadChatData(requests, fakeFetch(calls), 1);
    expect(data.nowMs).toBe(NOW);
    expect(data.vendors).toHaveLength(1);
    expect(data.orders).toHaveLength(1);
    expect(data.walletHkd).toBe(300);
  });

  it('refuses a path that is not an allowed student endpoint before any request is made', async () => {
    const calls: { path: string; init: RequestInit }[] = [];
    await expect(
      loadChatData([{ key: 'vendors', path: '/api/admin/clock' }], fakeFetch(calls), 0),
    ).rejects.toThrow('path not allowed');
    await expect(
      loadChatData(
        [{ key: 'vendors', path: 'https://example.com/api/vendors' }],
        fakeFetch(calls),
        0,
      ),
    ).rejects.toThrow('path not allowed');
    expect(calls).toEqual([]);
  });

  it('fails when a request fails, so the page can show the data-error reply', async () => {
    await expect(
      loadChatData([{ key: 'wallet', path: '/api/wallet/me' }], fakeFetch([], false), 0),
    ).rejects.toThrow('request failed');
  });
});
