'use client';

import { ALLERGEN_OPTIONS, DIET_OPTIONS, type ClassEntry, type Goal } from '@app/core';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { ReactNode } from 'react';
import { Button, ErrorNote, Field, Select, TextInput, ToggleChip } from './primitives';

function Section({ title, children }: { title: string; children: ReactNode }): React.JSX.Element {
  return (
    <section className="flex flex-col gap-3 border-t border-navy/10 pt-8 first:border-t-0 first:pt-0">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

export interface BuildingOption {
  id: string;
  campus: string;
  name: string;
}

export interface OnboardingInitial {
  dietTags: string[];
  allergens: string[];
  goal: Goal;
  eatMinutes: number;
  chatLanguage: 'en' | 'zh_HK' | 'zh_CN';
}

export interface SavedClass {
  weekday: number;
  startMinute: number;
  endMinute: number;
  buildingId: string;
}

interface ClassRow {
  key: number;
  weekday: number;
  buildingId: string;
  start: string;
  end: string;
}

const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
];

const GOALS: { value: Goal; label: string }[] = [
  { value: 'none', label: 'No preference' },
  { value: 'more_protein', label: 'More protein' },
  { value: 'more_carbs', label: 'More carbs' },
  { value: 'balanced', label: 'Balanced' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'zh_HK', label: '繁體中文' },
  { value: 'zh_CN', label: '简体中文' },
] as const;

const EAT_AT_CANTEEN_MINUTES = 15;

function toMinutes(clock: string): number {
  const [hours, minutes] = clock.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function toClock(minute: number): string {
  const hours = Math.floor(minute / 60);
  return `${String(hours).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

function toggled(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

async function send(path: string, method: string, body: unknown): Promise<string | null> {
  const response = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (response.ok) return null;
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? 'Could not save. Please try again.';
}

export function OnboardingForm({
  buildings,
  initial,
  savedClasses,
  gapsWithoutClasses,
}: {
  buildings: readonly BuildingOption[];
  initial: OnboardingInitial;
  savedClasses: readonly SavedClass[];
  gapsWithoutClasses: boolean;
}): React.JSX.Element {
  const router = useRouter();
  const [dietTags, setDietTags] = useState<string[]>(initial.dietTags);
  const [allergens, setAllergens] = useState<string[]>(initial.allergens);
  const [goal, setGoal] = useState<Goal>(initial.goal);
  const [eatMinutes, setEatMinutes] = useState(initial.eatMinutes);
  const [language, setLanguage] = useState(initial.chatLanguage);
  const [rows, setRows] = useState<ClassRow[]>(() =>
    savedClasses.map((entry, index) => ({
      key: index,
      weekday: entry.weekday,
      buildingId: entry.buildingId,
      start: toClock(entry.startMinute),
      end: toClock(entry.endMinute),
    })),
  );
  const [classesTouched, setClassesTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addRow = (): void => {
    setClassesTouched(true);
    setRows((current) => [
      ...current,
      {
        key: Math.max(-1, ...current.map((row) => row.key)) + 1,
        weekday: 1,
        buildingId: '',
        start: '',
        end: '',
      },
    ]);
  };
  const updateRow = (key: number, change: Partial<ClassRow>): void => {
    setClassesTouched(true);
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));
  };
  const removeRow = (key: number): void => {
    setClassesTouched(true);
    setRows((current) => current.filter((entry) => entry.key !== key));
  };

  function classEntries(): ClassEntry[] | string {
    const entries: ClassEntry[] = [];
    for (const row of rows) {
      if (row.buildingId === '' || row.start === '' || row.end === '') {
        return 'Fill in the building, start and end of every class, or remove the row.';
      }
      if (toMinutes(row.end) <= toMinutes(row.start)) return 'A class must end after it starts.';
      entries.push({
        weekday: row.weekday,
        startMinute: toMinutes(row.start),
        endMinute: toMinutes(row.end),
        buildingId: row.buildingId,
      });
    }
    return entries;
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    const entries = classEntries();
    if (typeof entries === 'string') {
      setError(entries);
      return;
    }

    setBusy(true);
    const profileError = await send('/api/me', 'PATCH', {
      dietTags,
      allergens,
      goal,
      eatMinutes,
      chatLanguage: language,
    });
    const classesError =
      profileError ??
      (classesTouched ? await send('/api/classes', 'PUT', { classes: entries }) : null);
    setBusy(false);
    if (classesError !== null) {
      setError(classesError);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <Section title="Diet">
        <div className="flex flex-wrap gap-2">
          {DIET_OPTIONS.map((option) => (
            <ToggleChip
              key={option.id}
              selected={dietTags.includes(option.id)}
              onToggle={() => setDietTags((current) => toggled(current, option.id))}
            >
              {option.label}
            </ToggleChip>
          ))}
        </div>
        <p className="text-xs text-muted">
          Only items a vendor has confirmed are treated as safe. Halal shows items only once a
          vendor confirms them, and we never guess.
        </p>
      </Section>

      <Section title="Allergens to avoid">
        <div className="flex flex-wrap gap-2">
          {ALLERGEN_OPTIONS.map((option) => (
            <ToggleChip
              key={option.id}
              selected={allergens.includes(option.id)}
              onToggle={() => setAllergens((current) => toggled(current, option.id))}
            >
              {option.label}
            </ToggleChip>
          ))}
        </div>
      </Section>

      <Section title="Goal and eating style">
        <Field label="Health goal">
          <Select value={goal} onChange={(event) => setGoal(event.target.value as Goal)}>
            {GOALS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-wrap gap-2">
          <ToggleChip
            selected={eatMinutes === EAT_AT_CANTEEN_MINUTES}
            onToggle={() => setEatMinutes(EAT_AT_CANTEEN_MINUTES)}
          >
            Eat at the canteen (15 min)
          </ToggleChip>
          <ToggleChip selected={eatMinutes === 0} onToggle={() => setEatMinutes(0)}>
            Take it to class (0 min)
          </ToggleChip>
        </div>
        <Field
          label="Chatbot language"
          hint="This sets the chatbot language only. The rest is English."
        >
          <Select
            value={language}
            onChange={(event) => setLanguage(event.target.value as typeof language)}
          >
            {LANGUAGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <div>
        <Section title="Timetable (optional)">
          <p className="text-xs text-muted">
            Add your classes to see what fits before your next one. Your classes (day, start, end
            and building) stay on your profile until you change or delete them. Course names are
            never stored.
          </p>
          {gapsWithoutClasses && !classesTouched ? (
            <p className="text-xs text-muted" data-legacy-gaps>
              Your free gaps from an earlier timetable are still in use. Add your classes here to
              replace them.
            </p>
          ) : null}
          {rows.map((row) => (
            <div key={row.key} data-class-row className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Select
                aria-label="Day"
                value={row.weekday}
                onChange={(event) => updateRow(row.key, { weekday: Number(event.target.value) })}
              >
                {WEEKDAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Building"
                value={row.buildingId}
                onChange={(event) => updateRow(row.key, { buildingId: event.target.value })}
              >
                <option value="">Building</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </Select>
              <TextInput
                aria-label="Start"
                type="time"
                value={row.start}
                onChange={(event) => updateRow(row.key, { start: event.target.value })}
              />
              <TextInput
                aria-label="End"
                type="time"
                value={row.end}
                onChange={(event) => updateRow(row.key, { end: event.target.value })}
              />
              <Button tone="quiet" type="button" onClick={() => removeRow(row.key)}>
                Remove
              </Button>
            </div>
          ))}
          <div>
            <Button tone="quiet" type="button" onClick={addRow}>
              Add a class
            </Button>
          </div>
        </Section>
      </div>

      <div className="flex flex-col gap-3">
        <ErrorNote message={error} />
        <Button type="submit" disabled={busy} className="sm:self-start">
          {busy ? 'Saving…' : 'Save and continue'}
        </Button>
      </div>
    </form>
  );
}
