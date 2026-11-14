import { useState } from 'react';
import type { VendorListItem } from '@/server/menuService';
import { outletPhotoPath, outletSlug } from '../outletSlug';
import { BUSY_LABELS, formatWaitRange, waitNote } from './viewModel';

const BUSY_CLASSES = {
  quiet: 'bg-cream text-navy',
  normal: 'border border-navy/40 bg-white text-navy',
  rush: 'bg-berry text-white',
} as const;

const TILE_CLASSES = [
  'bg-navy text-cream',
  'bg-berry text-cream',
  'bg-cocoa text-cream',
  'bg-sky text-navy',
] as const;

function tileClass(vendorId: string): string {
  let sum = 0;
  for (const char of vendorId) sum += char.charCodeAt(0);
  return TILE_CLASSES[sum % TILE_CLASSES.length] ?? TILE_CLASSES[0];
}

function OutletImageSlot({
  vendor,
  hasPhoto,
}: {
  vendor: VendorListItem;
  hasPhoto: boolean;
}): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  if (hasPhoto && !failed) {
    return (
      <span data-image-slot="photo" className="block h-12 w-12 shrink-0 overflow-hidden rounded-lg">
        <img
          src={outletPhotoPath(vendor.name)}
          alt={vendor.name}
          width={48}
          height={48}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-12 w-12 object-cover"
        />
      </span>
    );
  }
  return (
    <span
      data-image-slot="tile"
      aria-hidden="true"
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-xl font-bold ${tileClass(vendor.id)}`}
    >
      {vendor.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function VendorStrip({
  vendors,
  selected,
  onToggle,
  photos = [],
}: {
  vendors: readonly VendorListItem[];
  selected: readonly string[];
  onToggle: (vendorId: string) => void;
  photos?: readonly string[];
}): React.JSX.Element {
  return (
    <section aria-label="Vendors" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Vendors
        <span className="ml-2 font-normal normal-case text-muted">tap to filter</span>
      </h2>
      <ul className="-mx-4 flex snap-x scroll-pl-4 gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-pl-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0 xl:grid-cols-4">
        {vendors.map((vendor) => {
          const note = waitNote(vendor.wait.source);
          const isSelected = selected.includes(vendor.id);
          return (
            <li key={vendor.id} className="w-60 shrink-0 snap-start lg:w-auto">
              <button
                type="button"
                aria-pressed={isSelected}
                data-vendor={vendor.id}
                onClick={() => onToggle(vendor.id)}
                className={`flex h-full w-full gap-3 rounded-xl border p-3 text-left transition-shadow hover:shadow-md ${
                  isSelected
                    ? 'border-navy bg-white ring-2 ring-navy'
                    : 'border-navy/15 bg-white hover:border-navy/60'
                }`}
              >
                <OutletImageSlot
                  vendor={vendor}
                  hasPhoto={photos.includes(outletSlug(vendor.name))}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold leading-snug">{vendor.name}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        vendor.openNow ? 'bg-navy text-cream' : 'bg-cream text-muted'
                      }`}
                    >
                      {vendor.openNow ? 'Open' : 'Closed'}
                    </span>
                  </span>
                  <span className="text-xs text-muted">
                    {vendor.building.name} · {vendor.floor}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="font-medium">
                      Wait {formatWaitRange(vendor.wait.lowMinutes, vendor.wait.highMinutes)}
                    </span>
                    {vendor.walk ? (
                      <span className="text-muted">
                        {vendor.walk.minutes} min walk
                        {vendor.walk.source === 'estimate' ? ' (est.)' : ''}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${BUSY_CLASSES[vendor.busyState]}`}
                    >
                      {BUSY_LABELS[vendor.busyState]}
                    </span>
                    {vendor.paused ? (
                      <span className="rounded-full bg-cream px-2 py-0.5 text-xs font-medium text-cocoa">
                        Orders paused
                      </span>
                    ) : null}
                    {note ? <span className="text-xs text-muted">{note}</span> : null}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
