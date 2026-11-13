import { MODEL_VERSION } from '../config.js';
import { biasWeight } from './bias.js';
import { queueDelayMinutes } from './backlog.js';
import { residualRange } from './quantiles.js';

export interface PredictionInput {
  backlog: number;
  muPerMinute: number;
  prep: number;
  bias: number;
  biasSamples: number;
  residuals: readonly number[];
}

export interface Prediction {
  queueDelayMinutes: number;
  prepMinutes: number;
  baseMinutes: number;
  pointMinutes: number;
  lowMinutes: number;
  highMinutes: number;
  modelVersion: string;
}

export function predictWait(input: PredictionInput): Prediction {
  const queueDelay = queueDelayMinutes(input.backlog, input.muPerMinute);
  const base = queueDelay + input.prep;
  const point = Math.max(input.prep, base + biasWeight(input.biasSamples) * input.bias);
  const range = residualRange({ pred: point, prep: input.prep, residuals: input.residuals });
  return {
    queueDelayMinutes: queueDelay,
    prepMinutes: input.prep,
    baseMinutes: base,
    pointMinutes: point,
    lowMinutes: Math.min(range.low, point),
    highMinutes: Math.max(range.high, point),
    modelVersion: MODEL_VERSION,
  };
}
