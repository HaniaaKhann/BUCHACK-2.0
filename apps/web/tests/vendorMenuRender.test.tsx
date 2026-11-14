import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { VendorMenuItemView } from '../src/server/vendorControls';
import { VendorMenu } from '../src/ui/vendor/VendorMenu';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

const items: VendorMenuItemView[] = [
  {
    id: 'i1',
    name: 'Cola',
    priceHkd: 18,
    category: 'Drinks',
    inStock: true,
    dietTags: [],
    allergens: [],
    tagsVerified: false,
  },
];

const page = (isOwner: boolean): string =>
  renderToStaticMarkup(<VendorMenu vendorId="v1" initialItems={items} isOwner={isOwner} />);

describe('VendorMenu controls', () => {
  it('gives the owner an add form, an edit button and a note that new dishes are unverified', () => {
    const html = page(true);
    expect(html).toContain('Add a dish');
    expect(html).toContain('data-dish-form');
    expect(html).toContain('data-dish-submit');
    expect(html).toContain('data-edit-dish');
    expect(html).toContain('New dishes start with Not verified tags.');
    expect(html).toContain('<option value="Drinks"');
  });

  it('gives staff only the stock switch: no add form, no edit, no tag editor', () => {
    const html = page(false);
    expect(html).not.toContain('Add a dish');
    expect(html).not.toContain('data-dish-form');
    expect(html).not.toContain('data-edit-dish');
    expect(html).not.toContain('data-edit-tags');
    expect(html).toContain('Staff can change stock.');
    expect(html).toContain('In stock: Cola');
  });
});
