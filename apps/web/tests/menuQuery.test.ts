import { describe, expect, it } from 'vitest';
import { parseMenuQuery, resolveMenuQuery } from '../src/server/menuQuery';

const parse = (query: string) => {
  const result = parseMenuQuery(new URLSearchParams(query));
  if (!result.ok) throw new Error(result.error);
  return result.value;
};

const profile = { dietTags: ['vegetarian'], allergens: ['nuts'], goal: 'more_protein' as const };
const VENDOR = '00000000-0000-4000-8000-000000000001';

describe('parseMenuQuery', () => {
  it('reads defaults when nothing is given', () => {
    expect(parse('')).toEqual({
      diet: null,
      allergens: null,
      goalFilter: false,
      maxPrice: null,
      maxWait: null,
      fits: false,
      openNow: false,
      vendor: [],
      sort: 'best_match',
      off: [],
    });
  });

  it('reads every filter', () => {
    const query = parse(
      `diet=vegan,gluten_free&allergens=nuts&maxPrice=40&maxWait=15&fits=1&openNow=true&sort=lowest_wait&off=diet,goal&goalFilter=1&vendor=${VENDOR}`,
    );
    expect(query).toMatchObject({
      diet: ['vegan', 'gluten_free'],
      allergens: ['nuts'],
      maxPrice: 40,
      maxWait: 15,
      fits: true,
      openNow: true,
      sort: 'lowest_wait',
      off: ['diet', 'goal'],
      goalFilter: true,
      vendor: [VENDOR],
    });
  });

  it('treats an empty diet list as no diet rather than the profile default', () => {
    expect(parse('diet=').diet).toEqual([]);
  });

  it('rejects unknown options and malformed numbers', () => {
    for (const query of [
      'diet=carnivore',
      'allergens=tree_nut',
      'maxPrice=0',
      'maxPrice=1.5',
      'maxPrice=abc',
      'maxWait=999',
      'sort=cheapest',
      'off=everything',
      'vendor=nope',
    ]) {
      expect(parseMenuQuery(new URLSearchParams(query)).ok, query).toBe(false);
    }
  });
});

describe('resolveMenuQuery', () => {
  it('uses the profile filters by default', () => {
    expect(resolveMenuQuery(parse(''), profile)).toMatchObject({
      dietIds: ['vegetarian'],
      allergenIds: ['nuts'],
      goal: 'more_protein',
      goalFilter: false,
    });
  });

  it('turns each profile filter off on its own', () => {
    const dietOff = resolveMenuQuery(parse('off=diet'), profile);
    expect(dietOff.dietIds).toEqual([]);
    expect(dietOff.allergenIds).toEqual(['nuts']);

    const allergensOff = resolveMenuQuery(parse('off=allergens'), profile);
    expect(allergensOff.dietIds).toEqual(['vegetarian']);
    expect(allergensOff.allergenIds).toEqual([]);

    const goalOff = resolveMenuQuery(parse('off=goal&goalFilter=1'), profile);
    expect(goalOff.goal).toBeNull();
    expect(goalOff.goalFilter).toBe(false);
  });

  it('lets an explicit list replace the profile list', () => {
    expect(resolveMenuQuery(parse('diet=vegan'), profile).dietIds).toEqual(['vegan']);
  });

  it('only filters by goal when asked and a goal is set', () => {
    expect(resolveMenuQuery(parse('goalFilter=1'), profile).goalFilter).toBe(true);
    expect(resolveMenuQuery(parse('goalFilter=1'), { ...profile, goal: 'none' }).goalFilter).toBe(
      false,
    );
  });
});
