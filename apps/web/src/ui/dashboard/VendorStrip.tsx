import type { VendorListItem } from '@/server/menuService';
import { BUSY_LABELS, formatWaitRange, waitNote } from './viewModel';

const BUSY_CLASSES = {
  quiet: 'bg-emerald-50 text-emerald-800',
  normal: 'bg-neutral-100 text-neutral-800',
  rush: 'bg-red-50 text-red-800',
} as const;

export function VendorStrip({
  vendors,
  selected,
  onToggle,
}: {
  vendors: readonly VendorListItem[];
  selected: readonly string[];
  onToggle: (vendorId: string) => void;
}): React.JSX.Element {
  return (
    <section aria-label="Vendors" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
        Vendors
        <span className="ml-2 font-normal normal-case text-neutral-500">tap to filter</span>
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
                className={`flex h-full w-full flex-col gap-1.5 rounded-xl border p-3 text-left ${
                  isSelected
                    ? 'border-neutral-900 bg-white ring-1 ring-neutral-900'
                    : 'border-neutral-200 bg-white hover:border-neutral-400'
                }`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold leading-snug">{vendor.name}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      vendor.openNow
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {vendor.openNow ? 'Open' : 'Closed'}
                  </span>
                </span>
                <span className="text-xs text-neutral-600">
                  {vendor.building.name} · {vendor.floor}
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="font-medium">
                    Wait {formatWaitRange(vendor.wait.lowMinutes, vendor.wait.highMinutes)}
                  </span>
                  {vendor.walk ? (
                    <span className="text-neutral-600">
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
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                      Orders paused
                    </span>
                  ) : null}
                  {note ? <span className="text-xs text-neutral-500">{note}</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
