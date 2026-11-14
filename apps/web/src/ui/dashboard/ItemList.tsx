import type { MenuResponse } from '@/server/menuService';
import type { MenuItemView } from '@/server/menuView';
import { ItemCard } from './ItemCard';
import { emptyMessage, groupByFit, groupHeading } from './viewModel';

export const PAGE_SIZE = 24;

export function ItemList({
  menu,
  filtersOn,
  limit = Number.POSITIVE_INFINITY,
  onShowMore,
  onAdd,
}: {
  menu: MenuResponse;
  filtersOn: boolean;
  limit?: number;
  onShowMore?: () => void;
  onAdd?: (item: MenuItemView) => void;
}): React.JSX.Element {
  if (menu.items.length === 0) {
    const message = emptyMessage(menu.meta, filtersOn);
    return (
      <section
        data-empty-state={menu.meta.emptyState ?? (menu.meta.needsBuilding ? 'building' : 'none')}
        className="rounded-xl border border-dashed border-navy/60 bg-white p-6 text-center"
      >
        <h2 className="text-base font-semibold">{message.title}</h2>
        <p className="mx-auto mt-1 max-w-prose text-sm text-navy">{message.body}</p>
      </section>
    );
  }

  const hasNextClass = menu.meta.schedule.nextClassStart !== null;
  const shown = menu.items.slice(0, limit);
  const hidden = menu.items.length - shown.length;
  const totals = new Map(groupByFit(menu.items).map((group) => [group.status, group.items.length]));
  return (
    <div className="flex flex-col gap-6">
      {groupByFit(shown).map((group) => (
        <section key={group.status} data-group={group.status} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {groupHeading(group.status, hasNextClass)}
            <span className="ml-2 font-normal normal-case text-muted">
              {totals.get(group.status)}
            </span>
          </h2>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {group.items.map((item) => (
              <li key={item.id}>
                <ItemCard item={item} schedule={menu.meta.schedule} {...(onAdd ? { onAdd } : {})} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {hidden > 0 && onShowMore ? (
        <button
          type="button"
          data-show-more
          onClick={onShowMore}
          className="self-center rounded-md border border-navy/60 bg-white px-5 py-2.5 text-sm font-medium hover:bg-navy/10"
        >
          Show {Math.min(PAGE_SIZE, hidden)} more ({hidden} left)
        </button>
      ) : null}
    </div>
  );
}
