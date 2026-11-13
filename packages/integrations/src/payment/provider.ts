export type PaymentIntentStatus = 'pending' | 'captured' | 'refunded' | 'failed';

export interface PaymentIntent {
  readonly id: string;
  readonly userId: string;
  readonly amountHkd: number;
  readonly status: PaymentIntentStatus;
  readonly createdAt: Date;
}

export interface PaymentProvider {
  authorize(userId: string, amountHkd: number): Promise<PaymentIntent>;
  capture(intentId: string): Promise<PaymentIntent>;
  refund(intentId: string): Promise<PaymentIntent>;
}
