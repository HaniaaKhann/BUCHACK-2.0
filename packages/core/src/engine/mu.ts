import { MU_BLEND_CONSTANT, MU_FLOOR_PER_MINUTE, MU_PRIOR_PERCENTILE } from '../config.js';
import { median, quantile } from './stats.js';

export interface MuPriorInput {
  vendorSetting: number | null;
  slotTicketRatesPerMinute: readonly number[];
}

export function muPrior(input: MuPriorInput): number {
  if (input.vendorSetting !== null) return input.vendorSetting;
  return quantile(input.slotTicketRatesPerMinute, MU_PRIOR_PERCENTILE);
}

export interface MuBlendInput {
  prior: number;
  readyTapsPerBusyMinute: readonly number[];
}

export function blendMu(input: MuBlendInput): number {
  const busyMinutes = input.readyTapsPerBusyMinute.length;
  if (busyMinutes === 0) return Math.max(MU_FLOOR_PER_MINUTE, input.prior);
  const learned = median(input.readyTapsPerBusyMinute);
  const weight = busyMinutes / (busyMinutes + MU_BLEND_CONSTANT);
  return Math.max(MU_FLOOR_PER_MINUTE, input.prior + weight * (learned - input.prior));
}
