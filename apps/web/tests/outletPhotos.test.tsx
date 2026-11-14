import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { VendorListResponse } from '../src/server/menuService';
import { listOutletPhotoSlugs, logoExists } from '../src/server/assets';
import { VendorStrip } from '../src/ui/dashboard/VendorStrip';
import { outletPhotoPath, outletSlug } from '../src/ui/outletSlug';
import outlets from '../../../packages/db/seed-data/outlets.json';

const vendor = (name: string, id = 'vendor-1'): VendorListResponse['vendors'][number] => ({
  id,
  name,
  campus: 'BURC',
  floor: 'G/F',
  building: { id: 'b1', name: 'Undergraduate Halls', code: null },
  pickupEnabled: true,
  paused: false,
  busyState: 'normal',
  busyUntil: null,
  openNow: true,
  hoursToday: [{ open: '08:00', close: '17:30' }],
  walk: { minutes: 4, source: 'estimate' },
  wait: { lowMinutes: 5, highMinutes: 9, source: 'live', stale: false },
});

const noop = (): void => undefined;

describe('outlet slugs', () => {
  it('turns names into plain file names', () => {
    expect(outletSlug('Main Canteen')).toBe('main-canteen');
    expect(outletSlug("Books 'n Bites")).toBe('books-n-bites');
    expect(outletSlug('Café@CVA Commons')).toBe('cafe-cva-commons');
    expect(outletSlug('H.F.C. (Hot Food Counter) @ Scholars Court')).toBe(
      'h-f-c-hot-food-counter-scholars-court',
    );
    expect(outletPhotoPath('iCafe')).toBe('/outlets/icafe.jpg');
  });

  it('gives every seeded outlet its own file name', () => {
    const slugs = (outlets as { outlets: { name: string }[] }).outlets.map((outlet) =>
      outletSlug(outlet.name),
    );
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe('finding photos and the logo', () => {
  it('returns nothing, without an error, when there is no photo folder and no logo', () => {
    const empty = mkdtempSync(join(tmpdir(), 'unibowl-assets-'));
    try {
      expect(listOutletPhotoSlugs(empty)).toEqual([]);
      expect(logoExists(empty)).toBe(false);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('finds the photos and the logo that are there', () => {
    const folder = mkdtempSync(join(tmpdir(), 'unibowl-assets-'));
    try {
      mkdirSync(join(folder, 'outlets'));
      writeFileSync(join(folder, 'outlets', 'deli.jpg'), 'x');
      writeFileSync(join(folder, 'outlets', 'notes.txt'), 'x');
      writeFileSync(join(folder, 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
      expect(listOutletPhotoSlugs(folder)).toEqual(['deli']);
      expect(logoExists(folder)).toBe(true);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});

describe('outlet card image slot', () => {
  const strip = (photos: readonly string[]): string =>
    renderToStaticMarkup(
      <VendorStrip vendors={[vendor('Deli')]} selected={[]} onToggle={noop} photos={photos} />,
    );

  it('falls back to a palette tile with the initial when there is no photo', () => {
    const html = strip([]);
    expect(html).toContain('data-image-slot="tile"');
    expect(html).not.toContain('<img');
    expect(html).toMatch(/data-image-slot="tile"[^>]*>D</);
  });

  it('shows the photo, with the outlet name as its alt text, when the file exists', () => {
    const html = strip(['deli']);
    expect(html).toContain('data-image-slot="photo"');
    expect(html).toContain('src="/outlets/deli.jpg"');
    expect(html).toContain('alt="Deli"');
    expect(html).not.toContain('data-image-slot="tile"');
  });

  it('keeps the same 48 pixel box either way, so nothing shifts', () => {
    for (const html of [strip([]), strip(['deli'])]) {
      expect(html).toContain('h-12 w-12');
    }
    expect(strip(['deli'])).toContain('width="48"');
    expect(strip(['deli'])).toContain('height="48"');
  });

  it('shows the tile for an outlet whose photo is not in the list', () => {
    expect(strip(['someone-else'])).toContain('data-image-slot="tile"');
  });
});
