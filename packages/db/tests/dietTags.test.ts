import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { withMeatTags } from '../src/seed/dietTags.js';

describe('withMeatTags', () => {
  it('adds no_pork and no_beef to a dish that mentions neither', () => {
    expect(withMeatTags('Chicken Rice', []).sort()).toEqual(['no_beef', 'no_pork']);
  });

  it('leaves out no_pork when the name suggests pork', () => {
    for (const name of ['BBQ Pork Rice', 'Char Siu Noodles', 'Wonton Soup', 'Ham Sandwich']) {
      expect(withMeatTags(name, [])).not.toContain('no_pork');
    }
  });

  it('leaves out no_beef when the name suggests beef', () => {
    for (const name of [
      'Beef Brisket Noodles',
      'Ribeye Steak',
      'Cheeseburger',
      'Bolognese Pasta',
    ]) {
      expect(withMeatTags(name, [])).not.toContain('no_beef');
    }
  });

  it('does not mistake hamburger for ham', () => {
    expect(withMeatTags('Hamburger', [])).toContain('no_pork');
  });

  it('gives vegetarian and vegan dishes both tags whatever the name says', () => {
    expect(withMeatTags('Vegetarian Burger', ['vegetarian']).sort()).toEqual([
      'no_beef',
      'no_pork',
      'vegetarian',
    ]);
  });

  it('keeps the tags it was given and never adds halal', () => {
    const tags = withMeatTags('Plain Congee', ['vegan']);
    expect(tags).toContain('vegan');
    expect(tags).not.toContain('halal');
  });

  it('never produces halal for any dish in the generic menus', () => {
    const file = fileURLToPath(new URL('../seed-data/menus_generic.json', import.meta.url));
    const menus = JSON.parse(readFileSync(file, 'utf8')) as {
      outlets: { items: { name: string; dietTags: string[] }[] }[];
    };
    for (const outlet of menus.outlets) {
      for (const item of outlet.items) {
        expect(withMeatTags(item.name, item.dietTags)).not.toContain('halal');
      }
    }
  });
});
