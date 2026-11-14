export type PaymentIntentStatus = 'captured' | 'refunded' | 'failed';

export interface PaymentIntent {
  readonly id: string;
  readonly userId: string;
  readonly amountHkd: number;
  readonly status: PaymentIntentStatus;
}

export interface PaymentProvider {
  charge(userId: string, amountHkd: number, reference: string): Promise<PaymentIntent>;
  refund(reference: string): Promise<PaymentIntent>;
}
