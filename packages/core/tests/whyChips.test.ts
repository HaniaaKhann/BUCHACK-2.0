import { describe, expect, it } from 'vitest';
import { DIET_OPTIONS } from '../src/dietary.js';
import type { FitResult } from '../src/fit.js';
import { MS_PER_MINUTE } from '../src/config.js';
import { hktMidnight } from '../src/time.js';
import {
  NOT_VERIFIED_TEXT,
  VERIFIED_TICK,
  buildWhyChips,
  type WhyChipInput,
} from '../src/whyChips.js';

const at = (hours: number, minutes = 0): number =>
  hktMidnight('2026-11-17') + (hours * 60 + minutes) * MS_PER_MINUTE;

const fit = (overrides: Partial<FitResult> = {}): FitResult => ({
  status: 'fits',
  arriveAt: at(12, 30),
  readyPointAt: at(12, 41),
  readyHighAt: at(12, 46),
  pickupAt: at(12, 46),
  deadline: at(13, 10),
  lateByMinutes: 0,
  ...overrides,
});

const input = (overrides: Partial<WhyChipInput> = {}): WhyChipInput => ({
  selectedDietIds: [],
  item: { dietTags: ['vegetarian'], allergens: ['soy'], tagsStatus: 'verified' },
  fit: fit(),
  nextClassStart: at(13, 30),
  vendorOpenNow: true,
  ...overrides,
});

const texts = (chips: { text: string }[]): string[] => chips.map((chip) => chip.text);

describe('verified diet chips', () => {
  it('ticks a selected diet the vendor has verified', () => {
    const chips = buildWhyChips(input({ selectedDietIds: ['vegetarian'] }));
    expect(texts(chips)).toContain(`Vegetarian ${VERIFIED_TICK}`);
    expect(texts(chips)).not.toContain(NOT_VERIFIED_TEXT);
  });

  it('ticks a free-from diet only when the verified allergens avoid it', () => {
    const base = input({ selectedDietIds: ['gluten_free'] });
    expect(texts(buildWhyChips(base))).toContain(`Gluten free ${VERIFIED_TICK}`);
    const withGluten = input({
      selectedDietIds: ['gluten_free'],
      item: { dietTags: [], allergens: ['gluten'], tagsStatus: 'verified' },
    });
    expect(texts(buildWhyChips(withGluten)).join(' ')).not.toContain(VERIFIED_TICK);
  });

  it('never ticks halal on a verified item that does not carry the halal tag', () => {
    const chips = buildWhyChips(input({ selectedDietIds: ['halal'] }));
    expect(texts(chips).join(' ')).not.toContain('Halal');
    expect(texts(chips).join(' ')).not.toContain(VERIFIED_TICK);
  });

  it('ticks halal only when a verified item carries the halal tag', () => {
    const chips = buildWhyChips(
      input({
        selectedDietIds: ['halal'],
        item: { dietTags: ['halal'], allergens: [], tagsStatus: 'verified' },
      }),
    );
    expect(texts(chips)).toContain(`Halal ${VERIFIED_TICK}`);
  });
});

describe('unverified items', () => {
  it('shows Not verified and never a tick for any diet, however many are selected', () => {
    const everyDiet = DIET_OPTIONS.map((option) => option.id);
    for (const selected of [[], ['vegetarian'], ['halal'], ['gluten_free'], everyDiet]) {
      const chips = buildWhyChips(
        input({
          selectedDietIds: selected,
          item: {
            dietTags: ['vegetarian', 'vegan', 'halal', 'no_pork', 'no_beef'],
            allergens: [],
            tagsStatus: 'unverified',
          },
        }),
      );
      expect(texts(chips)).toContain(NOT_VERIFIED_TEXT);
      expect(texts(chips).join(' ')).not.toContain(VERIFIED_TICK);
    }
  });
});

describe('ready and fit chips', () => {
  it('shows the ready range and a fits message', () => {
    expect(texts(buildWhyChips(input()))).toEqual([
      'Ready 12:41 to 12:46',
      'Fits your 13:30 class',
    ]);
  });

  it('shows a single time when point and high end fall in the same minute', () => {
    const chips = buildWhyChips(input({ fit: fit({ readyHighAt: at(12, 41) }) }));
    expect(texts(chips)[0]).toBe('Ready 12:41');
  });

  it('says tight, and says how late an item may make the student', () => {
    expect(texts(buildWhyChips(input({ fit: fit({ status: 'tight' }) })))).toContain(
      'Tight for your 13:30 class',
    );
    const late = buildWhyChips(input({ fit: fit({ status: 'late', lateByMinutes: 3.2 }) }));
    expect(texts(late)).toContain('May make you late by 4 min');
    expect(late.at(-1)?.tone).toBe('late');
  });

  it('leaves out the fit chip when there is no next class', () => {
    expect(texts(buildWhyChips(input({ nextClassStart: null })))).toEqual(['Ready 12:41 to 12:46']);
  });

  it('says closed instead of a ready time when the vendor is shut', () => {
    expect(texts(buildWhyChips(input({ vendorOpenNow: false })))).toEqual(['Closed now']);
  });
});
