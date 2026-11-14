import { describe, expect, it } from 'vitest';
import { walletLines } from '../src/ui/cart/checkoutModel';

describe('walletLines', () => {
  it('shows the balance and what is left after the order', () => {
    expect(walletLines(300, 38)).toEqual({ before: 'HK$300', after: 'HK$262', enough: true });
  });

  it('allows spending the whole balance', () => {
    expect(walletLines(38, 38)).toEqual({ before: 'HK$38', after: 'HK$0', enough: true });
  });

  it('says so when the balance is too low', () => {
    expect(walletLines(10, 38)).toEqual({ before: 'HK$10', after: '-HK$28', enough: false });
  });

  it('shows placeholders until the balance has loaded, without blocking payment', () => {
    expect(walletLines(null, 38)).toEqual({ before: '…', after: '…', enough: true });
  });
});
