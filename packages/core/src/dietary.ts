import type { HardFilters } from './ranking.js';

export interface DietOption {
  id: string;
  label: string;
  tag: string | null;
  excludesAllergens: readonly string[];
}

export const DIET_OPTIONS: readonly DietOption[] = [
  { id: 'vegetarian', label: 'Vegetarian', tag: 'vegetarian', excludesAllergens: [] },
  { id: 'vegan', label: 'Vegan', tag: 'vegan', excludesAllergens: [] },
  { id: 'halal', label: 'Halal', tag: 'halal', excludesAllergens: [] },
  { id: 'no_pork', label: 'No pork', tag: 'no_pork', excludesAllergens: [] },
  { id: 'no_beef', label: 'No beef', tag: 'no_beef', excludesAllergens: [] },
  { id: 'gluten_free', label: 'Gluten free', tag: null, excludesAllergens: ['gluten'] },
  { id: 'dairy_free', label: 'Dairy free', tag: null, excludesAllergens: ['dairy'] },
];

export interface AllergenOption {
  id: string;
  label: string;
  dataIds: readonly string[];
}

export const ALLERGEN_OPTIONS: readonly AllergenOption[] = [
  { id: 'nuts', label: 'Nuts', dataIds: ['tree_nut'] },
  { id: 'peanuts', label: 'Peanuts', dataIds: ['peanut'] },
  { id: 'seafood', label: 'Seafood', dataIds: ['fish', 'shellfish'] },
  { id: 'shellfish', label: 'Shellfish', dataIds: ['shellfish'] },
  { id: 'egg', label: 'Egg', dataIds: ['egg'] },
  { id: 'soy', label: 'Soy', dataIds: ['soy'] },
  { id: 'sesame', label: 'Sesame', dataIds: ['sesame'] },
  { id: 'dairy', label: 'Dairy', dataIds: ['dairy'] },
  { id: 'gluten', label: 'Gluten', dataIds: ['gluten'] },
];

export const GOAL_OPTIONS = ['more_protein', 'more_carbs', 'balanced', 'none'] as const;
export type Goal = (typeof GOAL_OPTIONS)[number];

export const HALAL_OPTION_ID = 'halal';

export function isDietId(value: string): boolean {
  return DIET_OPTIONS.some((option) => option.id === value);
}

export function isAllergenId(value: string): boolean {
  return ALLERGEN_OPTIONS.some((option) => option.id === value);
}

export function dietOption(id: string): DietOption | undefined {
  return DIET_OPTIONS.find((option) => option.id === id);
}

export function resolveHardFilters(
  dietIds: readonly string[],
  allergenIds: readonly string[],
): HardFilters {
  const requiredDietTags: string[] = [];
  const excluded = new Set<string>();
  for (const id of dietIds) {
    const option = dietOption(id);
    if (option === undefined) continue;
    if (option.tag !== null) requiredDietTags.push(option.tag);
    for (const allergen of option.excludesAllergens) excluded.add(allergen);
  }
  for (const id of allergenIds) {
    const option = ALLERGEN_OPTIONS.find((candidate) => candidate.id === id);
    for (const dataId of option?.dataIds ?? []) excluded.add(dataId);
  }
  return { requiredDietTags, excludedAllergens: [...excluded] };
}
