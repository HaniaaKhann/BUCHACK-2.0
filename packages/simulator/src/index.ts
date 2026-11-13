export const SIMULATOR_PACKAGE = '@app/simulator' as const;

export { FOCUS_OUTLETS, HISTORY_SEED, TRAIN_WEEKS, WEEK_LAYOUT } from './history/config.js';
export { generateHistory } from './history/generate.js';
export type { History, SimOrder, TicketCountRow, VendorHistory } from './history/generate.js';
export { appOrderRows } from './history/export.js';
export type { OrderRow } from './history/export.js';
export type { SimStudent, SimFreeWindow } from './history/students.js';
export { runBacktest } from './backtest/report.js';
export type { AccuracyReport } from './backtest/report.js';
