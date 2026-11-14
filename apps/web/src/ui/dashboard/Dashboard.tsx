'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_NAME } from '@/brand';
import type { MenuResponse, VendorListResponse } from '@/server/menuService';
import type { MenuItemView } from '@/server/menuView';
import type { ChatLanguage } from '@app/core';
import { CartDrawer } from '../cart/CartDrawer';
import { ChatPanel } from '../chat/ChatPanel';
import { NotificationBell } from '../notifications/NotificationBell';
import { useCart } from '../cart/CartProvider';
import { cartCount, conflictsWithCart } from '../cart/cartReducer';
import { AppHeader } from '../primitives';
import { SignOutButton } from '../SignOutButton';
import { FilterPanel, type BuildingChoice, type ProfileSummary } from './FilterPanel';
import { ItemList, PAGE_SIZE } from './ItemList';
import { VendorStrip } from './VendorStrip';
import { useLiveRefresh } from './useLiveRefresh';
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  formatDemoClock,
  scheduleSummary,
  toQueryString,
  toggleValue,
  type FilterState,
} from './viewModel';

export interface DashboardProps {
  chatLanguage?: ChatLanguage;
  initialMenu: MenuResponse;
  initialVendors: VendorListResponse;
  profile: ProfileSummary;
  buildings: readonly BuildingChoice[];
  currentBuildingId: string | null;
}

async function getJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url, { cache: 'no-store' });
  return response.ok ? ((await response.json()) as T) : null;
}

export function Dashboard(props: DashboardProps): React.JSX.Element {
  const [menu, setMenu] = useState(props.initialMenu);
  const [vendors, setVendors] = useState(props.initialVendors);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [buildingId, setBuildingId] = useState(props.currentBuildingId);
  const [panelOpen, setPanelOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const cart = useCart();
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [notice, setNotice] = useState<string | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const refresh = useCallback(async (): Promise<void> => {
    const query = toQueryString(filtersRef.current);
    const [nextMenu, nextVendors] = await Promise.all([
      getJson<MenuResponse>(`/api/menu-items${query === '' ? '' : `?${query}`}`),
      getJson<VendorListResponse>('/api/vendors'),
    ]);
    if (nextMenu === null || nextVendors === null) {
      setNotice('Could not refresh. Showing the last results.');
      return;
    }
    setNotice(null);
    setMenu(nextMenu);
    setVendors(nextVendors);
  }, []);

  useLiveRefresh(refresh);

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setLimit(PAGE_SIZE);
    void refresh();
  }, [filters, refresh]);

  async function changeBuilding(next: string): Promise<void> {
    setBuildingId(next);
    const response = await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentBuildingId: next }),
    });
    if (!response.ok) setNotice('Could not save your building.');
    await refresh();
  }

  function addToCart(item: MenuItemView): void {
    const vendor = { id: item.vendorId, name: item.vendorName };
    const line = { menuItemId: item.id, name: item.name, priceHkd: item.priceHkd };
    if (conflictsWithCart(cart.state, item.vendorId)) {
      const ok = window.confirm(
        `Your cart has items from ${cart.state.vendorName}. Replace it with items from ${item.vendorName}?`,
      );
      if (ok) cart.dispatch({ type: 'replace', vendor, line });
      return;
    }
    cart.dispatch({ type: 'add', vendor, line });
  }

  const filterCount = activeFilterCount(filters);

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader
        left={<h1 className="text-lg font-semibold tracking-tight">{APP_NAME}</h1>}
        right={
          <>
            <Link href="/onboarding" className="text-sm font-medium underline">
              Profile
            </Link>
            <Link href="/orders" className="text-sm font-medium underline">
              Orders
            </Link>
            <NotificationBell />
            <button
              type="button"
              data-cart-button
              onClick={() => setCartOpen(true)}
              className="rounded-md bg-cream px-3 py-2 text-sm font-semibold text-navy hover:bg-white"
            >
              Cart ({cartCount(cart.state)})
            </button>
            <p className="hidden text-right text-xs sm:block">
              <span className="block font-medium" data-demo-clock>
                {formatDemoClock(menu.meta.now)}
              </span>
              demo time
            </p>
            <SignOutButton />
          </>
        }
      />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:py-6">
        <p className="text-sm text-navy" data-schedule>
          {scheduleSummary(menu.meta.schedule)}
        </p>

        <button
          type="button"
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen((open) => !open)}
          className="flex items-center justify-between rounded-xl border border-navy/60 bg-white px-4 py-3 text-sm font-medium lg:hidden"
        >
          <span>Filters and sorting</span>
          <span className="rounded-full bg-navy px-2 py-0.5 text-xs text-cream">{filterCount}</span>
        </button>

        <div className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start lg:gap-6">
          <aside className={`${panelOpen ? 'block' : 'hidden'} lg:sticky lg:top-4 lg:block`}>
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              profile={props.profile}
              buildings={props.buildings}
              currentBuildingId={buildingId}
              onBuildingChange={(next) => void changeBuilding(next)}
            />
          </aside>

          <div className="flex min-w-0 flex-col gap-6">
            {notice ? (
              <p role="status" className="rounded-lg bg-cream px-3 py-2 text-sm text-cocoa">
                {notice}
              </p>
            ) : null}
            <VendorStrip
              vendors={vendors.vendors}
              selected={filters.vendor}
              onToggle={(id) =>
                setFilters((current) => ({ ...current, vendor: toggleValue(current.vendor, id) }))
              }
            />
            <ItemList
              menu={menu}
              filtersOn={filterCount > 0}
              limit={limit}
              onShowMore={() => setLimit((current) => current + PAGE_SIZE)}
              onAdd={addToCart}
            />
          </div>
        </div>
      </main>
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <ChatPanel {...(props.chatLanguage ? { initialLanguage: props.chatLanguage } : {})} />
    </div>
  );
}
