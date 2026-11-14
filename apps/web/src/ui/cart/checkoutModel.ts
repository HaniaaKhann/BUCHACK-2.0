import { formatHkd } from '../orders/orderViewModel';

export interface WalletLines {
  before: string;
  after: string;
  enough: boolean;
}

export function walletLines(balance: number | null, total: number): WalletLines {
  if (balance === null) return { before: '…', after: '…', enough: true };
  const after = balance - total;
  return {
    before: formatHkd(balance),
    after: after < 0 ? `-${formatHkd(-after)}` : formatHkd(after),
    enough: after >= 0,
  };
}
