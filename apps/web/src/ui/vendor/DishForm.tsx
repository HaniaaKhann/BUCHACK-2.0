'use client';

import { ORDER_MAX_TOTAL_HKD } from '@app/core';
import { useState, type FormEvent } from 'react';
import { Button, ErrorNote, TextInput } from '../primitives';

export interface DishValues {
  name: string;
  priceHkd: number;
  category: string;
}

export interface DishFormProps {
  initial: { name: string; priceHkd: number | null; category: string };
  submitLabel: string;
  categories: readonly string[];
  clearOnSuccess?: boolean;
  stacked?: boolean;
  onSubmit: (values: DishValues) => Promise<string | null>;
  onCancel?: () => void;
}

export function DishForm(props: DishFormProps): React.JSX.Element {
  const [name, setName] = useState(props.initial.name);
  const [price, setPrice] = useState(
    props.initial.priceHkd === null ? '' : String(props.initial.priceHkd),
  );
  const [category, setCategory] = useState(props.initial.category);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const listId = `dish-categories-${props.submitLabel.replace(/\s+/g, '-').toLowerCase()}`;

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const priceHkd = Number(price);
    const valid =
      name.trim() !== '' &&
      category.trim() !== '' &&
      Number.isInteger(priceHkd) &&
      priceHkd >= 1 &&
      priceHkd <= ORDER_MAX_TOTAL_HKD;
    if (!valid) {
      setError(
        `Enter a name, a whole-number price from 1 to ${ORDER_MAX_TOTAL_HKD}, and a category.`,
      );
      return;
    }
    setBusy(true);
    const message = await props.onSubmit({
      name: name.trim(),
      priceHkd,
      category: category.trim(),
    });
    setBusy(false);
    setError(message);
    if (message === null && props.clearOnSuccess) {
      setName('');
      setPrice('');
      setCategory('');
    }
  }

  return (
    <form
      data-dish-form
      onSubmit={(event) => void submit(event)}
      className={
        props.stacked === true
          ? 'grid gap-3'
          : 'grid gap-3 sm:grid-cols-[2fr_1fr_1.5fr_auto] sm:items-end'
      }
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Name</span>
        <TextInput
          data-dish-name
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Price (HK$)</span>
        <TextInput
          data-dish-price
          inputMode="numeric"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Category</span>
        <TextInput
          data-dish-category
          list={listId}
          value={category}
          maxLength={40}
          onChange={(event) => setCategory(event.target.value)}
        />
        <datalist id={listId}>
          {props.categories.map((entry) => (
            <option key={entry} value={entry} />
          ))}
        </datalist>
      </label>
      <div className="flex gap-2">
        <Button type="submit" data-dish-submit disabled={busy}>
          {busy ? 'Saving…' : props.submitLabel}
        </Button>
        {props.onCancel ? (
          <Button type="button" tone="quiet" data-dish-cancel onClick={props.onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
      <div className={props.stacked === true ? '' : 'sm:col-span-4'}>
        <ErrorNote message={error} />
      </div>
    </form>
  );
}
