'use client';

import { DATA_ALLERGENS, DATA_DIET_TAGS } from '@app/core';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import type { VendorMenuItemView } from '@/server/vendorControls';
import { Button, ErrorNote, Switch } from '../primitives';

interface VendorMenuProps {
  vendorId: string;
  initialItems: VendorMenuItemView[];
  isOwner: boolean;
}

const labelOf = (list: readonly { id: string; label: string }[], id: string): string =>
  list.find((entry) => entry.id === id)?.label ?? id;

function TagEditor({
  item,
  onConfirm,
}: {
  item: VendorMenuItemView;
  onConfirm: (dietTags: string[], allergens: string[]) => Promise<void>;
}): React.JSX.Element {
  const [diet, setDiet] = useState(new Set(item.dietTags));
  const [allergens, setAllergens] = useState(new Set(item.allergens));

  const toggle = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  return (
    <div className="mt-3 space-y-3 rounded-md bg-neutral-50 p-3 text-sm">
      <fieldset>
        <legend className="font-medium">Diet tags this dish really meets</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {DATA_DIET_TAGS.map((tag) => (
            <label key={tag.id} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                data-diet={tag.id}
                checked={diet.has(tag.id)}
                onChange={() => setDiet(toggle(diet, tag.id))}
              />
              {tag.label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="font-medium">Allergens this dish contains</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {DATA_ALLERGENS.map((allergen) => (
            <label key={allergen.id} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                data-allergen={allergen.id}
                checked={allergens.has(allergen.id)}
                onChange={() => setAllergens(toggle(allergens, allergen.id))}
              />
              {allergen.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Button
        type="button"
        data-confirm-tags
        onClick={() => void onConfirm([...diet], [...allergens])}
      >
        Confirm these tags
      </Button>
    </div>
  );
}

export function VendorMenu({
  vendorId,
  initialItems,
  isOwner,
}: VendorMenuProps): React.JSX.Element {
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    const response = await fetch(`/api/vendor/${vendorId}/menu`, { cache: 'no-store' });
    if (response.ok) setItems(((await response.json()) as { items: VendorMenuItemView[] }).items);
  }, [vendorId]);

  async function setStock(itemId: string, inStock: boolean): Promise<void> {
    setError(null);
    const response = await fetch(`/api/vendor/${vendorId}/menu/${itemId}/stock`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ inStock }),
    });
    if (!response.ok) setError('Could not change stock.');
    await refresh();
  }

  async function confirm(itemId: string, dietTags: string[], allergens: string[]): Promise<void> {
    setError(null);
    const response = await fetch(`/api/vendor/${vendorId}/menu/${itemId}/verify-tags`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dietTags, allergens }),
    });
    if (!response.ok) setError('Could not confirm the tags.');
    else setEditing(null);
    await refresh();
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/vendor" className="text-sm font-medium underline">
            Back to orders
          </Link>
          <h1 className="text-lg font-semibold">Menu and stock</h1>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:py-6">
        <p className="text-sm text-neutral-700">
          {isOwner
            ? 'Imported tags are not verified. Only you can confirm them, and students see a tick only for confirmed dishes.'
            : 'Staff can change stock. Only the owner can confirm diet and allergen tags.'}
        </p>
        <ErrorNote message={error} />
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.id}
              data-item={item.name}
              className="rounded-xl border border-neutral-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-neutral-600">
                    HK${item.priceHkd} · {item.category}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={item.inStock}
                    label={`In stock: ${item.name}`}
                    onChange={(next) => void setStock(item.id, next)}
                  />
                  {item.inStock ? 'In stock' : 'Out'}
                </label>
              </div>
              <p
                className="mt-2 text-sm"
                data-tags-status={item.tagsVerified ? 'verified' : 'unverified'}
              >
                {item.tagsVerified
                  ? `Confirmed: ${
                      item.dietTags.map((id) => labelOf(DATA_DIET_TAGS, id)).join(', ') ||
                      'no diet tags'
                    }`
                  : 'Not verified'}
              </p>
              {isOwner ? (
                editing === item.id ? (
                  <TagEditor
                    item={item}
                    onConfirm={(dietTags, allergens) => confirm(item.id, dietTags, allergens)}
                  />
                ) : (
                  <Button
                    type="button"
                    tone="quiet"
                    className="mt-3"
                    data-edit-tags
                    onClick={() => setEditing(item.id)}
                  >
                    {item.tagsVerified ? 'Edit tags' : 'Review and confirm tags'}
                  </Button>
                )
              ) : null}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
