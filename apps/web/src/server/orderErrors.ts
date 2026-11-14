export type OrderErrorCode =
  | 'invalid_request'
  | 'vendor_unavailable'
  | 'vendor_paused'
  | 'vendor_closed'
  | 'item_unavailable'
  | 'total_too_high'
  | 'slot_invalid'
  | 'slot_full'
  | 'insufficient_balance'
  | 'not_found'
  | 'not_cancellable'
  | 'not_ready'
  | 'rate_limited';

export class OrderError extends Error {
  constructor(
    readonly status: 400 | 402 | 404 | 409 | 429,
    readonly code: OrderErrorCode,
    readonly extra: Record<string, number | string | string[]> = {},
  ) {
    super(code);
  }
}
