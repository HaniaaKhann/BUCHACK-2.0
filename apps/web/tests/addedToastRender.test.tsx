import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AddedToast, TOAST_MILLISECONDS } from '../src/ui/cart/AddedToast';

const noop = (): void => undefined;

describe('AddedToast', () => {
  it('stays about three seconds', () => {
    expect(TOAST_MILLISECONDS).toBe(3000);
  });

  it('renders an empty polite live region when there is nothing to say', () => {
    const html = renderToStaticMarkup(<AddedToast toast={null} onView={noop} onDone={noop} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('data-toast');
  });

  it('says what was added and offers the cart inside the live region', () => {
    const html = renderToStaticMarkup(
      <AddedToast
        toast={{ id: 1, text: 'Added to cart: Daily Soup' }}
        onView={noop}
        onDone={noop}
      />,
    );
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Added to cart: Daily Soup');
    expect(html).toContain('View cart');
    expect(html.indexOf('aria-live')).toBeLessThan(html.indexOf('Added to cart'));
  });
});
