import { ALLERGEN_OPTIONS, DIET_OPTIONS, type Goal, type SortKey } from '@app/core';
import { Select, Switch } from '../primitives';
import {
  DEFAULT_FILTERS,
  PRICE_CHOICES,
  SORT_LABELS,
  WAIT_CHOICES,
  toggleValue,
  type FilterState,
  type ProfileFilterId,
} from './viewModel';

export interface ProfileSummary {
  dietTags: readonly string[];
  allergens: readonly string[];
  goal: Goal | null;
}

export interface BuildingChoice {
  id: string;
  campus: string;
  name: string;
}

const GOAL_LABELS: Record<Goal, string> = {
  none: 'No preference',
  more_protein: 'More protein',
  more_carbs: 'More carbs',
  balanced: 'Balanced',
};

function labels(ids: readonly string[], options: readonly { id: string; label: string }[]): string {
  const names = ids.flatMap((id) => options.find((option) => option.id === id)?.label ?? []);
  return names.length > 0 ? names.join(', ') : 'None selected';
}

function ProfileRow({
  title,
  summary,
  disabled,
  on,
  onToggle,
}: {
  title: string;
  summary: string;
  disabled: boolean;
  on: boolean;
  onToggle: (next: boolean) => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-neutral-600">{summary}</p>
      </div>
      {disabled ? (
        <span className="text-xs text-neutral-500">Off</span>
      ) : (
        <Switch checked={on} onChange={onToggle} label={`${title} filter`} />
      )}
    </div>
  );
}

export function FilterPanel({
  filters,
  onChange,
  profile,
  buildings,
  currentBuildingId,
  onBuildingChange,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  profile: ProfileSummary;
  buildings: readonly BuildingChoice[];
  currentBuildingId: string | null;
  onBuildingChange: (buildingId: string) => void;
}): React.JSX.Element {
  const isOn = (id: ProfileFilterId): boolean => !filters.off.includes(id);
  const flip = (id: ProfileFilterId): void =>
    onChange({ ...filters, off: toggleValue(filters.off, id) });
  const goalSet = profile.goal !== null && profile.goal !== 'none';

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-neutral-200 bg-white p-4">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
          Where you are
        </h2>
        <Select
          aria-label="Building you are in"
          value={currentBuildingId ?? ''}
          onChange={(event) => onBuildingChange(event.target.value)}
        >
          <option value="" disabled>
            Choose a building
          </option>
          {buildings.map((building) => (
            <option key={building.id} value={building.id}>
              {building.campus} · {building.name}
            </option>
          ))}
        </Select>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
          Your profile
        </h2>
        <ProfileRow
          title="Diet"
          summary={labels(profile.dietTags, DIET_OPTIONS)}
          disabled={profile.dietTags.length === 0}
          on={isOn('diet')}
          onToggle={() => flip('diet')}
        />
        <ProfileRow
          title="Allergens"
          summary={labels(profile.allergens, ALLERGEN_OPTIONS)}
          disabled={profile.allergens.length === 0}
          on={isOn('allergens')}
          onToggle={() => flip('allergens')}
        />
        <ProfileRow
          title="Health goal"
          summary={profile.goal ? GOAL_LABELS[profile.goal] : 'None selected'}
          disabled={!goalSet}
          on={isOn('goal')}
          onToggle={() => flip('goal')}
        />
        {goalSet && isOn('goal') ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.goalFilter}
              onChange={(event) => onChange({ ...filters, goalFilter: event.target.checked })}
              className="h-4 w-4"
            />
            Only items that match my goal
          </label>
        ) : null}
        <p className="text-xs text-neutral-500">
          Switches turn a profile filter off for this visit only.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
          Narrow down
        </h2>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Max price</span>
          <Select
            value={filters.maxPrice ?? ''}
            onChange={(event) =>
              onChange({
                ...filters,
                maxPrice: event.target.value === '' ? null : Number(event.target.value),
              })
            }
          >
            <option value="">Any</option>
            {PRICE_CHOICES.map((price) => (
              <option key={price} value={price}>
                HK${price}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Max wait</span>
          <Select
            value={filters.maxWait ?? ''}
            onChange={(event) =>
              onChange({
                ...filters,
                maxWait: event.target.value === '' ? null : Number(event.target.value),
              })
            }
          >
            <option value="">Any</option>
            {WAIT_CHOICES.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} min
              </option>
            ))}
          </Select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.fits}
            onChange={(event) => onChange({ ...filters, fits: event.target.checked })}
            className="h-4 w-4"
          />
          Fits before my next class
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.openNow}
            onChange={(event) => onChange({ ...filters, openNow: event.target.checked })}
            className="h-4 w-4"
          />
          Open now
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Sort by</span>
          <Select
            value={filters.sort}
            onChange={(event) => onChange({ ...filters, sort: event.target.value as SortKey })}
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </Select>
        </label>
        {filters.vendor.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange({ ...filters, vendor: [] })}
            className="self-start text-sm underline"
          >
            Clear vendor filter ({filters.vendor.length})
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="self-start text-sm text-neutral-600 underline"
        >
          Reset all
        </button>
      </section>
    </div>
  );
}
