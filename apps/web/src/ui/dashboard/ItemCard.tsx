import type { ChipTone } from '@app/core';
import type { MenuItemView } from '@/server/menuView';
import { formatHktTime } from '@app/core';
import { formatWaitRange, waitNote, whenToGoText } from './viewModel';

const CHIP_CLASSES: Record<ChipTone, string> = {
  verified: 'border-navy bg-navy text-cream',
  neutral: 'border-navy/15 bg-cream text-navy',
  warn: 'border-cocoa/50 bg-cream text-cocoa',
  late: 'border-berry bg-white text-berry',
};

export function ItemCard({
  item,
  schedule,
  onAdd,
}: {
  item: MenuItemView;
  schedule: { freeNow: boolean; classEnd: number | null; nextClassStart?: number | null };
  onAdd?: (item: MenuItemView) => void;
}): React.JSX.Element {
  const note = waitNote(item.wait.source);
  const muted = item.fit.status === 'late';
  return (
    <article
      data-item={item.id}
      data-verified={item.tagsStatus}
      data-fit={item.fit.status}
      className={`flex flex-col gap-3 rounded-xl border border-navy/15 bg-white p-4 shadow-sm ${
        muted ? 'opacity-75' : ''
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-snug">{item.name}</h3>
          <p className="truncate text-sm text-muted">
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
          <dt className="text-xs uppercase tracking-wide text-muted">Wait</dt>
          <dd className="font-medium">
            {formatWaitRange(item.wait.lowMinutes, item.wait.highMinutes)}
            {note ? <span className="block text-xs font-normal text-muted">{note}</span> : null}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">When to go</dt>
          <dd className={`font-medium ${item.leaveNow && schedule.freeNow ? 'text-navy' : ''}`}>
            {whenToGoText(item, schedule)}
          </dd>
        </div>
      </dl>

      {item.cookedFor ? (
        <p className="rounded-lg bg-sky/20 px-3 py-2 text-sm text-navy">
          Order now, it will be cooked for when you arrive. Pickup slot{' '}
          <strong>{formatHktTime(item.cookedFor.slotStart)}</strong>.
        </p>
      ) : null}
      {onAdd && !item.orderable ? (
        <p className="rounded-lg bg-cream px-3 py-2 text-sm text-navy">
          Order at the counter. This vendor is not taking app orders right now.
        </p>
      ) : null}
      {onAdd && item.orderable ? (
        <button
          type="button"
          data-add={item.id}
          onClick={() => onAdd(item)}
          className="rounded-md bg-berry px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-berry/90"
        >
          Add to cart
        </button>
      ) : null}
    </article>
  );
}
