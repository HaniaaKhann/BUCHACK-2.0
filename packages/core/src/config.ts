export const MODEL_VERSION = 'v1';

export const SLOT_MINUTES = 15;
export const MS_PER_MINUTE = 60_000;

export const LAMBDA_RECENCY_WEIGHTS: readonly number[] = [0.4, 0.3, 0.2, 0.1];
export const LAMBDA_MIN_MATCHING_WEEKS = 2;
export const LAMBDA_LIVE_WINDOW_MINUTES = 10;

export const BUSY_MULTIPLIER = { quiet: 0.6, normal: 1.0, rush: 1.6 } as const;

export const MU_PRIOR_PERCENTILE = 0.9;
export const MU_BLEND_CONSTANT = 30;
export const MU_FLOOR_PER_MINUTE = 0.05;

export const PREP_MIN_SAMPLES = 5;
export const PREP_MAX_BACKLOG = 1;
export const MULTI_ITEM_EXTRA_MINUTES = 0.5;

export const LABEL_MAX_ACTUAL_MINUTES = 60;
export const LABEL_MAX_PREDICTED_RATIO = 3;
export const LABEL_PICKUP_FALLBACK_WEIGHT = 0.5;
export const BATCH_TAP_WINDOW_SECONDS = 10;
export const BATCH_TAP_MIN_ORDERS = 3;
export const BATCH_TAP_WEIGHT = 0.5;

export const BIAS_EWMA_ALPHA = 0.2;
export const BIAS_BLEND_CONSTANT = 30;

export const RESIDUAL_WINDOW = 200;
export const RESIDUAL_MIN_SAMPLES = 20;
export const COLD_START_RANGE_RATIO = 0.3;
export const RANGE_LOW_QUANTILE = 0.1;
export const RANGE_HIGH_QUANTILE = 0.9;

export const LATENESS_MIN_SAMPLES = 10;
export const LATENESS_COLD_START_Q50_MINUTES = 0;
export const LATENESS_COLD_START_Q90_MINUTES = 3;
