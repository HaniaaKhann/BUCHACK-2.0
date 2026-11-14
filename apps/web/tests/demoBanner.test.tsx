import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DemoBanner } from '../src/ui/DemoBanner';

describe('DemoBanner', () => {
  const text = renderToStaticMarkup(<DemoBanner />)
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ');

  it('says the data is simulated and the wallet money is demo money', () => {
    expect(text).toContain('Menus, prices and wait times are simulated');
    expect(text).toContain('wallet money is demo money');
  });

  it('keeps the existing notes about estimates and the lack of affiliation', () => {
    expect(text).toContain('walk times marked "est." are estimates');
    expect(text).toContain('Not affiliated with HKBU Estates Office or its caterers.');
  });
});
