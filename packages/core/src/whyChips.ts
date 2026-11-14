import { dietOption } from './dietary.js';
import type { FitResult } from './fit.js';
import { formatHktTime } from './time.js';
import type { TagsStatus } from './types.js';

export const VERIFIED_TICK = '✓';
export const NOT_VERIFIED_TEXT = 'Not verified';

export type ChipTone = 'verified' | 'neutral' | 'warn' | 'late';

export interface WhyChip {
  text: string;
  tone: ChipTone;
}

export interface WhyChipInput {
  selectedDietIds: readonly string[];
  selectedAllergenIds: readonly string[];
  item: {
    dietTags: readonly string[];
    allergens: readonly string[];
    tagsStatus: TagsStatus;
  };
  fit: FitResult;
  nextClassStart: number | null;
  vendorOpenNow: boolean;
}

function dietChips(input: WhyChipInput): WhyChip[] {
  if (input.item.tagsStatus !== 'verified') return [];
  return input.selectedDietIds.flatMap((id) => {
    const option = dietOption(id);
    if (option === undefined) return [];
    const hasTag = option.tag !== null && input.item.dietTags.includes(option.tag);
    const avoidsAllergens =
      option.tag === null &&
      option.excludesAllergens.every((a) => !input.item.allergens.includes(a));
    return hasTag || avoidsAllergens
      ? [{ text: `${option.label} ${VERIFIED_TICK}`, tone: 'verified' as const }]
      : [];
  });
}

function readyChip(fit: FitResult): WhyChip {
  const point = formatHktTime(fit.readyPointAt);
  const high = formatHktTime(fit.readyHighAt);
  return {
    text: point === high ? `Ready ${point}` : `Ready ${point} to ${high}`,
    tone: 'neutral',
  };
}

function fitChip(input: WhyChipInput): WhyChip | null {
  if (input.nextClassStart === null) return null;
  const classTime = formatHktTime(input.nextClassStart);
  if (input.fit.status === 'fits') return { text: `Fits your ${classTime} class`, tone: 'neutral' };
  if (input.fit.status === 'tight')
    return { text: `Tight for your ${classTime} class`, tone: 'warn' };
  return {
    text: `May make you late by ${Math.max(1, Math.ceil(input.fit.lateByMinutes))} min`,
    tone: 'late',
  };
}

export function buildWhyChips(input: WhyChipInput): WhyChip[] {
  const chips: WhyChip[] = [...dietChips(input)];
  const filterActive = input.selectedDietIds.length > 0 || input.selectedAllergenIds.length > 0;
  if (filterActive && input.item.tagsStatus !== 'verified') {
    chips.push({ text: NOT_VERIFIED_TEXT, tone: 'warn' });
  }
  if (!input.vendorOpenNow) {
    chips.push({ text: 'Closed now', tone: 'late' });
    return chips;
  }
  chips.push(readyChip(input.fit));
  const fit = fitChip(input);
  if (fit !== null) chips.push(fit);
  return chips;
}
