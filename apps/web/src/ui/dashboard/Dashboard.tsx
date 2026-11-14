'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_NAME } from '@/brand';
import type { MenuResponse, VendorListResponse } from '@/server/menuService';
import type { MenuItemView } from '@/server/menuView';
import type { ChatLanguage } from '@app/core';
import { AddedToast, type ToastMessage } from '../cart/AddedToast';
import { CartDrawer } from '../cart/CartDrawer';
import { ChatPanel } from '../chat/ChatPanel';
import { NotificationBell } from '../notifications/NotificationBell';
import { useCart } from '../cart/CartProvider';
import { cartCount, conflictsWithCart } from '../cart/cartReducer';
import { AppHeader } from '../primitives';
import { SignOutButton } from '../SignOutButton';
import { FilterPanel, type BuildingChoice, type ProfileSummary } from './FilterPanel';
import { focusableIn, nextFocusIndex } from './focusTrap';
import { ItemList, PAGE_SIZE } from './ItemList';
import { VendorStrip } from './VendorStrip';
import { useIsDesktop } from './useIsDesktop';
import { useLiveRefresh } from './useLiveRefresh';
import {
  DEFAULT_FILTERS,
  FROM_HINT,
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
  outletPhotos?: readonly string[];
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
  const isDesktop = useIsDesktop();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const panelOpen = isDesktop ? !collapsed : sheetOpen;
  const [cartOpen, setCartOpen] = useState(false);
  const cart = useCart();
  const cartTotal = cartCount(cart.state);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastCounter = useRef(0);
  const clearToast = useCallback(() => setToast(null), []);
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
      if (!ok) return;
      cart.dispatch({ type: 'replace', vendor, line });
    } else {
      cart.dispatch({ type: 'add', vendor, line });
    }
    toastCounter.current += 1;
    setToast({ id: toastCounter.current, text: `Added to cart: ${item.name}` });
  }

  const filterCount = activeFilterCount(filters);

  const closeSheet = useCallback((): void => {
    setSheetOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (isDesktop && sheetOpen) setSheetOpen(false);
  }, [isDesktop, sheetOpen]);

  useEffect(() => {
    if (!sheetOpen || isDesktop) return;
    const panel = panelRef.current;
    if (panel === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    let timer: ReturnType<typeof setTimeout> | undefined;
    function focusFirst(attempt: number): void {
      if (panel === null) return;
      focusableIn(panel)[0]?.focus();
      if (!panel.contains(document.activeElement) && attempt < 8) {
        timer = setTimeout(() => focusFirst(attempt + 1), 40);
      }
    }
    focusFirst(0);
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSheet();
        return;
      }
      if (event.key !== 'Tab' || panel === null) return;
      const items = focusableIn(panel);
      if (items.length === 0) return;
      event.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLElement);
      items[nextFocusIndex(current, items.length, event.shiftKey)]?.focus();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [sheetOpen, isDesktop, closeSheet]);

  function togglePanel(): void {
    if (isDesktop) setCollapsed((current) => !current);
    else setSheetOpen(true);
  }

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
              Cart (
              <span
                key={cartTotal}
                className={cartTotal > 0 ? 'inline-block animate-bump' : 'inline-block'}
              >
                {cartTotal}
              </span>
              )
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
          {menu.meta.needsBuilding ? (
            <span className="block text-muted" data-from-hint-summary>
              {FROM_HINT}
            </span>
          ) : null}
        </p>

        <button
          ref={triggerRef}
          type="button"
          data-filter-toggle
          aria-expanded={panelOpen}
          aria-controls="filter-panel"
          onClick={togglePanel}
          className="flex items-center justify-between rounded-xl border border-navy/60 bg-white px-4 py-3 text-sm font-medium transition-transform active:scale-[0.99] lg:self-start lg:gap-3"
        >
          <span>Filters and sorting</span>
          <span className="rounded-full bg-navy px-2 py-0.5 text-xs text-cream">{filterCount}</span>
        </button>

        <div
          className={`grid gap-4 transition-[grid-template-columns] duration-300 ease-out lg:items-start lg:gap-0 ${
            collapsed ? 'lg:grid-cols-[0px_minmax(0,1fr)]' : 'lg:grid-cols-[19rem_minmax(0,1fr)]'
          }`}
        >
          <div
            data-filter-backdrop
            aria-hidden="true"
            onClick={closeSheet}
            className={`fixed inset-0 z-30 bg-navy/50 transition-opacity duration-300 lg:hidden ${
              sheetOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          />
          <aside
            id="filter-panel"
            ref={panelRef}
            data-filter-panel
            data-open={panelOpen}
            inert={!panelOpen}
            {...(isDesktop ? {} : { role: 'dialog', 'aria-modal': sheetOpen })}
            aria-label="Filters and sorting"
            className={`fixed inset-x-0 bottom-0 z-40 max-h-[85vh] overflow-y-auto overscroll-contain rounded-t-2xl bg-white shadow-xl [transition-duration:300ms] [transition-property:transform,visibility] ease-out lg:sticky lg:top-4 lg:z-auto lg:max-h-none lg:translate-y-0 lg:overflow-hidden lg:rounded-none lg:bg-transparent lg:shadow-none ${
              sheetOpen
                ? 'translate-y-0'
                : 'invisible translate-y-full [transition-delay:0ms,300ms]'
            } ${collapsed ? 'lg:invisible lg:[transition-delay:0ms,300ms]' : 'lg:visible'}`}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-navy/15 bg-white px-4 py-3 lg:hidden">
              <h2 className="text-base font-semibold">Filters and sorting</h2>
              <button
                type="button"
                data-filter-close
                onClick={closeSheet}
                className="rounded-md bg-navy px-3 py-1.5 text-sm font-semibold text-cream"
              >
                Done
              </button>
            </div>
            <div className="p-3 lg:w-[19rem] lg:p-0 lg:pr-6">
              <FilterPanel
                filters={filters}
                onChange={setFilters}
                profile={props.profile}
                buildings={props.buildings}
                currentBuildingId={buildingId}
                onBuildingChange={(next) => void changeBuilding(next)}
                fitsAvailable={!menu.meta.needsBuilding}
              />
            </div>
          </aside>

          <div className="flex min-w-0 flex-col gap-6">
            {notice ? (
              <p role="status" className="rounded-lg bg-cream px-3 py-2 text-sm text-cocoa">
                {notice}
              </p>
            ) : null}
            <VendorStrip
              photos={props.outletPhotos ?? []}
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
      <AddedToast
        toast={toast}
        onView={() => {
          setToast(null);
          setCartOpen(true);
        }}
        onDone={clearToast}
      />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <ChatPanel {...(props.chatLanguage ? { initialLanguage: props.chatLanguage } : {})} />
    </div>
  );
}
