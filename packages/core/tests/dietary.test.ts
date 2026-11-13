import { describe, expect, it } from 'vitest';
import {
  ALLERGEN_OPTIONS,
  DIET_OPTIONS,
  isAllergenId,
  isDietId,
  resolveHardFilters,
} from '../src/dietary.js';

describe('vocabulary', () => {
  it('offers every diet and allergen choice from the onboarding brief', () => {
    expect(DIET_OPTIONS.map((option) => option.id)).toEqual([
      'vegetarian',
      'vegan',
      'halal',
      'no_pork',
      'no_beef',
      'gluten_free',
      'dairy_free',
    ]);
    expect(ALLERGEN_OPTIONS.map((option) => option.id)).toEqual([
      'nuts',
      'peanuts',
      'seafood',
      'shellfish',
      'egg',
      'soy',
      'sesame',
      'dairy',
      'gluten',
    ]);
  });

  it('recognises only known ids', () => {
    expect(isDietId('vegan')).toBe(true);
    expect(isDietId('carnivore')).toBe(false);
    expect(isAllergenId('seafood')).toBe(true);
    expect(isAllergenId('tree_nut')).toBe(false);
  });
});

describe('resolveHardFilters', () => {
  it('turns tag diets into required tags and free-from diets into allergen exclusions', () => {
    const filters = resolveHardFilters(['vegetarian', 'gluten_free', 'dairy_free'], []);
    expect(filters.requiredDietTags).toEqual(['vegetarian']);
    expect([...filters.excludedAllergens].sort()).toEqual(['dairy', 'gluten']);
  });

  it('maps the onboarding allergen labels to the ids used in menu data', () => {
    const filters = resolveHardFilters([], ['nuts', 'peanuts', 'seafood']);
    expect([...filters.excludedAllergens].sort()).toEqual([
      'fish',
      'peanut',
      'shellfish',
      'tree_nut',
    ]);
  });

  it('does not repeat an allergen two choices share', () => {
    const filters = resolveHardFilters(['gluten_free'], ['gluten', 'seafood', 'shellfish']);
    expect(filters.excludedAllergens.filter((id) => id === 'gluten')).toHaveLength(1);
    expect(filters.excludedAllergens.filter((id) => id === 'shellfish')).toHaveLength(1);
  });

  it('keeps halal as a required tag so unconfirmed items can never match', () => {
    expect(resolveHardFilters(['halal'], []).requiredDietTags).toEqual(['halal']);
  });

  it('ignores unknown ids', () => {
    expect(resolveHardFilters(['nope'], ['nope'])).toEqual({
      requiredDietTags: [],
      excludedAllergens: [],
    });
  });
});
