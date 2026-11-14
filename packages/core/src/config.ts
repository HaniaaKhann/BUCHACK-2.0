export const MODEL_VERSION = 'v2';

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
export const RANGE_LOW_PREP_FLOOR_RATIO = 0.5;
export const RANGE_LOW_QUANTILE = 0.1;
export const RANGE_HIGH_QUANTILE = 0.9;

export const LATENESS_MIN_SAMPLES = 10;
export const LATENESS_COLD_START_Q50_MINUTES = 0;
export const LATENESS_COLD_START_Q90_MINUTES = 3;

export const BUFFER_MINUTES = 2;

export const SLOT_CAP_FRACTION = 0.5;

export const ORDER_GRACE_SECONDS = 60;
export const FORECAST_SLOTS = 8;

export const RANKING_WEIGHT_GOAL = 0.3;
export const RANKING_WEIGHT_WAIT = 0.3;
export const RANKING_WEIGHT_PRICE = 0.2;
export const RANKING_WEIGHT_PAST_ORDERS = 0.2;
export const RANKING_WAIT_REFERENCE_MINUTES = 30;
export const RANKING_PRICE_REFERENCE_HKD = 100;
export const RANKING_PAST_ORDERS_CAP = 5;

export const FREE_WINDOW_MIN_GAP_MINUTES = 15;
export const SCHEDULE_DAY_START_MINUTE = 8 * 60;
export const SCHEDULE_DAY_END_MINUTE = 22 * 60;

export const ORDER_MAX_QTY_PER_LINE = 5;
export const ORDER_MAX_LINES = 8;
export const ORDER_MAX_TOTAL_HKD = 500;
export const SLOT_CHOICES_SHOWN = 12;
