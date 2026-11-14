import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SimulatedResult } from '../src/server/accuracy';
import { accuracySchema } from '../src/server/accuracy';
import { AccuracyView } from '../src/ui/admin/AccuracyView';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

const file = fileURLToPath(new URL('../public/accuracy.json', import.meta.url));
const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));

function numbersIn(value: unknown, into: Set<number> = new Set()): Set<number> {
  if (typeof value === 'number') into.add(value);
  else if (Array.isArray(value)) for (const entry of value) numbersIn(entry, into);
  else if (value !== null && typeof value === 'object') {
    for (const entry of Object.values(value)) numbersIn(entry, into);
  }
  return into;
}

const data = accuracySchema.parse(raw);
const ok: SimulatedResult = { status: 'ok', data };
const emptyInApp = { n: 0, maeMinutes: null, onTimeRate: null };

function values(html: string): number[] {
  return [...html.matchAll(/data-value="([^"]*)"/g)]
    .map((match) => match[1] ?? '')
    .filter((text) => text !== '')
    .map(Number);
}

describe('AccuracyView with the simulated backtest', () => {
  const html = renderToStaticMarkup(<AccuracyView simulated={ok} inApp={emptyInApp} />);

  it('says the numbers are simulated, in one plain sentence', () => {
    expect(html).toContain(
      'These numbers come from simulated data, not real canteen measurements.',
    );
    expect(html).toContain('Simulated data');
  });

  it('shows every model for each table and no number that is not in accuracy.json', () => {
    const shown = values(html);
    const tables = 2 + data.byWeekType.length;
    expect(shown).toHaveLength(tables * 3 * 3);
    const known = numbersIn(raw);
    for (const value of shown) expect(known.has(value)).toBe(true);
    for (const model of data.models) expect(html).toContain(model.name);
  });

  it('shows the in-app empty state when there are no completed orders, with no invented numbers', () => {
    expect(html).toContain('data-empty="in-app"');
    expect(html).toContain('No completed in-app orders yet.');
    expect(html).not.toContain('data-panel="in-app"');
  });
});

describe('AccuracyView states', () => {
  it('shows a clear message when the backtest file is missing or unreadable', () => {
    const missing = renderToStaticMarkup(
      <AccuracyView simulated={{ status: 'missing' }} inApp={emptyInApp} />,
    );
    expect(missing).toContain('data-empty="simulated"');
    expect(missing).toContain('not available yet');
    const invalid = renderToStaticMarkup(
      <AccuracyView simulated={{ status: 'invalid' }} inApp={emptyInApp} />,
    );
    expect(invalid).toContain('could not be read');
    expect(values(missing)).toEqual([]);
  });

  it('shows real in-app numbers once there are completed orders', () => {
    const html = renderToStaticMarkup(
      <AccuracyView
        simulated={{ status: 'missing' }}
        inApp={{ n: 3, maeMinutes: 1.67, onTimeRate: 0.667 }}
      />,
    );
    expect(html).toContain('data-panel="in-app"');
    expect(values(html)).toEqual([3, 1.67, 0.667]);
    expect(html).not.toContain('data-empty="in-app"');
  });
});
