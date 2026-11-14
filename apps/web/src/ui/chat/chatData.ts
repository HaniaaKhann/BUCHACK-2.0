import {
  isAllowedChatPath,
  type ChatData,
  type ChatFoods,
  type ChatOrder,
  type ChatRequest,
  type ChatVendor,
} from '@app/core';
import type { MenuResponse, VendorListResponse } from '@/server/menuService';
import type { OrderView } from '@/server/orderViews';

export type Fetcher = (path: string, init: RequestInit) => Promise<Response>;

export function toChatVendors(response: VendorListResponse): ChatVendor[] {
  return response.vendors.map((vendor) => ({
    id: vendor.id,
    name: vendor.name,
    openNow: vendor.openNow,
    paused: vendor.paused,
    pickupEnabled: vendor.pickupEnabled,
    busyState: vendor.busyState,
    wait: { lowMinutes: vendor.wait.lowMinutes, highMinutes: vendor.wait.highMinutes },
  }));
}

export function toChatFoods(response: MenuResponse): ChatFoods {
  return {
    items: response.items.map((item) => ({
      id: item.id,
      name: item.name,
      vendorName: item.vendorName,
      priceHkd: item.priceHkd,
      tagsStatus: item.tagsStatus,
      wait: { lowMinutes: item.wait.lowMinutes, highMinutes: item.wait.highMinutes },
      leaveAt: item.leaveAt,
      leaveNow: item.leaveNow,
    })),
    emptyState: response.meta.emptyState,
  };
}

export function toChatOrders(orders: readonly OrderView[]): ChatOrder[] {
  return orders.map((order) => ({
    id: order.id,
    status: order.status,
    vendorName: order.vendor.name,
    placedAt: order.placedAt,
    predicted: { ...order.predicted },
  }));
}

async function readJson(fetcher: Fetcher, request: ChatRequest): Promise<unknown> {
  if (!isAllowedChatPath(request.path)) throw new Error('path not allowed');
  const response = await fetcher(request.path, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error('request failed');
  return response.json();
}

export async function loadChatData(
  requests: readonly ChatRequest[],
  fetcher: Fetcher,
  fallbackNowMs: number,
): Promise<ChatData> {
  const data: ChatData = { nowMs: fallbackNowMs };
  const loaded = await Promise.all(
    requests.map(async (request) => ({ request, body: await readJson(fetcher, request) })),
  );
  for (const { request, body } of loaded) {
    switch (request.key) {
      case 'vendors': {
        const vendors = body as VendorListResponse;
        data.vendors = toChatVendors(vendors);
        data.nowMs = vendors.now;
        break;
      }
      case 'foods':
        data.foods = toChatFoods(body as MenuResponse);
        break;
      case 'foodsWithoutDiet':
        data.foodsWithoutDiet = toChatFoods(body as MenuResponse);
        break;
      case 'orders':
        data.orders = toChatOrders((body as { orders: OrderView[] }).orders);
        break;
      case 'wallet':
        data.walletHkd = (body as { balanceHkd: number }).balanceHkd;
        break;
    }
  }
  return data;
}
