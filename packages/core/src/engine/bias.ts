import { BIAS_BLEND_CONSTANT, BIAS_EWMA_ALPHA } from '../config.js';

export interface BiasUpdateInput {
  previous: number | null;
  error: number;
  weight: number;
}

export function updateBias(input: BiasUpdateInput): number {
  if (input.previous === null) return input.error;
  return input.previous + BIAS_EWMA_ALPHA * input.weight * (input.error - input.previous);
}

export function biasWeight(labelledOrders: number): number {
  return labelledOrders / (labelledOrders + BIAS_BLEND_CONSTANT);
}
