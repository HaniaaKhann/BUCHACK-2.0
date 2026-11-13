'use client';

import {
  ALLERGEN_OPTIONS,
  DIET_OPTIONS,
  freeWindowsFromClasses,
  type ClassEntry,
  type Goal,
} from '@app/core';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, Card, ErrorNote, Field, Select, TextInput, ToggleChip } from './primitives';

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
  currentBuildingId: string | null;
}

interface ClassRow {
  key: number;
  course: string;
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
}: {
  buildings: readonly BuildingOption[];
  initial: OnboardingInitial;
}): React.JSX.Element {
  const router = useRouter();
  const [dietTags, setDietTags] = useState<string[]>(initial.dietTags);
  const [allergens, setAllergens] = useState<string[]>(initial.allergens);
  const [goal, setGoal] = useState<Goal>(initial.goal);
  const [eatMinutes, setEatMinutes] = useState(initial.eatMinutes);
  const [language, setLanguage] = useState(initial.chatLanguage);
  const [buildingId, setBuildingId] = useState(initial.currentBuildingId ?? '');
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addRow = (): void =>
    setRows((current) => [
      ...current,
      {
        key: Date.now() + current.length,
        course: '',
        weekday: 1,
        buildingId: '',
        start: '',
        end: '',
      },
    ]);
  const updateRow = (key: number, change: Partial<ClassRow>): void =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));

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
    if (buildingId === '') {
      setError('Pick the building you are in right now.');
      return;
    }
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
      currentBuildingId: buildingId,
    });
    const windowsError =
      profileError ??
      (await send('/api/free-windows', 'PUT', { windows: freeWindowsFromClasses(entries) }));
    setBusy(false);
    if (windowsError !== null) {
      setError(windowsError);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Card title="Where are you now?">
        <Field label="Building" hint="Used for walk times. No GPS is ever used.">
          <Select value={buildingId} onChange={(event) => setBuildingId(event.target.value)}>
            <option value="">Choose a building</option>
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.campus} · {building.name}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      <Card title="Diet">
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
        <p className="text-xs text-neutral-600">
          Only items a vendor has confirmed are treated as safe. Halal shows items only once a
          vendor confirms them, and we never guess.
        </p>
      </Card>

      <Card title="Allergens to avoid">
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
      </Card>

      <Card title="Goal and eating style">
        <Field label="Health goal">
          <Select value={goal} onChange={(event) => setGoal(event.target.value as Goal)}>
            {GOALS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex gap-2">
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
      </Card>

      <Card title="Timetable (optional)">
        <p className="text-xs text-neutral-600">
          Add your classes to see what fits before your next one. Only your free gaps and the
          buildings around them are saved. Course names and class times are never stored.
        </p>
        {rows.map((row) => (
          <div key={row.key} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
            <TextInput
              aria-label="Course (not saved)"
              placeholder="Course (not saved)"
              value={row.course}
              onChange={(event) => updateRow(row.key, { course: event.target.value })}
            />
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
            <Button
              tone="quiet"
              type="button"
              onClick={() => setRows((current) => current.filter((entry) => entry.key !== row.key))}
            >
              Remove
            </Button>
          </div>
        ))}
        <div>
          <Button tone="quiet" type="button" onClick={addRow}>
            Add a class
          </Button>
        </div>
      </Card>

      <ErrorNote message={error} />
      <Button type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save and continue'}
      </Button>
    </form>
  );
}
