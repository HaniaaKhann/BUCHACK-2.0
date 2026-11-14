import type { ChipTone } from '@app/core';
import type { MenuItemView } from '@/server/menuView';
import { formatHktTime } from '@app/core';
import { formatWaitRange, waitNote, whenToGoText } from './viewModel';

const CHIP_CLASSES: Record<ChipTone, string> = {
  verified: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  neutral: 'border-neutral-200 bg-neutral-100 text-neutral-800',
  warn: 'border-amber-200 bg-amber-50 text-amber-900',
  late: 'border-red-200 bg-red-50 text-red-800',
};

export function ItemCard({
  item,
  schedule,
  onAdd,
}: {
  item: MenuItemView;
  schedule: { freeNow: boolean; classEnd: number | null };
  onAdd?: (item: MenuItemView) => void;
}): React.JSX.Element {
  const note = waitNote(item.wait.source);
  const muted = item.fit.status === 'late';
  return (
    <article
      data-item={item.id}
      data-verified={item.tagsStatus}
      data-fit={item.fit.status}
      className={`flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm ${
        muted ? 'opacity-75' : ''
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-snug">{item.name}</h3>
          <p className="truncate text-sm text-neutral-600">
            {item.vendorName} · {item.category}
          </p>
        </div>
        <p className="shrink-0 text-base font-semibold">HK${item.priceHkd}</p>
      </header>

      <ul className="flex flex-wrap gap-1.5">
        {item.chips.map((chip) => (
          <li
            key={chip.text}
            data-chip-tone={chip.tone}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${CHIP_CLASSES[chip.tone]}`}
          >
            {chip.text}
          </li>
        ))}
      </ul>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Wait</dt>
          <dd className="font-medium">
            {formatWaitRange(item.wait.lowMinutes, item.wait.highMinutes)}
            {note ? (
              <span className="block text-xs font-normal text-neutral-500">{note}</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">When to go</dt>
          <dd
            className={`font-medium ${item.leaveNow && schedule.freeNow ? 'text-emerald-700' : ''}`}
          >
            {whenToGoText(item, schedule)}
          </dd>
        </div>
      </dl>

      {item.cookedFor ? (
        <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Order now, it will be cooked for when you arrive. Pickup slot{' '}
          <strong>{formatHktTime(item.cookedFor.slotStart)}</strong>.
        </p>
      ) : null}
      {onAdd && !item.orderable ? (
        <p className="rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
          Order at the counter. This vendor is not taking app orders right now.
        </p>
      ) : null}
      {onAdd && item.orderable ? (
        <button
          type="button"
          data-add={item.id}
          onClick={() => onAdd(item)}
          className="rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Add to cart
        </button>
      ) : null}
    </article>
  );
}
